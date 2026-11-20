# AGENTS.md — test-workflow-web

Rules for every AI coding agent working in this repository (Claude Code, Codex, Cursor, Gemini, Antigravity, …). The full protocol is the Worker Skill: `.agents/skills/worker-task-execution/SKILL.md`. Read it before changing any file.

## Mandatory Skill-First Execution (กฎเหล็ก: บังคับอ่านและใช้ Skill ทุกครั้ง)

ทุกครั้งที่เริ่มรับมอบหมายงาน ไม่ว่าผู้ใช้จะสั่งด้วยคำสั่งสั้น คำสั่งทางการ หรือภาษาธรรมชาติทั่วไป ตัวแทน AI (Claude Code, Cursor, Antigravity, Gemini, Codex, Copilot) **ต้องตรวจสอบว่ามี Skill ที่ตรงกับงานหรือไม่ และต้องเรียกอ่านไฟล์ `SKILL.md` นั้นก่อนเริ่มลงมือเขียนโค้ดหรือรันคำสั่งใดๆ เสมอ ห้ามคิดวิธีทำเองหรือข้ามขั้นตอนเด็ดขาด**:

### ตารางจับคู่ Skill ตามประเภทงาน (Skill Dispatch Table)

| ประเภทงาน / คำสั่ง / บริบท | Skill ที่ต้องเปิดอ่านทันที (Mandatory Path) | กฎสำคัญที่ต้องทำตาม |
|---|---|---|
| **เริ่มงานพัฒนา / ฟีเจอร์ / แก้บั๊ก / Refactor / งานตาม Task Card หรือ TDD**<br>*(เช่น `เริ่มงาน ...`, `ทำ task ...`, `ช่วยแก้บั๊ก ...`, `พัฒนาฟีเจอร์ ...`)* | **1.** `.agents/skills/start-task/SKILL.md`<br>**2.** `.agents/skills/worker-task-execution/SKILL.md` | • ทำ Phase 1 (RED): เขียนเทสต์ให้พังก่อน -> เปิด Draft PR -> **หยุดรอ Dev**<br>• ห้ามเขียน implementation จนกว่า Dev จะสั่งลุยต่อ (Phase 2 GREEN)<br>• แก้เฉพาะไฟล์ใน Owned Paths เท่านั้น |
| **รีวิวโค้ด / รีวิว Pull Request (PR Review)**<br>*(เช่น `รีวิว PR ...`, `ช่วยตรวจโค้ด ...`, `review pull request`)* | `~/.gemini/config/skills/pr-production-review/SKILL.md` | • วางตัวและคอมเมนต์ในตำแหน่ง Tech Lead: ตรวจตาม DEVELOPER_WORKFLOW_GUIDE.md และ 7 มิติสถาปัตยกรรม ชี้จุดเสี่ยง Production พร้อมระบุ Action ชัดเจน<br>• ยิง inline comments และ summary ผ่าน API/CLI<br>• ปรับสถานะ ClickUp: ไม่ผ่าน -> `rework` / ผ่าน -> `ready to merge` ทันที |
| **วางแผนสถาปัตยกรรม / ออกแบบระบบ / แตก Task Cards**<br>*(เช่น `ช่วยวางแผน ...`, `ออกแบบ architecture ...`, `แตกการ์ดงาน ...`)* | `~/.gemini/config/skills/production-architecture-planning/SKILL.md` | • วิเคราะห์ 7 มิติสถาปัตยกรรม<br>• ออกแบบ TDD Matrix (TC-01..N) และ WBS ลง `Implementation/<feature>-spec.md` |
| **รีวิวแผนงานใน ClickUp / Tech Lead Planning Gate**<br>*(เช่น `รีวิวแผน <TASK-ID>`, `/review-plan <TASK-ID>`)* | `~/.gemini/config/skills/clickup-plan-review/SKILL.md` | • ดึงรายละเอียดและสเปกมาตรวจ<br>• คอมเมนต์แท็ก Dev (@mention) พร้อมปรับสถานะเป็น `ready` เมื่อผ่าน |
| **จัดการงาน ClickUp / ค้นหา Task / อัปเดตสถานะ / คอมเมนต์**<br>*(เช่น `/clickup`, `ช่วยดู task ClickUp ...`, `คอมเมนต์ ClickUp ...`)* | `~/.gemini/config/skills/clickup-task-automation/SKILL.md` | • ใช้ Rich AST Block สำหรับแท็กคน (@mention) เพื่อให้เด้ง Notification จริง<br>• ปฏิบัติตาม Guardrails ไม่ข้ามสถานะ |
| **ร่างข้อความคุยในทีม / สั่งงานน้อง / ตอบคำถามทีม (LINE, Slack)**<br>*(เช่น `ช่วยตอบน้อง ...`, `สั่งงาน dev ...`, `ส่งข้อความให้ทีม ...`)* | `~/.gemini/config/skills/natural-team-communication/SKILL.md` | • ใช้โทน Casual + Direct + Friendly ไม่ใช้คำลงท้าย ครับ/ค่ะ หลีกเลี่ยงภาษา AI สำเร็จรูป |

