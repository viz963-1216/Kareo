# Kareo / 長照一點通 — Data Model

Version: v0.2.6（J-002-r13，2026-10-03；D-05a 保存期限與案件關聯、D-16c 內容包身分與匯入操作者）
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

上述箭頭是建立媒合時的業務來源，不代表評估資料必須與案件保存同樣久。Lead 的 `assessmentId`／`recommendationId` 保存來源編號，不設指向 Assessment／RecommendationRun 的外鍵（§22，D-05a）；其他關聯不因此移除。

---

# 4. Session / 匿名工作階段

```text
id
tokenHash
createdAt
updatedAt
lastSeenAt
expiresAt
status
deletedAt
```

MVP 不強迫登入，以 Session 作為主要使用流程識別。

v0.2 補充（ARCHITECTURE §20）：

- `id` 不是秘密，不能單獨當作存取憑證。
- `tokenHash`：session token 的 SHA-256 雜湊；明文 token 只在建立時回傳一次，不寫入資料庫或 log。
- `expiresAt`：閒置 7 天或建立後 30 天（取較早者）。過期後所有需要 session 的 API 回 `SESSION_INVALID`。
- `status`：`ACTIVE`／`DELETION_REQUESTED`／`DELETED`。
- `deletedAt`：清理作業實際刪除關聯資料的時間。

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
withdrawnAt
```

沒有有效 Consent 時，不得開始正式 Assessment。

v0.2 補充：「有效 Consent」＝同一 session、`withdrawnAt` 為空、三個版本組合為 `contracts/legal/consent-versions.json` 中 `ACTIVE` 的組合。撤回時只填 `withdrawnAt`，不刪除紀錄（PRIVACY_AND_RETENTION §3.3）。

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
disabilityCertificate
incomeCategory
homeCareNeed
medicalNursingNeed
assistiveDeviceNeed
transportationNeed
freeText
status
knowledgeVersion
rulesVersion
ruleTrace
createdAt
updatedAt
```

第一版遵守 Data Minimization，不收過多敏感資料。

v0.2.2 補充（J-002-r4）：

- `city`／`district`／`lat`／`lng` 依 `locationPrecision` 可為 null，規則見 §9 與 API_CONTRACT §8。
- `lat`／`lng` 只在 `GPS`／`EXACT` 時保存；寫入前四捨五入到小數 3 位（約 100 公尺，D-13e 已核准），不寫入 log、不複製到 Lead、不提供給服務單位；隨 Assessment 依 PRIVACY_AND_RETENTION §2 刪除。
- `rulesVersion`：產生本結果的規則版本（ASSESSMENT_RULES，例如 `RULES-2026-09-23-r2`）。
- `ruleTrace`：jsonb，只存規則 ID、模板 ID、引用的知識 recordId；**不存**自由文字或關鍵字命中片段。不回傳前端。

---

# 8a. disabilityCertificate（2026-09-24，D-17）

```text
YES
NO
UNKNOWN
```

是否領有身心障礙證明。選填，預設 `UNKNOWN`。屬健康相關敏感資料，保存與刪除同 Assessment（PRIVACY_AND_RETENTION §2）。

---

# 8b. incomeCategory（2026-09-24，D-17a）

```text
LOW_INCOME
MIDDLE_LOW_INCOME
ALLOWANCE
GENERAL
UNKNOWN
```

家庭經濟身分（使用者自選）。選填，預設 `UNKNOWN`。屬敏感資料，只用於估算；保存與刪除同 Assessment。

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

| 值 | 意義 | 必填欄位 |
|---|---|---|
| `NONE` | 不提供位置（含 GPS 拒絕／失敗且未選行政區） | 無，city／district／lat／lng 皆 null |
| `CITY` | 只有縣市 | city |
| `DISTRICT` | 縣市＋行政區 | city、district |
| `GPS` | 裝置定位座標＋使用者選的縣市、行政區 | city、district、lat、lng |
| `EXACT` | 完整地址轉換的座標＋縣市、行政區 | city、district、lat、lng |

