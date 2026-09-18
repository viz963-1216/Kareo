# 第一階段規劃封存

封存日期：2026-09-19。以下為 B-001 / C-001 的歷史交付原文，集中保存以移除開發目錄中的舊草稿。原文中的 DRAFT、pending approval、路徑及待決事項僅代表提交當時狀態，不代表目前指令或新增授權。

目前請依 [任務總表](../../tasks/README.md) 及 [架構規格](../ARCHITECTURE.md) 執行；規格優先順序仍依 AGENTS.md。歷史規劃不取代目前規格；尚未解決的產品決策由 J-002 處理。


---

## 原始路徑：`apps/api/IMPLEMENTATION_PLAN.md`

# Kareo Backend — Implementation Plan

Task: TASK-B-001
Owner: Engineer B
Submission Version: B-001-r2
Status: DRAFT — 技術棧已由 Jerry 核准（2026-09-18），其餘決策待確認

本文件依 `docs/PRODUCT_SPEC.md`、`docs/ARCHITECTURE.md`、`docs/DATA_MODEL.md`、`docs/API_CONTRACT.md` 撰寫，僅為 Backend 第一階段實作計畫，不包含實際程式碼與框架安裝。若本文件與上述 Spec 衝突，以 Spec 為準。

## Revision Note（B-001-r2）

Jerry 於 2026-09-18 核准技術棧方向（延續 Kareocar 現有架構）：

- Backend 語言／框架：**Node.js + TypeScript**（不採 Python + FastAPI）
- Supabase 用途限定為 **PostgreSQL Database + Auth**，前端不得直接依賴 Supabase 自動產生的 API 完成核心業務流程
- Recommendation Engine、Knowledge PUBLISHED 判斷、Consent 檢查、Lead 等業務邏輯，一律由**自訂 Backend API / Netlify Functions** 處理，再讀寫 Supabase
- 暫不使用 Postgres Function 或 Supabase Edge Functions 承載核心業務邏輯
- 前端同樣採 JS/TypeScript，未來前後端可共用型別

本節取代 r1 版本第 8 節的「兩方案並列提案」，詳見下方第 8 節。

---

## 1. 模組總覽 / 責任劃分

Backend（`/apps/api/**`）依 `API_CONTRACT.md` 的 API 分組，規劃以下模組：

| 模組 | 責任 | 對應 Data Model |
|---|---|---|
| Session | 建立匿名工作階段，作為 MVP 主要使用者識別 | Session |
| Consent | 記錄免責聲明 / 隱私 / 條款同意版本，Assessment 前置檢查 | Consent |
| Assessment | 接收評估表單，輸出 CareNeedProfile | Assessment, CareNeedProfile |
| Provider | 提供 Provider 詳細資料查詢 | Provider, ProviderService, ProviderServiceArea |
| Recommendation | 依 CareNeedProfile 執行推薦邏輯，輸出 Top 3 | RecommendationRun, RecommendationItem |
| Lead | 建立「我要媒合」需求紀錄 | Lead |
| Knowledge | 提供目前 PUBLISHED 知識版本狀態，供 Assessment 使用 | KnowledgeSource, KnowledgeRecord, KnowledgeVersion |
| ExternalService | 提供 Kareocar 外部連結資訊（僅回傳 URL，不做整合） | ExternalService |

`/services/**` 為 Backend 內部邏輯層，API 層（`/apps/api`）呼叫這些 service，不直接把邏輯寫在 route/controller 內：

- `services/recommendation` — Recommendation Engine（Provider 篩選、排序、Stable Rotation）
- `services/knowledge` — Knowledge DB 存取、版本管理、Review/Publish 流程
- `services/crawler` — 官方來源定時爬取、Hash 比對、變更偵測

---

## 2. 資料流（對應 ARCHITECTURE.md 第 2 節）

```text
Frontend
  ↓ API Contract
Backend API (apps/api)
  ├─ Session / Consent
  ├─ Assessment ──→ Knowledge DB（讀取 PUBLISHED KnowledgeVersion）
  │        ↓
  │  CareNeedProfile
  │        ↓
  ├─ Recommendation ──→ Provider DB ──→ Top 3
  └─ Lead（記錄 Assessment + Provider + Session）

Crawler（獨立排程，每日 00:10 Asia/Taipei）
  ↓
Official Source → Snapshot → Hash Compare → KnowledgeChange
  ↓
NEEDS_REVIEW → Jerry/Admin Review → APPROVED → PUBLISHED
```

TRANSPORTATION 不進入 Recommendation Engine，`GET /api/v1/external-services/transportation` 直接回傳固定的 Kareocar 連結資料（對應 `DATA_MODEL.md` 第 29 節 ExternalService）。

---

## 3. API Contract 對應

依 `API_CONTRACT.md` 規劃 Route（版本前綴 `/api/v1`，皆回傳統一 `{success, data}` / `{success:false, error}` 格式）：

| Method | Path | 對應模組 |
|---|---|---|
| POST | /api/v1/session | Session |
| POST | /api/v1/consent | Consent |
| POST | /api/v1/assessments | Assessment（內部呼叫 Knowledge 讀取 PUBLISHED 版本） |
| POST | /api/v1/recommendations | Recommendation（內部呼叫 recommendation service） |
| GET | /api/v1/providers/{providerId} | Provider |
| GET | /api/v1/external-services/transportation | ExternalService（Kareocar） |
| POST | /api/v1/leads | Lead |
| GET | /api/v1/knowledge/status | Knowledge |

