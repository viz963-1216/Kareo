# Kareo / 長照一點通 — System Architecture

Version: v0.5.5（J-002-r13，2026-10-03；§20.7 保存期限分離、§21 內容包操作者與不可變規則）
Status: LOCKED FOR MVP  
Owner: Jerry

---

# 1. 架構目標

本專案採：

**Independent Development + Central Integration / 獨立開發 + Jerry 中心整合**

```text
Engineer A / B / C
        ↓
各自 Feature Branch
        ↓
PR → staging
        ↓
Jerry 整合與驗收
        ↓
staging → main
        ↓
Production
```

核心原則：

- A / B / C 可以同時工作
- A / B / C 不直接整合彼此程式
- 不修改其他人的 Ownership
- 所有人遵守同一份 Spec
- 跨模組整合只在 `staging` 進行
- `main` 只保存正式可部署版本

---

# 2. 整體系統

```text
使用者
  │
  ▼
Frontend Web（Engineer C）
  │
  │ API Contract
  ▼
Backend API（Engineer B）
  │
  ├───────────────┐
  │               │
  ▼               ▼
Provider DB    Knowledge DB
  │               │
  │               ▼
  │          Knowledge Crawler
  │
  ▼
Recommendation Engine
  │
  ▼
Top 3 Provider
```

交通需求另外走：

```text
TRANSPORTATION
↓
External Link
↓
Kareocar
```

Kareocar 正式網址：`https://kareocar.netlify.app/`

Kareocar 不內嵌、不共用 Backend、不共用 Database。

---

# 3. Repository Structure

```text
/
├── AGENTS.md
├── docs/
│   ├── PRODUCT_SPEC.md
│   ├── ARCHITECTURE.md
│   ├── DATA_MODEL.md
│   ├── API_CONTRACT.md
│   └── GIT_RULES.md
├── contracts/
│   ├── schemas/
│   └── mock/
├── tasks/
├── apps/
│   ├── web/
│   └── api/
├── services/
│   ├── recommendation/
│   ├── knowledge/
│   └── crawler/
├── data/
│   └── providers/
├── tests/
└── .github/
```

---

# 4. Branch Architecture / 分支架構

## main

正式穩定分支。

用途：Production Release。

只有 Jerry 將通過 staging 驗收的版本合併進 main。

## staging

固定整合分支。

用途：

- 接收 A / B / C 的 Feature PR
- Frontend / Backend 真實整合
- Provider Data 匯入驗證
- Integration Test
- E2E Test
- Release Candidate 驗收

A / B / C 不直接 Push staging。

## Feature Branch

每個 Task 從最新 staging 建立：

```text
staging
├── feat/a-xxx
├── feat/b-xxx
└── feat/c-xxx
```

完成後 PR 回 staging。

---

# 5. Ownership

## Jerry

主要負責：

```text
/docs/**
/contracts/**
/tasks/**
/.github/**
```

以及：PR Review、staging Integration、Release PR、Deploy。

## Engineer A / 工程師 A

```text
/data/providers/**
```

負責 Provider 原始資料、名稱/地址/電話、服務類別、服務範圍、Google Maps URL、資料清理、Mock Provider Data、基本 QA。

資料流程：

```text
原始 Provider 資料
↓
Engineer A 清洗
↓
Feature Branch
↓
PR → staging
↓
Jerry Review
↓
Engineer B 後續匯入正式 Provider DB
```

A 不直接操作正式 Database。

## Engineer B / 工程師 B

```text
/apps/api/**
/services/recommendation/**
/services/knowledge/**
/services/crawler/**
```

負責後端 API、Database、Provider Backend、Recommendation、Ranking、Lead、Knowledge、Crawler。

B 不修改前端 UI。

## Engineer C / 工程師 C

```text
/apps/web/**
```

負責首頁、Consent、Assessment、Result、Provider UI、Google Maps CTA、Kareocar CTA、Lead Form、Loading / Empty / Error、RWD。

C 不修改 Backend Schema 或 Recommendation Logic。

---

# 6. Frontend 與 Backend 分離

C 使用 `/contracts/mock/**` 的 Mock Data 完成 UI，不等待 B。

B 只依 `docs/API_CONTRACT.md` 完成正式 API，不等待 C。

最後由 Jerry 在 staging：

```text
C Mock Frontend
+
B Real API
↓
Integration
↓
E2E Test
```

---

# 7. Recommendation Architecture

