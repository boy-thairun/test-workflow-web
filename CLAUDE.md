# CLAUDE.md

Claude Code: the rules for this repository live in AGENTS.md so every agent shares one copy.

@AGENTS.md

## CRITICAL: MANDATORY SKILL LOADING BEFORE ANY ACTION
Before executing any request (development, bug fixing, review, planning, ClickUp sync), Claude Code MUST read the relevant skill from:
1. `.agents/skills/start-task/SKILL.md` & `.agents/skills/worker-task-execution/SKILL.md` (for task execution / TDD)
2. `~/.gemini/config/skills/pr-production-review/SKILL.md` (for PR reviews)
3. `~/.gemini/config/skills/production-architecture-planning/SKILL.md` (for planning)
4. `~/.gemini/config/skills/clickup-plan-review/SKILL.md` (for plan review)
5. `~/.gemini/config/skills/clickup-task-automation/SKILL.md` (for ClickUp operations)
6. `~/.gemini/config/skills/natural-team-communication/SKILL.md` (for team communication)

## Short Commands for Claude Code

Supports Flexible Dual-Mode:
- `/start-task <CLICKUP-ID>` หรือ `เริ่มงาน <CLICKUP-ID>` (Simplified Mode)
- `/start-task <TASK-ID> <CLICKUP-ID>` หรือ `เริ่มงาน <TASK-ID> <CLICKUP-ID>` (Explicit Mode)

When triggered, execute the 22-step protocol defined in `.agents/skills/start-task/SKILL.md`.

---
