# Kareo / 長照一點通 — Data Model

Version: v0.1  
Status: LOCKED FOR MVP  
Owner: Jerry

---

# 1. 目的

本文件定義 MVP 的核心資料結構。

所有 AI 與工程師不得自行：

- 新增核心欄位
- 改欄位名稱
- 刪除欄位
- 修改 enum
- 改資料關係

需要修改時：

```text
提出 Change Request
↓
Jerry Review
↓
修改本文件
↓
才能改 Code
```

---

# 2. 四大資料域

```text
1. User / Assessment
2. Provider / Recommendation
3. Knowledge
4. Consent / Disclaimer
```

---

# 3. 整體關係

```text
Session
  │
  ├── Consent
  │
  └── Assessment
         │
         └── CareNeedProfile
                │
                ├── RecommendationRun
                │       │
                │       └── RecommendationItem
                │                │
                │                └── Provider
                │
                └── KnowledgeVersion
```

使用者提出媒合時：

```text
RecommendationItem
↓
Lead
```

---

# 4. Session / 匿名工作階段

```text
id
createdAt
updatedAt
```

MVP 不強迫登入，以 Session 作為主要使用流程識別。

---

# 5. User / 使用者帳號

MVP 可選。

```text
id
name
email
phone
createdAt
```

未來需要跨裝置、歷史紀錄或媒合追蹤時再使用。

---

# 6. Consent / 同意紀錄

```text
id
sessionId
disclaimerVersion
privacyVersion
termsVersion
acceptedAt
```

沒有有效 Consent 時，不得開始正式 Assessment。

---

# 7. Assessment / 初步評估

```text
id
sessionId
ageRange
city
district
locationPrecision
lat
lng
livingSituation
caregiverSituation
mobilityLevel
dailyLivingLevel
homeCareNeed
medicalNursingNeed
assistiveDeviceNeed
transportationNeed
freeText
status
knowledgeVersion
createdAt
updatedAt
```

第一版遵守 Data Minimization，不收過多敏感資料。

---

# 8. ageRange

```text
UNDER_50
50_64
65_74
75_84
85_PLUS
UNKNOWN
```

---

# 9. locationPrecision

```text
NONE
CITY
DISTRICT
EXACT
GPS
```

---

# 10. livingSituation

```text
ALONE
WITH_FAMILY
WITH_CAREGIVER
INSTITUTION
OTHER
UNKNOWN
```

---

# 11. caregiverSituation

```text
NO_CAREGIVER
FAMILY_AVAILABLE
FAMILY_LIMITED
PAID_CAREGIVER
OTHER
UNKNOWN
```

---

# 12. mobilityLevel

```text
INDEPENDENT
NEEDS_ASSISTANCE
WHEELCHAIR
BEDRIDDEN
UNKNOWN
```

---

# 13. dailyLivingLevel

```text
INDEPENDENT
PARTIAL_ASSISTANCE
HIGH_ASSISTANCE
FULL_ASSISTANCE
UNKNOWN
```

此欄位不是正式 CMS 等級。

---

# 14. Service Need

以下欄位皆使用：

```text
YES
NO
UNKNOWN
```

欄位：

```text
homeCareNeed
medicalNursingNeed
assistiveDeviceNeed
transportationNeed
```

---

# 15. Assessment Status

```text
DRAFT
COMPLETED
CANCELLED
```

---

# 16. CareNeedProfile / 初步照護需求

```text
id
assessmentId
careNeeds
priority
summary
warnings
createdAt
```

允許的 careNeeds：

```text
HOME_CARE
HOME_MEDICAL_NURSING
ASSISTIVE_DEVICE
TRANSPORTATION
```

summary 與 warnings 必須使用「初步預估」語氣，不得宣稱正式核定。

---

# 17. Provider / 服務單位

