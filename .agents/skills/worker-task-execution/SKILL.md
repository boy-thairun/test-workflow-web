---
name: worker-task-execution
description: >-
  Protocol and execution guidelines for human developers and AI coding agents
  implementing assigned Task Cards in the Fotobots Whitelabel repository.
  Enforces Contract-First development, strict TDD (RED -> GREEN -> REFACTOR),
  path boundary isolation (Owned Paths vs Must Not Modify), stop conditions,
  and formal PR and Task Completion reporting.
---

# Developer / Worker Agent Execution Protocol

This skill provides the authoritative protocol for implementing assigned engineering Task Cards in the **Fotobots Whitelabel / Component-Based Visual CMS Platform**.

Every human developer or AI Worker Agent executing tasks in this codebase **MUST** strictly follow this protocol.

---

## 1. Governing Architecture References

Before making any code changes, read and understand the governing specifications:

1. **System Architecture Specification:**
   [`Implementation/system-architecture-fixed-technology-stack-and-implementation-spec.md`](../../Implementation/system-architecture-fixed-technology-stack-and-implementation-spec.md)
   - Architecture Invariants (Pure Domain, Decoupled Delivery, Clean Layering)
   - Approved Technology Baseline (Workers Static Assets, Hono RPC, Drizzle ORM, Neon Hyperdrive, R2)
   - 28 Architecture Decision Records (ADR-01 to ADR-28)
2. **Master Implementation & Parallel TDD Plan:**
   [`Implementation/master-parallel-implementation-and-tdd-plan-spec.md`](../../Implementation/master-parallel-implementation-and-tdd-plan-spec.md)
   - Workstream Ownership (WS-A through WS-H)
   - Test Pyramid & Integration Gates
3. **Master Task Decomposition & Work Card System:**
   [`Implementation/master-task-decomposition-and-execution-card-system-spec.md`](../../Implementation/master-task-decomposition-and-execution-card-system-spec.md)
   - Task Card definitions, dependencies, and Definition of Ready/Done

### 1.1 Key Guardrails & Invariants

> [!CAUTION]
> 1. **Zero-DB Invariant on Delivery Worker:** Ensure all work under WS-F (`apps/delivery/**`) reads ONLY from Cloudflare KV and R2. NEVER bind or connect to Neon / PostgreSQL / Hyperdrive. Public storefronts must stay 100% operational even if the authoring database is completely offline.
> 2. **Never Use `any` in TypeScript:** Strict mode is enforced 100% from root configs. If `any` is introduced, CI typecheck scripts will immediately block merging.
> 3. **One Card = One PR:** Never bundle multiple cards into a single PR. Every card must be merged and verified independently to protect the critical path.
> 4. **Design System & Theme Tokens:** UI components, pages, or styling across any app or worker must consume tokens from `@fotobots/design-system` (see [`docs/DESIGN_SYSTEM_AND_THEME_GUIDE.md`](../../docs/DESIGN_SYSTEM_AND_THEME_GUIDE.md)). Hardcoded hex colors, arbitrary spacing, or non-tokenized styling are strictly forbidden.


---

## 2. Assignment Verification (Single Dispatcher Rule)

You are assigned **exactly ONE** Task Card by the Project Execution Coordinator.

```text
Task ID: <TASK-ID>
ClickUp Task: <CLICKUP-ID>
Status: IN_PROGRESS
Owner: <YOUR_DEV_OR_AGENT_ID>
Assigned Branch: <ASSIGNED_BRANCH>
```

In this team, assignment happens in **ClickUp** during sprint planning. The developer then gives the agent two IDs: the **Task Card ID** (e.g. `CONTRACT-PAGE-010`, defines the work) and the **ClickUp task ID** (e.g. `DEV-123`, tracks who and status). If either ID is missing, ask for it before starting.

> [!CAUTION]
> **Do NOT Self-Select Tasks:** Workers must NOT pick arbitrary tasks from the READY queue.
> If the Task is not explicitly assigned to you or is owned by another developer/agent, **STOP** and report `TASK OWNERSHIP INVALID`.

---

## 3. Git Branch & Worktree Discipline

Every Task has exactly:

$$\textbf{1 Task Card } = \textbf{ 1 Branch } = \textbf{ 1 Pull Request}$$

