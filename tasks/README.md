# Kareo Tasks

所有工程 Task 必須：

```text
從最新 staging 建 Feature Branch
→ 執行 Task
→ Test
→ PR → staging
→ Jerry Review
```

A / B / C 不直接 Push `staging` 或 `main`。

每次 PR 必須提供：

- Submission Version
- Added
- Changed
- Fixed
- Known Issues

全站 Release Version 只由 Jerry 管理。

---

## Current Task Queue

| Engineer | Task | Status | Branch |
|---|---|---|---|
| A | TASK-A-001 Provider Data Foundation | Completed / Previous | `feat/a-001-provider-data` |
| A | TASK-A-002 Official Provider Dataset v1 | READY | `feat/a-002-provider-dataset-v1` |
| B | TASK-B-001 Backend Foundation Plan | In Review / r2 | `feat/b-001-backend-foundation` |
| B | TASK-B-002 Backend API Foundation | After B-001-r2 Approval | `feat/b-002-backend-api-foundation` |
| C | TASK-C-001 Frontend Foundation Plan | Current / Review as applicable | `feat/c-001-frontend-foundation` |
| C | TASK-C-002 Frontend MVP Foundation | After C-001 Approval | `feat/c-002-frontend-mvp-foundation` |

---

## Handoff

```text
Engineer A
Provider Data / Research / QA
        ↓
clean data
        ↓
Engineer B
Backend / Database / Business Logic
        ↓
API Contract
        ↓
Engineer C
Frontend / UX
```

A / B / C 不直接跨 Ownership 修改。

所有跨模組 Integration 由 Jerry 在 `staging` 完成。