推薦排序對應見 API_CONTRACT §9。

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

TRANSPORTATION MVP 不放 Provider，直接導流 Kareocar。

`resourceCategory`（v0.2.5，D-19 Q2）：

```text
SERVICE_PROVIDER          既有服務單位（預設；HOME_CARE／HOME_MEDICAL_NURSING／ASSISTIVE_DEVICE）
ASSISTIVE_DEVICE_CENTER   輔具資源中心（公共資源，只供查詢）
```

- `ASSISTIVE_DEVICE_CENTER` 一律 `type = OTHER`，**不建立 ProviderService**，所以推薦（§20、API_CONTRACT §9）永遠不會選到，也不能建立 Lead。
- 只收官方來源可確認的雙北輔具資源中心；服務範圍同樣只依可追溯證據建立（§19）。
- 既有資料匯入時未提供者視為 `SERVICE_PROVIDER`。住宿機構延後（D-19），屆時另定類別。

Provider Status：

```text
ACTIVE
INACTIVE
UNKNOWN
```

只有 `ACTIVE` 可被推薦。

`lat`／`lng`（v0.2.2 補充；v0.2.4 修訂）：只填**已驗證**座標，或經 Jerry 逐筆核准、有紀錄的非官方座標（目前只有 NTPC-AD-004 吉評，DEC-A003-07，Google Maps 商家標記）；來源、驗證方式、日期與核准紀錄記錄於 A 的資料報告（`data/providers/qa/`，TASK-A-003）。非官方座標在報告中持續標示為非官方，官方門牌資料收錄後改用官方點。無法驗證且未經核准者保持 null，不得由地址或行政區中心點推估。推薦只有在所有候選都有已驗證座標時才使用距離排序（API_CONTRACT §9）。

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

規則（v0.2.4，D-18；整併 Jerry 2026-09-29 DEC-A003-01／02 與 2026-10-01 Issue #49）：

- 只有**可追溯證據**（官方名單的特約服務區域、服務單位本身的正式書面範圍等）證實的行政區，才能建立 active ProviderServiceArea；證據來源與查核日期記錄於 `data/providers/qa/`。
- **不得推定**：不得以地址所在行政區、簽約／特約縣市、母機構（例如醫院本體）的範圍，推定服務單位服務某行政區；不得為了補足推薦家數新增範圍。曾被撤下的推定範圍不得直接恢復，須依最新證據重新查核。
- 輔具服務只限臺北市、新北市（DEC-A003-01）；居家護理須確認服務單位本身提供居家護理才收錄為 `HOME_MEDICAL_NURSING`（DEC-A003-02）。

`serviceAreaStatus`（v0.2.4，推導值，不另存欄位）：

```text
VERIFIED      有至少一筆 active ProviderServiceArea
UNCONFIRMED   沒有任何 active ProviderServiceArea（服務範圍待確認，不代表不提供服務）
```

用途：資源查詢與詳細頁的顯示（API_CONTRACT §10、§10a）。推薦（§20、API_CONTRACT §9）只比對 active ProviderServiceArea，`UNCONFIRMED` 的 Provider 永遠不是推薦候選。

# 19b. ProviderContractRegion / 特約縣市（v0.2.5，D-19 Q1）

```text
id
providerId
city          臺北市／新北市
serviceType   特約的服務類型（MVP 只有 ASSISTIVE_DEVICE）
sourceId      官方特約／簽約名單（A 的資料報告）
checkedAt
active
```

- 記錄「已列於該縣市政府特約名單」的事實，例如 SRC-004（臺北市輔具特約服務門市）、SRC-005（新北市輔具特約廠商）。
- **不是服務範圍**：不得轉成 ProviderServiceArea，推薦不讀取（§19、DEC-A003-01）。
- 公開時只回 `city`、`serviceType`（API_CONTRACT §10）；來源與查核日期留在資料報告。

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