```text
Assessment
↓
CareNeedProfile
↓
Service Type
↓
Provider Filter
↓
Service Area Match
├─ 精確位置＋候選全有已驗證座標 → Distance Ranking（DISTANCE）
├─ 精確位置但候選缺座標           → Stable Rotation（DISTRICT_ROTATION，D-13c）
├─ 行政區                         → Stable Rotation（DISTRICT_ROTATION）
├─ 只有縣市                       → Stable Rotation（CITY_ROTATION，D-13a）
└─ 沒有位置                       → 不推薦，提示補充位置（NO_LOCATION，D-13b）
↓
Top 3（0–3 家）
```

完整規則與回應欄位：API_CONTRACT §9。沒有位置仍可完成 Assessment 與服務建議（PRODUCT_SPEC §24）。

AI 不直接選 Provider。

## 7.1 Resource Lookup Path / 資源查詢路徑（v0.5.3，D-18）

```text
使用者（不需評估、不需 session）
↓
GET /api/v1/providers（API_CONTRACT §10a）
↓
Provider Database（唯讀：status = ACTIVE → serviceType → 所在地或已驗證服務範圍 → 固定排序 → 分頁）
↓
GET /api/v1/providers/{id}（§10，詳細資料／電話／官網／Google Maps）
```

- 與 Recommendation 分開：不讀取或寫入 Session、Assessment、RecommendationRun、Lead；不輪替、不計算距離、不產生推薦原因。
- 共用 Provider 資料表與 §10 詳細端點，不另建資源資料表或同義端點。
- 要媒合時回到「評估 → 推薦 → Lead」；查詢結果沒有 `recommendationId`，Lead 驗證（API_CONTRACT §12）會拒絕。
- 只讀查詢以 Supabase REST 完成，不新增 RPC（§22 只用於寫入）。
- 特約縣市（ProviderContractRegion）與輔具資源中心（`resourceCategory`）只出現在查詢路徑；推薦路徑不讀取（D-19）。
- 需求摘要（PRODUCT_SPEC §14b）只在前端由評估結果組成，不經任何 API、不寫入資料庫或瀏覽器長期儲存。

---

# 8. Assessment Architecture（原 AI Architecture）

MVP（D-01 方案 B，Jerry 2026-09-23 核准）：Assessment Service 透過同一個 Adapter 介面呼叫**確定性規則引擎**（`docs/ASSESSMENT_RULES.md`），不呼叫任何外部 AI 服務：

```text
使用者資訊
↓
Assessment Service
↓
Rule-based Assessment Engine（rulesVersion）＋ PUBLISHED Knowledge resolver
↓
CareNeedProfile（summary 含可能適用的制度與補助說明，ASSESSMENT_RULES §6）
↓
Recommendation Engine
↓
Provider DB
```

程式中的介面名稱（例如 `CareAssessmentAIAdapter`）沿用 B-003，不因命名重構；staging／production 必須組裝規則引擎與 PUBLISHED Knowledge resolver（B-010）。

已被取代（保留作歷史）：原設計為「Assessment Service → AI Adapter → 外部 AI Provider」。未來若要引入 AI，需重新決策並修訂 PRODUCT_SPEC §16。

---

# 9. Knowledge Architecture

```text
Official Source
↓
Crawler
↓
Raw Snapshot
↓
Content Hash
↓
Compare
↓
KnowledgeChange
↓
NEEDS_REVIEW（摘要由人工撰寫於內容包；MVP 不使用 AI Summary）
↓
Jerry / Admin Review
↓
APPROVED
↓
KnowledgeVersion
↓
PUBLISHED
```

只有 `PUBLISHED` 版本可供正式 Assessment 使用。

排程：`Asia/Taipei` 每日 `00:10`。

白名單來源：衛生福利部、1966 / 長照專區、全國法規資料庫、臺北市政府、新北市政府；以及 Jerry 指定的 Google 雲端硬碟資料夾（`1h3pDfDYOy1Qo4OOiP9duUJ4DUK0NJ6Fh`，PRODUCT_SPEC §40、MVP_DECISIONS D-15）中已登錄於 Source Registry 的檔案。雲端硬碟檔案不由 B-009 公開抓取；檔案更新時由 Jerry 通知並以新內容包提交。

Crawler 抓取失敗時繼續使用 Last Published Knowledge Version。

## 9.1 公開長照資訊讀取（v0.5.4，D-19 Q3）

```text
使用者（不需評估、不需 session）
↓
GET /api/v1/knowledge/records（API_CONTRACT §13a）
↓
目前 PUBLISHED 版本快照（knowledge_version_records）→ 今天有效 → 篩選 → 固定排序 → 分頁
```

