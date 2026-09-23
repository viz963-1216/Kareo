# Kareo / 長照一點通 — API Contract

Version: v0.2.1（J-002-r3，2026-09-23）  
Status: v0.1 內容 LOCKED FOR MVP；**v0.2 新增項目（標示「v0.2」的段落）為 PROPOSED**（MVP_DECISIONS D-04／D-05／D-06），Jerry 核准前屬可逆實作，不得宣稱已核准  
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
GET  /api/v1/providers/{providerId}
GET  /api/v1/external-services/transportation
GET  /api/v1/knowledge/status
```

- Body 中的 `sessionId` 必須與 token 所屬 session 相同，否則 `FORBIDDEN`。
- 引用的 `assessmentId`／`recommendationId` 不屬於同一 session 時回 `NOT_FOUND`（不透露是否存在）。
- 規則細節見 ARCHITECTURE §20。

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
| `INVALID_STATUS_TRANSITION` | 409（僅內部工具） |
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

v0.2：需要 `X-Kareo-Session-Token`；`assessmentId` 必須屬於同一 session。排序依 PRODUCT_SPEC §21–24：使用者提供精確位置**且** Provider 有已驗證座標時用 `DISTANCE`；只有行政區時用 `DISTRICT_ROTATION`；不得用未驗證座標計算距離、不得宣稱「最近」。目前 Provider 座標為資料缺口（MVP_DECISIONS D-07），所以真實資料暫時只會走 `DISTRICT_ROTATION`，但 `DISTANCE` 分支屬 MVP 必要功能，須實作與測試。只有縣市／沒有位置的回應待 D-13 決議。

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
    "notice": "以下結果依您提供的位置與需求進行初步推薦。"
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
    "providers": [],
    "notice": "目前尚未找到符合條件的服務單位，建議查看更多官方資源或聯絡 1966。"
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

# 25. Change Log

| 版本 | 日期 | 內容 | 下游 |
|---|---|---|---|
| v0.1 | 2026-09-14 | MVP 初版 | — |
| v0.2 | 2026-09-23 | Session token 持有證明、DELETE session、Consent 撤回、Lead 冪等與聯絡同意、錯誤碼與 HTTP 對照、限制（J-002-r1） | B-011、B-006、B-005、B-010、C（adapter 由 J-003 接線）、contracts/mock |
| v0.2.1 | 2026-09-23 | 狀態標示更正：v0.2 新增項目為 PROPOSED；§9 恢復原始 MVP 的 DISTANCE／DISTRICT_ROTATION 兩種排序（座標為資料缺口，D-07）；無位置／只有縣市回應待 D-13（J-002-r3） | B-005、B-011a、C-005、J-003 |
