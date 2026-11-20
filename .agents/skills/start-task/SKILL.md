---
name: start-task
description: Universal Developer Start Task protocol for human developers and AI coding agents (Claude Code, Gemini/Antigravity, Cursor, Codex, Copilot). Invoked when the developer types "เริ่มงาน <TASK-ID> <CLICKUP-ID>", "/start-task <TASK-ID> <CLICKUP-ID>", or "start task <TASK-ID> <CLICKUP-ID>".
---

# Universal Developer Start Task Protocol

This skill is the central repository standard for initiating any Task Card in `Fotobots Whitelabel`.

Developers using Claude Code, Gemini / Antigravity, Cursor / Codex, or GitHub Copilot do not need to paste the 22-step prompt manually. Typing the short command below immediately triggers this authoritative protocol.

---

## ⚡ Quick Trigger Command (คำสั่งสั้น)

รองรับ 2 รูปแบบตามความสะดวก (Flexible Dual-Mode):

### รูปแบบที่ 1: แบบสั้น (Simplified Mode - ClickUp-First / แนะนำ)
```text
เริ่มงาน <CLICKUP-ID>
```
หรือ `/start-task <CLICKUP-ID>` / `start task <CLICKUP-ID>`
*(ตัวอย่าง: `เริ่มงาน DEV-123`)*

- **Binding Rule:**
  - `CLICKUP-ID`: รหัสงาน ClickUp (เช่น `DEV-123`)
  - `TASK-ID`: 
    - Agent จะตรวจดูข้อมูลการ์ดใน ClickUp หากในชื่อการ์ดมีแท็ก `[<TASK-ID>]` (เช่น `[AUTH-010] Verify OTP`) หรือใน description มีระบุไฟล์สเปกใน `Implementation/` ให้ auto-resolve ผูก `TASK-ID = AUTH-010` ให้อัตโนมัติ
    - หากเป็นการ์ดงานทั่วไป (Bug, Refactor, Tech Debt) ที่ไม่มีไฟล์สเปกแยก ให้ผูก `TASK-ID = <CLICKUP-ID>` ทันที
  - `DEV_OR_AGENT_ID`: Developer หรือ AI agent ผู้รับผิดชอบ

### รูปแบบที่ 2: แบบระบุคู่ (Explicit Mode - Spec-First / รูปแบบเดิม)
```text
เริ่มงาน <TASK-ID> <CLICKUP-ID>
```
หรือ `/start-task <TASK-ID> <CLICKUP-ID>` / `start task <TASK-ID> <CLICKUP-ID>`
*(ตัวอย่าง: `เริ่มงาน TASK-001 DEV-123`)*

- **Binding Rule:**
  - `TASK-ID`: รหัสการ์ดสเปก (เช่น `TASK-001`)
  - `CLICKUP-ID`: รหัสงาน ClickUp (เช่น `DEV-123`)
  - `DEV_OR_AGENT_ID`: Developer หรือ AI agent ผู้รับผิดชอบ

> [!NOTE]
> Agent จะหยุดถามเฉพาะกรณีที่ผู้ใช้ไม่ได้ระบุ ID ใดๆ เลย หรือ ID ที่ระบุไม่ตรงกับรูปแบบรหัสงานที่ถูกต้อง หากระบุมาเพียง 1 ID ให้ถือว่าเป็น `<CLICKUP-ID>` และเริ่มงานตามรูปแบบที่ 1 ทันที

---

## The 22-Step Execution Protocol

```
Step 1: Read Project Instructions
Step 2: Verify Task Readiness
Step 3: Verify Repository State & Create Branch
Step 4: Respect Scope (Owned Paths)
Step 5: Define Integration Interface
Step 6: Enforce Frozen Contract Rule
Step 7: Enforce Cross-Ownership Rule
Step 8: Enforce Architecture Invariants
Step 9: Plan Only This Task (Concise Execution Plan)
Step 10: Follow Strict TDD (RED -> GREEN -> REFACTOR)
Step 11: Execute Phase 1 (RED) & Open Draft PR (STOP & WAIT)
Step 12: Implement Minimum Required Scope
Step 13: Report Discovered Work (Do Not Expand Scope)
Step 14: Own Developer Testing
Step 15: Enforce Security & Secrets Safety
Step 16: Implement Observability Context
Step 17: Verify Integration Contract & Canonical Fixtures
Step 18: Final Verification (Lint, Typecheck, Test: `pnpm test`)
Step 19: Inspect Git Scope
Step 20: Finalize Pull Request ([<CLICKUP-ID>] หรือ [<TASK-ID>] <Title>)
Step 21: Stop & Do Not Start Another Task
Step 22: Deliver Task Completion Report
```

### Step 1: Read Project Instructions
Before making any changes, read and understand:
1. `AGENTS.md` and repository architectural documentation / specs.
2. The specific task card or issue for `<TASK-ID>`.

### Step 2: Verify Task Readiness
Confirm that all blocking dependencies are satisfied and Definition of Ready is met (status `ready` approved by Tech Lead).

### Step 3: Verify Repository State & Create Branch
1. Inspect git state:
   ```bash
   git status
   git branch --show-current
   git log -1 --oneline
   ```
2. Developers work from a fork:
   - `origin` = developer fork
   - `upstream` = `Thairun/race-photo-requirement-discovery`
3. Branch from the latest `upstream/develop` (or local up-to-date `develop`):
   ```bash
   git checkout develop
   git pull upstream develop
   # แบบ Simplified (1 ID):
   git checkout -b feat/<CLICKUP-ID>-<short-description>
   # หรือแบบ Explicit (2 IDs):
   git checkout -b feat/<TASK-ID>-<CLICKUP-ID>-<short-description>
   ```

### Step 4: Respect Scope
- **Owned Paths**: The ONLY files you may create or edit.
- **Read-Only Dependencies**: Files you may inspect but NEVER modify.
- **Must Not Modify**: Prohibited files.

### Step 10 & 11: Strict TDD Phase 1 (RED) & Open Draft PR (STOP & WAIT)
1. Write ONLY failing test cases reproducing business failure reasons.
2. Run `pnpm test` to verify failure.
3. Commit with `ClickUp-Task: <CLICKUP-ID>` trailer.
4. Push branch to fork and open a **Draft PR** targeting `develop`.
5. **STOP & WAIT** for developer review.

### Step 12 to 22: Phase 2 (GREEN & REFACTOR) & Final Report
1. Implement minimal required code in Owned Paths.
2. Run verification: `pnpm test`.
3. Commit with `ClickUp-Task: <CLICKUP-ID>` trailer.
4. Push branch to fork: `git push origin <branch-name>`
5. PR title: `[<CLICKUP-ID>] <Title>` หรือ `[<TASK-ID>] <Title>`
6. Mark PR Ready for review (`gh pr ready`).
7. Output completion report from `.agents/skills/worker-task-execution/templates/completion-report.md`.