### Branch Naming Standards:
- Features: `feat/<TASK-ID>-<CLICKUP-ID>-<short-description>` (e.g. `feat/DATA-PAGE-020-DEV-123-create-pages`)
- Bug Fixes: `fix/<TASK-ID>-<CLICKUP-ID>-<short-description>`
- Chores/Infra: `chore/<TASK-ID>-<CLICKUP-ID>-<short-description>` (e.g. `chore/PLAT-WRANGLER-003-DEV-124-worker-skeletons`)

The ClickUp ID in the branch name is what lets the ClickUp status sync find the task on every push (see §10). The Task Card ID alone is not enough: the sync would misread `CONTRACT-PAGE-010` as a ClickUp task called `PAGE-010`.

### Branch Flow: Fork → `develop` → (lead) `staging` → `main`
```text
your fork: feat/<TASK-ID>-<CLICKUP-ID>-…  ──PR──►  Thairun/develop  ──(lead, by hand)──►  staging  ──►  main (prod)
```
- Developers have **read** access to `Thairun/fotobots-whitelabel` and work from a **fork**. Branch from the latest `develop` of `Thairun/fotobots-whitelabel` (`upstream/develop`), push to your fork (`origin`), and open the PR into **`develop`** — never into `staging` or `main`.
- **Only the team lead merges.** Promotion `develop → staging → main` is done by hand by the lead and is not part of any card.
- Pushes to a fork do not reach `Thairun/fotobots-whitelabel`, so ClickUp cannot see them. Open a **Draft PR** at the end of the RED phase instead (§6.1); that is what moves the task to `in progress`.
- Check remotes with `git remote -v`: `origin` = your fork, `upstream` = `Thairun/fotobots-whitelabel` (Developer Guide §2.2).

### Sync Commands Before Editing:
```bash
git fetch --all
git status
git branch --show-current
git log -1 --oneline
```
*Never implement directly on `develop`, `staging` or `main`, and never push to them.*

---

## 4. Path Boundary Isolation

Every Task Card strictly defines:
- **`Owned Paths`:** The ONLY files you are authorized to create or modify.
- **`Read-Only Dependencies`:** Files you may inspect to understand types/contracts.
- **`Must Not Modify`:** Prohibited files. Never touch these files during this task.

---

## 5. Hard Stop Conditions (Fail Fast)

If you encounter any of the following conditions during implementation, **STOP IMMEDIATELY** and output the corresponding report. Do NOT attempt a local workaround:

### 5.1 `CROSS-OWNERSHIP CHANGE REQUIRED`
Trigger: The task cannot be completed without modifying files owned by another Workstream.
```text
CROSS-OWNERSHIP CHANGE REQUIRED
Task: <TASK-ID>
Required Path: <path>
Owning Workstream: <Workstream ID>
Reason: <why current task cannot proceed without this change>
Suggested Dependency Task: <new task proposal>
```

### 5.2 `CONTRACT CHANGE REQUIRED`
Trigger: A frozen contract in `packages/contracts/` needs to be modified.
```text
CONTRACT CHANGE REQUIRED
Task ID: <TASK-ID>
Current Contract: <contract-name>
Required Change: <exact-diff>
Reason: <why change is needed>
Breaking / Non-breaking: <classification>
Affected Producers: <producers>
Affected Consumers: <consumers>
```

### 5.3 `ARCHITECTURE CONFLICT`
Trigger: Any requirement that breaches fundamental architecture invariants:
- Delivery Worker connecting to Neon / PostgreSQL
- Admin importing `packages/db`
- Domain packages importing Drizzle, SQL, or Hono
- Direct cross-domain repository queries
- Cloudflare Queues treated as source of truth
- Public Delivery reading Draft content
- Publishing "latest" instead of pinned Versions
- Secrets stored inside CMS content
```text
ARCHITECTURE CONFLICT
Task ID: <TASK-ID>
Violation: <describe forbidden connection or violation>
Invariant Reference: <section in system architecture spec>
Impact: <system risk>
```

---

## 6. Test-Driven Development (TDD) Protocol

For all domain logic, commands, state management, and critical infrastructure, follow:

$$\textbf{RED } \longrightarrow \textbf{ GREEN } \longrightarrow \textbf{ REFACTOR}$$

### Step-by-Step TDD Loop:
1. **Read TDD Scenarios** from the Task Card (`RED-1`, `RED-2`, `RED-3`).
2. **Write Failing Test:** Implement the test asserting the expected failure or missing invariant.
3. **Execute Test:** Run the test and confirm it fails for the **exact expected reason** (not syntax/import errors).
4. **Implement Minimum Code (GREEN):** Write clean, minimal code to pass the test.
5. **Verify GREEN:** Re-run the test to confirm it passes.
6. **Refactor:** Clean up code, remove duplication, ensure strict type safety.
7. **Run Verification Commands:**
   ```bash
   pnpm --filter <package> test
   pnpm --filter <package> typecheck
   pnpm --filter <package> lint
   ```

