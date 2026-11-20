<!--
  PR title: [TASK-ID] <Title>   e.g. [CONTRACT-PAGE-010] Define frozen Page & Component schemas
  Branch:   feat/<TASK-ID>-<CLICKUP-ID>-<short-description> from upstream/develop, pushed to your fork
  Base:     develop (never staging or main). Open as Draft at the end of RED; mark Ready for review after GREEN.
  Required: keep the "ClickUp-Task:" line below as the first line so ClickUp status updates automatically.
  One Task Card = One Branch = One PR.
  Source template: .agents/skills/worker-task-execution/templates/pr-body.md
-->

ClickUp-Task: <CLICKUP-ID>

## Task

<TASK-ID>

## Goal

<One-sentence goal from Task Card>

## Architecture References

- system-architecture-fixed-technology-stack-and-implementation-spec.md
- master-parallel-implementation-and-tdd-plan-spec.md
- master-task-decomposition-and-execution-card-system-spec.md

## TDD

### RED

- RED-1: <Test command & observed failure output>
- RED-2: <Test command & observed failure output>

### GREEN

- <Description of minimal implementation making tests pass>

### REFACTOR

- <Preserved behavior, cleanup, type improvements>

## Changes

- <List of files added or modified under Owned Paths>

## Contracts

Changed: YES / NO

## Migrations

None / <Migration file name>

## Tests

- <List of verification commands executed, e.g. pnpm typecheck, pnpm test>

## Security Impact

<Tenant isolation, credential safety, or N/A>

## Deployment Impact

<How this change affects builds or Cloudflare runtime>

## Rollback / Forward Fix

<Revert commit on main>

## Discovered Tasks

<None or references to discovered tasks>

## Acceptance Criteria

- [x] AC-1: <Criterion 1>
- [x] AC-2: <Criterion 2>
