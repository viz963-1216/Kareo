# TASK-B-004 — Provider Domain + Import API

Owner: Engineer B — Backend  
Type: Backend / Database / Provider  
Status: QUEUED — DO NOT START UNTIL B-003 + A-002 MERGED

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