所有 Error Code 沿用 `API_CONTRACT.md` 第 5 節定義（`INVALID_REQUEST` / `NOT_FOUND` / `VALIDATION_ERROR` / `CONSENT_REQUIRED` / `NO_PROVIDER_FOUND` / `KNOWLEDGE_UNAVAILABLE` / `INTERNAL_ERROR`），不新增或修改 Error Code。

Assessment 若無有效 Consent，回傳 `CONSENT_REQUIRED`（對應 `ARCHITECTURE.md` 第 11 節）。

---

## 4. Recommendation 處理順序

嚴格依 `PRODUCT_SPEC.md` 第 21–23 節與 `ARCHITECTURE.md` 第 7 節，**AI 不直接挑 Provider**：

```text
CareNeedProfile
  ↓
Service Type（本次要推薦的服務類型）
  ↓
Eligible Provider（status = ACTIVE）
  ↓
Service Type Match（ProviderService）
  ↓
Service Area Match（ProviderServiceArea，非 Provider 地址）
  ↓
分流：
  有精確位置（GPS / 完整地址）→ Distance Ranking → rankingType = DISTANCE
  只有行政區                   → Stable Rotation   → rankingType = DISTRICT_ROTATION / CITY_ROTATION
  完全沒有位置                 → rankingType = NO_LOCATION（不宣稱「附近」，見下方）
  ↓
Top 3（最多 3 家，2 家回 2 家，0 家回空陣列 + notice，不得 Error）
  ↓
每筆 RecommendationItem 附上可解釋 reasons（服務範圍、服務類型、距離等）
```

Stable Rotation 規劃使用 `sessionId + district + date` 作為 seed（對應 `PRODUCT_SPEC.md` 第 23 節），確保同一使用者同一天重整不會看到不同商家清單，但不同日期可輪替。禁止使用純 Random。

`rankingType` enum 依 `DATA_MODEL.md` 第 20 節：`DISTANCE` / `DISTRICT_ROTATION` / `CITY_ROTATION` / `NO_LOCATION`。

---

## 5. Knowledge / Crawler 更新流程

依 `PRODUCT_SPEC.md` 第 42–52 節與 `ARCHITECTURE.md` 第 9 節：

```text
KnowledgeSource（官方白名單：衛福部 / 1966 長照專區 / 全國法規資料庫 / 臺北市政府 / 新北市政府）
  ↓
Crawler（每日 00:10 Asia/Taipei）
  ↓
Raw Snapshot
  ↓
Content Hash 比對
  ↓
無變化 → 結束，更新 lastVerifiedAt
有變化 → 建立 KnowledgeChange（status = NEEDS_REVIEW）
  ↓
Jerry / Admin Review（本 Task 不做 Admin UI，只規劃資料狀態機，Review 介面留待後續 Task）
  ↓
APPROVED → 建立 / 更新 KnowledgeVersion → PUBLISHED
```

規則（不可違反）：

- 只有 `PUBLISHED` 的 KnowledgeVersion 可供正式 Assessment 使用；Assessment 回應必須記錄當下使用的 `knowledgeVersion`。
- Crawler 執行失敗（`CrawlerRun.status = FAILED`）時，**不得清空或刪除舊資料**，系統繼續使用 Last Published Knowledge Version。
- 不同官方來源資料衝突時，標記 `CONFLICT`，交由 Jerry/Admin 判斷，AI 不自行決定。
- `publishedAt`（官方公告日）與 `effectiveFrom`（生效日）分開記錄，未生效前不得當作目前有效制度使用。

本 Task 僅規劃上述狀態機與資料流，不含 Admin Review UI（屬於未來 Task，需 Jerry 決定是否併入 Frontend 或另建後台）。

---

## 6. Error Handling

- 所有 API 遵守 `API_CONTRACT.md` 統一錯誤格式，不自訂新的 Error Code。
- Recommendation 找不到符合 Provider：回傳 `success:true`、`providers: []`，並附 `notice` 提示訊息（非 Error）。
- Assessment 缺少有效 Consent：回傳 `CONSENT_REQUIRED`。
- Knowledge 無可用 PUBLISHED 版本：回傳 `KNOWLEDGE_UNAVAILABLE`，Assessment 不得憑空猜測制度內容。
- 所有未預期例外統一包裝為 `INTERNAL_ERROR`，並記錄 log（不可洩漏 Secret / Stack Trace 給前端）。
- Crawler 失敗：記錄 `CrawlerRun.status = FAILED` 與 `errorMessage`，不影響現有 PUBLISHED Knowledge 對外服務。

---

## 7. Test Strategy

規劃三層測試（實作階段依技術棧選定對應框架）：

1. **Unit Test**：Recommendation 篩選/排序邏輯（含 Distance Ranking 與 Stable Rotation 的可重現性）、Knowledge 狀態機轉換合法性（例如不可從 `DISCOVERED` 直接跳到 `PUBLISHED`）。
2. **Integration Test（Backend 內部）**：API Route → Service →（Mock）Database 的串接，驗證 Response 格式符合 `API_CONTRACT.md`。
3. **Contract Test**：以 `contracts/mock/**`（Jerry 提供）的範例格式驗證 Real API Response 結構一致，避免 Engineer B 私自改動欄位。

Engineer B 測試範圍不含 Frontend E2E（屬 Jerry 在 staging 的整合測試，見 `ARCHITECTURE.md` 第 16 節 Testing Boundary）。

---

## 8. 核准技術棧（Jerry 已於 2026-09-18 核准）

