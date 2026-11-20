---
name: clickup-task-automation
description: >-
  Automates ClickUp task operations via REST API v2. Trigger when the user runs
  `/clickup_helper`, `/clickup`, or asks to interact with ClickUp tasks, search tasks
  by Custom ID (e.g. DEV-xxxx), fetch task details, or post comments with rich
  @mentions (type: 'tag') to trigger real notifications across ThaiRun projects.
---

# ClickUp Task Automation & Rich @Mention Protocol

คู่มือและเครื่องมือสำหรับการจัดการงานบน **ClickUp API v2** ประจำองค์กร **ThaiRun** เพื่อให้ AI Coding Agents และ Developers สามารถค้นหางาน, ตรวจสอบสถานะ, และคอมเมนต์ตอบกลับพร้อม **@Mention แท็กเพื่อนร่วมทีมให้เด้งแจ้งเตือนจริง 100%** ในทุกโปรเจกต์

---

## 1. คำสั่งสั้นใน Chat (Quick Slash Commands)

เมื่อต้องการจัดการงานใน ClickUp สามารถพิมพ์ใน Chat ของ Antigravity/IDE ได้ทันที:

- `/clickup_helper comment <TASK-ID> "<MESSAGE>"` หรือ `/clickup comment <TASK-ID> "<MESSAGE>"`
- `/clickup_helper set-status <TASK-ID> <STATUS>` หรือ `/clickup set-status <TASK-ID> <STATUS>`
- `/clickup_helper task <TASK-ID>` หรือ `/clickup task <TASK-ID>`
- `/clickup_helper comments <TASK-ID>`
- `/clickup_helper members`
- `/review-plan <TASK-ID>` หรือ `รีวิวแผน <TASK-ID>` (โหลดสกิล `clickup-plan-review` เพื่อรีวิวแผนงานและคอมเมนต์แท็ก dev)

> **สำหรับ AI Agent:** เมื่อพบคำสั่งที่ขึ้นต้นด้วย `/clickup_helper` หรือ `/clickup` ให้รันคำสั่ง `clickup_helper` (หรือ `node ~/.gemini/config/skills/clickup-task-automation/scripts/clickup_helper.js`) ตามพารามิเตอร์ที่ผู้ใช้ระบุทันทีโดยไม่ต้องถามซ้ำ

---

## 2. คำสั่ง CLI ใน Terminal (เข้าถึงได้ทุกที่)

ระบบได้ทำ Symlink เข้า `$PATH` (`~/.local/bin/`) ไว้เรียบร้อยแล้ว สามารถเปิด Terminal ในโฟลเดอร์ไหนก็ได้แล้วพิมพ์:
```bash
# คอมเมนต์พร้อมแท็ก
clickup comment DEV-5252 "@jet-thairun แผนงานผ่านแล้ว ลุยต่อได้เลย"

# ดูข้อมูลการ์ด
clickup task DEV-5252
```

---

## 3. จุดสำคัญที่สุด: กฎเหล็กการ @Mention ให้เกิด Notification จริง

> [!CAUTION]
> **ห้ามส่ง `@username` เป็น Plain Text String เด็ดขาด!**
> หากยิง API ด้วย `{"comment_text": "@jet-thairun ..."}` ClickUp จะบันทึกเป็นข้อความธรรมดา (ตัวหนังสือสีดำ) **จะไม่แปลงเป็นกล่องแท็กสีฟ้า และจะไม่ยิง Mention Notification หาผู้ใช้คนนั้น**