- 與 Assessment 讀同一份 PUBLISHED 知識；不讀 NEEDS_REVIEW／APPROVED 未發布內容。
- 只讀，不寫入任何資料；不回傳 `ruleData`、原文或審核資料。
- 沒有 PUBLISHED 版本時回 `KNOWLEDGE_UNAVAILABLE`，不得以內容包檔案或 fixture 代替。

---

# 10. Kareocar Architecture

```text
CareNeedProfile
↓
TRANSPORTATION
↓
Frontend CTA
↓
Open New Tab
↓
Kareocar
```

Kareocar URL：`https://kareocar.netlify.app/`

常駐入口（v0.5.4，D-19 Q4）：首頁與導覽列另有不需評估的外部連結，同樣開新分頁（`noopener noreferrer`）；網址與評估結果入口相同，來源為 `GET /api/v1/external-services/transportation` 或與其一致的前端常數，不得出現第二個網址。

MVP 禁止 iframe、Backend Integration、Database Integration、Authentication Integration。

---

# 11. Consent Architecture

正式 Assessment 前必須存在有效 Consent：

```text
Session
↓
Consent
├─ disclaimerVersion
├─ privacyVersion
└─ termsVersion
```

沒有 Consent 時 Backend 回 `CONSENT_REQUIRED`。

---

# 12. Provider DB 與 Knowledge DB 分離

Provider DB 回答「可以找誰？」。

Knowledge DB 回答「目前制度怎麼規定？」。

兩者資料模型與責任分開。

---

# 13. Environment

正式分為四層：

```text
LOCAL
PREVIEW
STAGING
PRODUCTION
```

## LOCAL

各工程師自己的開發環境。

## PREVIEW

單一 Feature PR 的預覽與模組測試環境。

## STAGING

Jerry 的整合環境，對應 `staging` branch。

用於 A+B+C 整合、Real API 串接、Integration / E2E Test。

## PRODUCTION

正式環境，對應 `main` branch。

只有 Jerry 負責 Production Release / Deploy。

---

# 14. Secret Rule

禁止 Commit API Key、Database Secret、Token、Private Key。

只能放 Environment Variables，Frontend 不得包含 AI API Key。

STAGING 與 PRODUCTION 必須使用不同環境設定與 Secrets。

---

# 15. Cross-module Rule

需要修改其他模組時：

```text
建立 Issue
↓
Jerry 判斷
↓
建立新 Task
↓
對應 Owner 修改
```

不得直接跨 Ownership 修改。

---

# 16. Testing Boundary

Engineer A：Provider Data / 基本 QA  
Engineer B：API / Recommendation / Knowledge / Crawler  
Engineer C：UI / Flow / RWD / Loading / Empty / Error  
Jerry：staging Integration / End-to-End / Release / Production

---

# 17. Definition of Integration

只有當：

```text
A Provider Data
+
B Backend
+
C Frontend
+
Knowledge
+
API Contract
+
staging Integration Test
```

全部通過後，才叫 `Integrated`。

Feature PR 合併到 staging 只能稱為 `Module Complete`。

`Production Complete` 必須再完成 staging → main Release 與 Production 驗證。

---

# 18. Source of Truth

```text
PRODUCT_SPEC.md
↓
ARCHITECTURE.md
↓
DATA_MODEL.md
↓
API_CONTRACT.md
↓
GIT_RULES.md
↓
TASK
↓
Code
```

若衝突，停止修改並交由 Jerry 決定。


---

# 19. Approved MVP Technology Stack / 已核准技術棧

MVP 技術棧已由 Jerry 核准如下：

## Frontend

```text
React
Vite
TypeScript
React Router
```

Frontend application 維持於：

```text
/apps/web/**
```

Engineer C 可在 `/apps/web/**` 內建立該 App 自己的 package / TypeScript / Vite configuration。

Repository Root Config 仍由 Jerry 管理。

## Backend

```text
Node.js
TypeScript
Netlify Functions / Serverless API
```

Backend application 維持於：

```text
/apps/api/**
```

## Database / Auth

```text
Supabase
├── PostgreSQL
└── Auth
```

Supabase 主要作為 Database / Auth / Server-side persistence layer。

核心 Business Logic 不直接交給 Supabase Auto API。

例外：需要跨資料表原子寫入時，可使用「只負責寫入」的 Postgres function（見 §22）。

