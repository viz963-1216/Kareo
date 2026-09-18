# TASK-A-005 — Provider QA Acceptance Cases

Owner: Engineer A — Data / QA / Research  
Type: QA Dataset  
Status: QUEUED — DO NOT START UNTIL A-004 MERGED

---

# Goal / 目標

建立 Provider / Recommendation 相關 QA 測試情境與邊界資料，提供 Jerry 在 staging 做 Integration / E2E 時使用；A 不負責執行全站 E2E。

---

# Prerequisite / 前置條件

A-004 已 Merge；B-005 前可先準備案例，實際 E2E 仍由 Jerry 執行。

---

# Branch / PR Rule

從最新 `staging` 建立：

```text
feat/a-005-provider-qa-acceptance-cases
```

完成後：

```text
PR → staging
```

首次提交版次：

```text
A-005-r1
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
/data/providers/**
```

不得跨 Ownership。若必須修改其他模組，停止並回報 Jerry。

---

# Required Deliverables / 必交付

至少涵蓋：
- 0 / 1 / 2 / 3 家符合 Provider
- 台北 / 新北
- GPS 精確位置
- District-only
- 無位置
- Service Area 不符合
- 缺 lat/lng
- Inactive / Unknown Provider
- Duplicate / invalid data
輸出 `/data/providers/qa/acceptance-cases.md` 與必要 fixture。

---

# Acceptance Criteria

- [ ] 邊界案例完整
- [ ] 每案例有 Input / Expected Result
- [ ] 不自行定義新 API Contract
- [ ] 不負責跨模組程式修改

---

# Not In Scope

真正 E2E 執行、Frontend automation、Backend implementation。

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
[A-005] Provider QA Acceptance Cases
```