> [!IMPORTANT]
> **Check-in Output Requirement:** เมื่อเริ่มทำงานที่ตรงกับ Skill ใด ให้แสดงบันทึกสั้นๆ ในข้อความบรรทัดแรกว่าได้อ่านและกำลังดำเนินการตาม Skill นั้น (เช่น `[Loaded Skill: worker-task-execution]` หรือ `[Using Skill: start-task]`) เพื่อยืนยันว่า Agent ได้อ่าน Skill แล้วและไม่ทำข้ามขั้นตอน

## Quick Start Command (คำสั่งสั้นสำหรับ Dev)

เมื่อต้องการเริ่มงาน Dev สามารถพิมพ์คำสั่งสั้นใน Chat ได้ทันที รองรับ 2 รูปแบบตามความสะดวก (Flexible Dual-Mode):
- **แบบสั้น (Simplified / แนะนำ):** `เริ่มงาน <CLICKUP-ID>` (เช่น `เริ่มงาน DEV-123`) หรือ `/start-task <CLICKUP-ID>`
- **แบบระบุคู่ (Explicit / รูปแบบเดิม):** `เริ่มงาน <TASK-ID> <CLICKUP-ID>` (เช่น `เริ่มงาน TASK-001 DEV-123`) หรือ `/start-task <TASK-ID> <CLICKUP-ID>`

เมื่อ Agent ได้รับคำสั่งนี้ ให้โหลดและปฏิบัติตาม Universal Start Task Protocol ที่ `.agents/skills/start-task/SKILL.md` (หรือ `.agents/skills/worker-task-execution/SKILL.md`) ทันที


## Existing Project Context & Environment Rules