### โครงสร้าง Rich Mention & Code Block AST (ClickUp Format)
ClickUp ใช้ Quill Delta Engine สำหรับคอมเมนต์:
- **Mention บุคคล**: ส่ง object `{ "type": "tag", "user": { "id": ... } }`
- **Code Block (หลายบรรทัด)**: ClickUp **ไม่แปลง Markdown ```` ``` ```` ใน API comments ให้เอง** หากส่งเป็นข้อความธรรมดา จะหลุดเป็น inline code สีชมพูทีละบรรทัด ต้องส่งเป็น AST block ที่มี `attributes: { "code-block": "javascript" }` (หรือ `true`):

```json
{
  "comment": [
    {
      "type": "tag",
      "user": {
        "id": 306672701,
        "username": "jet-thairun",
        "email": "jet@thai.run",
        "initials": "J",
        "profilePicture": null
      },
      "text": "@jet-thairun"
    },
    {
      "text": " โค้ดตัวอย่างสำหรับแก้จุดนี้:\n"
    },
    {
      "text": "const total = balance - amount;\nconsole.log(total);\n",
      "attributes": {
        "code-block": "javascript"
      }
    }
  ],
  "notify_all": true
}
```

> [!TIP]
> สคริปต์ `clickup_helper.js` (`postComment` / `buildCommentBlocks`) ได้ใส่ parser รองรับทั้ง `@username` และ Markdown code blocks ```` ```lang ... ``` ```` ให้อัตโนมัติแล้ว เมื่อส่งข้อความที่มี fenced code block เข้ามา สคริปต์จะแปลงเป็นบล็อก `code-block` ให้อัตโนมัติทันที

---

## 2. เครื่องมือสำเร็จรูปประจำเครื่อง (Bundled CLI Script)

ระบบมีสคริปต์อัตโนมัติที่ช่วยค้นหาสมาชิก และแปลง `@username` ในข้อความให้กลายเป็น Mention Block ให้อัตโนมัติ:

**Path ของสคริปต์:**
`~/.gemini/config/skills/clickup-task-automation/scripts/clickup_helper.js`

### คำสั่งที่ใช้งานได้ทันที:

#### 1. ค้นหาข้อมูล Task (รองรับทั้ง Custom ID เช่น `DEV-5252` และ Task ID ภายใน):
```bash
node ~/.gemini/config/skills/clickup-task-automation/scripts/clickup_helper.js task DEV-5252
```

#### 2. ปรับสถานะ Task (เช่น `ready`, `rework`, `ready to merge`, `in review`):
```bash
node ~/.gemini/config/skills/clickup-task-automation/scripts/clickup_helper.js set-status DEV-5252 "ready to merge"
```

#### 3. โพสต์คอมเมนต์พร้อม @Mention (แปลงแท็กและแจ้งเตือนอัตโนมัติ):
```bash
node ~/.gemini/config/skills/clickup-task-automation/scripts/clickup_helper.js comment DEV-5252 "@jet-thairun แผนงานผ่านแล้ว ลุยต่อได้เลย"
```
*(หากในข้อความมี `@jet-thairun`, `@boy-thairun` หรือชื่อสมาชิกคนอื่นๆ สคริปต์จะค้นหา User ID ในองค์กรและแปลงเป็นบล็อกแท็กสีฟ้าให้ทันที)*

#### 4. ดูรายชื่อสมาชิกในทีม (พร้อม User ID & Username):
```bash
node ~/.gemini/config/skills/clickup-task-automation/scripts/clickup_helper.js members
```

#### 5. ดึงรายการคอมเมนต์ใน Task:
```bash
node ~/.gemini/config/skills/clickup-task-automation/scripts/clickup_helper.js comments DEV-5252
```

#### 6. แก้ไขหรือลบคอมเมนต์:
```bash
node ~/.gemini/config/skills/clickup-task-automation/scripts/clickup_helper.js update-comment <COMMENT_ID> "@jet-thairun ข้อความที่แก้ไข"
node ~/.gemini/config/skills/clickup-task-automation/scripts/clickup_helper.js delete-comment <COMMENT_ID>
```

---

## 3. ข้อมูล Configuration ของ ThaiRun ClickUp Workspace

- **Workspace / Team ID:** `90182419955` (ThaiRun)
- **API Base URL:** `https://api.clickup.com/api/v2`
- **Default API Token:** เก็บใน Environment `CLICKUP_API_TOKEN` (หรือใช้ fallback token ประจำเครื่อง: `pk_306696764_L83SBHFNUMR5EXCABM3801M8CV4W3U0B`)

### รายชื่อและ User ID ของทีมหลัก:
| ชื่อใน ClickUp | User ID | Email |
|---|---|---|
| `boy-thairun` (Lead) | `306696764` | `boy@thai.run` |
| `jet-thairun` | `306672701` | `jet@thai.run` |
| `peach-thairun` | `107691071` | `peach@thai.run` |
| `palm-thairun` | `107639678` | `palm@thai.run` |
| `nutdev-thairun` | `107639676` | `nutdev@thai.run` |
| `lhong-thairun` | `312789672` | `lhong@thai.run` |
| `First-thairun` | `107639675` | `first@thai.run` |
| `tdevthairun` / `t-thairun` | `107639673` / `306688039` | `tdev@thai.run` / `t@thai.run` |
| `Bie-thairun` | `90642228` | `bie@thai.run` |
| `Kitti Sintuprasert` (dang) | `306696737` | `dang@thai.run` |

---

## 4. ตัวอย่างการเรียกใช้งานผ่าน Code (Node.js ESM)

```javascript
import { postComment, getTask } from "/Users/boy189/.gemini/config/skills/clickup-task-automation/scripts/clickup_helper.js";

// ดึงข้อมูล Task
const task = await getTask("DEV-5252");
console.log(task.name, task.status.status);

// ส่งคอมเมนต์พร้อมแท็ก
await postComment("DEV-5252", "@jet-thairun อนุมัติแผนงานเรียบร้อยแล้วครับ");
```