正式資料流：

```text
React Frontend
↓
Kareo /api/v1 Backend
↓
Service / Business Logic
↓
Repository / Adapter
↓
Supabase PostgreSQL
```

## Deployment

```text
Netlify
├── Frontend
└── Netlify Functions
```

Branch / Environment：

```text
Feature Branch → PREVIEW
staging        → STAGING
main           → PRODUCTION
```

STAGING 與 PRODUCTION 必須使用不同 Environment Variables / Secrets。

## AI Provider

**MVP 不使用 AI Provider**（MVP_DECISIONS D-01 方案 B，Jerry 2026-09-23 決定）。Assessment 使用確定性規則引擎（`docs/ASSESSMENT_RULES.md`）。以下 Adapter 規則保留給未來引入 AI 時使用。

所有 AI 能力必須透過 Adapter Boundary，禁止直接把 OpenAI / Claude / Gemini SDK 散落在 Business Logic 中。

（已被取代）原本要求「AI Provider 選型前以 Fake Adapter 測試」；MVP 不選 AI Provider，自動測試可繼續使用 Fake / Deterministic Adapter。

Fake Adapter 只允許用於自動測試與本機開發；STAGING／PRODUCTION 的 Function 必須組裝規則引擎，不得組裝 Fake Adapter。


---

# 20. Session Ownership, Security & Abuse Controls（v0.2，J-002-r1）

決策 D-04（SPEC-APPROVED 2026-09-24）。本節是 B-011 與各 API 的實作依據；對應 contract 見 API_CONTRACT §3.1–3.4。

## 20.1 匿名 session 持有證明

```text
POST /api/v1/session
↓
Server 產生：
  sessionId     可公開的識別碼
  sessionToken  至少 256 bits 的密碼學隨機值（crypto.randomBytes / getRandomValues）
↓
DB 只存 SHA-256(sessionToken)
↓
Response 回傳一次 sessionToken
↓
之後所有 session 相關請求帶 Header：
  X-Kareo-Session-Token: <sessionToken>
```

- `sessionId` 不是憑證；只有 `sessionId` 而沒有正確 token 的請求一律拒絕。
- 不得用 `Math.random()` 產生任何憑證或可被猜測後造成越權的 ID。
- 前端把 token 存在 `sessionStorage`（分頁關閉即消失），不放 URL、不放 cookie、不寫入 log。
- MVP 不使用 cookie，因此不涉及 CSRF；若日後改用 cookie，必須 `HttpOnly; Secure; SameSite=Strict` 並加 CSRF 防護。

## 20.2 有效期

- 閒置 7 天或建立後 30 天，取較早者，過期回 `SESSION_INVALID`。
- 每次成功請求更新 `lastSeenAt`（可節流為每 5 分鐘最多寫一次）。
- 使用者刪除（`DELETE /api/v1/session`）或撤回同意後，token 立即失效。

## 20.3 資源歸屬檢查

每個需要 session 的 API 依序檢查：

```text
1. token 存在、雜湊相符、未過期、status = ACTIVE        → 否則 SESSION_INVALID (401)
2. body 內 sessionId（若有）等於 token 所屬 session       → 否則 FORBIDDEN (403)
3. 需要同意的操作：存在有效 Consent（DATA_MODEL §6）      → 否則 CONSENT_REQUIRED (403)
4. 引用的 assessmentId / recommendationId / leadId 屬於同一 session
                                                          → 否則 NOT_FOUND (404)，不透露資源存在
5. Lead 的 providerId 出現在該 recommendationId 的推薦結果 → 否則 VALIDATION_ERROR (400)
```

Service role 繞過 RLS，因此上述檢查必須在 Service 層完成，不能只依賴資料庫存在性。

## 20.4 濫用限制

限流必須持久化於資料庫（DATA_MODEL §39），以原子更新計數；不得只用單一 function instance 的記憶體。

| 規則 | 上限 | 鍵 |
|---|---|---|
| 建立 session | 20 次／小時 | IP 雜湊 |
| Consent | 10 次／小時 | session |
| Assessment | 3 次／小時 | session |
| Recommendation | 30 次／小時 | session |
| Provider detail | 60 次／小時 | IP 雜湊 |
| Provider lookup（`GET /api/v1/providers`，v0.5.3） | 120 次／小時 | IP 雜湊 |
| Knowledge records（`GET /api/v1/knowledge/records`，v0.5.4） | 120 次／小時 | IP 雜湊 |
| 管理登入（含失敗嘗試） | 20 次／小時 | IP 雜湊 |
| 管理端所有讀寫（驗證前） | 300 次／小時 | IP 雜湊 |
| 已驗證管理讀取（所有讀取端點合計） | 300 次／小時 | 操作者 ID 雜湊 |
| 已驗證管理寫入（所有寫入端點合計） | 60 次／小時 | 操作者 ID 雜湊 |
| Lead | 5 次／日 | session |
| Lead（同一電話） | 3 次／日 | 電話雜湊 |