|---|
| **เริ่มงานพัฒนา / ฟีเจอร์ / แก้บั๊ก / Refactor / งานตาม Task Card หรือ TDD**<br>*(เช่น `เริ่มงาน ...`, `ทำ task ...`, `ช่วยแก้บั๊ก ...`, `พัฒนาฟีเจอร์ ...`)* | **1.** [`.agents/skills/start-task/SKILL.md`](.agents/skills/start-task/SKILL.md)<br>**2.** [`.agents/skills/worker-task-execution/SKILL.md`](.agents/skills/worker-task-execution/SKILL.md) | • ทำ Phase 1 (RED): เขียนเทสต์ให้พังก่อน -> เปิด Draft PR -> **หยุดรอ Dev**<br>• ห้ามเขียน implementation จนกว่า Dev จะสั่งลุยต่อ (Phase 2 GREEN)<br>• แก้เฉพาะไฟล์ใน Owned Paths เท่านั้น |
| **รีวิวโค้ด / รีวิว Pull Request (PR Review)**<br>*(เช่น `รีวิว PR ...`, `ช่วยตรวจโค้ด ...`, `review pull request`)* | [`~/.gemini/config/skills/pr-production-review/SKILL.md`](/Users/boy189/.gemini/config/skills/pr-production-review/SKILL.md) | • วางตัวและคอมเมนต์ในตำแหน่ง Tech Lead: ตรวจตาม DEVELOPER_WORKFLOW_GUIDE.md และ 7 มิติสถาปัตยกรรม ชี้จุดเสี่ยง Production พร้อมระบุ Action ชัดเจน<br>• ยิง inline comments และ summary ผ่าน API/CLI<br>• ปรับสถานะ ClickUp: ไม่ผ่าน -> `rework` / ผ่าน -> `ready to merge` ทันที |
| **วางแผนสถาปัตยกรรม / ออกแบบระบบ / แตก Task Cards**<br>*(เช่น `ช่วยวางแผน ...`, `ออกแบบ architecture ...`, `แตกการ์ดงาน ...`)* | [`~/.gemini/config/skills/production-architecture-planning/SKILL.md`](/Users/boy189/.gemini/config/skills/production-architecture-planning/SKILL.md) | • วิเคราะห์ 7 มิติสถาปัตยกรรม<br>• ออกแบบ TDD Matrix (TC-01..N) และ WBS ลง `Implementation/<feature>-spec.md` |
| **รีวิวแผนงานใน ClickUp / Tech Lead Planning Gate**<br>*(เช่น `รีวิวแผน <TASK-ID>`, `/review-plan <TASK-ID>`)* | [`~/.gemini/config/skills/clickup-plan-review/SKILL.md`](/Users/boy189/.gemini/config/skills/clickup-plan-review/SKILL.md) | • ดึงรายละเอียดและสเปกมาตรวจ<br>• คอมเมนต์แท็ก Dev (@mention) พร้อมปรับสถานะเป็น `ready` เมื่อผ่าน |
| **จัดการงาน ClickUp / ค้นหา Task / อัปเดตสถานะ / คอมเมนต์**<br>*(เช่น `/clickup`, `ช่วยดู task ClickUp ...`, `คอมเมนต์ ClickUp ...`)* | [`~/.gemini/config/skills/clickup-task-automation/SKILL.md`](/Users/boy189/.gemini/config/skills/clickup-task-automation/SKILL.md) | • ใช้ Rich AST Block สำหรับแท็กคน (@mention) เพื่อให้เด้ง Notification จริง<br>• ปฏิบัติตาม Guardrails ไม่ข้ามสถานะ |
| **ร่างข้อความคุยในทีม / สั่งงานน้อง / ตอบคำถามทีม (LINE, Slack)**<br>*(เช่น `ช่วยตอบน้อง ...`, `สั่งงาน dev ...`, `ส่งข้อความให้ทีม ...`)* | [`~/.gemini/config/skills/natural-team-communication/SKILL.md`](/Users/boy189/.gemini/config/skills/natural-team-communication/SKILL.md) | • ใช้โทน Casual + Direct + Friendly ไม่ใช้คำลงท้าย ครับ/ค่ะ หลีกเลี่ยงภาษา AI สำเร็จรูป |

> [!IMPORTANT]
> **Check-in Output Requirement:** เมื่อเริ่มทำงานที่ตรงกับ Skill ใด ให้แสดงบันทึกสั้นๆ ในข้อความบรรทัดแรกว่าได้อ่านและกำลังดำเนินการตาม Skill นั้น (เช่น `[Loaded Skill: worker-task-execution]` หรือ `[Using Skill: start-task]`) เพื่อยืนยันว่า Agent ได้อ่าน Skill แล้วและไม่ทำข้ามขั้นตอน

## Quick Start Command (คำสั่งสั้นสำหรับ Dev)

เมื่อต้องการเริ่มงาน Dev สามารถพิมพ์คำสั่งสั้นใน Chat ได้ทันที รองรับ 2 รูปแบบตามความสะดวก (Flexible Dual-Mode):
- **แบบสั้น (Simplified / แนะนำ):** `เริ่มงาน <CLICKUP-ID>` (เช่น `เริ่มงาน DEV-4346`) หรือ `/start-task <CLICKUP-ID>`
- **แบบระบุคู่ (Explicit / รูปแบบเดิม):** `เริ่มงาน <TASK-ID> <CLICKUP-ID>` (เช่น `เริ่มงาน CONTRACT-PAGE-010 DEV-123`) หรือ `/start-task <TASK-ID> <CLICKUP-ID>`

เมื่อ Agent ได้รับคำสั่งนี้ ให้โหลดและปฏิบัติตาม Universal Start Task Protocol ที่ [`.agents/skills/start-task/SKILL.md`](.agents/skills/start-task/SKILL.md) (หรือ [`.agents/skills/worker-task-execution/SKILL.md`](.agents/skills/worker-task-execution/SKILL.md)) ทันที