延續 Kareocar 現有做法，Backend 架構採：

```text
Frontend（JS/TypeScript）
  ↓ API Contract（固定格式，非 Supabase 自動 API）
自訂 Backend API（Node.js + TypeScript，可能以 Netlify Functions 部署）
  ↓
Supabase（僅作 PostgreSQL Database + Auth）
```

### 核准內容

- **Backend 語言／框架**：Node.js + TypeScript（Express 或 Fastify，具體框架屬實作階段細節，不影響本計畫）
- **Database**：Supabase（PostgreSQL），**僅用於資料儲存與 Auth**，不作為主要 API 層
- **業務邏輯歸屬**：Recommendation Engine、Knowledge PUBLISHED 判斷、Consent 檢查、Lead 建立等，一律寫在自訂 Backend API（`/apps/api`）與 `/services/**`，再讀寫 Supabase；**不**使用 Supabase 自動產生的 REST API 承載這些邏輯，**不**使用 Postgres Function，**不**使用 Supabase Edge Functions 承載核心業務邏輯
- **部署型態**：延續 Kareocar 模式，可能以 Netlify Functions 或同等 Serverless Function 部署自訂 API（是否採用 Netlify Functions 或獨立 Node Server，留待實作階段依部署環境細節確認，不影響本文件已規劃的模組劃分）
- **前端**：JS/TypeScript，未來前後端可共用 TypeScript 型別定義（例如把 `API_CONTRACT.md` 介面定義成共用 `.ts` type）

### 理由

- 與 Kareocar 既有架構一致，降低未來兩系統整合或团队維護的認知負擔
- Node.js + TypeScript 與前端（JS/TS 生態）共用型別，降低 Contract 不一致風險
- Supabase 僅承擔 Database/Auth，避免業務邏輯（尤其是「AI 不得自己選 Provider」「Knowledge 需 Review/Publish Gate」等強制規則）繞過自訂 API 而被 Supabase 自動 API 曝露或繞過

Crawler 排程沿用第 5 節規劃，執行環境（Serverless Scheduled Function / 獨立 Worker）待第 9 節確認。

本文件不含實際安裝套件、不含 Root Config 異動；套件安裝與專案初始化留待下一張實作 Task。

---

## 9. 需 Jerry 核准的決策

已核准（2026-09-18）：

- [x] Backend 技術棧 → Node.js + TypeScript
- [x] Database 選型與 Hosting → Supabase（僅 Database + Auth，不作主要 API 層）

尚待確認：

- [ ] 自訂 Backend API 的實際部署型態（Netlify Functions vs 獨立 Node Server / 其他 Serverless 平台）
- [ ] Knowledge Admin Review 介面歸屬（獨立 Admin 前端？併入現有 Frontend？CLI 工具？）
- [ ] Crawler 排程執行環境（Serverless Scheduled Function、獨立 Worker、或 CI Scheduled Job）
- [ ] AI Adapter（Assessment 用於生成 CareNeedProfile 的 LLM 供應商）選型，需符合 `ARCHITECTURE.md` 第 8 節 AI Architecture 的 Adapter 隔離原則
- [ ] Node.js Backend 框架細節（Express / Fastify / 其他）與 ORM／DB Client 選擇（例如 Prisma 或 Supabase 官方 JS Client）

---

## 10. 未來在 staging 的整合與測試需求

- Jerry 需要將 Engineer C 的 Mock Frontend 換成 Real API（`AGENTS.md` 第 11 節），Backend 需確保欄位、型態、enum 與 Contract 完全一致，避免整合時出現落差。
- Engineer A 的 Provider 資料（`feat/a-001-provider-data`）需要由 Engineer B 在後續 Task 匯入正式 Provider DB（`ARCHITECTURE.md` 第 5 節：A 不直接操作正式 Database）。
- staging 環境需要獨立的 Database 與 Secrets（`ARCHITECTURE.md` 第 14 節），與 Production 分離。
- Knowledge Crawler 首次上線前，需要 Jerry 確認官方白名單來源清單是否完整，並人工核准第一版 KnowledgeVersion 後 Assessment 才能正式使用。
- 建議 staging Integration 時執行一次完整 E2E：Consent → Assessment → Recommendation（含有位置與無位置兩種情境）→ Lead，涵蓋 Empty State 與 Error State。

---

## Source of Truth

若本文件與規格衝突：

```text
PRODUCT_SPEC.md → ARCHITECTURE.md → DATA_MODEL.md → API_CONTRACT.md → GIT_RULES.md → TASK → Code
```

發現衝突或需跨模組決策時，停止修改並建立 Issue，交由 Jerry 決定。


---

## 原始路徑：`apps/web/IMPLEMENTATION_PLAN.md`

# Kareo Frontend Implementation Plan

- Task: `TASK-C-001`
- Owner: Engineer C
- Submission version: `C-001-r1`
- Status: Proposed — pending Jerry approval for technology-stack decisions

## 1. Purpose and scope

This plan defines the MVP frontend information architecture and user experience for Kareo. It is limited to `/apps/web/**` and is designed to work with API-contract-shaped mock data before the real API is integrated in `staging`.

The frontend presents a preliminary care-needs assessment and service guidance. It must not make official eligibility, CMS-level, benefit-approval, diagnosis, or provider-ranking decisions.

Out of scope for this task:

- Installing a framework or changing root configuration.
- Changing API endpoints, response shapes, data models, contracts, or mock contracts.
- Implementing backend, recommendation, provider-data, knowledge, authentication, payment, or Kareocar integration.