Provider Database 是 Provider 資料的 Source of Truth。

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
createdAt
updatedAt
```

Provider Type：

```text
HOME_CARE
HOME_MEDICAL_NURSING
ASSISTIVE_DEVICE
OTHER
```

TRANSPORTATION MVP 不放 Provider，直接導流 taiwanjcare。

Provider Status：

```text
ACTIVE
INACTIVE
UNKNOWN
```

只有 `ACTIVE` 可被推薦。

`verified=true` 代表平台已確認基本資料，不代表政府認證。

---

# 18. ProviderService / 服務類別

```text
id
providerId
serviceType
active
```

serviceType：

```text
HOME_CARE
HOME_MEDICAL_NURSING
ASSISTIVE_DEVICE
```

---

# 19. ProviderServiceArea / 服務範圍

```text
id
providerId
city
district
active
```

Provider 地址與服務範圍必須分開。

---

# 20. RecommendationRun / 推薦執行紀錄

```text
id
assessmentId
serviceType
rankingType
locationPrecision
knowledgeVersion
createdAt
```

rankingType：

```text
DISTANCE
DISTRICT_ROTATION
CITY_ROTATION
NO_LOCATION
```

---

# 21. RecommendationItem / 單一推薦結果

```text
id
recommendationRunId
providerId
rank
score
distanceKm
reasons
createdAt
```

rank MVP 只允許：

```text
1
2
3
```

score 為 0–100，主要供系統排序；前端不一定顯示。

reasons 必須是使用者看得懂的推薦理由。

---

# 22. Lead / 媒合需求

```text
id
sessionId
assessmentId
providerId
serviceType
contactName
contactPhone
status
createdAt
updatedAt
```

Lead Status：

```text
NEW
CONTACTED
ACCEPTED
CLOSED
CANCELLED
```

---

# 23. KnowledgeSource / 知識來源

```text
id
name
authority
jurisdiction
sourceUrl
active
createdAt
updatedAt
```

authority 例：

```text
MOHW
LAW
TAIPEI_GOV
NEW_TAIPEI_GOV
```

jurisdiction：

```text
TAIWAN
TAIPEI
NEW_TAIPEI
```

---

# 24. KnowledgeRecord / 政策與補助資料

```text
id
sourceId
title
category
jurisdiction
sourceUrl
publishedAt
effectiveFrom
effectiveTo
fetchedAt
lastVerifiedAt
contentHash
status
version
rawText
summary
ruleData
createdAt
updatedAt
```

Knowledge Category：

```text
ELIGIBILITY
BENEFIT
COPAY
ASSISTIVE_DEVICE
TRANSPORTATION
RESPITE
HOME_CARE
HOME_MEDICAL_NURSING
APPLICATION
OTHER
```

Knowledge Status：

```text
DISCOVERED
NEEDS_REVIEW
APPROVED
PUBLISHED
REJECTED
SUPERSEDED
CONFLICT
FETCH_FAILED
```

只有 `PUBLISHED` 可被正式 Assessment 使用。

---

# 25. ruleData

`ruleData` 使用 JSON 保存可由系統讀取的結構化規則。

AI 不得自行改變既有 ruleData schema。

---

# 26. KnowledgeVersion / 正式知識版本

```text
id
version
status
publishedAt
createdBy
approvedBy
notes
```

例如：

```text
KB-2026-09-14-001
```

Status：

```text
DRAFT
PUBLISHED
ARCHIVED
```

Assessment 只能使用 `PUBLISHED`。

---

# 27. KnowledgeChange / 政策異動

```text
id
knowledgeRecordId
oldContentHash
newContentHash
oldContent
newContent
aiSummary
status
detectedAt
reviewedAt
reviewedBy
```

Status：

```text
NEEDS_REVIEW
APPROVED
REJECTED
CONFLICT
```

---

# 28. CrawlerRun / 爬蟲執行紀錄

```text
id
sourceId
startedAt
finishedAt
status
itemsChecked
changesDetected
errorMessage
```

Status：

```text
RUNNING
SUCCESS
PARTIAL
FAILED
```

Crawler FAILED 時，不得刪除舊 Knowledge，繼續使用 Last Published Knowledge Version。

---

# 29. ExternalService / 外部服務

MVP 目前主要是 taiwanjcare。

```text
id
name
serviceType
url
active
```

範例：

```json
{
  "id": "EXT-001",
  "name": "taiwanjcare",
  "serviceType": "TRANSPORTATION",
  "url": "正式網址",
  "active": true
}
```

---

# 30. 敏感資料原則

MVP 避免保存：

- 身分證號
- 完整病歷
- 病歷號
- 正式診斷證明
- 銀行資料

未來如有必要，需重新設計 Privacy / Security。

---

# 31. Timestamp Rule

所有時間使用 ISO 8601。

例如：

```text
2026-09-14T22:30:00+08:00
```

---

# 32. ID Rule

建議 Debug / Demo Prefix：

```text
SES-
USR-
CON-
ASM-
CNP-
PROV-
PSV-
PSA-
REC-
RECI-
LEAD-
KSRC-
KREC-
KVER-
KCHG-
CRAWL-
EXT-
```

正式 DB 可使用 UUID。

---

# 33. Ownership / 負責範圍

## Jerry

中文：

- 整體 Schema
- Consent
- Architecture
- Contract
- Integration
- 核心 Data Model 修改核准

## Engineer A / 工程師 A

中文：

- Provider 原始資料
- ProviderService
- ProviderServiceArea
- Google Maps URL
- 資料清洗
- 資料驗證
- 測試資料

A 不得修改 Assessment、Recommendation、Knowledge、Lead 核心 Schema。

## Engineer B / 工程師 B

中文：

- Provider DB
- Provider API
- Recommendation
- RecommendationItem
- Lead
- Knowledge DB
- Crawler
- KnowledgeChange
- KnowledgeVersion

B 不修改前端 Schema 以外的 UI 實作。

## Engineer C / 工程師 C

中文：

- Session 使用流程
- Consent UI
- Assessment UI
- CareNeedProfile 顯示
- Recommendation API Response 顯示
- Provider UI
- Lead Form

C 不自行修改後端 Schema。

---

# 34. Golden Rule

Frontend 不直接猜 Database。  
Backend 不直接猜 Frontend。  
雙方只透過 `API_CONTRACT.md` 溝通。  
任何 Schema 改動都必須先修改 Spec，再修改 Code。

---

# 35. Source of Truth

```text
PRODUCT_SPEC.md
↓
DATA_MODEL.md
↓
API_CONTRACT.md
↓
TASK
↓
Code
```

Code 與本文件不同時，以本文件為準並停止開發、建立 Issue。
