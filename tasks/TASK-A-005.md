# TASK-A-005 — Provider QA Acceptance Cases

Owner: Engineer A — Data / QA / Research  
Type: QA Dataset  
Status: READY（A-004 已合併，PR #18）；未見提交  

---

# Goal / 目標

建立 Provider / Recommendation 相關 QA 測試情境與邊界資料，提供 Jerry 在 staging 做 Integration / E2E 時使用；A 不負責執行全站 E2E。

---

# Prerequisite / 前置條件

A-004 已合併（完成）。B-005 合併前即可準備案例；真實 E2E 由 J-003 執行。位置案例依 API_CONTRACT v0.2.2 §8–§9；座標案例使用 A-003-r2 覆蓋率報告（r2 未交付前，DISTANCE 案例以「需已驗證座標」標示 BLOCKED，不自行造座標）。

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

`/data/providers/qa/acceptance-cases.md`（與必要 fixture），每個案例寫明 Input（服務類型、location.precision、city、district、座標是否提供）與 Expected（`rankingType`、`locationPrecision`、家數、`distanceKm` 是否為數值、notice 重點、不得出現的字樣），至少涵蓋：

- 0／1／2／3 家符合 Provider（每種服務類型至少一組真實資料案例）
- 臺北市、新北市各自的行政區案例；服務範圍跨縣市（地址在臺北、服務新北）
- 精確位置（`GPS`）且候選全部有已驗證座標 → `DISTANCE`
- 精確位置但候選部分／全部缺座標 → `DISTRICT_ROTATION`（D-13c）
- 只有行政區 → `DISTRICT_ROTATION`，同 session 同日穩定
- 只有縣市 → `CITY_ROTATION`（D-13a）
- 沒有位置 → 前端不呼叫；API 若被呼叫為 `NO_LOCATION`、0 家（D-13b）
- Service Area 不符合、Inactive／UNKNOWN Provider、ProviderService.active = false
- Duplicate／invalid data（交給 A-004 gate 的反例）

---

# Acceptance Criteria

- [ ] 上列情境全部有案例，每案例有 Input／Expected，可由 J-003 直接執行
- [ ] Expected 引用 API_CONTRACT §9 的欄位與 enum，不自行定義新 Contract
- [ ] 標示 PROPOSED（D-13a–c）的案例與原始 MVP 案例分開，Jerry 修改提案時容易更新
- [ ] 需要已驗證座標的案例列出使用的 Provider 與 A-003-r2 報告依據；無法提供時標 BLOCKED 並說明
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

---

# 變更紀錄

- 2026-09-23 J-002-r4：A-004 已合併 → READY；位置案例依 API_CONTRACT v0.2.2 §9 展開（精確位置、缺座標、行政區、縣市、無位置）。