## 2. Sitemap / page map

```text
/
├─ /                         Homepage
├─ /consent                  Consent and disclaimer
├─ /assessment               Care-needs assessment
├─ /assessment/result        Preliminary CareNeedProfile result
├─ /recommendations/:service Service recommendation and Provider Top 3
├─ /providers/:providerId    Provider detail
├─ /lead                     Lead form for the selected provider
└─ shared states             Loading, empty, error, and not-found views
```

`TRANSPORTATION` is not a provider-result route. When it appears in the CareNeedProfile or service recommendation, the user sees an external Kareocar CTA instead.

## 3. User flow

```text
Homepage
  ↓ Start free assessment
Consent / Disclaimer (must accept)
  ↓
Assessment
  ↓ POST /assessments
Preliminary CareNeedProfile result
  ↓ Choose a non-transportation service
Service recommendation / Provider Top 3
  ↓
Provider detail
  ├─ Open Google Maps in a new tab
  └─ Start lead form → submit lead → confirmation

CareNeedProfile with TRANSPORTATION
  ↓
Kareocar CTA → https://kareocar.netlify.app/ (new tab)
```

If consent is not accepted, the assessment cannot start. If a user has no location, the assessment can still finish, but the UI must not claim that any provider is nearby. If no provider matches, show a helpful empty state rather than an error.

## 4. Page responsibilities

| Page | Primary responsibility | Key actions and requirements |
| --- | --- | --- |
| Homepage | Explain the free preliminary service and guide first-time visitors. | Primary CTA: 「開始免費長照評估」; avoid dense policy/CMS content. |
| Consent | Collect clickwrap acceptance before assessment. | Show service explanation, disclaimer, privacy notice and terms versions; submit consent with `accepted: true`. |
| Assessment | Collect only contract-defined preliminary needs and location information. | Validate required inputs, allow `UNKNOWN` where supported, submit the assessment request. |
| Assessment Result | Present `careNeedProfile` in understandable language. | Label result 「初步預估」; show `summary`, `warnings`, priorities and next steps. |
| Service Recommendation | Let the user act on each recommended service. | For HOME_CARE, HOME_MEDICAL_NURSING and ASSISTIVE_DEVICE, request and display Provider Top 3. For TRANSPORTATION, show Kareocar external CTA. |
| Provider Top 3 | Present the contract response without altering ranking. | Display provider name, type, district, reasons, distance only when present, notice, detail, Maps and lead actions. |
| Provider Detail | Show one provider's contract-defined detail. | Display contact, service areas, services, verified flag, website when present, Google Maps CTA and lead CTA. |
| Lead Form | Collect only contact name and phone to request matching. | Keep selected assessment, provider and service context; show success or recoverable error after submission. |

## 5. Component map

```text
App shell
├─ Header / footer
│  └─ Persistent preliminary-result and 1966 reminder in footer
├─ DisclaimerBanner
├─ HomepageHero
├─ ConsentForm
├─ AssessmentForm
│  ├─ LocationFields
│  ├─ LivingAndCaregiverFields
│  ├─ MobilityAndDailyLivingFields
│  └─ ServiceNeedFields
├─ CareNeedProfileCard
│  ├─ PriorityList
│  ├─ WarningList
│  └─ ServiceActionList
├─ RecommendationView
│  ├─ RecommendationNotice
│  ├─ ProviderCard
│  ├─ ProviderReasons
│  └─ EmptyProviderState
├─ ProviderDetailView
├─ GoogleMapsLink
├─ KareocarLink
├─ LeadForm
└─ AsyncState
   ├─ LoadingState
   ├─ ErrorState
   ├─ EmptyState
   └─ SuccessFeedback
```

Reusable components receive view data only. They must not contain recommendation logic, construct Google Maps URLs, or infer official eligibility.

## 6. Frontend state management

Use route-level state plus a small session context/store:

- `sessionId`: returned by `POST /api/v1/session`.
- `consent`: accepted status plus disclaimer, privacy and terms versions.
- `assessment`: current request draft and completed `assessmentId`.
- `careNeedProfile`: the completed assessment response, including `knowledgeVersion` and warnings.
- `selectedService`, `selectedProvider` and latest recommendation response.
- `lead`: selected provider/service context and submission status.

Persist only the minimum session and completed identifiers needed to resume the current browser flow. Do not persist free-text health information or contact data beyond what is required for the active flow. Treat API data as read-only frontend state.

## 7. Loading, success, empty and error states

| Flow | Loading | Success | Empty | Error |
| --- | --- | --- | --- | --- |
| Session / consent | Disable duplicate submit and announce progress. | Continue to assessment. | Not applicable. | Explain that assessment cannot start; offer retry. |
| Assessment | Keep entered answers visible and prevent duplicate submission. | Show CareNeedProfile and required warnings. | Not applicable. | Preserve answers, show non-diagnostic error and retry option. |
| Recommendation | Skeleton/provider-list progress with accessible status text. | Show up to three returned providers and notice. | When `providers: []`, show the contract notice, 1966 guidance and retry/change-location actions. | Do not guess providers; show retry and 1966 guidance. |
| Provider detail | Show detail loading state. | Show returned provider information. | Not applicable. | Show not-found/retry state; do not manufacture details. |
| Lead | Disable repeated submissions while sending. | Confirm `leadId` and status `NEW`; explain next expected contact. | Not applicable. | Retain typed values locally for correction/retry. |
| Kareocar | Not required before navigation. | Open supplied URL in a new tab. | If service data is unavailable, show a non-embedded unavailable message. | Do not substitute another URL. |