`DISTANCE`、`DISTRICT_ROTATION` 為原始 MVP（PRODUCT_SPEC §21–23）；`CITY_ROTATION`、`NO_LOCATION` 的使用條件已核准（MVP_DECISIONS D-13a／D-13b，2026-09-24），對應見 API_CONTRACT §9。`locationPrecision` 記錄當次 Assessment 的精度。

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
recommendationId
providerId
serviceType
contactName
contactPhone
contactConsentAt
idempotencyKey
status
statusReason
assignedOperatorId
firstContactedAt
closedAt
createdAt
updatedAt
```

v0.2 補充：

- `recommendationId`：Lead 所依據的推薦結果；`providerId` 必須出現在該推薦的 providers 中。
- `contactConsentAt`：使用者勾選媒合聯絡同意的時間（必填）。
- `idempotencyKey`：前端送出時帶的 `Idempotency-Key`；`(sessionId, idempotencyKey)` 唯一。
- `statusReason`：終態原因碼，見 LEAD_OPERATIONS §3。
- `contactName`／`contactPhone`：刪除或保存期限到期時清空為 null，Lead 其餘欄位保留。
- **保存期限分離（D-05a，2026-10-03）**：評估、CareNeedProfile、RecommendationRun／Item 依 PRIVACY_AND_RETENTION §2、§6 清理，不得因 Lead 存在而延長。Lead 案件骨架與其狀態／存取／冪等子表在結案或取消後 1 年清理；聯絡欄位在 180 天到期或自助刪除／撤回時先清空。
- `assessmentId`／`recommendationId` 仍為必填來源編號，但不建立指向健康評估資料的外鍵。移除的範圍只限 `leads_assessment_id_fkey`／`leads_recommendation_id_fkey`；不移除 session、Provider 等其他外鍵。
- 建立 Lead 時仍須驗證有效 session、同意、評估與推薦存在且屬於本人、Provider／服務符合推薦（API_CONTRACT §12）。健康資料已清理後，內部查件可讀案件骨架，不得重建已刪除的健康內容或因來源資料不存在而失敗。
- 狀態轉移規則見 LEAD_OPERATIONS §3，每次轉移寫入 LeadStatusEvent（§37）。

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
KAREO_DRIVE
```

`KAREO_DRIVE`（2026-09-24，D-15）：Jerry 指定資料夾中的檔案；`sourceUrl` 為 `https://drive.google.com/file/d/<fileId>/view`，原發布機關記錄於 Source Registry。

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
packId
packRecordId
contentFingerprint
createdAt
updatedAt
```

- `packId`＋`packRecordId`：來源內容包與包內紀錄 id（匯入冪等鍵）。
- `version`：**第一次被發布時**的版本，之後不因 carry-forward 覆寫；某版本實際包含哪些紀錄以 §26a 為準（B-008-r3）。
- `contentFingerprint`：審核內容指紋（`sha256:<hex>`），由後端依實際保存欄位計算；核准必須比對此值（B-008-r4、API_CONTRACT §26.6）。

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
withdrawnAt
withdrawnBy
withdrawalReason
```

- `id` 一律等於內容包的 `intendedKnowledgeVersion`（D-03），不由程式自行產生。
- `withdrawnAt`／`withdrawnBy`／`withdrawalReason` 只在「撤回」時填入，與一般發布造成的 `ARCHIVED` 區分；曾被撤回的版本不得再被恢復（API_CONTRACT §26.10）。
- `publishedAt` 為最近一次成為 `PUBLISHED` 的時間（恢復時更新）。

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

## 26a. KnowledgeVersionRecord / 版本內容快照（v0.2.3，B-008-r3）

```text
versionId
knowledgeRecordId
```

每次發布時寫入該版本實際包含的全部紀錄（新增＋沿用），不可變、不覆寫、不刪除。撤回與恢復、發布預覽的 `totalRecordCount`、可恢復版本的 `recordCount` 都以此表為準（API_CONTRACT §26.8、§26.10）。

## 26b. KnowledgeContentPack / 內容包登錄（v0.2.4，D-16b）