超過回 `RATE_LIMITED (429)`，附 `Retry-After` header。上限數值屬 D-04 建議值，Jerry 核准後生效。

2026-10-04 J-003 中央整合：Jerry 已授權接手 ABCJ 與一般技術選擇，管理端採上述初始操作額度。登入所有有效 JSON 嘗試（包含無效憑證）均計數；更換 token 或網路不能重設操作者額度。超額先返回 429，不執行業務寫入／稽核；只寫入持久限流計數。16 KB 限制適用管理端 POST，先檢查 UTF-8 位元組再解析 JSON。數值為 Kareo 初始設定，不是外部安全標準指定值。

Payload 限制：

| 項目 | 上限 |
|---|---|
| Request body | 16 KB，超過回 `PAYLOAD_TOO_LARGE (413)` |
| `freeText` | 500 字 |
| `contact.name` | 1–30 字 |
| `contact.phone` | 臺灣手機 `09\d{8}` 或市話 `0\d{1,2}-?\d{6,8}` |
| `Idempotency-Key` | UUID 格式 |

## 20.5 冪等與重複送出

- `POST /api/v1/leads` 必須帶 `Idempotency-Key`。`(sessionId, key)` 相同且內容相同 → 回傳原結果；內容不同 → `IDEMPOTENCY_CONFLICT (409)`。
- 同一 session＋provider＋serviceType 已有未終態 Lead → 回傳既有 Lead 並標示 `duplicate: true`。
- 以資料庫唯一約束保證，不以應用層先查後寫代替（避免併發重複）。

## 20.6 錯誤與 log

- 公開錯誤只回 contract 定義的 code 與中文訊息；不得包含 stack、SQL、內部 ID 以外的系統資訊或 secret。
- log 只記錄：request id、路由、錯誤 code、耗時、session id 前 8 碼。**不得記錄** token、姓名、電話、freeText、評估回答、規則引擎命中的關鍵字片段。

## 20.7 刪除

見 PRIVACY_AND_RETENTION §6。清理作業為受保護內部指令，支援 dry-run，寫入 DeletionRun（DATA_MODEL §40）。

D-05a：Assessment／CareNeedProfile／RecommendationRun／Item 與 Lead 各自按期限清理（DATA_MODEL §22、§40）；Lead 的來源編號不以外鍵阻擋健康資料刪除。自助刪除／撤回立即使 token 失效、清空所有關聯 Lead 聯絡欄位，只取消未終態案件；健康資料必須在請求後 **7 天內**完成實體清理，不能等滿 7 天才成為清理候選。每日作業與失敗重試不得使 `deletionScheduledBefore` 成為不實承諾；J-003／J-004 驗證實際筆數與期限。

## 20.8 內部操作

Lead 查件、清理作業使用受保護 CLI（InternalOperator 驗證，DATA_MODEL §36），不新增管理 endpoint。

知識審核與發布（D-16、D-16a，2026-09-29 更正）：除既有 B-008 CLI 外，**允許**受保護的管理 API `/api/v1/admin/**`（API_CONTRACT §26，B-012）供管理頁面（C-006）使用：

- 必須以 InternalOperator 個人密鑰換得的 15 分鐘管理 token 呼叫，且操作者需有 `KNOWLEDGE_PUBLISHER` 角色；**不提供匿名或一般使用者可呼叫的管理 API**。
- 權限、稽核（DATA_MODEL §41）、發布前重新驗證與發布／撤回一致性由後端保證；發布／撤回沿用 B-008 service 與原子寫入函式（§22），不另寫一套。
- 不自動核准或發布：每個寫入都由操作者按下並二次確認。
- 管理頁面不編輯政策內容或 `ruleData`；內容仍只經由內容包進入（§21）。
- 回應 `Cache-Control: no-store`；前端不直接連資料庫。

---

# 21. Knowledge MVP Ingest Path（v0.2，J-002-r1）