Timeouts are errors, not empty results. The UI must never invent an assessment, recommendation, provider, or benefit result.

## 8. Mock data and API-contract mapping

During independent frontend development, use fixtures shaped exactly like `API_CONTRACT.md`; do not add fields or change existing names, types or enums.

| Frontend flow | Contract endpoint | Required response data | Fixture scenario |
| --- | --- | --- | --- |
| Start session | `POST /api/v1/session` | `sessionId`, `createdAt` | Success and error |
| Accept consent | `POST /api/v1/consent` | `consentId`, `acceptedAt` | Accepted, declined, `CONSENT_REQUIRED` |
| Submit assessment | `POST /api/v1/assessments` | `assessmentId`, `knowledgeVersion`, `careNeedProfile` | Success, validation error, timeout |
| Get providers | `POST /api/v1/recommendations` | `recommendationId`, service/ranking/location data, `providers`, `notice` | GPS success, district success, empty, error |
| Provider detail | `GET /api/v1/providers/{providerId}` | Provider fields, `services`, `serviceAreas` | Success, not found, error |
| Transportation | `GET /api/v1/external-services/transportation` | `url`, `openMode`, `notice` | Success and unavailable error |
| Submit lead | `POST /api/v1/leads` | `leadId`, `status`, `createdAt` | Success, validation error, error |

Mock fixtures should remain inside the web application only when created in a later, explicitly scoped frontend task. `contracts/mock/**` is Jerry-owned and must not be changed by Engineer C.

## 9. API integration boundaries

- All requests use the fixed `/api/v1` contract and its standard `success` envelope.
- Map `success: false` to a user-safe error state using the supplied error code/message.
- `NO_PROVIDER_FOUND` or `providers: []` maps to an empty provider state, not a crash.
- `CONSENT_REQUIRED` returns the user to consent; it must not be bypassed in the UI.
- Render `distanceKm` only when the contract supplies it. With `DISTRICT_ROTATION`, explicitly state that the result is not distance-ranked.
- Render provider `reasons`; do not calculate scores, distances, service coverage, rankings or provider eligibility in the frontend.
- Use only the supplied `googleMapsUrl`; never construct a Maps URL from address data.

## 10. Disclaimer and preliminary-result placement

| Placement | Required content |
| --- | --- |
| Homepage near CTA | Briefly state that the service is free and provides a preliminary assessment. |
| Consent page | Full disclaimer and separate privacy/terms acknowledgement before assessment starts. |
| Assessment Result | Prominent 「初步預估」 label plus API `warnings`. |
| Benefit or policy information | Use 「可能符合」or「預估」; show knowledge notice/source metadata when supplied. |
| Provider results | State that recommendations are based on current information and service/location criteria, not official endorsement. |
| Global footer | State that eligibility, care level, services and benefits require formal confirmation by 1966 or the local long-term-care management center. |

Never use wording such as 「正式核定」、「已符合資格」or「已核定 CMS 等級」.

## 11. External-navigation rules

### Google Maps

Display a clearly labelled external link only when the returned provider includes `googleMapsUrl`. Open it in a new tab with safe external-link behavior. The frontend must not construct, alter or embed a Google Maps URL.

### Kareocar

For `TRANSPORTATION`, use the external-service response URL; the MVP expected URL is `https://kareocar.netlify.app/`. Open a new tab. Do not use an iframe, shared authentication, backend integration, database integration, or an in-app transportation booking flow.

## 12. Responsive design strategy

- Design mobile-first because a family caregiver may use a phone during care coordination.
- Use one-column forms and readable, touch-friendly controls on narrow screens.
- Keep primary CTA and next step visible; do not rely on hover to reveal essential information.
- On larger screens, use constrained content width and a two-column provider/detail layout only when information remains readable.
- Provider cards must preserve rank, reasons, phone, service type and CTAs without horizontal clipping.
- Test at least mobile, tablet and desktop breakpoints, including long Chinese labels and dynamic API notices.

## 13. Accessibility baseline

- Use semantic headings, landmarks, labelled form controls and native buttons/links.
- Associate validation errors with fields and move focus to the first error after submit.
- Announce loading, success and error updates through accessible status messaging.
- Keep keyboard order aligned with visual order; make all CTA and dialog controls keyboard-operable.
- Provide visible focus states and sufficient text/background contrast.
- Do not use colour alone for validation, rank, verified status or error meaning.
- Ensure external links identify that they open a new tab.
- Write plain, respectful Chinese and avoid unexplained professional terminology.

## 14. Frontend technology-stack options

No framework is installed or selected by this task. Jerry must approve one option before implementation changes root configuration.

| Option | Strengths | Trade-offs |
| --- | --- | --- |
| A. React + Vite + TypeScript + React Router | Strong component ecosystem, straightforward mock/API replacement, familiar routing and good support for responsive component development. | Requires root setup and dependency approval; state/data-fetching conventions must be agreed. |
| B. Next.js + TypeScript | File-based routing, strong deployment conventions and future flexibility for server rendering. | More framework decisions and configuration than this static/mock-first MVP plan needs; requires root setup and deployment approval. |

Recommendation: Option A, React + Vite + TypeScript + React Router, because it is the lighter mock-first option for the defined page flow and keeps eventual API replacement simple. This is a recommendation only; no package, configuration, route, or dependency change is authorized here.

## 15. Decisions requiring Jerry approval

