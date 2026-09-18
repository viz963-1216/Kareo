# Kareo Backend — Implementation Plan

Task: TASK-B-001
Owner: Engineer B
Status: DRAFT — 待 Jerry 核准

本文件依 `docs/PRODUCT_SPEC.md`、`docs/ARCHITECTURE.md`、`docs/DATA_MODEL.md`、`docs/API_CONTRACT.md` 撰寫，僅為 Backend 第一階段實作計畫，不包含實際程式碼與框架安裝。若本文件與上述 Spec 衝突，以 Spec 為準。

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

## 8. 建議技術棧（Jerry 決定用）

目前 Repository 尚無已核准 Backend Framework，提出兩個方案：

### 方案 A：Node.js + TypeScript + Express（或 Fastify）+ PostgreSQL + Prisma

- 優點：與前端（若 Engineer C 選 React/Next.js）共用 JS/TS 生態，型別可與 Contract 共用；Prisma 對應 `DATA_MODEL.md` 的 Schema 定義直覺；Vibe Coding 友善（AI 對 TS/Node 生態熟悉度高）；部署選項多（Vercel / Railway / Render）。
- 缺點：Recommendation 排序邏輯若計算量大，需注意 Node 單執行緒特性；團隊需熟悉 Prisma migration 流程。

### 方案 B：Python + FastAPI + PostgreSQL + SQLAlchemy

- 優點：FastAPI 自動產生 OpenAPI 文件，利於與 `API_CONTRACT.md` 對照；Python 生態對未來 Knowledge/Crawler 的資料處理、NLP（若需要）較豐富；Type Safety 可用 Pydantic 達成。
- 缺點：與 Frontend（多半是 JS/TS 生態）型別無法直接共用；團隊若無 Python 經驗，Vibe Coding 上手成本略高。

**兩方案皆使用 PostgreSQL** 作為主要資料庫（符合關聯式資料如 Provider/Assessment/Knowledge 之間的外鍵關係），Crawler 排程建議用 Cron（部署平台原生排程或 node-cron / APScheduler）。

本文件僅提案，**未安裝任何套件、未修改 Root Config**，最終技術棧由 Jerry 核准後才會在後續 Task 落地。

---

## 9. 需 Jerry 核准的決策

- [ ] Backend 技術棧（方案 A vs 方案 B，或其他）
- [ ] Database 選型與 Hosting（例如 Supabase / Railway / 自架 PostgreSQL）
- [ ] Knowledge Admin Review 介面歸屬（獨立 Admin 前端？併入現有 Frontend？CLI 工具？）
- [ ] Crawler 排程執行環境（Serverless Cron、獨立 Worker、或 CI Scheduled Job）
- [ ] AI Adapter（Assessment 用於生成 CareNeedProfile 的 LLM 供應商）選型，需符合 `ARCHITECTURE.md` 第 8 節 AI Architecture 的 Adapter 隔離原則

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