## Before you start

You need the task identification from the developer. The developer may provide either:
- **Simplified Mode (1 ID):** `<CLICKUP-ID>` (e.g. `DEV-4346`). Look up the task in ClickUp; if the title contains `[<TASK-ID>]` or references a spec in `Implementation/`, auto-resolve `TASK-ID`. Otherwise, use `<CLICKUP-ID>` as the sole task identifier.
- **Explicit Mode (2 IDs):** `<TASK-ID> <CLICKUP-ID>` (e.g. `CONTRACT-PAGE-010 DEV-123`). First is the Task Card in `Implementation/`, second is the ClickUp Task ID.
Only stop and ask if no valid ID was provided.

## How to work

1. **One card = one branch = one PR.** Never bundle cards.
2. **Branch** from `upstream/develop` (the latest `develop` of `Thairun/fotobots-whitelabel`), named `feat/<CLICKUP-ID>-<short-description>` (or `feat/<TASK-ID>-<CLICKUP-ID>-<short-description>`). Developers work from a fork: `origin` = their fork, `upstream` = `Thairun/fotobots-whitelabel`.
3. **Only edit the card's Owned Paths.** If the work needs any other file, stop and report `CROSS-OWNERSHIP CHANGE REQUIRED` (Skill §5).
4. **Two phases, two prompts.** Phase 1 (RED): write only failing tests, run them, confirm they fail for the business reason (not syntax/import), commit with a `ClickUp-Task: <CLICKUP-ID>` trailer, push to the fork, open a **Draft PR into `develop`** whose body starts with `ClickUp-Task: <CLICKUP-ID>`, then **stop and wait** for the developer. Phase 2 (GREEN & REFACTOR) only after the developer confirms RED.
5. **Verify** before opening a PR: `pnpm lint`, `pnpm typecheck`, `pnpm test` (Node 24, see `.nvmrc`).
6. **PRs go into `develop` only.** Never target, push to, or merge into `develop`, `staging` or `main` yourself. Only the team lead merges, and promotes `develop → staging → main` by hand.
7. **Finish the PR**: title `[<CLICKUP-ID>] <Title>` or `[<TASK-ID>] <Title>`, body from `.github/pull_request_template.md` with `ClickUp-Task: <CLICKUP-ID>` as the first line, then mark it Ready for review (`gh pr ready`) once CI is green.
8. **Return the Task Completion Report** (`.agents/skills/worker-task-execution/templates/completion-report.md`).

## ClickUp