1. Chosen frontend framework and version.
2. Package manager, root package configuration and deployment/preview setup.
3. Styling system and any component/form/data-fetching libraries.
4. Exact consent, privacy and terms copy and their version identifiers.
5. Whether and how browser session state may persist between reloads.
6. Any API-contract ambiguity, new mock scenario or requested contract change.
7. Analytics, error-monitoring, tracking or external-service security policy.

## 16. Staging and real-API integration checklist

When Jerry integrates the frontend with Engineer B's real API in `staging`:

1. Replace fixture adapters with the real `/api/v1` endpoints without changing UI response assumptions.
2. Verify session → consent → assessment → CareNeedProfile → recommendation → detail → lead flow end to end.
3. Verify the consent rejection and `CONSENT_REQUIRED` paths.
4. Verify GPS, district-only and no-location recommendation wording.
5. Verify zero, one, two and three provider responses, plus API error and timeout states.
6. Confirm ranking, reasons, distance and Maps URLs are rendered exactly as returned.
7. Confirm TRANSPORTATION opens Kareocar in a new tab and is never sent to the provider recommendation endpoint.
8. Verify disclaimer wording at every required placement and confirm no official-result claims appear.
9. Run mobile, keyboard and screen-reader-oriented checks alongside integration/E2E testing.

## 17. Scope compliance

This plan introduces no changes to backend, contracts, schemas, recommendation logic, provider data, root configuration or deployment configuration. Future implementation tasks should remain scoped to `/apps/web/**` and should create an Issue for any required cross-module change.


---

## 原始路徑：`services/recommendation/README.md`

# Recommendation Service — Plan

Task: TASK-B-001
Owner: Engineer B
Status: DRAFT — 待 Jerry 核准

本文件規劃 `services/recommendation/**`，依 `docs/DATA_MODEL.md` 第 20–21 節、`docs/PRODUCT_SPEC.md` 第 17–27 節、`docs/ARCHITECTURE.md` 第 7 節。

---

## 1. 責任

Recommendation Service 是 Backend API 呼叫的內部邏輯層，負責：

- 依 `CareNeedProfile` 與指定 `serviceType`，從 Provider DB 篩出符合條件的 Provider
- 依是否有精確位置決定排序策略（Distance Ranking / Stable Rotation）
- 產生最多 3 筆 `RecommendationItem`，附上可解釋的 `reasons`
- 記錄一次 `RecommendationRun`（含 `rankingType`、`locationPrecision`、`knowledgeVersion`）

**本模組不負責**：Provider 資料維護（Engineer A / Provider Service 負責）、Assessment 內容生成、AI 選商家（明確禁止）。

---

## 2. 輸入 / 輸出

輸入（對應 `POST /api/v1/recommendations`）：

```json
{
  "assessmentId": "ASM-001",
  "serviceType": "HOME_CARE"
}
```

輸出：`RecommendationRun` + 最多 3 筆 `RecommendationItem`（含 Provider 展示欄位、`rank`、`distanceKm`、`reasons`），格式完全依 `API_CONTRACT.md` 第 9 節。

---

## 3. 處理流程

```text
1. 讀取 Assessment / CareNeedProfile → 取得 location（city/district/precision/lat/lng）
2. Eligible Provider：status = ACTIVE
3. Service Type Match：ProviderService.serviceType = 指定 serviceType 且 active = true
4. Service Area Match：ProviderServiceArea 包含 Assessment 的 city/district
   （地址與服務範圍分開判斷，Provider 本身地址不等於服務範圍）
5. 依 locationPrecision 分流：
   a. GPS / EXACT（有 lat/lng）→ 計算 Distance（Haversine）→ 由近到遠排序
   b. DISTRICT / CITY（僅有行政區）→ Stable Rotation 排序
   c. NONE（無位置）→ rankingType = NO_LOCATION，仍可回傳符合 Service Type + Service Area 的結果，
      但不得標示「附近」或距離
6. 取前 3 筆，若不足 3 筆則回傳實際數量；0 筆則回傳空陣列 + notice
7. 每筆結果組成 reasons（例如「服務範圍包含 OO 區」「提供您需要的 OO 服務」，有距離時加「距離約 X 公里」）
8. 寫入 RecommendationRun + RecommendationItem
```

---

## 4. Stable Rotation 演算法規劃

依 `PRODUCT_SPEC.md` 第 23 節，禁止純 Random：

```text
seed = hash(sessionId + district + date)
使用 seed 對符合條件的 Provider 清單做確定性排序（例如以 seed 為基礎的 shuffle 或加權排序）
```

- 同一 `sessionId` + 同一 `district` + 同一天 → 結果穩定不變
- 換日期 → seed 改變 → 可以輪替，避免長期固定同幾家曝光
- 明確**不得**因商家付費而改變自然推薦順序（`PRODUCT_SPEC.md` 第 5 節），本模組不接受任何付費排序參數

---

## 5. 排序型別（enum，不可自行新增）

`rankingType`：`DISTANCE` / `DISTRICT_ROTATION` / `CITY_ROTATION` / `NO_LOCATION`（依 `DATA_MODEL.md` 第 20 節）

---

## 6. Error Handling

- 找不到任何符合 Provider → 正常回應（`success:true`），`providers: []`，`notice` 提示改看更多資源或聯絡 1966，**不得回 Error**。
- `serviceType` 不在允許 enum 內 → `VALIDATION_ERROR`。
- `assessmentId` 不存在 → `NOT_FOUND`。
- 計算 Distance 需要的 lat/lng 缺漏但 locationPrecision 宣稱 GPS/EXACT → fallback 降級為 Stable Rotation，並記錄 Known Issue（不得中斷流程）。

