# TASK-A-001 — Provider Data Foundation

Owner: Engineer A  
Type: Data / QA  
Status: MERGED（PR #2）— 模組完成，不代表整合完成或正式環境驗收（2026-09-23 J-002-r4 核對）  

---

# Goal / 目標

建立第一版 Provider 資料整理規格與可供後續匯入的測試資料格式。

本 Task 不負責 Backend、不負責 Database、不負責 Recommendation Engine。

---

# 開始前必讀

```text
AGENTS.md
docs/PRODUCT_SPEC.md
docs/ARCHITECTURE.md
docs/DATA_MODEL.md
docs/GIT_RULES.md
```

---

# Branch / PR Rule

從最新 `staging` 建立：

```text
feat/a-001-provider-data
```

完成後建立 PR，Base Branch 必須選：

```text
staging
```

不得直接 Push `staging` 或 `main`。

---

# Allowed Paths / 可修改範圍

```text
/data/providers/**
```

# Forbidden Paths / 禁止修改

```text
/apps/**
/services/**
/docs/**
/contracts/**
/tasks/**
/.github/**
```

不得修改 Root Config、Database Schema、API Contract。

---

# Input / 輸入

以 `DATA_MODEL.md` 中的 Provider / ProviderService / ProviderServiceArea 為準。

Provider 基本欄位至少包含：

```text
id
name
type
address
city
district
lat
lng
phone
website
googleMapsUrl
status
verified
```

服務範圍與 Provider 地址必須分開。

---

# Output / 輸出

在 `/data/providers/` 建立：

```text
README.md
provider-template.csv
provider-sample.json
```

`provider-sample.json` 至少建立 6 筆假資料：HOME_CARE、HOME_MEDICAL_NURSING、ASSISTIVE_DEVICE 各至少 2 筆，以台北市 / 新北市為主。

---

# Data Rules / 資料規則

1. `id` 必須唯一。
2. `type` 只能使用 Data Model 定義的 Enum。
3. `status` 只能使用 ACTIVE / INACTIVE / UNKNOWN。
4. `verified` 使用 Boolean。
5. 不得把 Provider 地址直接當作服務範圍。
6. Google Maps URL 無資料時可為空，不可捏造正式商家資料。
7. Sample Data 必須清楚標示為測試資料。
8. 本 Task 不抓正式 Provider 名單。

---

# Acceptance Criteria / 驗收標準

- [ ] `/data/providers/README.md` 說明欄位用途
- [ ] 建立可使用的 CSV Template
- [ ] 建立至少 6 筆 JSON Sample Data
- [ ] Sample 包含三種 Provider Type
- [ ] 地址與 Service Area 概念有明確區分
- [ ] Enum 與 DATA_MODEL.md 一致
- [ ] 沒有修改 Allowed Paths 以外檔案
- [ ] PR Base 是 `staging`

---

# Completion Report / 完成後回報

```text
1. 完成哪些檔案
2. Sample Data 有幾筆
3. 使用哪些 Provider Type
4. 是否有缺少或不確定的欄位
5. 是否修改 Allowed Paths 以外檔案
6. 測試 / Validation 結果
```

完成後建立：

```text
[A-001] Provider Data Foundation
Feature Branch → staging
```
