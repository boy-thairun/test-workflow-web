import { expect, test, type Page } from '@playwright/test';
import fixtures from '@test-workflow/virtual-room-contracts/fixtures/rest' with { type: 'json' };

test.beforeEach(async ({ page }) => {
  let signedIn = false;
  await page.route('**/api/v1/auth/*', async route => {
    const request = route.request();
    const endpoint = new URL(request.url()).pathname.split('/').pop();
    if (endpoint === 'login') {
      const input = request.postDataJSON();
      signedIn = input.email === fixtures.loginRequest.email && input.password === fixtures.loginRequest.password;
      await route.fulfill(signedIn ? { json: fixtures.loginSuccess } : { status: 401, json: fixtures.invalidCredentials });
    } else if (endpoint === 'me') {
      await route.fulfill(signedIn ? { json: fixtures.loginSuccess } : { status: 401, json: fixtures.expiredSession });
    } else if (endpoint === 'logout') {
      signedIn = false;
      await route.fulfill({ status: 204 });
    } else {
      await route.abort();
    }
  });
});

async function login(page: Page, password = fixtures.loginRequest.password) {
  await page.getByLabel('อีเมล').fill(fixtures.loginRequest.email);
  await page.getByLabel('รหัสผ่าน').fill(password);
  await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
}

test('login enters the room and refresh retains the session', async ({ page }) => {
  await page.goto('/');
  await login(page);
  await expect(page).toHaveURL(/\/room$/);
  await expect(page.getByRole('heading', { name: 'ห้องสาธารณะ' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'ห้องสาธารณะ' })).toBeVisible();
});

test('an unauthenticated direct link shows the login and invalid credentials are reported', async ({ page }) => {
  await page.goto('/room');
  await expect(page.getByRole('heading', { name: 'เข้าสู่ห้อง' })).toBeVisible();
  await login(page, 'incorrect');
  await expect(page.getByRole('alert')).toHaveText('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
});

test('logout clears room access', async ({ page }) => {
  await page.goto('/');
  await login(page);
  await page.getByRole('button', { name: 'ออกจากระบบ' }).click();
  await page.goto('/room');
  await expect(page.getByRole('heading', { name: 'เข้าสู่ห้อง' })).toBeVisible();
});