---

## 7. Test Strategy

- Unit Test：Service Area 篩選邏輯、Distance 排序正確性、Stable Rotation 在同 seed 下結果一致、不同 date 下結果可變化。
- 邊界測試：0 家 / 1 家 / 2 家 / 超過 3 家符合條件。
- 禁止測試：不得測試「LLM 自行選商家」路徑，因為此路徑本來就不應存在。

---

## 8. 技術決策（需 Jerry 核准）

- Distance 計算是否需要考慮實際路網距離，或 MVP 僅用直線距離（Haversine）即可（建議 MVP 用直線距離，未來可換 Google Distance Matrix API）。
- Stable Rotation 的 hash / seed 演算法實作細節（例如簡單 mod 運算 vs cryptographic hash），效能與可預測性需求由 Jerry 確認。

---

## Source of Truth

```text
PRODUCT_SPEC.md → ARCHITECTURE.md → DATA_MODEL.md → API_CONTRACT.md → GIT_RULES.md → TASK → Code
```


---

## 原始路徑：`services/knowledge/README.md`

# Knowledge Service — Plan

Task: TASK-B-001
Owner: Engineer B
Status: DRAFT — 待 Jerry 核准

本文件規劃 `services/knowledge/**`，依 `docs/DATA_MODEL.md` 第 23–27 節、`docs/PRODUCT_SPEC.md` 第 38–52 節、`docs/ARCHITECTURE.md` 第 9 節。

---

## 1. 責任

Knowledge Service 負責管理長照制度 / 法規 / 補助的官方資料，回答「目前制度怎麼規定？」，與 Provider DB（回答「可以找誰？」）明確分離，不共用資料表邏輯。

管理對象：`KnowledgeSource`、`KnowledgeRecord`、`KnowledgeVersion`、`KnowledgeChange`。

**本模組不負責**：抓取官方網站的實際爬蟲執行（由 `services/crawler` 負責，Knowledge Service 只消費 Crawler 產生的結果）。

---

## 2. 資料流

```text
services/crawler 偵測到變化
  ↓
建立 / 更新 KnowledgeRecord（status 初始為 DISCOVERED 或 NEEDS_REVIEW）
  ↓
建立 KnowledgeChange（oldContentHash / newContentHash / aiSummary，status = NEEDS_REVIEW）
  ↓
Jerry / Admin Review（Approve or Reject）
  ↓
APPROVED → 併入新的 / 更新既有 KnowledgeVersion
  ↓
PUBLISHED（唯一可供正式 Assessment 使用的狀態）
```

Assessment Service 呼叫 Knowledge Service 取得目前 `PUBLISHED` 的 `KnowledgeVersion`，並將版本號記錄於該筆 Assessment（對應 `DATA_MODEL.md` 第 7 節 `knowledgeVersion` 欄位）。

---

## 3. 狀態機（不可自行新增/修改）

`KnowledgeRecord.status`：

```text
DISCOVERED → NEEDS_REVIEW → APPROVED → PUBLISHED
                    ↓             ↓
                REJECTED      SUPERSEDED
                    ↓
                CONFLICT
FETCH_FAILED（爬取失敗，不影響既有 PUBLISHED 資料）
```

`KnowledgeVersion.status`：`DRAFT → PUBLISHED → ARCHIVED`

規則：

- 只有 `PUBLISHED` 版本可供正式 Assessment 使用。
- 不同官方來源資料衝突 → 標記 `CONFLICT`，**AI 不得自行判斷**，交由 Jerry/Admin。
- `publishedAt`（官方公告日）與 `effectiveFrom`（生效日）分開記錄；生效日未到不得視為目前有效制度。
- Crawler 抓取失敗（`FETCH_FAILED`）→ 不清空、不刪除舊資料，系統繼續使用 Last Published Knowledge Version。

---

## 4. Jurisdiction / 適用地區

`TAIWAN` / `TAIPEI` / `NEW_TAIPEI`（依 `DATA_MODEL.md` 第 23 節）。地方補助不得跨區套用（例如台北市補助不能用於新北市使用者）。

---

## 5. 官方白名單（不可擴增，需 Jerry 核准才能新增來源）

- 中央：衛生福利部、1966 / 長照專區、全國法規資料庫
- 地方：臺北市政府、新北市政府

禁止把部落格、社群媒體、新聞、SEO 文章當作正式 Assessment Knowledge。

---

## 6. API 對應

`GET /api/v1/knowledge/status`（依 `API_CONTRACT.md` 第 13 節）：回傳目前 `PUBLISHED` 版本號、`publishedAt`、`lastVerifiedAt`、提醒文字。Frontend 原則上不直接讀整個 Knowledge DB，只透過此輕量端點取得狀態。

---

## 7. Error Handling

- 找不到任何 `PUBLISHED` 版本（例如系統剛啟動、尚未有人 Approve）→ `KNOWLEDGE_UNAVAILABLE`，Assessment 不得用 LLM 記憶硬猜。
- Knowledge 內容不足以回答使用者制度問題 → 依 `PRODUCT_SPEC.md` 第 51 節，回覆固定文案：「目前平台資料不足以做出可靠預估，建議聯絡 1966 或所在地長期照顧管理中心確認。」

---

## 8. Test Strategy