- Up to `testing`, status is changed **only** by the GitHub Action `clickup-status-sync.yml`: Draft PR → `in progress`, Ready for review → `in review`, changes requested → `in progress`, merged into `develop` → `testing`. After that, testers move the card by hand; promotion to `staging`/`main` is updated by the lead. Agents never change status.
- A card sent back from QA is fixed on a new branch/PR with **the same ClickUp ID** (or the tester's Bug subtask ID).
- If a ClickUp MCP server is connected, you may read the assigned task and post comments (RED results, Completion Report). **Never** change a task's status or assignee, and never touch tasks not assigned to the current developer.

## Hard stops (Skill §5)

Stop and report instead of working around:

- `TASK OWNERSHIP INVALID`: no card or ClickUp ID was given, or the task belongs to someone else.
- `CROSS-OWNERSHIP CHANGE REQUIRED`: you need a file outside Owned Paths.
- `CONTRACT CHANGE REQUIRED`: a frozen contract in `packages/contracts/` must change.
- `ARCHITECTURE CONFLICT`: e.g. Delivery Worker touching Neon/Hyperdrive, Admin importing `packages/db`, domain packages importing Drizzle/SQL/Hono, publishing "latest" instead of pinned versions, secrets in CMS content.

## Never

- Use `any` in TypeScript (ESLint blocks it).
- Hardcode credentials, or type resource IDs by hand. Keys are managed in Infisical, outside task scope; read them from env vars / Worker bindings. Resource IDs in `wrangler.jsonc` come only from the OpenTofu snapshot `infra/contracts/wrangler-bindings.<env>.json` via `node scripts/wrangler/sync-bindings.mjs <env>`. Never copy the example Hyperdrive/KV IDs or `-prod` bucket names from the specs.
- Use the planning IDs in `master-parallel-implementation-and-tdd-plan-spec.md` (e.g. `CONTRACT-PAGE-001`). Card IDs in the task-card spec are canonical; see the crosswalk in that plan's §1.3.
- Hardcode CSS hex colors, arbitrary spacing, or ad-hoc styles in UI apps/components. All UI styling must import and consume tokens from `@fotobots/design-system` (see [`docs/DESIGN_SYSTEM_AND_THEME_GUIDE.md`](docs/DESIGN_SYSTEM_AND_THEME_GUIDE.md)).

---

## Before you start

You need the task identification from the developer. The developer may provide either:
- **Simplified Mode (1 ID):** `<CLICKUP-ID>` (e.g. `DEV-123`). Look up the task in ClickUp; if the title contains `[<TASK-ID>]` or references a spec in `Implementation/`, auto-resolve `TASK-ID`. Otherwise, use `<CLICKUP-ID>` as the sole task identifier.
- **Explicit Mode (2 IDs):** `<TASK-ID> <CLICKUP-ID>` (e.g. `TASK-001 DEV-123`). First is the Task Card in `Implementation/`, second is the ClickUp Task ID.
Only stop and ask if no valid ID was provided.

> [!IMPORTANT]
> **Tech Lead Review Gate:** งานต้องผ่านการรีวิวแผนและอนุมัติจาก Tech Lead จนการ์ดอยู่ในสถานะ `ready` ก่อนเท่านั้น หากการ์ดยังอยู่ใน `backlog` ให้ทักถามหรือเตือน Dev ก่อนเริ่มงาน

## How to work

1. **Tech Lead Sign-off First:** ต้องผ่านการรีวิวแผนจาก Tech Lead (สถานะ `ready`) ก่อนเริ่มเขียนโค้ด
2. **One card = one branch = one PR.** Never bundle cards.
2. **Branch** from `upstream/develop` (or latest `develop`), named `feat/<CLICKUP-ID>-<short-description>` (or `feat/<TASK-ID>-<CLICKUP-ID>-<short-description>`). Developers work from a fork: `origin` = their fork, `upstream` = `Thairun/race-photo-requirement-discovery`.
3. **Only edit the card's Owned Paths.** If the work needs any other file, stop and report `CROSS-OWNERSHIP CHANGE REQUIRED`.
4. **Two phases, two prompts.** Phase 1 (RED): write only failing tests, run them, confirm they fail for the business reason (not syntax/import), commit with a `ClickUp-Task: <CLICKUP-ID>` trailer, push to the fork, open a **Draft PR into `develop`** whose body starts with `ClickUp-Task: <CLICKUP-ID>`, then **stop and wait** for the developer. Phase 2 (GREEN & REFACTOR) only after the developer confirms RED.
5. **Verify** before opening a PR: run tests and linter (Verification command: `pnpm test`).
6. **PRs go into `develop` only.** Never target, push to, or merge into `develop`, `staging` or `main` yourself. Only the team lead merges.
7. **Finish the PR**: title `[<CLICKUP-ID>] <Title>` or `[<TASK-ID>] <Title>`, body from `.github/pull_request_template.md` with `ClickUp-Task: <CLICKUP-ID>` as the first line, then mark it Ready for review (`gh pr ready`) once CI is green.
8. **Return the Task Completion Report** (`.agents/skills/worker-task-execution/templates/completion-report.md`).

## ClickUp

- Up to `testing`, status is changed **only** by the GitHub Action `clickup-status-sync.yml`: Draft PR → `in progress`, Ready for review → `in review`, changes requested → `in progress`, merged into `develop` → `testing`. After that, testers move the card by hand; promotion to `staging`/`main` is updated by the lead. Agents never change status.
- A card sent back from QA is fixed on a new branch/PR with **the same ClickUp ID** (or the tester's Bug subtask ID).
- If a ClickUp MCP server is connected, you may read the assigned task and post comments (RED results, Completion Report). **Never** change a task's status or assignee, and never touch tasks not assigned to the current developer.

## Hard stops

Stop and report instead of working around:
- `TASK OWNERSHIP INVALID`: no card or ClickUp ID was given, or the task belongs to someone else.
- `CROSS-OWNERSHIP CHANGE REQUIRED`: you need a file outside Owned Paths.
- `CONTRACT CHANGE REQUIRED`: a frozen contract must change.
- `ARCHITECTURE CONFLICT`: violations of core domain layering or security invariants.

## Never
- Use `any` in TypeScript or unsafe type casts.
- Hardcode credentials or secrets.
- Expand scope beyond the assigned task card.

---

## Before you start

You need the task identification from the developer. The developer may provide either:
- **Simplified Mode (1 ID):** `<CLICKUP-ID>` (e.g. `DEV-123`). Look up the task in ClickUp; if the title contains `[<TASK-ID>]` or references a spec in `Implementation/`, auto-resolve `TASK-ID`. Otherwise, use `<CLICKUP-ID>` as the sole task identifier.
- **Explicit Mode (2 IDs):** `<TASK-ID> <CLICKUP-ID>` (e.g. `TASK-001 DEV-123`). First is the Task Card in `Implementation/`, second is the ClickUp Task ID.
Only stop and ask if no valid ID was provided.

> [!IMPORTANT]
> **Tech Lead Review Gate:** งานต้องผ่านการรีวิวแผนและอนุมัติจาก Tech Lead จนการ์ดอยู่ในสถานะ `ready` ก่อนเท่านั้น หากการ์ดยังอยู่ใน `backlog` ให้ทักถามหรือเตือน Dev ก่อนเริ่มงาน

## How to work

1. **Tech Lead Sign-off First:** ต้องผ่านการรีวิวแผนจาก Tech Lead (สถานะ `ready`) ก่อนเริ่มเขียนโค้ด
2. **One card = one branch = one PR.** Never bundle cards.
2. **Branch** from `upstream/develop` (or latest `develop`), named `feat/<CLICKUP-ID>-<short-description>` (or `feat/<TASK-ID>-<CLICKUP-ID>-<short-description>`). Developers work from a fork: `origin` = their fork, `upstream` = `Thairun/race-photo-requirement-discovery`.
3. **Only edit the card's Owned Paths.** If the work needs any other file, stop and report `CROSS-OWNERSHIP CHANGE REQUIRED`.
4. **Two phases, two prompts.** Phase 1 (RED): write only failing tests, run them, confirm they fail for the business reason (not syntax/import), commit with a `ClickUp-Task: <CLICKUP-ID>` trailer, push to the fork, open a **Draft PR into `develop`** whose body starts with `ClickUp-Task: <CLICKUP-ID>`, then **stop and wait** for the developer. Phase 2 (GREEN & REFACTOR) only after the developer confirms RED.
5. **Verify** before opening a PR: run tests and linter (Verification command: `pnpm test`).
6. **PRs go into `develop` only.** Never target, push to, or merge into `develop`, `staging` or `main` yourself. Only the team lead merges.
7. **Finish the PR**: title `[<CLICKUP-ID>] <Title>` or `[<TASK-ID>] <Title>`, body from `.github/pull_request_template.md` with `ClickUp-Task: <CLICKUP-ID>` as the first line, then mark it Ready for review (`gh pr ready`) once CI is green.
8. **Return the Task Completion Report** (`.agents/skills/worker-task-execution/templates/completion-report.md`).

## ClickUp

- Up to `testing`, status is changed **only** by the GitHub Action `clickup-status-sync.yml`: Draft PR → `in progress`, Ready for review → `in review`, changes requested → `in progress`, merged into `develop` → `testing`. After that, testers move the card by hand; promotion to `staging`/`main` is updated by the lead. Agents never change status.
- A card sent back from QA is fixed on a new branch/PR with **the same ClickUp ID** (or the tester's Bug subtask ID).
- If a ClickUp MCP server is connected, you may read the assigned task and post comments (RED results, Completion Report). **Never** change a task's status or assignee, and never touch tasks not assigned to the current developer.

## Hard stops

Stop and report instead of working around:
- `TASK OWNERSHIP INVALID`: no card or ClickUp ID was given, or the task belongs to someone else.
- `CROSS-OWNERSHIP CHANGE REQUIRED`: you need a file outside Owned Paths.
- `CONTRACT CHANGE REQUIRED`: a frozen contract must change.
- `ARCHITECTURE CONFLICT`: violations of core domain layering or security invariants.

## Never
- Use `any` in TypeScript or unsafe type casts.
- Hardcode credentials or secrets.
- Expand scope beyond the assigned task card.

---

## Before you start

You need the task identification from the developer. The developer may provide either:
- **Simplified Mode (1 ID):** `<CLICKUP-ID>` (e.g. `DEV-123`). Look up the task in ClickUp; if the title contains `[<TASK-ID>]` or references a spec in `Implementation/`, auto-resolve `TASK-ID`. Otherwise, use `<CLICKUP-ID>` as the sole task identifier.
- **Explicit Mode (2 IDs):** `<TASK-ID> <CLICKUP-ID>` (e.g. `TASK-001 DEV-123`). First is the Task Card in `Implementation/`, second is the ClickUp Task ID.
Only stop and ask if no valid ID was provided.

> [!IMPORTANT]
> **Tech Lead Review Gate:** งานต้องผ่านการรีวิวแผนและอนุมัติจาก Tech Lead จนการ์ดอยู่ในสถานะ `ready` ก่อนเท่านั้น หากการ์ดยังอยู่ใน `backlog` ให้ทักถามหรือเตือน Dev ก่อนเริ่มงาน

## How to work

1. **Tech Lead Sign-off First:** ต้องผ่านการรีวิวแผนจาก Tech Lead (สถานะ `ready`) ก่อนเริ่มเขียนโค้ด
2. **One card = one branch = one PR.** Never bundle cards.
2. **Branch** from `upstream/develop` (or latest `develop`), named `feat/<CLICKUP-ID>-<short-description>` (or `feat/<TASK-ID>-<CLICKUP-ID>-<short-description>`). Developers work from a fork: `origin` = their fork, `upstream` = `Thairun/race-photo-requirement-discovery`.
3. **Only edit the card's Owned Paths.** If the work needs any other file, stop and report `CROSS-OWNERSHIP CHANGE REQUIRED`.
4. **Two phases, two prompts.** Phase 1 (RED): write only failing tests, run them, confirm they fail for the business reason (not syntax/import), commit with a `ClickUp-Task: <CLICKUP-ID>` trailer, push to the fork, open a **Draft PR into `develop`** whose body starts with `ClickUp-Task: <CLICKUP-ID>`, then **stop and wait** for the developer. Phase 2 (GREEN & REFACTOR) only after the developer confirms RED.
5. **Verify** before opening a PR: run tests and linter (Verification command: `pnpm test`).
6. **PRs go into `develop` only.** Never target, push to, or merge into `develop`, `staging` or `main` yourself. Only the team lead merges.
7. **Finish the PR**: title `[<CLICKUP-ID>] <Title>` or `[<TASK-ID>] <Title>`, body from `.github/pull_request_template.md` with `ClickUp-Task: <CLICKUP-ID>` as the first line, then mark it Ready for review (`gh pr ready`) once CI is green.
8. **Return the Task Completion Report** (`.agents/skills/worker-task-execution/templates/completion-report.md`).

## ClickUp

- Up to `testing`, status is changed **only** by the GitHub Action `clickup-status-sync.yml`: Draft PR → `in progress`, Ready for review → `in review`, changes requested → `in progress`, merged into `develop` → `testing`. After that, testers move the card by hand; promotion to `staging`/`main` is updated by the lead. Agents never change status.
- A card sent back from QA is fixed on a new branch/PR with **the same ClickUp ID** (or the tester's Bug subtask ID).
- If a ClickUp MCP server is connected, you may read the assigned task and post comments (RED results, Completion Report). **Never** change a task's status or assignee, and never touch tasks not assigned to the current developer.

## Hard stops

Stop and report instead of working around:
- `TASK OWNERSHIP INVALID`: no card or ClickUp ID was given, or the task belongs to someone else.
- `CROSS-OWNERSHIP CHANGE REQUIRED`: you need a file outside Owned Paths.
- `CONTRACT CHANGE REQUIRED`: a frozen contract must change.
- `ARCHITECTURE CONFLICT`: violations of core domain layering or security invariants.

## Never
- Use `any` in TypeScript or unsafe type casts.
- Hardcode credentials or secrets.
- Expand scope beyond the assigned task card.
