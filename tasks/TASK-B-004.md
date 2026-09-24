# TASK-B-004 — Provider Domain + Import API

Owner: Engineer B — Backend  
Type: Backend / Database / Provider  
Status: MERGED（PR #16，B-004-r2）— 模組完成，不代表整合完成或正式環境驗收（2026-09-23 J-002-r4 核對）；staging Supabase 回滾測試由 J-003 執行  

---

# Goal / 目標

建立 Provider / ProviderService / ProviderServiceArea 的正式 Backend Domain、Supabase migration、A 資料匯入流程，以及 `GET /api/v1/providers/{providerId}`。

---

# Prerequisite / 前置條件

B-003 與 A-002 已 Merge；正式匯入前使用 A 的 staging dataset。

---

# Branch / PR Rule

從最新 `staging` 建立：

```text
feat/b-004-provider-domain-import-api
```

完成後：

```text
PR → staging
```

首次提交版次：

```text
B-004-r1
```

若退回修改，revision 依序遞增。

不得直接 Push `staging` 或 `main`。

---

# 開始前必讀

```text
AGENTS.md
docs/PRODUCT_SPEC.md
docs/ARCHITECTURE.md
docs/DATA_MODEL.md
docs/API_CONTRACT.md
docs/GIT_RULES.md
```

---

# Allowed Paths / 可修改範圍

```text
/apps/api/**
```

不得跨 Ownership。若必須修改其他模組，停止並回報 Jerry。

---

# Required Deliverables / 必交付

- Provider / ProviderService / ProviderServiceArea migration
- Provider repository / service
- A dataset import script + validation
- `GET /api/v1/providers/{providerId}`
- 測試 Not Found / invalid / valid provider
- 不讓 Frontend 直接查核心 Business Tables

---

# Acceptance Criteria

- [ ] Provider Schema 符合 DATA_MODEL
- [ ] Import 可重複執行或安全避免重複
- [ ] Provider Detail API 符合 API_CONTRACT
- [ ] Service / ServiceArea 關聯正確
- [ ] 測試通過
- [ ] 無 Secret

---

# Not In Scope

Recommendation Ranking、Lead、Crawler、Frontend。

---

# Completion Report

PR 必須回報：

```text
Submission Version:
Added:
Changed:
Fixed:
Tests / QA:
Known Issues:
是否修改 Allowed Paths 以外檔案:
```

PR Title：

```text
[B-004] Provider Domain + Import API
```

---

## 2026-09-19 MVP 補充驗收與依賴

A-002 合併後可建模及試匯入；正式資料匯入必須等待 A-004 validator 通過，使用 A-003 校正後版本。附版本/列數/關聯/拒收報告、重複匯入不增生與失敗不留下半套資料的證據。來源缺欄位（例如 service id/active）先按既有 contract 由 A 修正，B 不猜值或靜默略過。

此補充不授權改寫高順位規格；所需規格更新由 TASK-J-002 先合併。
