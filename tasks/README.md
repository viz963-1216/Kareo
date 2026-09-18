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
- Test / QA Result
- Scope Check

全站 Release Version 只由 Jerry 管理。

---

# Current Active Tasks

| Engineer | Task | Status |
|---|---|---|
| A | TASK-A-002 Official Provider Dataset v1 | ▶ ACTIVE / START NOW |
| B | TASK-B-003 Assessment API + AI Adapter Foundation | ▶ ACTIVE / START NOW |
| C | TASK-C-002 Frontend MVP Foundation | ▶ ACTIVE / START NOW |

目前每位工程師只維持一張 Active Task。

後續 Task 雖已建立，但在前置條件完成前一律不得提前開工。

---

# Completed

| Engineer | Task | Status |
|---|---|---|
| A | TASK-A-001 Provider Data Foundation | ✅ MERGED |
| B | TASK-B-001 Backend Foundation Plan | ✅ MERGED |
| B | TASK-B-002 Backend API Foundation | ✅ MERGED |
| C | TASK-C-001 Frontend Foundation Plan | ✅ MERGED |

---

# Engineer A Queue

| Task | Status | Dependency |
|---|---|---|
| A-002 Official Provider Dataset v1 | ▶ ACTIVE | — |
| A-003 Provider Geocoding + Service Area QA | 🔒 QUEUED | A-002 merged |
| A-004 Provider Validation Gate | 🔒 QUEUED | A-003 merged |
| A-005 Provider QA Acceptance Cases | 🔒 QUEUED | A-004 merged |

A 的責任維持：

```text
Provider Data
Source Traceability
Data Cleaning
Geocoding / Service Area QA
Validation
QA Cases
```

A 不負責 Backend、Supabase 正式操作或全站 E2E 執行。

---

# Engineer B Queue

| Task | Status | Dependency |
|---|---|---|
| B-003 Assessment API + AI Adapter Foundation | ▶ ACTIVE | — |
| B-004 Provider Domain + Import API | 🔒 QUEUED | B-003 + A-002 merged |
| B-005 Recommendation Engine + API | 🔒 QUEUED | B-004 merged |
| B-006 Lead API | 🔒 QUEUED | B-004 merged |
| B-007 Kareocar External Service API | 🔒 QUEUED | B-003 merged |
| B-008 Knowledge Foundation + Publish Gate | 🔒 QUEUED | B-003 + Jerry Source Registry |
| B-009 Knowledge Crawler | 🔒 QUEUED / POST-MVP ALLOWED | B-008 merged |

B 的責任維持：

```text
Backend API
Database
Provider Backend
Assessment
Recommendation
Lead
Knowledge
Crawler
```

B 不修改 Frontend UI。

---

# Engineer C Queue

| Task | Status | Dependency |
|---|---|---|
| C-002 Frontend MVP Foundation | ▶ ACTIVE | — |
| C-003 Recommendation + Top 3 UI | 🔒 QUEUED | C-002 merged |
| C-004 Provider Detail + Google Maps | 🔒 QUEUED | C-003 merged |
| C-005 Lead Flow + Final MVP UX QA | 🔒 QUEUED | C-004 merged |

C 的責任維持：

```text
Homepage
Consent
Assessment UI
Result
Recommendation UI
Provider UI
Google Maps CTA
Kareocar CTA
Lead Form
RWD / Accessibility / States
```

C 不修改 Backend Schema、Recommendation Logic 或 Supabase 核心資料。

---

# Dependency Flow

```text
A-002
├─→ A-003 → A-004 → A-005
└─→ B-004 → B-005
             └─→ Recommendation Real API

B-003
├─→ B-004
├─→ B-007
└─→ B-008 → B-009

C-002 → C-003 → C-004 → C-005
```

B-006 在 B-004 完成後可與 B-005 平行，但仍需 Jerry 明確開放後才開始。

---

# Handoff

```text
Engineer A
Provider Data / Research / QA
        ↓
clean / validated data
        ↓
Engineer B
Backend / Database / Business Logic
        ↓
API Contract
        ↓
Engineer C
Frontend / UX
```

所有跨模組 Integration 由 Jerry 在 `staging` 完成。

Feature PR Merge 到 staging 只能稱為 Module Complete。

只有通過 A+B+C + Supabase + Netlify + Integration / E2E 後，才能稱為 Integrated。
