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
| A | TASK-A-001 Provider Data Foundation | ✅ MERGED | `feat/a-001-provider-data` |
| A | TASK-A-002 Official Provider Dataset v1 | ▶ READY / START NOW | `feat/a-002-provider-dataset-v1` |
| B | TASK-B-001 Backend Foundation Plan | ✅ MERGED | `feat/b-001-backend-foundation` |
| B | TASK-B-002 Backend API Foundation | ✅ MERGED | `feat/b-002-backend-api-foundation` |
| B | TASK-B-003 Assessment API + AI Adapter Foundation | ▶ READY / START NOW | `feat/b-003-assessment-ai-adapter` |
| C | TASK-C-001 Frontend Foundation Plan | ✅ MERGED | `feat/c-001-frontend-foundation` |
| C | TASK-C-002 Frontend MVP Foundation | ▶ READY / START NOW | `feat/c-002-frontend-mvp-foundation` |

---

## Current Workload

```text
Engineer A
→ A-002 Official Provider Dataset

Engineer B
→ B-003 Assessment API + AI Adapter Foundation

Engineer C
→ C-002 Frontend MVP Foundation
```

目前每位工程師只維持一張 Active Task。

完成前不要預先開下一張實作 Task，避免 Backend 過度超前、跨模組依賴失衡。

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
