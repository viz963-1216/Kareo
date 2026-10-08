# Kareo / 長照一點通 — API Contract

Version: v0.7.1（J-002-r13，2026-10-03；§6–7 刪除完成期限及終態案件行為澄清，回應格式不變）
Status: v0.6 §10／§10a 追加欄位與 §13a 依 D-19 **SPEC-APPROVED 2026-10-01**（[Issue #49 comment 5926683690](https://github.com/viz963-1216/Kareo/issues/49#issuecomment-5926683690)）；v0.5 §10a／§10 新增欄位 **SPEC-APPROVED 2026-10-01**（D-18a–e，[PR #50 comment 5925833841](https://github.com/viz963-1216/Kareo/pull/50#issuecomment-5925833841)）；§26.8 內容包規則依 D-16b **SPEC-APPROVED 2026-10-01**；v0.1 內容 LOCKED FOR MVP；v0.2 session／安全段落（D-04）**SPEC-APPROVED 2026-09-24**；v0.2.2 位置與補助整併（D-13a–g、D-14a–b）**SPEC-APPROVED 2026-09-24**；Lead 接件（D-06）與同意版本（D-05）仍為 PROPOSED；§26 v0.4（D-16a）**SPEC-APPROVED 2026-09-29**  
Owner: Jerry

---

# 1. 目的

本文件定義前端與後端之間的固定資料交換格式。

本專案採中心整合制：

- Engineer B / 工程師 B：後端
- Engineer C / 工程師 C：前端
- Jerry：Mock → Real API、整合、Contract Change、最終測試

B 與 C 不直接整合彼此程式，只需遵守本文件。

---

# 2. 核心規則

所有 AI 與工程師不得自行：

- 修改 Endpoint
- 修改欄位名稱
- 修改資料型態
- 修改 enum
- 刪除欄位
- 改變 Response 結構

如果規格不足：

```text
建立 Issue
↓
Jerry Review
↓
修改 API_CONTRACT.md
↓
才能修改 Code
```

---

# 3. Base URL

```text
/api/v1
```

v0.2 變更說明：MVP 尚未對外上線，以下 session 持有證明、冪等與錯誤碼屬 v1 內的補強，沒有既有正式使用者受影響，因此不另開 `/v2`（§22）。

## 3.1 Session 持有證明（v0.2）

除下列公開 endpoint 外，所有 API 必須帶 Header：

```text
X-Kareo-Session-Token: <sessionToken>
```

不需要 session 的公開 endpoint：

```text
POST /api/v1/session
GET  /api/v1/providers                 （v0.5，§10a 公開資源查詢）
GET  /api/v1/providers/{providerId}
GET  /api/v1/external-services/transportation
GET  /api/v1/knowledge/status
GET  /api/v1/knowledge/records         （v0.6，§13a 公開長照資訊查詢）
```

- Body 中的 `sessionId` 必須與 token 所屬 session 相同，否則 `FORBIDDEN`。
- 引用的 `assessmentId`／`recommendationId` 不屬於同一 session 時回 `NOT_FOUND`（不透露是否存在）。
- 規則細節見 ARCHITECTURE §20。
- `/api/v1/admin/**`（§26）不使用 session token，改以 `X-Kareo-Admin-Token` 驗證操作者身分與角色；不接受匿名呼叫。

## 3.2 HTTP Status 對照（v0.2）

| error.code | HTTP |
|---|---|
| `INVALID_REQUEST` | 400 |
| `VALIDATION_ERROR` | 400 |
| `SESSION_INVALID` | 401 |
| `CONSENT_REQUIRED` | 403 |
| `FORBIDDEN` | 403 |
| `NOT_FOUND` | 404 |
| `IDEMPOTENCY_CONFLICT` | 409 |
| `INVALID_STATUS_TRANSITION` | 409（僅內部工具與 §26 管理 API） |
| `KNOWLEDGE_STATE_CHANGED` | 409（僅 §26 管理 API，v0.4） |
| `PAYLOAD_TOO_LARGE` | 413 |
| `RATE_LIMITED` | 429（附 `Retry-After` header） |
| `INTERNAL_ERROR` | 500 |
| `KNOWLEDGE_UNAVAILABLE` | 503 |
| `AI_UNAVAILABLE` | 503（保留；MVP 不使用 AI，不會回傳） |

`NO_PROVIDER_FOUND` 保留但 Recommendation 查無結果時仍回 `success: true` 與空陣列（§9），不得以錯誤回應。

## 3.3 Idempotency-Key（v0.2）

`POST /api/v1/leads` 必須帶：

```text
Idempotency-Key: <UUID>
```

- 同一 session＋同一 key＋同內容 → 回傳原結果（HTTP 200）。
- 同一 session＋同一 key＋不同內容 → `IDEMPOTENCY_CONFLICT`。
- 缺少或格式錯誤 → `VALIDATION_ERROR`。

## 3.4 限制（v0.2）

Body 上限 16 KB；`freeText` 500 字；限流規則見 ARCHITECTURE §20.4。超過限流回 `RATE_LIMITED`。

---

# 4. 通用成功格式

```json
{
  "success": true,
  "data": {}
}
```

---

# 5. 通用錯誤格式

```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "請確認輸入資料"
  }
}
```

MVP Error Code：

```text
INVALID_REQUEST
NOT_FOUND
VALIDATION_ERROR
CONSENT_REQUIRED
NO_PROVIDER_FOUND
KNOWLEDGE_UNAVAILABLE
INTERNAL_ERROR
```

v0.2 新增：

```text
SESSION_INVALID
FORBIDDEN
RATE_LIMITED
PAYLOAD_TOO_LARGE
IDEMPOTENCY_CONFLICT
AI_UNAVAILABLE
INVALID_STATUS_TRANSITION
```

v0.4 新增（只用於 §26 管理 API）：

```text
KNOWLEDGE_STATE_CHANGED
```

`KNOWLEDGE_STATE_CHANGED`：操作者在畫面上看到的知識狀態（發布預覽、紀錄內容指紋、目前發布版本、可恢復版本）在送出前已改變。資料不變；前端需重新讀取並請操作者重新確認（§26.1）。

`AI_UNAVAILABLE`：保留給未來引入 AI 時使用。MVP 使用規則引擎（D-01），不會產生此錯誤碼；規則引擎、Knowledge resolver 或資料庫失敗依 §3.2 回 `KNOWLEDGE_UNAVAILABLE` 或 `INTERNAL_ERROR`，不得回成功格式的預設結果。

HTTP status 見 §3.2。

---

# 6. Session API / 使用者暫存工作階段

## POST /api/v1/session

用途：建立匿名 Session。

### Request

不需要 Body。

### Response

```json
{
  "success": true,
  "data": {
    "sessionId": "SES-001",
    "sessionToken": "k7Qm...（至少 256 bits，base64url）",
    "createdAt": "2026-09-14T22:00:00+08:00",
    "expiresAt": "2026-09-21T22:00:00+08:00"
  }
}
```

v0.2：`sessionToken` 只在此回應出現一次，前端存於 `sessionStorage` 並在後續請求放入 `X-Kareo-Session-Token`。`expiresAt` 為目前閒置到期時間。

## DELETE /api/v1/session（v0.2）

用途：使用者刪除自己的資料（PRIVACY_AND_RETENTION §6.1）。需要 `X-Kareo-Session-Token`，無 Body。

```json
{
  "success": true,
  "data": {
    "sessionId": "SES-001",
    "status": "DELETION_REQUESTED",
    "deletionScheduledBefore": "2026-09-21T22:00:00+08:00"
  }
}
```

呼叫後 token 立即失效；重複呼叫回 `SESSION_INVALID`。

立即清空該 session 全部 Lead 的聯絡欄位（包括 CLOSED／CANCELLED）；只把未終態案件取消並記 `USER_DELETED` 系統事件。`deletionScheduledBefore` 是請求後不超過 7 天的完成期限，不是開始清理的時間。評估／Profile／推薦資料按期限實體刪除，不因案件仍保存而排除（D-05a；DATA_MODEL §22）。回應結構不變。

---

# 7. Consent API / 同意與免責聲明

## POST /api/v1/consent

### Request

```json
{
  "sessionId": "SES-001",
  "disclaimerVersion": "1.0",
  "privacyVersion": "1.0",
  "termsVersion": "1.0",
  "accepted": true
}
```

### Response

```json
{
  "success": true,
  "data": {
    "consentId": "CON-001",
    "acceptedAt": "2026-09-14T22:02:00+08:00"
  }
}
```

`accepted=false` 時不得開始正式 Assessment。

v0.2：需要 `X-Kareo-Session-Token`。三個版本必須是 `contracts/legal/consent-versions.json` 中 `ACTIVE` 的組合，否則 `VALIDATION_ERROR`。

## POST /api/v1/consent/withdraw（v0.2）

需要 `X-Kareo-Session-Token`，無 Body。

```json
{
  "success": true,
  "data": {
    "withdrawnAt": "2026-09-14T23:00:00+08:00",
    "sessionStatus": "DELETION_REQUESTED"
  }
}
```

撤回後 session 進入刪除流程，token 失效，未終態 Lead 轉為 `CANCELLED`（`CONSENT_WITHDRAWN`）。

該 session 全部 Lead 的聯絡欄位立即清空；終態案件不改狀態、不新增取消事件。健康評估資料同樣須在請求後 7 天內完成清理（PRIVACY_AND_RETENTION §6.1），同意證據按自己的 3 年保存規則處理。回應結構不變。

---

# 8. Assessment API / 長照初步評估

## POST /api/v1/assessments

### Request

```json
{
  "sessionId": "SES-001",
  "ageRange": "75_84",
  "location": {
    "city": "新北市",
    "district": "三重區",
    "precision": "DISTRICT",
    "lat": null,
    "lng": null
  },
  "livingSituation": "WITH_FAMILY",
  "caregiverSituation": "FAMILY_LIMITED",
  "mobilityLevel": "NEEDS_ASSISTANCE",
  "dailyLivingLevel": "PARTIAL_ASSISTANCE",
  "needs": {
    "homeCare": "YES",
    "medicalNursing": "UNKNOWN",
    "assistiveDevice": "YES",
    "transportation": "YES"
  },
  "disabilityCertificate": "UNKNOWN",
  "incomeCategory": "UNKNOWN",
  "freeText": "最近上下樓比較困難，家人白天需要上班。"
}
```

### Response

```json
{
  "success": true,
  "data": {
    "assessmentId": "ASM-001",
    "knowledgeVersion": "KB-2026-09-14-001",
    "careNeedProfile": {
      "id": "CNP-001",
      "careNeeds": [
        "HOME_CARE",
        "ASSISTIVE_DEVICE",
        "TRANSPORTATION"
      ],
      "priority": [
        "HOME_CARE",
        "TRANSPORTATION",
        "ASSISTIVE_DEVICE"
      ],
      "summary": "依目前提供的資訊，可能優先需要居家照顧協助，並有交通及輔具相關需求。",
      "warnings": [
        "本結果僅為初步預估",
        "實際長照資格及補助仍需由照顧管理專員正式評估"
      ]
    }
  }
}
```

v0.2：需要 `X-Kareo-Session-Token`。錯誤：無有效同意 `CONSENT_REQUIRED`；無 PUBLISHED 知識 `KNOWLEDGE_UNAVAILABLE`。MVP 由規則引擎產生結果（ASSESSMENT_RULES），Response 格式不變。任何失敗都不得回傳成功格式的預設結果。

### location 欄位（v0.2.2，J-002-r4）

`location` 物件**一律存在**；四個子欄位都**一律出現**，不適用時為 `null`（不省略）。`precision` 決定哪些欄位必填：

| `precision` | 意義 | `city` | `district` | `lat`／`lng` | 取得方式 |
|---|---|---|---|---|---|
| `NONE` | 使用者不提供位置 | `null` | `null` | `null` | 使用者選「不提供」，或 GPS 失敗且未選行政區 |
| `CITY` | 只有縣市 | 必填 | `null` | `null` | 使用者只選縣市 |
| `DISTRICT` | 縣市＋行政區 | 必填 | 必填 | `null` | 使用者選縣市與行政區（MVP 預設路徑） |
| `GPS` | 裝置定位 | 必填 | 必填 | 必填（WGS84 十進位度數） | 瀏覽器定位，使用者同意後取得；縣市與行政區仍由使用者選擇（D-13d） |
| `EXACT` | 可定位的完整地址 | 必填 | 必填 | 必填 | 由完整地址轉換座標；轉換服務待 Jerry 決定（D-13d） |

- `city` 只接受 `臺北市`、`新北市`（MVP 服務地區，PRODUCT_SPEC §7）。其他縣市的使用者以 `NONE` 送出（D-14b）。
- 組合不符上表 → `VALIDATION_ERROR`（例如 `DISTRICT` 缺 `district`、`NONE` 卻帶座標、`lat` 超出 −90～90）。
- **不提供位置仍可完成評估**：`NONE`／`CITY` 不得因缺少位置被拒。
- 座標只用於推薦距離計算；保存與刪除依 PRIVACY_AND_RETENTION §2（D-13e）。

### disabilityCertificate（v0.3.1，2026-09-24，D-17）

- 值：`YES`／`NO`／`UNKNOWN`（是否領有身心障礙證明）。選填；未提供時後端視為 `UNKNOWN`（向下相容，舊前端不會被拒）。其他值 → `VALIDATION_ERROR`。
- 不收障礙類別、等級或證明影本。
- `YES` 時，summary 另含身心障礙福利補助說明（ASSESSMENT_RULES §6.5）；`UNKNOWN` 時含一句提示；`NO` 時不提。回應格式不變。

### incomeCategory（v0.3.2，2026-09-24，D-17a）

- 值：`LOW_INCOME`（低收入戶）／`MIDDLE_LOW_INCOME`（中低收入戶）／`ALLOWANCE`（領有中低收入老人生活津貼或身心障礙者生活補助，但非低收、中低收）／`GENERAL`（以上皆非）／`UNKNOWN`。選填；未提供視為 `UNKNOWN`。其他值 → `VALIDATION_ERROR`。
- 用途：結果頁的個人自付估算（ASSESSMENT_RULES §6.6）。不收收入金額、存款或證明文件。回應格式不變。

### summary 格式（v0.2.2）

`careNeedProfile.summary` 仍是單一字串（不新增欄位）。內容由 ASSESSMENT_RULES §6 的模板組成，句子之間以 `\n` 分隔；包含需求、可能資格、可能適用的補助說明（金額／比率為官方規則說明，非核定結果）、地方資訊與下一步。前端逐行顯示，不解析內容。範例：`contracts/mock/assessments/WITH-SUBSIDY-NEW_TAIPEI.json`（Mock，數值不代表已核准知識）。

Care Need Enum：

```text
HOME_CARE
HOME_MEDICAL_NURSING
ASSISTIVE_DEVICE
TRANSPORTATION
```

---

# 9. Recommendation API / 服務單位推薦

## POST /api/v1/recommendations

TRANSPORTATION 不使用此 API。

v0.2：需要 `X-Kareo-Session-Token`；`assessmentId` 必須屬於同一 session。

### 位置與排序（v0.2.2，J-002-r4；依 PRODUCT_SPEC §20–24）

位置來自該 Assessment 的 `location`（§8），Request 不另帶位置。所有候選都先經過：`status = ACTIVE` → 服務類型相符（ProviderService.active）→ 服務範圍相符（ProviderServiceArea.active；服務範圍與地址分開，PRODUCT_SPEC §19）。

| Assessment `precision` | 服務範圍比對 | 條件 | `rankingType` | 排序 | `distanceKm` | 狀態 |
|---|---|---|---|---|---|---|
| `GPS`／`EXACT` | 縣市＋行政區 | 所有候選都有已驗證座標 | `DISTANCE` | Haversine 直線距離由近到遠；同距離依 `providerId` 升冪 | 數值（公里，四捨五入到小數 1 位） | 原始 MVP（§21） |
| `GPS`／`EXACT` | 縣市＋行政區 | 任一候選缺已驗證座標（部分或全部） | `DISTRICT_ROTATION` | 同下列穩定輪替 | `null` | **APPROVED D-13c** |
| `DISTRICT` | 縣市＋行政區 | — | `DISTRICT_ROTATION` | 穩定輪替（D-13f） | `null` | 原始 MVP（§22–23） |
| `CITY` | 服務範圍含該縣市任一行政區 | — | `CITY_ROTATION` | 穩定輪替（seed 不含行政區） | `null` | **APPROVED D-13a** |
| `NONE` | 不比對 | — | `NO_LOCATION` | 不推薦，`providers = []` | — | **APPROVED D-13b**（前端在 NONE 時不呼叫本 API） |

規則：

- **不得**用未驗證座標、地址或行政區中心點推估距離；`distanceKm` 與「距離約 X 公里」**只在** `rankingType = DISTANCE` 出現。
- 除 `DISTANCE` 外，`notice` 必須說明「並非依實際距離排序」；任何 rankingType 都不得出現「最近」「附近」。
- 最多回傳 3 家；1 或 2 家就回 1 或 2 家；0 家回 `success: true`＋空陣列＋提醒 `notice`，不得 Error（§20）。
- 穩定輪替（D-13f 建議）：以 `sha256(sessionId|city|district|date|providerId)` 由小到大排序，`date` 為 Asia/Taipei 的 `YYYY-MM-DD`；`CITY_ROTATION` 的 seed 不含 `district`。同 session 同日結果相同，不同日期可輪替；禁止純 Random。
- 每次推薦寫入 RecommendationRun（`rankingType`、`locationPrecision`）與 RecommendationItem（DATA_MODEL §20–21）。

回應欄位（所有 rankingType 一致）：

| 欄位 | 規則 |
|---|---|
| `rankingType` | 一律存在：`DISTANCE`／`DISTRICT_ROTATION`／`CITY_ROTATION`／`NO_LOCATION` |
| `locationPrecision` | 一律存在，等於 Assessment 的 `location.precision`（空結果也要有） |
| `providers` | 一律存在，0–3 筆 |
| `providers[].distanceKm` | 一律存在；只有 `DISTANCE` 為數值，其餘為 `null` |
| `providers[].reasons` | 可理解的推薦原因；只有 `DISTANCE` 可含「距離約 X 公里」 |
| `notice` | 一律存在，依上表說明排序依據或補充位置提示 |

Mock：`contracts/mock/recommendations/`（`DISTRICT_ROTATION`）與 `ranking-variants/`（`DISTANCE`、`DISTANCE` 缺座標改行政區、`CITY_ROTATION`、`NO_LOCATION`）。以上格式已於 2026-09-24 核准（D-13a–c）。

### Request

```json
{
  "assessmentId": "ASM-001",
  "serviceType": "HOME_CARE"
}
```

### 精確位置 Response

```json
{
  "success": true,
  "data": {
    "recommendationId": "REC-001",
    "serviceType": "HOME_CARE",
    "rankingType": "DISTANCE",
    "locationPrecision": "GPS",
    "providers": [
      {
        "id": "PROV-001",
        "name": "測試居家照顧中心",
        "type": "HOME_CARE",
        "address": "新北市三重區測試路100號",
        "district": "三重區",
        "phone": "02-12345678",
        "website": null,
        "googleMapsUrl": "https://maps.google.com/...",
        "verified": true,
        "rank": 1,
        "distanceKm": 1.8,
        "reasons": [
          "服務範圍包含三重區",
          "提供您需要的居家照顧服務",
          "距離約 1.8 公里"
        ]
      }
    ],
    "notice": "以下結果依您提供的位置與需求進行初步推薦，距離為直線距離的約略值。"
  }
}
```

### 只有行政區 Response

```json
{
  "success": true,
  "data": {
    "recommendationId": "REC-002",
    "serviceType": "HOME_CARE",
    "rankingType": "DISTRICT_ROTATION",
    "locationPrecision": "DISTRICT",
    "providers": [
      {
        "id": "PROV-010",
        "name": "測試長照服務中心",
        "type": "HOME_CARE",
        "address": "新北市三重區測試路200號",
        "district": "三重區",
        "phone": "02-87654321",
        "website": null,
        "googleMapsUrl": "https://maps.google.com/...",
        "verified": true,
        "rank": 1,
        "distanceKm": null,
        "reasons": [
          "服務範圍包含三重區",
          "提供您需要的居家照顧服務"
        ]
      }
    ],
    "notice": "目前依您提供的行政區推薦符合條件的服務單位。因尚未提供精確位置，此結果並非依實際距離排序。"
  }
}
```

最多回傳 3 家。只有 2 家就回 2 家。0 家時回空陣列，不得直接 Error。

### Empty Response

```json
{
  "success": true,
  "data": {
    "recommendationId": "REC-003",
    "serviceType": "HOME_CARE",
    "rankingType": "DISTRICT_ROTATION",
    "locationPrecision": "DISTRICT",
    "providers": [],
    "notice": "目前尚未找到符合條件的服務單位，建議查看更多官方資源或聯絡 1966。"
  }
}
```


### 精確位置但候選缺座標 Response（APPROVED D-13c）

```json
{
  "success": true,
  "data": {
    "recommendationId": "REC-004",
    "serviceType": "HOME_CARE",
    "rankingType": "DISTRICT_ROTATION",
    "locationPrecision": "GPS",
    "providers": [
      { "id": "PROV-010", "rank": 1, "distanceKm": null, "reasons": ["服務範圍包含三重區", "提供您需要的居家照顧服務"] }
    ],
    "notice": "部分服務單位尚無已確認的位置資料，本次改依您選擇的行政區推薦，並非依實際距離排序。"
  }
}
```

（`providers[]` 其餘欄位同上，此處省略。）

### 只有縣市 Response（APPROVED D-13a）

```json
{
  "success": true,
  "data": {
    "recommendationId": "REC-005",
    "serviceType": "HOME_CARE",
    "rankingType": "CITY_ROTATION",
    "locationPrecision": "CITY",
    "providers": [
      { "id": "PROV-020", "rank": 1, "distanceKm": null, "reasons": ["服務範圍包含新北市部分行政區", "提供您需要的居家照顧服務"] }
    ],
    "notice": "目前只依您提供的縣市推薦，並非依實際距離排序，也不代表能服務您所在的行政區。補充行政區後可取得更適合的推薦。"
  }
}
```

### 沒有位置 Response（APPROVED D-13b）

前端在 `NONE` 時不呼叫本 API，直接顯示服務建議與補充位置提示。若仍被呼叫：

```json
{
  "success": true,
  "data": {
    "recommendationId": "REC-006",
    "serviceType": "HOME_CARE",
    "rankingType": "NO_LOCATION",
    "locationPrecision": "NONE",
    "providers": [],
    "notice": "您尚未提供位置，因此無法推薦服務單位。提供縣市或行政區後，可以取得符合服務範圍的推薦。"
  }
}
```

---

# 10. Provider Detail API / 服務單位詳細資料

## GET /api/v1/providers/{providerId}

### Response

```json
{
  "success": true,
  "data": {
    "id": "PROV-001",
    "name": "測試居家照顧中心",
    "type": "HOME_CARE",
    "address": "新北市三重區測試路100號",
    "city": "新北市",
    "district": "三重區",
    "phone": "02-12345678",
    "website": null,
    "googleMapsUrl": "https://maps.google.com/...",
    "verified": true,
    "services": ["HOME_CARE"],
    "serviceAreas": [
      {
        "city": "新北市",
        "district": "三重區"
      }
    ]
  }
}
```

Google Maps URL 一律由 Provider 資料提供，Frontend 不自行組 URL。

v0.5 新增欄位（只新增，既有欄位不變）：

| 欄位 | 型態 | 規則 |
|---|---|---|
| `serviceAreaStatus` | `VERIFIED`／`UNCONFIRMED` | 由後端依資料推導，不另存：該 Provider 有至少一筆 active ProviderServiceArea → `VERIFIED`；沒有 → `UNCONFIRMED`。`serviceAreas` 只列已驗證的 active 範圍；`UNCONFIRMED` 時 `serviceAreas = []` |

- `UNCONFIRMED` 代表「目前沒有可追溯證據確認服務哪些行政區」，**不是**「不提供服務」。前端固定顯示「服務範圍待確認，請洽機構」，不得以地址、所在縣市或其他來源補上範圍（D-18）。
- 範例：`contracts/mock/providers/PROV-MOCK-204.json`（`UNCONFIRMED`）；其餘 `PROV-MOCK-*` 為 `VERIFIED`。

v0.6 新增欄位（只新增，D-19）：

| 欄位 | 型態 | 規則 |
|---|---|---|
| `resourceCategory` | `SERVICE_PROVIDER`／`ASSISTIVE_DEVICE_CENTER` | `SERVICE_PROVIDER`：既有服務單位。`ASSISTIVE_DEVICE_CENTER`：輔具資源中心（D-19 Q2），`type = OTHER`、`services = []`，**永遠不是推薦候選**（推薦要求服務類型相符） |
| `contractRegions` | `{ city, serviceType }[]` | 已列於該縣市政府特約名單的事實（D-19 Q1），例如 `{ "city": "臺北市", "serviceType": "ASSISTIVE_DEVICE" }`；沒有資料時為 `[]`。**不是服務範圍**：不代表能到府或服務某行政區，推薦（§9）永遠不讀。前端顯示「列於臺北市輔具特約廠商名單」等文字，並說明長照輔具補助須向核定縣市的特約廠商購置 |

範例：`PROV-MOCK-202`（臺北市、新北市特約）、`PROV-MOCK-301`（輔具資源中心）。
- 本端點是公開端點（§3.1），可從推薦結果或資源查詢（§10a）進入。**詳細頁本身不是媒合入口**：「我要媒合」只能帶著推薦結果（`recommendationId`）進入 §12；從資源查詢進入時，前端不得顯示媒合按鈕，改為引導「先完成免費評估」。

---

# 10a. Resource Lookup API / 公開資源查詢（v0.5，D-18）

## GET /api/v1/providers

讓使用者**不必先做評估**就能查詢 Kareo 收錄的服務單位（PRODUCT_SPEC §14a）。這是資訊查詢，**不是個案推薦**：不讀取或建立 session、Assessment、RecommendationRun，不需要健康或聯絡資料，結果不得作為 §12 媒合的依據。

- 公開端點，不需要 `X-Kareo-Session-Token`（§3.1）。限流見 ARCHITECTURE §20.4。
- 只回 `status = ACTIVE` 的 Provider；詳細資料沿用 §10 `GET /api/v1/providers/{providerId}`。
- 不排序推薦、不輪替、不計算距離；不回傳 `rank`、`distanceKm`、`reasons`。

### Query 參數

| 參數 | 必填 | 規則 |
|---|---|---|
| `resourceCategory` | 否 | v0.6。`SERVICE_PROVIDER`／`ASSISTIVE_DEVICE_CENTER`；省略＝全部 |
| `serviceType` | 否 | `HOME_CARE`／`HOME_MEDICAL_NURSING`／`ASSISTIVE_DEVICE`（沿用 DATA_MODEL §18）；只回該服務 active 的 Provider（輔具資源中心沒有服務類型，不會出現）。與 `resourceCategory = ASSISTIVE_DEVICE_CENTER` 同時提供 → `VALIDATION_ERROR` |
| `city` | 否 | 只接受 `臺北市`、`新北市`（`contracts/reference/service-districts.json`） |
| `district` | 否 | 必須同時提供 `city`，且屬於該縣市 |
| `areaFilter` | 否 | `LOCATED_IN`（依機構所在地 `city`／`district`）或 `SERVICE_AREA`（只比對已驗證的 active ProviderServiceArea）。有 `city` 時省略＝`LOCATED_IN`；沒有 `city` 時不得提供 |
| `includeUnconfirmed` | 否 | `true`／`false`，預設 `false`。只在 `areaFilter = SERVICE_AREA` 時可為 `true`：在已驗證結果之後附上 `serviceAreaStatus = UNCONFIRMED` 的 Provider（同 `serviceType`、`q` 條件） |
| `contractCity` | 否 | v0.6。`臺北市`／`新北市`；只回 `contractRegions` 含該縣市的 Provider（有 `serviceType` 時，特約的服務類型也須相同）。可與地區篩選同時使用（AND） |
| `q` | 否 | 名稱關鍵字，去除前後空白後 1–50 字，比對 `name` 是否包含 |
| `page` | 否 | 整數 ≥ 1，預設 1 |
| `pageSize` | 否 | 整數 1–50，預設 20 |

未列出的參數一律 `VALIDATION_ERROR`（避免前端以為 `sort=distance` 之類的條件已生效）。

### 兩種地區篩選的差異

| | `LOCATED_IN` | `SERVICE_AREA` |
|---|---|---|
| 比對欄位 | Provider `city`／`district`（機構所在地） | active ProviderServiceArea（已驗證服務範圍） |
| 範圍未知（`UNCONFIRMED`）的 Provider | 只要所在地符合就出現 | 預設不出現，只回 `unconfirmedCount`；`includeUnconfirmed=true` 時列在最後並標 `areaMatch = UNCONFIRMED` |
| 代表的意思 | 機構在這裡，**不代表**能到府或服務此區 | 有證據確認服務範圍包含此區；仍**不是**個案推薦 |

`SERVICE_AREA` 只看 `city` 時（未給 `district`），比對「服務範圍含該縣市任一行政區」。

### 排序

固定、可重現、與使用者無關：

1. `SERVICE_AREA`：`areaMatch = VERIFIED` 在前，`UNCONFIRMED` 在後。
2. 縣市依 `service-districts.json` 順序（臺北市、新北市），行政區依該檔陣列順序。
3. `id` 升冪。

不得依距離、輪替、付費、評分或點擊數排序。

### Success Response

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "PROV-MOCK-201",
        "name": "測試輔具服務中心",
        "type": "ASSISTIVE_DEVICE",
        "resourceCategory": "SERVICE_PROVIDER",
        "services": ["ASSISTIVE_DEVICE"],
        "address": "新北市三重區重新路三段201號",
        "city": "新北市",
        "district": "三重區",
        "phone": "02-42010101",
        "website": "https://example.com/kareo-mock/prov-mock-201",
        "googleMapsUrl": "https://www.google.com/maps/search/?api=1&query=PROV-MOCK-201",
        "verified": true,
        "serviceAreaStatus": "VERIFIED",
        "contractRegions": [
          {
            "city": "新北市",
            "serviceType": "ASSISTIVE_DEVICE"
          }
        ],
        "areaMatch": "VERIFIED"
      },
      {
        "id": "PROV-MOCK-204",
        "name": "測試輔具商行（服務範圍待確認）",
        "type": "ASSISTIVE_DEVICE",
        "resourceCategory": "SERVICE_PROVIDER",
        "services": ["ASSISTIVE_DEVICE"],
        "address": "新北市三重區重新路三段204號",
        "city": "新北市",
        "district": "三重區",
        "phone": "02-42040404",
        "website": null,
        "googleMapsUrl": "https://www.google.com/maps/search/?api=1&query=PROV-MOCK-204",
        "verified": true,
        "serviceAreaStatus": "UNCONFIRMED",
        "contractRegions": [
          {
            "city": "新北市",
            "serviceType": "ASSISTIVE_DEVICE"
          }
        ],
        "areaMatch": "UNCONFIRMED"
      }
    ],
    "page": 1,
    "pageSize": 20,
    "totalCount": 4,
    "unconfirmedCount": 1,
    "appliedFilters": {
      "resourceCategory": null,
      "serviceType": "ASSISTIVE_DEVICE",
      "city": "新北市",
      "district": "三重區",
      "areaFilter": "SERVICE_AREA",
      "includeUnconfirmed": true,
      "contractCity": null,
      "q": null,
      "page": 1,
      "pageSize": 20
    },
    "notice": "以下包含服務範圍待確認的機構（列在最後）。標示「服務範圍待確認」者，目前沒有資料確認能服務您所選地區，請先洽機構確認。本結果不是依您的個案狀況所做的推薦，也不代表距離遠近。"
  }
}
```

（`items` 節錄 2 筆；完整內容見 `contracts/mock/providers/lookup/list-service-area-include-unconfirmed-response.json`。）

| 欄位 | 規則 |
|---|---|
| `items[]` | 欄位**只有**上例 15 個（v0.6 加入 `resourceCategory`、`contractRegions`），與 §10 同名欄位值相同。**不得回傳** `lat`、`lng`、`status`、`createdAt`、`updatedAt`、`rank`、`distanceKm`、`reasons`，以及任何資料來源、查核證據、決策編號、非官方座標標記、內部備註、Lead 或推薦統計 |
| `items[].areaMatch` | 只有 `SERVICE_AREA` 為 `VERIFIED`／`UNCONFIRMED`；其餘為 `null` |
| `totalCount` | 符合條件的總筆數（含 `includeUnconfirmed` 附加的筆數） |
| `unconfirmedCount` | `SERVICE_AREA` 時為符合 `serviceType`／`q` 但範圍未知的筆數（不論 `includeUnconfirmed`）；其他情況為 `null` |
| `appliedFilters` | 一律回傳 10 個鍵（v0.6 加入 `resourceCategory`、`contractCity`），值為後端實際套用、補上預設值後的條件 |
| `notice` | 一律存在，後端產生，前端照原文顯示；不得含「最近」「附近」「適合您」「一定可到府」 |

### 空結果與錯誤

| 情況 | 回應 |
|---|---|
| 沒有符合條件 | `success: true`、`items: []`、`totalCount: 0`、notice 建議調整條件或洽 1966（`list-empty-response.json`） |
| `page` 超過最後一頁 | `success: true`、`items: []`，`totalCount` 為實際總數（`list-page-out-of-range-response.json`） |
| `city` 不是臺北市／新北市 | `VALIDATION_ERROR`「本階段只提供臺北市、新北市的資源查詢。」 |
| `district` 不屬於 `city`；只有 `district` 沒有 `city` | `VALIDATION_ERROR` |
| `areaFilter` 沒有 `city`、值不合法；`includeUnconfirmed=true` 但不是 `SERVICE_AREA` | `VALIDATION_ERROR` |
| `serviceType`／`resourceCategory` 不合法、`resourceCategory = ASSISTIVE_DEVICE_CENTER` 又給 `serviceType`、`contractCity` 不是臺北市／新北市、`q` 超過長度、`page`／`pageSize` 越界、未定義參數 | `VALIDATION_ERROR` |
| 限流 | `RATE_LIMITED`（429） |

前端的「其他縣市」選項不呼叫本 API，直接顯示「本階段只提供臺北市、新北市」與 1966 提示（比照 D-14b）。找不到單一 Provider 沿用 §10 `NOT_FOUND`。

### 與推薦、媒合的界線（D-18）

- 推薦（§9）規則不變：候選必須服務類型相符且**已驗證服務範圍**相符。`UNCONFIRMED` 的 Provider 不會因為出現在查詢結果就成為推薦候選；不得為了補足推薦家數放寬條件或新增沒有證據的服務範圍。
- 查詢結果沒有 `recommendationId`，不能用來建立 Lead（§12 已要求 `providerId` 必須在同 session 的推薦結果中）。
- Mock：`contracts/mock/providers/lookup/`（7 種成功情境、6 種錯誤、request 範例；`node contracts/mock/providers/lookup/validate-fixtures.mjs` 檢查一致性，含「`PROV-MOCK-204` 查得到、但不在三重區輔具推薦中」的同機構對照）。

---

# 11. Kareocar External Service API

## GET /api/v1/external-services/transportation

### Response

```json
{
  "success": true,
  "data": {
    "id": "EXT-001",
    "name": "Kareocar",
    "serviceType": "TRANSPORTATION",
    "url": "https://kareocar.netlify.app/",
    "openMode": "NEW_TAB",
    "notice": "此服務將前往外部 Kareocar 平台。"
  }
}
```

MVP 只允許 External Link，禁止 iframe、Backend Integration、Database Integration、Authentication Integration。

---

# 12. Lead API / 我要媒合

## POST /api/v1/leads

### Request

```json
{
  "sessionId": "SES-001",
  "assessmentId": "ASM-001",
  "recommendationId": "REC-001",
  "providerId": "PROV-001",
  "serviceType": "HOME_CARE",
  "contact": {
    "name": "王先生",
    "phone": "0912345678"
  },
  "contactConsent": true
}
```

v0.2 Headers：`X-Kareo-Session-Token`、`Idempotency-Key`（§3.3）。

v0.2 驗證：

- `contactConsent` 必須為 `true`，否則 `VALIDATION_ERROR`。
- `assessmentId`、`recommendationId` 必須屬於同一 session；`providerId` 必須在該推薦結果中，`serviceType` 必須與推薦相同。
- 同一 session＋provider＋serviceType 已有未終態 Lead → 回傳既有 Lead，`duplicate: true`。

### Response

```json
{
  "success": true,
  "data": {
    "leadId": "LEAD-001",
    "status": "NEW",
    "createdAt": "2026-09-14T22:40:00+08:00",
    "duplicate": false
  }
}
```

Lead 的查件與狀態更新只經由受保護的內部指令（docs/LEAD_OPERATIONS.md §4），不提供公開 API。

Lead Status：

```text
NEW
CONTACTED
ACCEPTED
CLOSED
CANCELLED
```

---

# 13. Knowledge API / 最新資料狀態

Frontend 原則上不直接讀整個 Knowledge DB。

## GET /api/v1/knowledge/status

### Response

```json
{
  "success": true,
  "data": {
    "version": "KB-2026-09-14-001",
    "publishedAt": "2026-09-14T00:30:00+08:00",
    "lastVerifiedAt": "2026-09-14T00:20:00+08:00",
    "notice": "長照制度及補助可能隨時調整，實際資格仍請洽 1966 或所在地長期照顧管理中心。"
  }
}
```

若前端顯示補助或制度資訊，可包含：

```json
{
  "title": "長照相關補助資訊",
  "summary": "目前制度摘要",
  "source": {
    "authority": "衛生福利部",
    "url": "官方來源網址"
  },
  "effectiveFrom": "2026-07-01",
  "lastVerifiedAt": "2026-09-14T00:20:00+08:00"
}
```

---

# 13a. Knowledge Records API / 公開長照資訊查詢（v0.6，D-19 Q3）

## GET /api/v1/knowledge/records

讓使用者不必先做評估，就能瀏覽 Kareo **已審核並發布**的長照制度與補助資訊（PRODUCT_SPEC §14c）。內容與 Assessment 使用的知識是同一份（§13、DATA_MODEL §24、§26a）。

- 公開端點，不需要 session（§3.1）。限流見 ARCHITECTURE §20.4。
- 只回**目前 PUBLISHED 版本**快照（`knowledge_version_records`）中、今天（Asia/Taipei）有效的紀錄：`effectiveFrom ≤ 今天`，且 `effectiveTo` 為 `null` 或 `≥ 今天`。尚未生效或已失效的不回（PRODUCT_SPEC §47）。
- 沒有任何 PUBLISHED 版本 → `KNOWLEDGE_UNAVAILABLE`（503），與 §13 一致。
- 不做個人化：不回答「您是否符合」，不計算金額。

### Query 參數

| 參數 | 必填 | 規則 |
|---|---|---|
| `jurisdiction` | 否 | `TAIWAN`／`TAIPEI`／`NEW_TAIPEI`（DATA_MODEL §23）；省略＝全部 |
| `category` | 否 | DATA_MODEL §24 Knowledge Category；省略＝全部 |
| `page` | 否 | 整數 ≥ 1，預設 1 |
| `pageSize` | 否 | 整數 1–50，預設 20 |

未列出的參數 → `VALIDATION_ERROR`。

排序固定：`jurisdiction`（TAIWAN → TAIPEI → NEW_TAIPEI）→ `category`（DATA_MODEL §24 列出順序）→ `id`。

### Success Response

```json
{
  "success": true,
  "data": {
    "knowledgeVersion": "KB-MOCK-001",
    "publishedAt": "2026-09-24T12:00:00+08:00",
    "items": [
      {
        "id": "KREC-MOCK-015",
        "title": "新北市長照輔具及居家無障礙補助申請流程",
        "category": "ASSISTIVE_DEVICE",
        "jurisdiction": "NEW_TAIPEI",
        "summary": "新北市長照輔具及居家無障礙改善補助須先經核定才能購置或租賃，未經核定不予補助；部分輔具需附三個月內的輔具評估報告。取得核定通知後 6 個月內，向特約廠商購置或租賃並檢附請款文件，處理期限 40 天。承辦為新北市輔具資源中心（蘆洲區集賢路 245 號 9 樓，02-8286-7045）。",
        "effectiveFrom": "2026-09-24",
        "effectiveTo": null,
        "publishedAt": null,
        "lastVerifiedAt": "2026-09-24T10:00:00+08:00",
        "source": {
          "title": "新北市政府雲端櫃檯「長期照顧輔具服務及居家無障礙環境改善服務補助」",
          "publisher": "新北市政府",
          "url": "https://service.ntpc.gov.tw/eservice/CaseData.action?itemId=110105"
        }
      }
    ],
    "page": 1,
    "pageSize": 20,
    "totalCount": 2,
    "appliedFilters": {
      "jurisdiction": "NEW_TAIPEI",
      "category": "ASSISTIVE_DEVICE",
      "page": 1,
      "pageSize": 20
    },
    "notice": "以下為 Kareo 已審核發布的長照制度與補助資訊摘要，內容可能隨主管機關公告調整。實際資格、服務內容與補助，仍應由 1966 或所在地長期照顧管理中心正式評估確認。"
  }
}
```

（`items` 節錄 1 筆；完整內容見 `contracts/mock/knowledge/records-new-taipei-assistive-device-response.json`。Mock 的摘要取自已核准、尚未發布的內容包，只示範格式。）

| 欄位 | 規則 |
|---|---|
| `knowledgeVersion`／`publishedAt` | 目前 PUBLISHED 版本與發布時間 |
| `items[]` | **只有**上例 10 個欄位。**不得回傳** `ruleData`、原文 `excerpt`／`rawText`、`contentHash`、`contentFingerprint`、`status`、`packId`、審核紀錄或任何內部欄位 |
| `items[].publishedAt` | 官方公告日（DATA_MODEL §24），可為 `null`；不是 Kareo 發布時間 |
| `source.title` | Source Registry 的來源名稱 |
| `source.publisher` | 發布機關（`LAW` → 全國法規資料庫、`MOHW` → 衛生福利部、`TAIPEI_GOV` → 臺北市政府、`NEW_TAIPEI_GOV` → 新北市政府；`KAREO_DRIVE` → Source Registry 記錄的原發布機關） |
| `source.url` | 官方網址；`KAREO_DRIVE` 來源一律 `null`（不公開雲端硬碟連結，D-15） |
| `notice` | 一律存在且包含 1966 正式評估提醒（PRODUCT_SPEC §34）；空結果時改為建議調整條件或洽 1966 |

錯誤：`jurisdiction`／`category`／`page`／`pageSize` 不合法、未定義參數 → `VALIDATION_ERROR`；沒有 PUBLISHED 版本 → `KNOWLEDGE_UNAVAILABLE`；限流 → `RATE_LIMITED`。

前端規則：`summary` 照原文逐段顯示，不得改寫、計算或推論個人資格；每筆顯示來源與生效日；不得出現「您符合」「已核定」「您可獲得」。Mock：`contracts/mock/knowledge/`（`node contracts/mock/knowledge/validate-fixtures.mjs`）。

---

# 14. 正式資格禁止欄位

MVP API 不得回：

```text
officialCMSLevel
officialEligibility
approvedBenefit
```

除非未來真的取得正式核定資料。

所有結果必須維持 preliminary / estimated / possible 概念。

---

# 15. Assessment Disclaimer

所有 Assessment Response 必須包含 warnings，至少包含：

```text
本結果僅為初步預估。
實際資格、長照等級與補助仍需由正式長照評估確認。
```

---

# 16. Mock Data Rule / 假資料規則

Engineer C 不等待 Engineer B。

Jerry 提供：

```text
/contracts/mock/
```

建議檔案：

```text
assessment-response.json
recommendation-response.json
provider-response.json
lead-response.json
transportation-response.json
```

C 只依這些格式製作 UI。

---

# 17. Backend Rule / 後端規則

Engineer B：

- 依本文件實作 API
- 不接 C 的 Frontend
- 不修改 C 的 UI
- 不等待 C 完成
- 只需確保 API 符合 Contract

---

# 18. Frontend Rule / 前端規則

Engineer C：

- 依本文件建立 Mock Data / UI / Flow
- 必須處理 Loading / Success / Empty / Error
- 不修改 Backend
- 不修改 Database
- 不自行設計新的 Response

---

# 19. Engineer A / 工程師 A

A 主要提供 Provider Data，不需要開發 API。

Provider 資料至少符合：

```json
{
  "id": "PROV-001",
  "name": "XX居家照顧中心",
  "type": "HOME_CARE",
  "address": "地址",
  "city": "新北市",
  "district": "三重區",
  "phone": "電話",
  "website": null,
  "googleMapsUrl": "Google Maps URL",
  "verified": false
}
```

Jerry Review 後，再交由 B 匯入。

---

# 20. Integration Owner / 整合負責人

只有 Jerry 負責：

```text
C Mock API
↓
B Real API
↓
Integration Test
↓
Preview Test
↓
Production Merge
```

---

# 21. Loading / Empty / Timeout

Frontend 必須處理：

```text
LOADING
SUCCESS
EMPTY
ERROR
```

Recommendation / Assessment Timeout 時不得自己猜結果，應提示稍後重試或直接聯絡 1966。

---

# 22. API Version

MVP：

```text
/v1
```

重大破壞性 Contract 變更建立 `/v2`，不得直接破壞舊格式。

---

# 23. Contract Change Flow

```text
建立 Issue
↓
Jerry Review
↓
Jerry 修改 API_CONTRACT.md
↓
建立對應 Task
↓
Owner 實作
↓
Jerry Integration
```

禁止口頭 Contract，也禁止先改 Code 再補文件。

---

# 24. Source of Truth

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

若 Code 與本文件衝突，以 Contract 為準，停止修改並建立 Issue。

---

# 26. Admin Knowledge API（v0.4，2026-09-29，D-16／D-16a）

供 Jerry 在管理頁面（C-006）審核與發布知識。實作：TASK-B-012。Mock：`contracts/mock/admin/`（對照表見 `contracts/mock/README.md`「Admin Knowledge fixtures」）。

v0.4 依 Jerry 核准的 C-006 決定（[PR #34 comment 5883232266](https://github.com/viz963-1216/Kareo/pull/34#issuecomment-5883232266)，MVP_DECISIONS D-16a）補齊：發布預覽、可恢復版本清單、四種寫入操作的完整 request／response、`KNOWLEDGE_STATE_CHANGED` 錯誤碼。v0.3 已定義的端點路徑、欄位名稱與錯誤格式不變，只新增欄位與端點；publish 新增必填 `previewToken`、withdraw 新增必填 `withdrawVersionId` 屬 request 收緊，因 B-012／C-006 尚未有任何提交、沒有既有呼叫端，依 §22 不另開 `/v2`。

不變的界線：不自動核准或發布（每個寫入都要操作者按下並二次確認）；管理頁面不編輯政策內容或 `ruleData`，內容仍只經由內容包（contracts/knowledge）進入。

## 26.1 共通規則

- **驗證**：`POST /api/v1/admin/session`，Body `{ "operatorId": "...", "operatorKey": "..." }` → `{ "adminToken": "...", "expiresAt": "..." }`（15 分鐘，後端只存雜湊）。之後所有 admin 端點以 Header `X-Kareo-Admin-Token` 呼叫，不使用 §3.1 的 `X-Kareo-Session-Token`。只接受 `InternalOperator.active = true` 且 `roles` 含 `KNOWLEDGE_PUBLISHER` 的操作者（DATA_MODEL §36）。
- **錯誤對照**（沿用 §5 envelope，HTTP 依 §3.2）：

| 情況 | error.code | HTTP |
|---|---|---|
| 無 token、token 錯誤或過期；`operatorId`／`operatorKey` 錯誤或操作者已停用（不透露是哪一項） | `SESSION_INVALID` | 401 |
| 操作者有效但沒有 `KNOWLEDGE_PUBLISHER` 角色 | `FORBIDDEN` | 403 |
| 欄位缺漏、格式錯誤、`reason` 空白、`confirm` 不是 `true`、發布條件不符、恢復目標等於撤回目標 | `VALIDATION_ERROR` | 400 |
| 路徑中的紀錄或變更不存在 | `NOT_FOUND` | 404 |
| 紀錄／變更已不是 `NEEDS_REVIEW`（已被處理過） | `INVALID_STATUS_TRANSITION` | 409 |
| 操作者看到的內容在送出前已改變（預覽失效、紀錄內容指紋不符、目前發布版本已變、恢復目標已不符合條件） | `KNOWLEDGE_STATE_CHANGED`（v0.4 新增） | 409 |
| 限流、Body 過大 | `RATE_LIMITED`／`PAYLOAD_TOO_LARGE` | 429／413 |
| 其他後端錯誤 | `INTERNAL_ERROR` | 500 |

- **任何錯誤回應都代表資料完全沒有改變**（沒有部分寫入、沒有稽核成功紀錄）。前端收到錯誤時不得顯示成功，也不得自行重試寫入。
- 收到 `KNOWLEDGE_STATE_CHANGED`：前端重新讀取相關清單／預覽，讓操作者看過新內容後重新確認；不得沿用舊畫面的資料重送。
- 所有 admin 回應 `Cache-Control: no-store`。
- **寫入操作**（decision、dismiss、publish、withdraw）一律需要 `confirm: true`（前端二次確認後才送出）；decision、dismiss、withdraw 必填 `reason`（去除前後空白後 1–500 字）。publish 依 D-16a 不需要 `reason`。每個成功的寫入都寫入稽核紀錄（DATA_MODEL §41：操作者、時間、動作、目標、原因、結果數量），log 不含密鑰或 token。
- 時間一律 ISO 8601 含 `+08:00`；日期 `YYYY-MM-DD`（Asia/Taipei）。

管理端限流（2026-10-04 中央整合）：登入 20 次／小時／IP 雜湊；其餘管理請求 300 次／小時／IP 雜湊，驗證後讀取 300 次、寫入 60 次／小時／操作者（各端點合計）。超額回 `RATE_LIMITED (429)`、`Retry-After`、`Cache-Control: no-store`；不執行操作。POST body >16 KB（UTF-8）回 `PAYLOAD_TOO_LARGE (413)`，在解析 JSON 前檢查。詳見 ARCHITECTURE §20.4。

## 26.2 端點一覽

| 方法與路徑 | 用途 | Request | Success `data` | Mock |
|---|---|---|---|---|
| `POST /api/v1/admin/session` | 換取管理 token | `{ operatorId, operatorKey }` | `{ adminToken, expiresAt }` | `session-response.json` |
| `GET /api/v1/admin/knowledge/status` | 目前版本與每日檢查 | — | §26.3 | `knowledge-status-*.json` |
| `GET /api/v1/admin/knowledge/changes?status=NEEDS_REVIEW` | 每日變更 | — | `{ changes[] }` §26.4 | `knowledge-changes-*.json` |
| `GET /api/v1/admin/knowledge/records?status=NEEDS_REVIEW` | 待審紀錄 | — | `{ records[] }` §26.5 | `knowledge-records-*.json` |
| `POST /api/v1/admin/knowledge/records/{id}/decision` | 核准／退回單筆 | §26.6 | `{ record, review }` | `knowledge-record-*.json` |
| `POST /api/v1/admin/knowledge/changes/{id}/dismiss` | 變更不影響內容 | §26.7 | `{ change, review }` | `knowledge-change-dismissed-response.json` |
| `GET /api/v1/admin/knowledge/publish-preview` | 發布預覽（v0.4） | — | §26.8 | `knowledge-publish-preview-*.json` |
| `POST /api/v1/admin/knowledge/publish` | 發布 | §26.9 | §26.9 | `knowledge-publish-response.json` |
| `GET /api/v1/admin/knowledge/restorable-versions` | 可恢復版本清單（v0.4） | — | §26.10 | `knowledge-restorable-versions-*.json` |
| `POST /api/v1/admin/knowledge/withdraw` | 撤回目前版本 | §26.11 | §26.11 | `knowledge-withdraw-*.json` |

`status` query 在 MVP 只接受 `NEEDS_REVIEW`（省略時等同 `NEEDS_REVIEW`）；其他值回 `VALIDATION_ERROR`。清單不分頁，依時間由舊到新排序。**空清單一律回 `success: true` 與空陣列**，不是錯誤。

## 26.3 GET /api/v1/admin/knowledge/status

```json
{
  "success": true,
  "data": {
    "publishedVersion": "KB-MOCK-001",
    "publishedAt": "2026-09-24T12:00:00+08:00",
    "lastCrawlerRun": { "status": "SUCCESS", "startedAt": "...", "finishedAt": "..." }
  }
}
```

- 沒有 PUBLISHED 版本（從未發布或撤回時選擇不恢復）：`publishedVersion`、`publishedAt` 為 `null`，仍是 `success: true`（管理頁需要看到這個狀態；公開的 §13 則回 `KNOWLEDGE_UNAVAILABLE`）。
- 從未執行 crawler：`lastCrawlerRun` 為 `null`。`lastCrawlerRun.status` 依 DATA_MODEL §28（`RUNNING`／`SUCCESS`／`PARTIAL`／`FAILED`）；`RUNNING` 時 `finishedAt` 為 `null`。

## 26.4 changes[]（每日變更）

| 欄位 | 型態 | 說明 |
|---|---|---|
| `id` | string | KnowledgeChange id |
| `sourceId` | string | Source Registry 的來源 id |
| `detectedAt` | datetime | |
| `previousHash`／`currentHash` | string \| null／string | `sha256:<hex>`；第一次抓取時 `previousHash` 為 `null` |
| `diffSummary` | string | 系統產生的差異摘要（不是政策內容） |
| `status` | enum | 清單中固定為 `NEEDS_REVIEW`；處理後為 `DISMISSED`（DATA_MODEL §27） |

## 26.5 records[]（待審紀錄）

| 欄位 | 型態 | 說明 |
|---|---|---|
| `id` | string | 資料庫 id（decision 路徑使用） |
| `packId`／`recordId` | string | 內容包與包內紀錄 id |
| `title`、`jurisdiction`、`category`、`sourceUrl`、`summary` | string | 同內容包；前端只顯示，不可編輯 |
| `effectiveFrom` | date | |
| `effectiveTo` | date \| null | v0.4 新增 |
| `contentFingerprint` | string | v0.4 新增。後端依實際保存內容計算的審核內容指紋（B-008-r4，`sha256:<hex>`）；前端原樣帶回 decision，不自行計算 |
| `status` | enum | 清單中固定為 `NEEDS_REVIEW` |

## 26.6 POST /api/v1/admin/knowledge/records/{id}/decision

Request：

```json
{
  "decision": "APPROVED",
  "reason": "已逐格核對原文，數字一致。",
  "expectedContentFingerprint": "sha256:...",
  "confirm": true
}
```

- `decision`：`APPROVED` 或 `REJECTED`。`reason` 兩者都必填。
- `expectedContentFingerprint`：操作者畫面上那筆紀錄的 `contentFingerprint`。後端在同一個原子更新中比對（沿用 B-008-r4 `approveRecords`），不一致回 `KNOWLEDGE_STATE_CHANGED`，紀錄不變。
- 紀錄不是 `NEEDS_REVIEW` → `INVALID_STATUS_TRANSITION`；id 不存在 → `NOT_FOUND`。

Success（`record` 為更新後的紀錄，欄位同 §26.5，`status` 為 `APPROVED` 或 `REJECTED`）：

```json
{
  "success": true,
  "data": {
    "record": { "id": "KREC-MOCK-001", "...": "...", "status": "APPROVED" },
    "review": {
      "decision": "APPROVED",
      "reason": "已逐格核對原文，數字一致。",
      "reviewedBy": "OP-MOCK-001",
      "reviewedAt": "2026-09-25T09:30:00+08:00"
    }
  }
}
```

- `APPROVED` 只代表可被下一次發布納入，**不會**自動發布。`REJECTED` 的紀錄永遠不會被發布。

## 26.7 POST /api/v1/admin/knowledge/changes/{id}/dismiss

用於「來源頁面有變但不影響已審核內容」（例如排版）。會影響內容的變更不在管理頁處理，需以新內容包提交後再審核。

Request：`{ "reason": "只有頁尾更新日期與排版變動，條文與金額未變。", "confirm": true }`

Success：

```json
{
  "success": true,
  "data": {
    "change": { "id": "KC-MOCK-001", "...": "...", "status": "DISMISSED" },
    "review": {
      "decision": "DISMISSED",
      "reason": "只有頁尾更新日期與排版變動，條文與金額未變。",
      "reviewedBy": "OP-MOCK-001",
      "reviewedAt": "2026-09-25T09:20:00+08:00"
    }
  }
}
```

變更不是 `NEEDS_REVIEW` → `INVALID_STATUS_TRANSITION`；不存在 → `NOT_FOUND`。

## 26.8 GET /api/v1/admin/knowledge/publish-preview（v0.4）

後端依 B-008 的發布規則（D-03、D-03-v2，`publishVersion`）試算「如果現在發布」的結果，不寫入任何資料。**前端只顯示這裡的版號與數字，不得自行產生版號、不得用待審清單筆數推算任何數量。**

Success（可發布）：

```json
{
  "success": true,
  "data": {
    "canPublish": true,
    "targetVersionId": "KB-MOCK-002",
    "currentVersionId": "KB-MOCK-001",
    "publishDate": "2026-09-25",
    "publishedRecordCount": 1,
    "carriedForwardCount": 15,
    "totalRecordCount": 16,
    "supersededRecordCount": 0,
    "excludedRecordCount": 0,
    "newRecords": [
      { "id": "KREC-MOCK-001", "packId": "KP-MOCK-003", "recordId": "KR-MOCK-016", "title": "...", "jurisdiction": "NEW_TAIPEI", "effectiveFrom": "2026-10-01", "effectiveTo": null }
    ],
    "blockers": [],
    "previewToken": "PPV-MOCK-002-7f3a",
    "generatedAt": "2026-09-25T09:40:00+08:00"
  }
}
```

計數規則（與 B-008-r4 `publish_knowledge_version` 回傳一致）：

| 欄位 | 定義 |
|---|---|
| 候選紀錄 | 目前狀態 `APPROVED`、尚未發布，**且所屬內容包在資料庫登錄的狀態為 `APPROVED`** 的全部紀錄（v0.5，D-16b：內容包狀態以匯入時保存的資料為準，不讀檔案） |
| `targetVersionId` | 候選紀錄所屬內容包的 `intendedKnowledgeVersion`（格式 `KB-YYYY-MM-DD-NNN`）。所有候選內容包必須相同 |
| `publishedRecordCount`（新增） | 候選紀錄中 `effectiveTo` 為 `null` 或不早於 `publishDate` 的筆數 |
| `excludedRecordCount` | 候選紀錄中 `effectiveTo` 早於 `publishDate`、不會發布的筆數（仍保持 `APPROVED`） |
| `supersededRecordCount` | 目前 PUBLISHED 紀錄中，被新紀錄取代（同 `jurisdiction`＋`ruleData.type`＋`title`）或已失效（`effectiveTo` 早於 `publishDate`）的筆數 |
| `carriedForwardCount`（沿用） | 目前 PUBLISHED 紀錄中，未被取代且未失效、會帶入新版本的筆數 |
| `totalRecordCount`（發布總數） | `publishedRecordCount + carriedForwardCount`＝新版本 `knowledge_version_records` 的筆數 |
| `publishDate` | 試算使用的發布日（Asia/Taipei 當日） |

`newRecords` 列出會新增的紀錄（不含 excluded），供操作者核對；`currentVersionId` 為目前 PUBLISHED 版本，沒有時為 `null`（此時 `carriedForwardCount = 0`）。

無法發布時仍回 `success: true`，`canPublish: false`、`previewToken: null`、`blockers` 至少一項；無法決定版號時 `targetVersionId` 為 `null`，無法試算的數量回 `0`：

| `blockers[].code` | 條件 |
|---|---|
| `NO_APPROVED_RECORDS` | 沒有任何 `APPROVED` 紀錄 |
| `ALL_CANDIDATES_EXPIRED` | 候選紀錄的 `effectiveTo` 全部早於 `publishDate` |
| `PACK_NOT_APPROVED` | 有 `APPROVED` 紀錄所屬的內容包，在資料庫登錄的 `status` 不是 `APPROVED`，或尚未登錄（message：「內容包資料尚未登錄」）。沿用 B-008 規則，D-16b 維持 |
| `TARGET_VERSION_INVALID` | 內容包缺 `intendedKnowledgeVersion` 或格式不合法 |
| `TARGET_VERSION_CONFLICT` | 候選內容包的 `intendedKnowledgeVersion` 不只一個 |
| `VERSION_ALREADY_EXISTS` | `targetVersionId` 已存在（不得覆寫或改號） |

每個 blocker 為 `{ "code": "...", "message": "給操作者看的中文說明" }`；前端顯示 `message`，並停用發布按鈕。

**預覽失效**：`previewToken` 是後端對「版號＋目前 PUBLISHED 版本＋每筆新增／沿用／取代／排除紀錄的 id 與 `contentFingerprint`＋相關內容包的 `status` 與內容包指紋（v0.5，D-16b）＋`publishDate`」算出的不透明值（前端不得解析或自行產生）。上述任一項在預覽後改變（有人核准／退回紀錄、匯入更新內容、另一次發布或撤回、跨過午夜），同樣輸入重新計算的值就不同，預覽即失效。預覽本身沒有另外的有效時間，但受管理 token 15 分鐘有效期限制。

## 26.9 POST /api/v1/admin/knowledge/publish

Request：

```json
{ "versionId": "KB-MOCK-002", "previewToken": "PPV-MOCK-002-7f3a", "confirm": true }
```

- `versionId`、`previewToken` 必須原樣取自最近一次預覽（`previewToken` 為 v0.4 新增必填）。`confirm` 必須是 `true`。
- **後端在發布時重新驗證**：以同一套規則重新計算，並在與寫入相同的交易（或持有發布鎖）內比對，確保比對後到寫入前不會插入其他寫入：
  - 重新計算後有 blocker → `VALIDATION_ERROR`（例如版號已存在、沒有可發布紀錄）。
  - `versionId` 不等於重新計算的 `targetVersionId`，或 `previewToken` 不一致 → `KNOWLEDGE_STATE_CHANGED`。
  - 任何錯誤都不寫入。
- 發布本身沿用 B-008 `publishVersion`／`publish_knowledge_version`，不另寫一套。

Success（數量與通過驗證的預覽相同）：

```json
{
  "success": true,
  "data": {
    "versionId": "KB-MOCK-002",
    "publishedAt": "2026-09-25T09:42:10+08:00",
    "publishedRecordCount": 1,
    "carriedForwardCount": 15,
    "totalRecordCount": 16,
    "supersededRecordCount": 0,
    "excludedRecordCount": 0
  }
}
```

v0.3 的 `versionId`、`publishedRecordCount`、`carriedForwardCount`、`supersededRecordCount` 不變；`publishedAt`、`totalRecordCount`、`excludedRecordCount` 為 v0.4 新增。成功後前端重新讀取 §26.3 以顯示新版本。

## 26.10 GET /api/v1/admin/knowledge/restorable-versions（v0.4）

撤回時可選擇恢復的版本。前端只能從這份清單選擇，或明確選擇不恢復；不得自行猜測上一版或讓操作者輸入版號。

```json
{
  "success": true,
  "data": {
    "currentVersion": {
      "versionId": "KB-MOCK-002",
      "publishedAt": "2026-09-25T09:42:10+08:00",
      "recordCount": 16
    },
    "versions": [
      {
        "versionId": "KB-MOCK-001",
        "publishedAt": "2026-09-24T12:00:00+08:00",
        "approvedBy": "OP-MOCK-001",
        "notes": null,
        "recordCount": 15
      }
    ]
  }
}
```

- `currentVersion`：目前 PUBLISHED 版本（即撤回對象）；沒有時為 `null`，前端停用撤回。`recordCount` 為該版本 `knowledge_version_records` 筆數。
- `versions[]` 只列**符合恢復條件**的版本，依 `publishedAt` 由新到舊：
  1. 狀態為 `ARCHIVED`，且不是 `currentVersion`（**不得恢復正在撤回的同一版本**）。
  2. 從未被撤回（`withdrawnAt` 為 `null`；曾因錯誤被撤回的版本不能再恢復）。
  3. `knowledge_version_records` 至少 1 筆。
  4. 快照中沒有任何紀錄的 `effectiveTo` 早於今天（Asia/Taipei），與發布「失效紀錄不得納入」規則一致。
- `publishedAt` 為該版本最近一次成為 PUBLISHED 的時間；`approvedBy`、`notes` 取自 KnowledgeVersion，供操作者辨識。
- 沒有任何版本符合條件時 `versions: []`（`success: true`）；前端只提供「不恢復任何版本」並顯示撤回後將沒有可用知識、評估會暫停的警告。

## 26.11 POST /api/v1/admin/knowledge/withdraw

Request：

```json
{
  "withdrawVersionId": "KB-MOCK-002",
  "republishVersionId": "KB-MOCK-001",
  "reason": "KR-MOCK-016 生效日有誤，先回到上一版。",
  "confirm": true
}
```

- `withdrawVersionId`（v0.4 新增必填）：操作者確認要撤回的版本，取自 §26.10 `currentVersion.versionId`。
- `republishVersionId`：**必須出現**；值為 §26.10 `versions[]` 其中一個 `versionId`，或明確的 `null`（不恢復）。省略此欄位 → `VALIDATION_ERROR`。
- 驗證順序與錯誤（任何錯誤都不寫入）：
  1. `reason` 空白、`confirm` 不是 `true`、欄位缺漏或格式錯誤 → `VALIDATION_ERROR`。
  2. `republishVersionId` 等於 `withdrawVersionId` → `VALIDATION_ERROR`。
  3. 目前沒有 PUBLISHED 版本，或目前 PUBLISHED 版本不是 `withdrawVersionId` → `KNOWLEDGE_STATE_CHANGED`。
  4. `republishVersionId` 不是 `null`，且提交當下不符合 §26.10 恢復條件（包含不存在、已被撤回過、已含失效紀錄）→ `KNOWLEDGE_STATE_CHANGED`。
- 上述目前版本與恢復資格檢查，必須與撤回／恢復寫入及稽核紀錄在同一交易內保證一致；只在 Node 層事先讀取驗證不足以避免競爭條件（TASK-B-012）。
- 通過後沿用 B-008 `withdrawVersion`／`withdraw_knowledge_version`：不刪資料，撤回版本 → `ARCHIVED` 並記錄撤回者、時間、原因；有恢復目標時依 `knowledge_version_records` 快照恢復完整內容。

Success：

```json
{
  "success": true,
  "data": {
    "withdrawnVersionId": "KB-MOCK-002",
    "republishedVersionId": "KB-MOCK-001",
    "withdrawnAt": "2026-09-25T10:05:00+08:00",
    "withdrawnBy": "OP-MOCK-001",
    "reason": "KR-MOCK-016 生效日有誤，先回到上一版。"
  }
}
```

- `republishedVersionId` 為 `null` 時，系統沒有 PUBLISHED 版本：公開 §13 與 Assessment 回 `KNOWLEDGE_UNAVAILABLE`，直到下一次發布。前端必須在二次確認時事先明示這個後果。
- v0.3 的 `withdrawnVersionId`、`republishedVersionId` 不變；`withdrawnAt`、`withdrawnBy`、`reason` 為 v0.4 新增。

## 26.12 前端規則（C-006）

- 版號、數量、可恢復版本、錯誤訊息一律以 API 回應為準；不自行產生、推算或補值。
- 二次確認畫面：核准／退回顯示紀錄標題與原因；發布顯示 `targetVersionId` 與新增／沿用／總數三個數字（有 `excludedRecordCount` 或 `supersededRecordCount` 時一併顯示）；撤回顯示撤回版本、恢復版本或「不恢復」及其後果。
- 同一操作送出後到收到回應前停用按鈕（連點只送一次）。
- `SESSION_INVALID` 回到登入並清除 token；`FORBIDDEN` 顯示沒有權限；`KNOWLEDGE_STATE_CHANGED` 重新載入相關資料後要求重新確認；`VALIDATION_ERROR` 顯示 `message`。

---

# 25. Change Log

| 版本 | 日期 | 內容 | 下游 |
|---|---|---|---|
| v0.1 | 2026-09-14 | MVP 初版 | — |
| v0.2 | 2026-09-23 | Session token 持有證明、DELETE session、Consent 撤回、Lead 冪等與聯絡同意、錯誤碼與 HTTP 對照、限制（J-002-r1） | B-011、B-006、B-005、B-010、C（adapter 由 J-003 接線）、contracts/mock |
| v0.2.1 | 2026-09-23 | 狀態標示更正：v0.2 新增項目為 PROPOSED；§9 恢復原始 MVP 的 DISTANCE／DISTRICT_ROTATION 兩種排序（座標為資料缺口，D-07）；無位置／只有縣市回應待 D-13（J-002-r3） | B-005、B-011a、C-005、J-003 |
| v0.2.2 | 2026-09-23 | §8 `location` 依 precision 定義必填／null 規則，`NONE`／`CITY` 可完成評估；`summary` 以 `\n` 分段承載補助說明（不新增欄位）；§9 統一位置與排序表、回應欄位一律出現、空結果補 `locationPrecision`、缺座標／只有縣市／沒有位置的 PROPOSED 回應（D-13a–c）；`AI_UNAVAILABLE` 標示 MVP 不使用（J-002-r4） | B-010（location 驗證、summary）、B-005、C-005、J-003、contracts/mock |
| v0.2.3 | 2026-09-24 | 狀態更新：D-04、D-13a–g、D-14a–b 核准（PR #31 comment 5806704685）；內容不變 | B-011a、B-005、B-010、C-005 |
| v0.3 | 2026-09-24 | 新增 §26 Admin Knowledge API（D-16，Jerry 核准）；知識來源 authority 新增 `KAREO_DRIVE`（D-15） | B-012、C-006、B-008-r2、J-003 |
| v0.3.1 | 2026-09-24 | §8 Assessment Request 新增選填 `disabilityCertificate`（YES／NO／UNKNOWN，D-17）；回應格式不變 | B-010、C-005、J-003 |
| v0.3.2 | 2026-09-24 | §8 Assessment Request 新增選填 `incomeCategory`（D-17a）；回應格式不變 | B-010、C-005、J-003 |
| v0.4 | 2026-09-29 | §26 補齊（D-16a，Jerry 核准 [PR #34 comment 5883232266](https://github.com/viz963-1216/Kareo/pull/34#issuecomment-5883232266)）：新增 `GET …/publish-preview`、`GET …/restorable-versions`；decision／dismiss／publish／withdraw 完整 request／response（全部 `confirm: true`；decision／dismiss／withdraw 必填 `reason`）；publish 新增必填 `previewToken`、withdraw 新增必填 `withdrawVersionId` 且 `republishVersionId` 必須明確出現；records 新增 `contentFingerprint`、`effectiveTo`；新錯誤碼 `KNOWLEDGE_STATE_CHANGED`（409）；KnowledgeChange 新增 `DISMISSED`。v0.3 欄位與路徑不變 | B-012、C-006、B-009（`DISMISSED`）、J-003、contracts/mock/admin |
| v0.5 | 2026-10-01 | 新增 §10a `GET /api/v1/providers` 公開資源查詢（D-18／D-18a–e，2026-10-01 核准：[PR #50 comment 5925833841](https://github.com/viz963-1216/Kareo/pull/50#issuecomment-5925833841)）；§10 新增 `serviceAreaStatus` 並明定詳細頁不是媒合入口；§3.1 公開端點清單；§26.8 候選紀錄與 `PACK_NOT_APPROVED` 改以資料庫登錄的內容包狀態為準、`previewToken` 涵蓋內容包狀態與指紋（D-16b，SPEC-APPROVED [PR #48 comment 5925628146](https://github.com/viz963-1216/Kareo/pull/48#issuecomment-5925628146)）。既有欄位與路徑不變 | B-013、C-007、B-012-r3、J-003、contracts/mock/providers |
| v0.6 | 2026-10-01 | D-19（[Issue #49 comment 5926683690](https://github.com/viz963-1216/Kareo/issues/49#issuecomment-5926683690)）：§10／§10a 新增 `resourceCategory`（輔具資源中心）、`contractRegions`（特約縣市）與 `resourceCategory`／`contractCity` 篩選；新增 §13a `GET /api/v1/knowledge/records`；§3.1 公開端點。既有欄位與路徑不變 | A-006、A-007、B-013、B-014、C-007、C-008、J-003、contracts/mock |

## 10b. 公開名冊補充（v0.7，2026-10-08，Issue #106）

§10 詳情及 §10a items 可追加選填 `publicInfo`，結構依 DATA_MODEL §19c；沒有資料則省略（不回 undefined／null）。原始鍵仍必須存在，不接受其他未知欄位。

GET /api/v1/providers 可用 `assistiveProgram=PURCHASE|SMART_TECH` 篩選官方輔具制度分類；搭配服務類別時僅允許 ASSISTIVE_DEVICE，不允許中心。未給服務類別時篩選仍只取具有該分類的輔具商家。appliedFilters 只在 request 使用此參數時追加 `assistiveProgram`，既有無參數回應維持原 10 鍵，fixtures 無須虛造分類。未知值回 VALIDATION_ERROR。分類不影響 Top 3、Lead 與服務範圍。
