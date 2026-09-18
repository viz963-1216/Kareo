# TASK-C-003 — Recommendation + Top 3 UI

Owner: Engineer C — Frontend  
Type: Frontend / Recommendation  
Status: QUEUED — DO NOT START UNTIL C-002 MERGED

---

# Goal / 目標

完成 Service Recommendation 與 Provider Top 3 UI，使用 Jerry 提供的 fixed Mock Contract 開發，不等待 B-005。

---

# Prerequisite / 前置條件

C-002 已 Merge；`contracts/mock/recommendation-response.json` 可用。

---

# Branch / PR Rule

從最新 `staging` 建立：

```text
feat/c-003-recommendation-top-3-ui
```

完成後：

```text
PR → staging
```

首次提交版次：

```text
C-003-r1
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
/apps/web/**
```

不得跨 Ownership。若必須修改其他模組，停止並回報 Jerry。

---

# Required Deliverables / 必交付

- Service recommendation page
- Provider Top 3 cards
- reasons / rank / distance rendering
- DISTRICT_ROTATION wording
- 0 / 1 / 2 / 3 provider states
- LOADING / EMPTY / ERROR
- TRANSPORTATION 顯示 Kareocar CTA，不打 Recommendation API

---

# Acceptance Criteria

- [ ] 不自行排序 Provider
- [ ] 不自行計算 distance
- [ ] 0 家是 Empty，不是 crash
- [ ] Kareocar New Tab
- [ ] UI 以 Mock Adapter 可完整操作
- [ ] RWD 基本可用

---

# Not In Scope

Provider Detail、Lead Form、Backend、Supabase direct access。

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
[C-003] Recommendation + Top 3 UI
```