D-16c（2026-10-03）：已提交內容包的不可變規則適用所有包，包含尚未登錄的舊資料。匯入／回填只在內容符合時登錄，差異交回人工以新批次修正。`--commit`／回填重用既有 InternalOperator 的個人密鑰與 `KNOWLEDGE_PUBLISHER` 角色驗證，`importedBy` 記錄實際操作者 ID（DATA_MODEL §26b）；這不新增登入系統或公開管理端點。

每日自動更新（Crawler，B-009，每天 00:10 Asia/Taipei）屬原始 MVP（PRODUCT_SPEC §42），目前依原始範圍開發。「crawler 延後」提案（MVP_DECISIONS D-11）未核准、已擱置，不影響任何任務。

不論有無 crawler，正式知識都只經由人工審核的內容包進入。B-009 上線後，crawler 發現的變更同樣先成為 NEEDS_REVIEW，再經下列審核與發布：

```text
官方來源（docs/knowledge/source-registry.md）
↓
contracts/knowledge/packs/KP-*.json（NEEDS_REVIEW）
↓
Jerry 逐筆審核（PR 中的審核紀錄＝審核證據；PR 合併本身不是審核）
↓
B-008 import → approve → publish（CLI 由 J-003 在整合環境執行並留證；或 Jerry 在管理頁以 §26 管理 API 核准與發布，D-16）
↓
PUBLISHED KnowledgeVersion
↓
Assessment（B-010）
```

完整規則見 `contracts/knowledge/README.md`。內容包核准 ≠ 已發布。

---

# 22. Atomic Write Functions / 原子寫入函式（v0.5，J-002-r2）

決策：MVP_DECISIONS D-10（Jerry 2026-09-23 核准，來源 PR #16 B-004 P1）。

Supabase REST 無法把多次寫入包在同一個交易內。需要「全有或全無」的多表寫入時，採用：

```text
Node Service：完成全部驗證與業務判斷
↓
一次呼叫 supabase.rpc('<function>', { payload })
↓
Postgres function：在單一交易內只做寫入（upsert）
↓
任一步失敗 → 整個交易回滾，沒有任何資料對外可見
```

規則：

1. Function **只負責寫入**：不做驗證、不含業務規則、不做推薦或判斷；所有驗證留在 Node Service 層。
2. 每個 function 以獨立 migration 建立，名稱以用途命名（例如 `import_provider_dataset`）。
3. 權限：`revoke execute ... from public, anon, authenticated`；只 `grant execute ... to service_role`。不得開放給前端。
4. 輸入為單一 `jsonb` payload；回傳寫入筆數。錯誤一律讓交易失敗並向上拋出，由 Service 層轉為安全的錯誤回應，不把 SQL 錯誤細節回給前端。
5. 測試：
   - 單元測試：證明 Service 只呼叫一次 rpc，且驗證失敗時完全不呼叫。
   - 整合測試（J-003 於 staging Supabase 執行）：故意讓第二、第三張表寫入失敗，確認三張表都沒有新資料。
6. 目前核准用途：Provider 匯入（B-004）；知識發布／撤回（B-008，2026-09-24 延伸核准，MVP_DECISIONS D-10）；Lead 狀態與事件、案件接手（B-006，`update_lead_status_with_event`、`claim_lead_for_reveal`，2026-10-01 隨 #47 合併）；知識管理寫入與內容包登錄（B-012，D-16b）。其他用途需再經 Jerry 核准並登記於 MVP_DECISIONS。
7. 已核准的例外：`publish_knowledge_version` 在函式內檢查紀錄必須為 APPROVED（額外安全檢查，不視為違反第 1 點）。
8. 已核准的例外（v0.5.3，D-16b，2026-10-01）：知識管理 RPC（`admin_*`）可在函式內做「與寫入同一交易才能保證」的一致性檢查——內容指紋比對（compare-and-set）、目前發布版本與恢復條件、發布計畫與 `previewToken` 重算比對——並寫入稽核。業務驗證（欄位格式、權限、原因必填）仍留在 Node Service。
9. 知識發布／撤回序列化（v0.5.3，D-16b）：CLI 發布、CLI 撤回、管理頁發布、管理頁撤回四個入口，交易一開始都取得**同一個** `pg_advisory_xact_lock(<固定常數>)`，取得後才檢查、寫入與稽核。只用 `select … for update` 不足（沒有 PUBLISHED 版本時沒有資料列可鎖，且各入口不一定經過同一列）。併發正確性須以真實多連線 Postgres 驗證（J-003）；PGlite 為單一 session，不能作為併發證據。
