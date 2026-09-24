# TASK-B-007 — Kareocar External Service API

Owner: Engineer B — Backend  
Type: Backend / External Service  
Status: MERGED（PR #14；路由由 J-003 PR #20 補上）— 模組完成，不代表整合完成或正式環境驗收（2026-09-23 J-002-r4 核對）  

---

# Goal / 目標

實作 `GET /api/v1/external-services/transportation`，提供 Kareocar External Service 資料。

---

# Prerequisite / 前置條件

B-003 已 Merge。此 Task 很小，不得趁機做 Kareocar backend integration。

---

# Branch / PR Rule

從最新 `staging` 建立：

```text
feat/b-007-kareocar-external-service-api
```

完成後：

```text
PR → staging
```

首次提交版次：

```text
B-007-r1
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

固定依 Contract 回傳 Kareocar External Service：
- name = Kareocar
- serviceType = TRANSPORTATION
- url = https://kareocar.netlify.app/
- openMode = NEW_TAB
- notice

---

# Acceptance Criteria

- [ ] API 完全符合 Contract
- [ ] URL 正確
- [ ] 無 iframe / 共用 DB / 共用 Auth
- [ ] Tests 通過

---

# Not In Scope

Kareocar 內嵌、派車、共用登入、共用 Database。

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
[B-007] Kareocar External Service API
```
