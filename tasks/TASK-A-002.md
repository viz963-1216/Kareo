# TASK-A-002 — Official Provider Dataset v1

Owner: Engineer A — Data / QA / Research  
Type: Data / Research / QA  
Status: READY

---

# Goal / 目標

建立 Kareo 第一版可供 Backend 匯入的「正式 Provider Dataset」。

本 Task 以臺北市、新北市為第一階段，整理：

- HOME_CARE / 居家照顧
- HOME_MEDICAL_NURSING / 居家醫療與護理
- ASSISTIVE_DEVICE / 輔具

Engineer A 負責資料來源、清洗、正規化、來源追溯與 QA。

本 Task **不負責 Backend、不負責 Database 程式、不負責 Recommendation Engine**。

---

# 開始前必讀

```text
AGENTS.md
docs/PRODUCT_SPEC.md
docs/ARCHITECTURE.md
docs/DATA_MODEL.md
docs/GIT_RULES.md
tasks/TASK-A-001.md
```

---

# Branch / PR Rule

從最新 `staging` 建立：

```text
feat/a-002-provider-dataset-v1
```

完成後：

```text
PR → staging
```

不得直接 Push `staging` 或 `main`。

首次提交版次：

```text
A-002-r1
```

若 Jerry 退回後重新提交，依序使用 `A-002-r2`、`A-002-r3`。

---

# Allowed Paths / 可修改範圍

```text
/data/providers/**
```

---

# Forbidden Paths / 禁止修改

```text
/apps/**
/services/**
/docs/**
/contracts/**
/tasks/**
/.github/**
```

不得修改 Root Config、API Contract、Database Schema、Recommendation Rule。

---

# Official / Primary Source Rule

優先使用政府、官方或可追溯的一手公開來源。

不得把以下內容直接當正式 Provider Source：

- AI 自行生成內容
- 無來源名單
- 部落格整理文
- SEO 網站
- Facebook / Threads / LINE 貼文
- 無法確認真實性的商業名錄

若只能找到非官方資料，必須放進待確認清單，不得直接標記為已驗證。

---

# Data Model

Provider 必須遵守 `docs/DATA_MODEL.md`。

至少包含：

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

服務與服務範圍分開處理：

```text
Provider
ProviderService
ProviderServiceArea
```

不得把「實體地址」推測成「服務範圍」。

不知道就保留 null / UNKNOWN，不可自行猜測。

---

# Output / 輸出

請建立或更新：

```text
/data/providers/sources/source-registry.md
/data/providers/raw/
/data/providers/staging/providers.json
/data/providers/staging/provider-services.json
/data/providers/staging/provider-service-areas.json
/data/providers/qa/validation-report.md
```

## source-registry.md

至少記錄：

```text
Source Name
Authority / Organization
Source URL
Provider Type
Jurisdiction
Retrieved At
Notes
```

## providers.json

只放已完成基本正規化的 Provider。

## provider-services.json

記錄 Provider 實際可確認的 Service Type。

## provider-service-areas.json

只有來源明確提供服務區域時才能填寫。

不得因 Provider 位於某行政區，就自行假設它只服務該行政區。

---

# Minimum Dataset Target

第一版目標：

- 至少 30 筆可追溯 Provider
- 三種 Provider Type 都要有資料
- 臺北市、新北市都至少要有代表資料
- 每筆都必須能追溯到來源

如果某類別官方公開資料不足，不得為了達標捏造資料。

在 QA Report 說明實際筆數與不足原因即可。

---

# QA / Validation

至少檢查：

1. ID 是否重複
2. Provider Name 是否明顯重複
3. Provider Type 是否為合法 Enum
4. City / District 是否合理
5. 電話格式
6. 地址空值
7. Website / Maps URL 格式
8. Service Area 是否有來源依據
9. Source 是否可追溯
10. 測試資料與正式資料是否混在一起

`verified=true` 只代表平台已完成基本資料核對，不代表政府認證。

---

# Handoff to Engineer B

A 不直接操作 Supabase。

完成後：

```text
A 正規化資料
↓
PR → staging
↓
Jerry Review
↓
B 後續依 Task 匯入 Supabase
```

---

# Acceptance Criteria

- [ ] 至少 30 筆可追溯 Provider，或在 QA Report 清楚說明官方資料不足原因
- [ ] 三種 Provider Type 都有資料
- [ ] 臺北市、新北市都有資料
- [ ] 每筆 Provider 有來源可追溯
- [ ] Provider / Service / Service Area 分開
- [ ] 未知資料沒有自行猜測
- [ ] 完成 validation-report.md
- [ ] 沒有修改 Allowed Paths 以外檔案
- [ ] PR Base 為 `staging`
- [ ] PR 有 Submission Version
- [ ] PR 有 Added / Changed / Fixed / Known Issues

---

# Completion Report

完成後回報：

```text
Submission Version:
Provider 總筆數:
HOME_CARE:
HOME_MEDICAL_NURSING:
ASSISTIVE_DEVICE:
臺北市筆數:
新北市筆數:
主要資料來源:
QA 發現:
Known Issues:
是否修改 Allowed Paths 以外檔案:
```

PR Title：

```text
[A-002] Official Provider Dataset v1
```