### 6.1 Two-Phase AI Agent Execution Rule (Enforce RED before GREEN)

> [!IMPORTANT]
> **Enforce RED before GREEN:** When interacting with an AI Coding Agent, never allow the agent to write implementation code simultaneously with test code in a single prompt.
> 
> **Phase 1 (RED):**
> When prompted with:
> *"เขียนเฉพาะชุดทดสอบ Unit/Contract Test ใน Owned Paths ตาม Scenarios RED-1 ถึง RED-3 ให้รันแล้วพัง (Failing Test) พร้อมระบุข้อความ Error ที่คาดหวัง โดยยังไม่ต้องเขียน Implementation โค้ดจริง"*
> 
> The AI Agent MUST:
> 1. Create failing unit/contract tests under `Owned Paths`.
> 2. Execute tests: `pnpm --filter <package> test`.
> 3. Verify that tests fail due to the expected business rule or contract invariant (NOT syntax or module import errors).
> 4. Commit the failing tests with a `ClickUp-Task: <CLICKUP-ID>` trailer in the commit message, push the branch to your fork, and open a **Draft PR** into `Thairun/fotobots-whitelabel:develop` whose body starts with `ClickUp-Task: <CLICKUP-ID>` (§3). This moves the ClickUp task to `in progress`. CI on the Draft PR is expected to be red at this point.
> 5. Report the exact failing output and expected error message.
> 6. **STOP** and wait for human developer confirmation before writing implementation code.
> 
> **Phase 2 (GREEN & REFACTOR):**
> Only after the failing RED state is inspected and confirmed, the agent is instructed to write the minimal production code to pass tests, refactor, run `pnpm lint`, `pnpm typecheck` and `pnpm test`, push to the same Draft PR, fill in the PR body from the template, and mark it **Ready for review** (`gh pr ready`). CI must be green.
>
> Copy-paste prompts for both phases are in [Developer Guide §4](../../../docs/DEVELOPER_AND_AI_AGENT_GUIDE.md). Do not use a single prompt that asks for tests and implementation together.

---

## 7. Discovered Work Protocol

If during implementation you discover additional necessary work outside the scope of your card:
- Do **NOT** silently expand the scope of the current card.
- Output a `DISCOVERED TASK` report to the Coordinator:
```text
DISCOVERED TASK
Discovered From: <TASK-ID>
Suggested Title: <title>
Suggested Workstream: <WS-A through WS-H>
Description: <description>
Why It Is Needed: <rationale>
Blocks Current Task: YES / NO
Suggested Dependency: <dependency relation>
```

---

## 8. Pull Request & Completion Verification

Before submitting for review, verify every Acceptance Criterion on the Task Card.

### 8.1 PR Format (`[TASK-ID] <Title>`)
Use the template in [templates/pr-body.md](./templates/pr-body.md). The first line must be the ClickUp marker; it takes priority over any other ID the sync finds in the PR:
```markdown
ClickUp-Task: <CLICKUP-ID>

## Task
<TASK-ID>

## Goal
<Goal from Task Card>

## Architecture References
<References>

## TDD
### RED
- RED-1: <Expected vs Observed Failure>
- RED-2: <Expected vs Observed Failure>

### GREEN
- <Summary of implementation passing tests>

### REFACTOR
- <Refactoring details>

## Changes
- <List of files changed in Owned Paths>

## Contracts
Changed: YES / NO

## Migrations
None / <Migration file name>

## Tests
- <Commands executed>

## Acceptance Criteria
- [x] AC-1 ...
- [x] AC-2 ...
```

### 8.2 Task Completion Report
When PR is opened, return the completion report in [templates/completion-report.md](./templates/completion-report.md) to the Coordinator. The Coordinator will review, verify integration gates, and update the execution state.

---

## 9. Cross-Agent Integration & Independence Rules