- Unit Test：狀態機轉換合法性（例如禁止 `DISCOVERED` 直接跳 `PUBLISHED`）、Jurisdiction 篩選正確性（台北市 Knowledge 不會誤用於新北市使用者）。
- Integration Test：`GET /knowledge/status` 在「有 PUBLISHED 版本」與「無 PUBLISHED 版本」兩種情境下的回應正確性。
- Regression：確認 Crawler FETCH_FAILED 情境下，舊 PUBLISHED 版本仍可正常被 Assessment 讀取。

---

## 9. 需 Jerry 核准的決策

- [ ] Admin Review 介面（本 Task 只規劃資料狀態機，實際 Review UI/流程需另立 Task）
- [ ] `ruleData`（結構化規則 JSON）的實際 schema 設計，需先經 Jerry 確認後才能落地（`DATA_MODEL.md` 第 25 節：AI 不得自行改變既有 ruleData schema）
- [ ] AI Summary（KnowledgeChange.aiSummary）使用的 LLM 供應商與 Prompt 規範

---

## Source of Truth

```text
PRODUCT_SPEC.md → ARCHITECTURE.md → DATA_MODEL.md → API_CONTRACT.md → GIT_RULES.md → TASK → Code
```


---

## 原始路徑：`services/crawler/README.md`

# Crawler Service — Plan

Task: TASK-B-001
Owner: Engineer B
Status: DRAFT — 待 Jerry 核准

本文件規劃 `services/crawler/**`，依 `docs/DATA_MODEL.md` 第 28 節、`docs/PRODUCT_SPEC.md` 第 42–49 節、`docs/ARCHITECTURE.md` 第 9 節。

---

## 1. 責任

Crawler Service 負責定期抓取官方白名單來源，偵測內容變化，產生 `KnowledgeChange` 供 Knowledge Service / Jerry 審核。**Crawler 本身不得直接修改正式 Assessment 使用的 Knowledge，只能提出變更請求。**

管理對象：`CrawlerRun`（每次執行紀錄）。

---

## 2. 排程

- 頻率：每日一次
- 時間：`00:10`
- Timezone：`Asia/Taipei`

（實際排程執行環境——Serverless Cron / 獨立 Worker / CI Scheduled Job——屬技術棧決策，需 Jerry 核准，見第 6 節。）

---

## 3. 處理流程

```text
1. 讀取 KnowledgeSource（官方白名單，active = true）清單
2. 對每個來源建立 CrawlerRun（status = RUNNING, startedAt）
3. 抓取官方頁面內容（Raw Snapshot）
4. 計算 Content Hash
5. 與該 KnowledgeRecord 目前的 contentHash 比對：
   a. 相同 → 更新 lastVerifiedAt，不建立 KnowledgeChange
   b. 不同 → 建立 / 更新 KnowledgeRecord（status 視情況設為 DISCOVERED 或直接進 NEEDS_REVIEW）
      並建立 KnowledgeChange（oldContentHash / newContentHash / oldContent / newContent，
      status = NEEDS_REVIEW，可附 aiSummary 協助 Jerry 快速理解差異）
6. 更新 CrawlerRun（status = SUCCESS / PARTIAL / FAILED, finishedAt, itemsChecked, changesDetected）
```

---

## 4. 失敗處理（Crawler Failure）

依 `PRODUCT_SPEC.md` 第 49 節與 `DATA_MODEL.md` 第 28 節：

- 單一來源抓取失敗 → 該來源對應 `CrawlerRun.status = FAILED`，記錄 `errorMessage`。
- 部分來源成功、部分失敗 → 整體視為 `PARTIAL`。
- **絕對禁止**：因抓取失敗而清空 Knowledge、刪除舊資料，或用「半套」新資料覆蓋既有 `PUBLISHED` 內容。系統必須繼續使用 Last Published Knowledge Version 對外服務。

---

## 5. 與 Knowledge Service 的分工

```text
Crawler：Official Source → Snapshot → Hash Compare → KnowledgeChange（NEEDS_REVIEW）
Knowledge Service：管理 Review / Approve / Publish 之後的狀態與正式版本
```

Crawler 不持有「審核通過」的權限，只負責「發現變化並提出」。

---

## 6. Error Handling

- 官方網站結構改版導致解析失敗 → 記錄 `FAILED` + `errorMessage`，不中斷其他來源的抓取。
- 網路逾時 → 重試策略與次數由後續實作階段決定（本 Task 只規劃行為原則：失敗不影響既有 Published 資料）。

---

## 7. Test Strategy

- Unit Test：Content Hash 計算一致性（同內容 → 同 hash）、Hash 比對邏輯（有變化才觸發 KnowledgeChange）。
- Integration Test：模擬單一來源抓取失敗時，其餘來源與既有 Published Knowledge 不受影響。
- 手動測試：以固定官方頁面 Snapshot 驗證解析正確性（不在 CI 中對正式官網做高頻率請求，避免造成負擔或被封鎖）。

---

## 8. 技術決策（需 Jerry 核准）

- [ ] Crawler 執行環境（Serverless Scheduled Function / 獨立 Worker Process / CI Cron Job）
- [ ] HTML 解析方式（是否需要 Headless Browser，或純 HTTP + HTML Parser 即可）
- [ ] `aiSummary` 是否在 Crawler 階段即生成，或延後到 Review 階段才呼叫 AI（涉及成本與即時性權衡）
- [ ] 重試 / 逾時策略的具體參數

---

## Source of Truth

```text
PRODUCT_SPEC.md → ARCHITECTURE.md → DATA_MODEL.md → API_CONTRACT.md → GIT_RULES.md → TASK → Code
```
