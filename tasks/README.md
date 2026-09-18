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
| B-008 Knowledge Foundation + Publish Gate | 🔒 NEXT PRIORITY | B-003 merged + J-002 source registry/format |
| B-004 Provider Domain + Import API | 🔒 QUEUED | B-003 + A-002 merged |
| B-005 Recommendation Engine + API | 🔒 QUEUED | B-004 merged |
| B-006 Lead API | 🔒 QUEUED | B-004 merged |
| B-007 Kareocar External Service API | 🔒 QUEUED | B-003 merged |
| B-010 Production Assessment Engine | 🔒 QUEUED | B-003 + B-008 merged + J-002 AI/content approved |
| B-011 Session / Privacy / API Controls | 🔒 QUEUED | J-002 security spec + relevant APIs merged |
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

B 維持單一 Active Task。建議順序：B-003 → B-008 → B-004 → B-005 → B-006 → B-007 → B-010 → B-011。B-008 若缺 J-002 輸入，先回報阻塞；可先執行前置已完成的 B-004 或 B-007，不以未發布知識繞過。B-009 可延後至 MVP 後。

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


# 2026-10-22 MVP 執行與交付計畫（2026-09-19 修訂）

目前狀態保留為工作安排，不表示尚未驗收的任務已完成。A-002 已提交內容仍需 review / 修正並合併 staging；所有工程 PR 的 base 一律 staging，不以其他 feature branch 代替。

| 新增 Task | Owner | 開工條件 / 交付 |
|---|---|---|
| [J-002](TASK-J-002.md) | Jerry | 現在開始；AI/安全/隱私/接件規格、官方來源與首批核准知識 |
| [B-010](TASK-B-010.md) | B | 真實 Assessment engine；詳見任務依賴 |
| [B-011](TASK-B-011.md) | B | session 歸屬、限流、冪等、RLS、刪除/保存驗收 |
| [J-003](TASK-J-003.md) | Jerry | CI 現在開始；模組完成後接真實 API 與 E2E |
| [J-004](TASK-J-004.md) | Jerry | release、接件交接、額度、備份還原與回滾 |

## Dependencies / 不得跳過的關卡

- J-002 source registry/格式 → B-008；J-002 核准內容 + B-008 → J-003 首次人工發布。
- B-003 + B-008 + J-002 AI 決策 → B-010；真實 smoke 需前述發布完成。
- A-002 → B-004 試匯入；A-003 → A-004 → B-004 正式資料匯入驗收。
- J-002 安全/隱私/營運 contract → B-006 新增操作、B-011、C 的正式文案驗收。
- A-005 + B-003…B-008 + B-010/B-011 + C-005 → J-003 最終 E2E → J-004 release。
- J-003 可分階段開始，首次知識發布不等待最終 E2E，避免與 B-010 循環依賴。

## Milestones（目標日期，非已完成承諾）

| 日期 | 目標 |
|---|---|
| 9/23 | J-002 AI/安全/隱私/Lead 操作規格 |
| 9/26 | J-002 核准內容包、J-003 CI 骨架 |
| 10/12 | A/B/C 必要功能與真實 API 接線完成 |
| 10/13–10/18 | 完整 E2E、安全、手機驗收與缺陷修復 |
| 10/19 | 功能凍結 |
| 10/20–10/21 | 備份還原、發布演練與 smoke |
| 10/22 | Kareo MVP 交付 |

阻塞時在 PR/Issue 寫出缺少的輸入、責任人及對日期的影響；不得把 Fake/Mock/未發布知識視為正式完成。不新增會員、付款、完整 CRM；B-009 crawler 可後補。

「完成」必須同時有：正式知識、真實評估、可追溯 Provider 資料、確定性推薦、可保存並由負責人接件的 Lead、隱私/權限驗收、部署後 E2E、可操作的回復方案。