匯入內容包時保存內容包層級資料，讓發布預覽與發布（API_CONTRACT §26.8–26.9）不必讀檔案。表名與 DDL 由 B-012 決定，至少包含：

```text
packId                    主鍵（= 內容包 packId）
formatVersion
intendedKnowledgeVersion  KB-YYYY-MM-DD-NNN
sourceRegistryVersion
status                    NEEDS_REVIEW / APPROVED / REJECTED（內容包層級）
reviewedBy / reviewedAt / reviewDecision   取自內容包的 review
packFingerprint           sha256：依 recordId 排序的 (recordId, contentFingerprint)，加上 intendedKnowledgeVersion、status
recordsFingerprint        sha256：依 recordId 排序的 (recordId, contentFingerprint)，不含版號／狀態
importedAt / importedBy / updatedAt
```

規則：

- 發布候選＝紀錄 `APPROVED` **且**所屬內容包在本表為 `APPROVED`；找不到登錄資料視同未核准（`PACK_NOT_APPROVED`）。
- 內容包 `APPROVED` 只能經由匯入「已由 Jerry 在 PR 核准（`status = APPROVED` 且有內容包層級 `review`）」的檔案取得；管理頁不提供整包核准。
- 同一 `packId` 重新匯入：只有每筆 `contentFingerprint` 都不變時，才可把狀態由 `NEEDS_REVIEW` 升為 `APPROVED`；內容有變一律拒絕，必須使用新 `packId`。
- 既有資料以回填指令登錄：讀 `contracts/knowledge/packs/*.json`，逐筆比對資料庫內容指紋，一致才登錄。
- `recordsFingerprint` 用於內容不變的比較；`packFingerprint` 仍包含版號與狀態，不以刪除雜湊輸入來允許狀態升級。匯入與回填使用相同紀錄集合與算法（包含內容包的 REJECTED 紀錄）。
- **匯入操作者（D-16c）**：`importedBy` 保存實際授權操作者的 InternalOperator ID，不是 `CLI:importKnowledgePack` 等程式名稱、內容審核人或任意預設字串。寫入／回填必須提供身分並重用既有個人密鑰及 `KNOWLEDGE_PUBLISHER` 角色驗證；密鑰不進參數、log 或 GitHub。離線驗證不得虛構操作者或寫入稽核。
- `importedAt`／`importedBy` 是首次登錄（含本次回填）的時間與執行者；冪等重跑保留原值。回填不冒充歷史匯入人／時間；逐筆 review 的人與時間仍取原核准證據（§26c）。
- 已提交內容的不可變規則亦適用尚未登錄的舊包：同一 packId／recordId 的內容不同時拒絕／跳過並列出需人工處理的差異，不走「先更正草稿、再核准」的繞行路徑。只允許不改內容的既有指紋格式相容／回填；實際內容修正使用新批次與新紀錄，保留舊核准／發布證據（contracts/knowledge/README §1、§3）。

## 26c. KnowledgeRecordReview / 逐筆審核紀錄（v0.2.4，D-16b）

只能新增，不可修改或刪除。CLI 核准（內容包 `review`）與管理頁核准／退回（API_CONTRACT §26.6）寫入同一份紀錄，並與紀錄狀態更新在同一交易內：

```text
id
knowledgeRecordId
decision            APPROVED / REJECTED
reviewedBy
reviewedAt
reason              管理頁必填；CLI 取內容包 review 的註記（可為 null）
contentFingerprint  核准當下的內容指紋
channel             CLI_PACK / ADMIN_API
```