### 9.1 Cross-Agent Integration Contract
Every Task that produces data, behavior, events, artifacts, APIs, or state consumed by another Task MUST define an explicit Integration Interface:
- **Consumes:** Name, Contract, Contract Version, Producer Task ID, Canonical Fixture.
- **Produces:** Name, Contract, Contract Version, Consumer Task IDs, Canonical Fixture.
- **Upstream & Downstream Tasks:** Explicit DAG relationships.
- **Compatibility:** Required/optional fields, null/missing semantics, error shapes, semver compatibility, ordering, idempotency.
- **Canonical Fixtures:** At least 1 valid, 1 invalid, and edge-case fixtures that validate against the real schema.
- **Contract & Integration Tests:**
  - *Producer Contract Test:* Output validates against Frozen Contract.
  - *Consumer Contract Test:* Consumes canonical Fixture without needing real Producer.
  - *Integration Test:* Replaces Fixture with actual Producer output.
  - *Integration Gate:* Verifies end-to-end integration before marking fully resolved.

### 9.2 Agent Independence Rule
Different Developers or AI Coding Agents MAY implement Producer and Consumer independently and in parallel after the Contract reaches FROZEN status.
Agents must never depend on:
- undocumented implementation details;
- private helper functions owned by another Workstream;
- another Agent's unmerged branch;
- assumptions communicated only through chat.

They may depend only on:
- Frozen Contracts;
- canonical fixtures;
- approved public interfaces;
- merged code;
- explicit Task dependencies.

### 9.3 Cross-Agent Compatibility Principle
The project MUST remain implementation-agent agnostic.
Correctness must not depend on whether a Task is implemented by:
- Codex;
- Claude Code;
- Gemini;
- a human developer;
- another coding agent.

The compatibility boundary is:

$$\textbf{Contract } + \textbf{ Tests } + \textbf{ Git } + \textbf{ Integration Gate}$$

Not the Agent.

### 9.4 The 7 Core Rules for Developers & AI Agents
1. **Agent ใดก็ได้ แต่ Contract ต้องเหมือนกัน:** All agents and developers must strictly conform to identical Frozen Contracts in `packages/contracts/`.
2. **Agent ใดก็ได้ แต่ Task Card format ต้องเหมือนกัน:** Standard card schema with Owned Paths, Must Not Modify, and Stop Conditions.
3. **Agent ใดก็ได้ แต่ RED/GREEN/REFACTOR เหมือนกัน:** Failing test verification (RED) must precede implementation code (GREEN).
4. **Agent ใดก็ได้ แต่ CI เป็นผู้ตัดสิน:** Verification via `pnpm typecheck` and `pnpm test` on CI is the sole criterion for merging.
5. **Producer/Consumer ห้ามรู้ implementation ภายในของกัน:** Decoupled modules interact strictly through contracts and canonical fixtures.
6. **งานต่าง Agent เชื่อมกันผ่าน merged contract/fixture ไม่ผ่าน chat หรือ working branch:** No cross-agent dependency on unmerged branches or informal chat.
7. **Integration Gate เป็นผู้ยืนยันว่ารวมงานได้จริง:** Work is only considered integrated once the relevant integration gate passes.

---

## 10. ClickUp Status Automation

ClickUp task status is updated **only** by the GitHub Action `.github/workflows/clickup-status-sync.yml`, from real GitHub events. Agents and developers do not change status by hand.

| GitHub event | ClickUp status |
|---|---|
| Open a Draft PR into `develop` (end of RED) | `in progress` |
| Mark the PR Ready for review (end of GREEN) | `in review` |
| Changes requested, or PR converted back to draft | `in progress` |
| Lead merges the PR into `develop` | `testing` |
| Promotion `develop → staging → main` | not synced — the lead updates ClickUp by hand (e.g. bulk status change) |

For the sync to find the task, put the ClickUp ID in all three places:
1. **Branch name** — `feat/<TASK-ID>-<CLICKUP-ID>-…`
2. **Commit message trailer** — `ClickUp-Task: <CLICKUP-ID>`
3. **PR body first line** — `ClickUp-Task: <CLICKUP-ID>` (used for PR, review and merge events)

IDs typed anywhere else (examples in a PR description, other tasks mentioned in a commit) are ignored.

After `testing`, testers own the card and move it by hand (Developer Guide §11.3). When QA sends a card back to `in progress`, fix it on a new branch and PR that use **the same ClickUp ID** (or the ID of the Bug subtask the tester created).

### 10.1 If a ClickUp MCP Server Is Connected
An agent with a ClickUp MCP connection may **read** the assigned task (to get its ID and confirm it is assigned to the current developer) and **post comments** (RED results, the Task Completion Report). It must **never** change a task's status or assignee, and must never touch a task that is not assigned to the current developer. Status belongs to the GitHub Action so that it reflects what actually happened in Git and CI, not what an agent claims (Core Rule #4).

