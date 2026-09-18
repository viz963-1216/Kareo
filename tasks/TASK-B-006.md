# TASK-B-006 — Lead API

Owner: Engineer B — Backend  
Type: Backend / Lead  
Status: QUEUED — DO NOT START UNTIL B-004 MERGED

---

# Goal / 目標

實作 `POST /api/v1/leads` 與 Lead persistence，建立 User Need → Provider → Lead 的商業資料鏈。

---

# Prerequisite / 前置條件

B-004 已 Merge；可與 B-005 在不同 Feature Branch 平行，但不得互改檔案衝突。

---

# Branch / PR Rule

從最新 `staging` 建立：

```text
feat/b-006-lead-api
```

完成後：

```text
PR → staging
```

首次提交版次：

```text
B-006-r1
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

- Lead migration / repository / service
- `POST /api/v1/leads`
- Lead Status：NEW / CONTACTED / ACCEPTED / CLOSED / CANCELLED
- Input validation
- PII 最小化
- Tests

---

# Acceptance Criteria

- [ ] API 符合 Contract
- [ ] 建立 Lead 時關聯 Session / Assessment / Provider / Service
- [ ] 不收集 Task 外敏感資料
- [ ] Invalid provider / input 有安全錯誤
- [ ] Tests 通過

---

# Not In Scope

Provider CRM、Payment、商家後台、Frontend Lead Form。

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
[B-006] Lead API
```