管理頁操作仍另寫 §41 AdminAuditEvent；本表是「這筆內容由誰、依據哪個內容指紋核准」的唯一來源。既有已核准紀錄由回填指令以 `CLI_PACK` 補登。

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
DISMISSED
```

`DISMISSED`（v0.2.3，D-16a）：操作者在管理頁確認「來源有變但不影響已審核內容」（API_CONTRACT §26.7），必填原因，記錄於 `reviewedAt`／`reviewedBy` 與 §41 稽核紀錄。會影響內容的變更不得以 `DISMISSED` 結案，需以新內容包提交審核。

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

MVP 目前主要是 Kareocar。

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
  "name": "Kareocar",
  "serviceType": "TRANSPORTATION",
  "url": "https://kareocar.netlify.app/",
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

---

# 36. InternalOperator / 內部操作者（v0.2）

```text
id
displayName
roles
keyHash
active
createdAt
revokedAt
```

roles：

```text
LEAD_OPERATOR
DATA_STEWARD
KNOWLEDGE_PUBLISHER
```

只供受保護內部指令與管理 API 使用（LEAD_OPERATIONS §4、contracts/knowledge/README §4、API_CONTRACT §26）；管理 API 只接受以個人密鑰換得的短效管理 token，不提供一般使用者 API。`keyHash` 為操作者個人密鑰雜湊。

---

# 37. LeadStatusEvent / 媒合狀態歷程（v0.2）

```text
id
leadId
fromStatus
toStatus
reasonCode
note
operatorId
createdAt
```

`note` 不得包含姓名、電話或健康細節。

`operatorId` 可為 null，僅表示撤回同意／自助刪除觸發的系統自動取消（`CONSENT_WITHDRAWN`／`USER_DELETED`）。真人更新仍須驗證並記錄其 InternalOperator ID，不使用虛構共用系統帳號。系統只取消未終態 Lead；已 CLOSED／CANCELLED 不改狀態、不追加取消事件，但聯絡欄位仍須清空。

---

# 38. LeadAccessEvent / 聯絡資料存取紀錄（v0.2）

```text
id
leadId
operatorId
action
createdAt
```

action：`REVEAL_CONTACT`。

---

# 39. RateLimitCounter / 限流計數（v0.2）

```text
key
windowStart
count
expiresAt
```

`key` 由規則名稱＋session id 或 IP 雜湊組成，不存 IP 明文。必須持久化（資料庫），不得只用單一 function instance 記憶體（ARCHITECTURE §20.4）。

---

# 40. DeletionRun / 清理作業紀錄（v0.2）

```text
id
startedAt
finishedAt
dryRun
status
sessionsDeleted
leadsContactCleared
leadsDeleted
consentsDeleted
errorMessage
operatorId
```

status：`RUNNING`／`SUCCESS`／`FAILED`。`errorMessage` 不得包含個資。

`leadsDeleted`／`consentsDeleted` 分別是案件整筆與同意證據清理計數（D-05a）。各類計數可能重疊，例如已滿 1 年且仍有聯絡欄位的案件可同時計入清空與整筆刪除，不可相加當作不重複人數。dry-run 不寫入資料／執行紀錄；實際執行留結果，已清理資料重跑不重複計數。Session 現有狀態墓碑不能當成健康資料實體刪除證據；墓碑的必要欄位與最終保存期限仍須在 D-05 審閱確認，不因此授權永久保留憑證或關聯資料。

---

# 41. AdminAuditEvent / 管理操作稽核紀錄（v0.2.3，D-16a）

```text
id
operatorId
action
targetType
targetId
reason
detail
createdAt
```

action：

```text
KNOWLEDGE_RECORD_APPROVED
KNOWLEDGE_RECORD_REJECTED
KNOWLEDGE_CHANGE_DISMISSED
KNOWLEDGE_VERSION_PUBLISHED
KNOWLEDGE_VERSION_WITHDRAWN
```

- 每個成功的管理 API 寫入（API_CONTRACT §26）與同一筆資料變更在同一交易內寫入；寫入失敗則整個操作失敗。
- `targetType`：`KNOWLEDGE_RECORD`／`KNOWLEDGE_CHANGE`／`KNOWLEDGE_VERSION`。`reason`：decision、dismiss、withdraw 必填；publish 為 `null`。
- `detail`（jsonb）只放非敏感的結果：例如核准時的 `contentFingerprint`、發布的版號與五個數量、撤回的 `republishVersionId`。不得包含密鑰、token 或個資。
- 只能新增，不得修改或刪除；只有 service_role 可寫入。
