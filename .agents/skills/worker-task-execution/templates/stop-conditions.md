# Stop Condition Reporting Templates

When encountering a condition that violates boundaries, contracts, or architecture invariants, output one of the following reports immediately and stop implementation:

---

## 1. Cross-Ownership Stop Condition

```text
CROSS-OWNERSHIP CHANGE REQUIRED
Task: <TASK-ID>
Required Path: <file path needed to change>
Owning Workstream: <WS-A through WS-H>
Reason: <why this file needs modification>
Why Current Task Cannot Proceed: <exact blockage>
Suggested Dependency Task: <new task proposal>
```

---

## 2. Contract Change Stop Condition

```text
CONTRACT CHANGE REQUIRED
Task ID: <TASK-ID>
Current Contract: <contract name and path in packages/contracts/>
Required Change: <exact diff or field alteration>
Reason: <why the frozen contract is insufficient>
Breaking / Non-breaking: <classification>
Affected Producers: <components producing this contract>
Affected Consumers: <components consuming this contract>
```

---

## 3. Architecture Conflict Stop Condition

```text
ARCHITECTURE CONFLICT
Task ID: <TASK-ID>
Violation: <describe forbidden connection, e.g. Delivery connecting to DB, Admin importing packages/db>
Invariant Reference: <Section in system-architecture-fixed-technology-stack-and-implementation-spec.md>
Impact: <system reliability / security risk>
```

---

## 4. Discovered Task Report

```text
DISCOVERED TASK
Discovered From: <TASK-ID>
Suggested Title: <concise title>
Suggested Workstream: <WS-A through WS-H>
Description: <what work was discovered>
Why It Is Needed: <rationale>
Blocks Current Task: YES / NO
Suggested Dependency: <dependency relationship>
```
