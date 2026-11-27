import { AuthError, createAuthClient, type User } from '../auth/client.ts';
import room from '@test-workflow/virtual-room-contracts/room' with { type: 'json' };
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app')!;
const auth = createAuthClient();

function setPage(path: string) {
  if (location.pathname !== path) history.replaceState(null, '', path);
}

function drawMap(grid: HTMLElement) {
  grid.style.setProperty('--columns', String(room.width));
  grid.style.setProperty('--rows', String(room.height));
  const obstacles = new Set(room.obstacles.map(({ x, y }) => x + ',' + y));
  for (let y = 0; y < room.height; y++) {
    for (let x = 0; x < room.width; x++) {
      const cell = document.createElement('span');
      cell.className = 'tile';
      if (obstacles.has(x + ',' + y)) cell.classList.add('tile--obstacle');
      if (x === room.spawn.x && y === room.spawn.y) cell.classList.add('tile--spawn');
      grid.append(cell);
    }
  }
}

function showLogin(initialError = '') {
  setPage('/');
  app.innerHTML = '<main class="login">'
    + '<section class="login-panel"><p class="brand"><span class="brand-mark" aria-hidden="true"></span>Virtual Room</p>'
    + '<div class="login-body"><h1>เข้าสู่ห้อง</h1><p class="muted">ใช้บัญชีทดลองจากหน้าต่าง Terminal ของ API</p>'
    + '<form class="login-form"><label for="email">อีเมล</label><input id="email" name="email" type="email" autocomplete="username" required>'
    + '<label for="password">รหัสผ่าน</label><input id="password" name="password" type="password" autocomplete="current-password" required>'
    + '<p class="feedback" role="alert" hidden></p><button type="submit">เข้าสู่ระบบ <span aria-hidden="true">→</span></button></form>'
    + '</div></section><div class="showcase" aria-hidden="true"><div class="showcase-map"><div class="map"></div></div></div></main>';
  const form = app.querySelector('form')!;
  const feedback = app.querySelector<HTMLElement>('.feedback')!;
  const submit = app.querySelector<HTMLButtonElement>('button')!;
  const setFeedback = (message: string) => {
    feedback.textContent = message;
    feedback.hidden = !message;
  };
  drawMap(app.querySelector('.map')!);
  setFeedback(initialError);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submit.disabled) return;
    const data = new FormData(form);
    submit.disabled = true;
    setFeedback('');
    try {
      showRoom(await auth.login(String(data.get('email')), String(data.get('password'))));
    } catch (error) {
      setFeedback(error instanceof AuthError && error.code === 'INVALID_CREDENTIALS'
        ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
        : 'เข้าสู่ระบบไม่ได้ กรุณาตรวจว่า API เปิดอยู่แล้วลองอีกครั้ง');
    } finally {
      submit.disabled = false;
    }
  });
}

function showRoom(user: User) {
  setPage('/room');
  app.innerHTML = '<header class="room-header"><p class="brand"><span class="brand-mark" aria-hidden="true"></span>Virtual Room</p>'
    + '<div class="account"><span class="account-name"></span><button class="secondary" type="button">ออกจากระบบ</button></div></header>'
    + '<main class="room"><div class="room-title"><h1>ห้องสาธารณะ</h1><p class="muted">จุดสีเขียวคือตำแหน่งเริ่มต้น</p></div>'
    + '<div class="room-map"><div class="map" role="img" aria-label="แผนที่ห้องสาธารณะ"></div></div>'
    + '<p class="feedback" role="alert" hidden></p></main>';
  app.querySelector('.account-name')!.textContent = user.displayName;
  drawMap(app.querySelector('.map')!);
  const logout = app.querySelector<HTMLButtonElement>('.account button')!;
  logout.addEventListener('click', async () => {
    logout.disabled = true;
    try {
      await auth.logout();
      showLogin();
    } catch {
      const feedback = app.querySelector<HTMLElement>('.feedback')!;
      feedback.textContent = 'ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง';
      feedback.hidden = false;
      logout.disabled = false;
    }
  });
}

app.innerHTML = '<main class="loading" role="status">กำลังตรวจสอบเซสชัน…</main>';
try {
  const user = await auth.current();
  if (user) showRoom(user);
  else showLogin();
} catch {
  showLogin('ติดต่อ API ไม่ได้ กรุณาตรวจว่า API เปิดอยู่');
}
