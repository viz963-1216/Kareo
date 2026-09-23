# Kareo Integration Acceptance / 整合驗收紀錄

Owner: Jerry（TASK-J-003）
Submission Version: J-003-r2

> 只有「部署環境中，以真實 API 與真實資料實際操作成功」才算通過。
> Mock、單元測試、PR 合併都**不算**整合完成。平台額度或模組缺漏造成的阻擋一律記為 `PENDING`，必要項目 PENDING 時完整驗收判定為**失敗**。
> 需求對應見 `docs/MVP_TRACEABILITY.md`（J-002-r3）；決策狀態見 `docs/MVP_DECISIONS.md`。

---

## 兩種檢查（不可混用）

| 檢查 | 指令 | PENDING | 結束碼 | 代表什麼 |
|---|---|---|---|---|
| 開發檢查（每個 PR，CI `acceptance-dev`） | `node scripts/acceptance-gate.mjs --mode=dev` | 允許 | 只有 FAIL → 1 | 「目前沒有壞掉的東西」。exit 0 **不是** MVP 通過，輸出最後一行會明寫 |
| 完整驗收／release gate（手動 workflow `Release gate`、PR → main） | `node scripts/acceptance-gate.mjs --mode=release` | **不允許** | 任何 FAIL 或 PENDING → 1 | 原始 MVP 所有必要項目都有真實證據 |

Gate 內容：路由／contract／禁止欄位（`check-integration.mjs`）、知識包格式、**知識內容是否已核准**（格式正確 ≠ 核准）、Provider 資料 gate（A-004），以及 `tests/e2e/acceptance-cases.json` 的 27 個 E2E 案例。

E2E 案例只有在 `tests/e2e/results/*.json` 有**正式結果**時才算 PASS：`apiMode = real`、`baseUrl` 為 https 且不是 localhost、有 `commit` 與 `date`。Mock 或本機結果一律忽略（`tests/scripts/acceptance-gate.test.mjs` 有測）。

真實 API 的自動案例：`node tests/e2e/run-api-e2e.mjs https://<staging> --commit <sha> --out tests/e2e/results/<run>.json`。環境做不到的案例回報 PENDING 並寫原因，不會回報 PASS；需要瀏覽器（ui）或操作人員（ops）的案例由人工紀錄結果。

C 的 Mock 模組驗收（C-003／C-004／C-005）只證明畫面與 contract 相容，不填入本文件的 E2E 結果。

---

## 目前結論（2026-09-23，J-003-r2）

**Integrated：否。** 完整驗收（release 模式）：**FAIL**（9 PASS、0 FAIL、34 PENDING）。

真實使用者流程目前能走到哪一步：

```text
首頁 ✅（程式可建置；部署環境暫停，未能實測）
↓
同意 ⛔ 沒有 ACTIVE 同意版本（D-05，法務 BLOCKED）；後端尚未驗證版本是否 ACTIVE
↓
初步評估 ⛔ 後端一律 KNOWLEDGE_UNAVAILABLE（B-008 PR #26 審核中、B-010 未見提交、0 筆知識核准）
↓
制度／補助說明 ⛔ 缺補助說明模板（D-12）
↓
推薦 ⛔ API 不存在（B-005 未見提交）；精確位置另缺已驗證座標（D-07）
↓
服務單位詳情 ⛔ B-004 PR #16（r2）、C-004 PR #27 審核中
↓
送出媒合 ⛔ B-006、C-005 未見提交
↓
內部查件與狀態更新 ⛔ 未開始；接件人 BLOCKED（D-06）
（另）每日知識更新 ⛔ B-009 未見提交（D-11 未核准）
（另）Kareocar 外連 ⚠ API 與路由可用；Kareocar 站因 Netlify 額度暫停（D-09）
```

**Netlify 團隊額度用完，`kareo-tw` 與 `kareocar` 兩個站都暫停中**（MVP_DECISIONS D-09），部署後驗收目前無法執行。

---

## Contract 差異：目前後端 vs 目標 contract

目標為 API_CONTRACT v0.2（**D-04／D-05／D-06 仍是 PROPOSED**）。前端 adapter 已依目標實作，但**後端未提供的能力一律視為依賴未完成**，不因 adapter 寫好而算整合完成。

| 項目 | 目前 staging 後端（`646ae7e`） | 目標 contract | 前端 adapter（J-003-r2） | 狀態／負責 |
|---|---|---|---|---|
| Session token | `POST /session` 只回 `sessionId`、`createdAt`；不發 token、不回 `expiresAt` | 回 `sessionToken`（≥256 bits）與 `expiresAt`；受保護 API 需 `X-Kareo-Session-Token` | 新 session 先清除舊 token；有 token 就帶出；`VITE_KAREO_REQUIRE_SESSION_TOKEN=true` 時缺 token 直接失敗，否則標示「未受保護」並警告 | **依賴未完成**：B-011a；D-04 |
| Session 歸屬 | 未檢查 body `sessionId` 與持有者 | 不一致 → `FORBIDDEN`；跨 session 資源 → `NOT_FOUND` | 不處理（後端責任） | **依賴未完成**：B-011a |
| `DELETE /session`、`POST /consent/withdraw` | 不存在 | 存在 | 未接（等後端與 C-005 畫面） | **依賴未完成**：B-011a／B-011b、C-005；D-05 |
| Consent 版本 | 接受任何非空字串 | 只接受 `consent-versions.json` 中 ACTIVE 組合，否則 `VALIDATION_ERROR` | 只送部署設定的版本；未設定就拒絕記錄同意；`main` 分支缺版本時建置失敗 | **依賴未完成**：B-011a；**BLOCKED**：D-05 無 ACTIVE 版本 |
| Lead 冪等 | 無 Lead API | `Idempotency-Key`（UUID）必填；同 key 同內容回原結果、不同內容 `IDEMPOTENCY_CONFLICT` | 未接（等 B-006 與 C-005） | **依賴未完成**：B-006、C-005；D-04 |
| 錯誤碼 | `AppError` 只有 v0.1 七個碼 | 另有 `SESSION_INVALID`、`FORBIDDEN`、`RATE_LIMITED`、`PAYLOAD_TOO_LARGE`、`IDEMPOTENCY_CONFLICT`、`INVALID_STATUS_TRANSITION` | 已能顯示這些碼；`SESSION_INVALID` 會清除 token | **依賴未完成**：B-011a |
| HTTP status | v0.1 碼已依 §3.2 對照 | §3.2 全表；429 附 `Retry-After` | 以 HTTP status＋envelope 一起判斷（見下） | 部分 |
| 錯誤格式 | `{success:false,error:{code,message}}`；未知 API 回 JSON 404 | 同左 | 非 2xx、`null`、空 body、非 JSON（平台 502 HTML）、缺 `data` 的 success 一律成為明確錯誤 | 完成（adapter） |
| 推薦／詳情 | 無推薦 API；詳情在 B-004 PR #16 | §9、§10 | 推薦已接；詳情由 C-004 PR #27 加入 | **依賴未完成**：B-005、B-004 |
| Knowledge status | 無 | §13 | 未使用 | **依賴未完成**：B-008 |

---

## 執行紀錄

### Run 2026-09-23-02 — 本機，J-003-r2 分支

| 項目 | 內容 |
|---|---|
| Base commit | staging `646ae7e` |
| 環境 | 本機 macOS，Node v24.19.0（CI 使用 Node 22） |
| 資料／知識版本 | 無 Provider 匯入、無 PUBLISHED Knowledge（0／9 筆核准） |
| 真實外部服務 | 未使用（Netlify 暫停、無 Supabase 憑證） |

| # | 檢查 | 指令 | 結果 |
|---|---|---|---|
| 1 | Backend typecheck | `npm run typecheck --prefix apps/api` | PASS |
| 2 | Backend tests | `npm test --prefix apps/api` | PASS（5 檔、34 項） |
| 3 | Frontend build（real） | `npm run build --prefix apps/web` | PASS；bundle 不含 `SES/CON/ASM/KB/PROV/REC-MOCK` |
| 3a | Frontend build（mock，deploy preview） | `VITE_KAREO_API_MODE=mock VITE_KAREO_DEPLOY_CONTEXT=deploy-preview npm run build --prefix apps/web` | PASS；mock 以獨立 chunk 延遲載入 |
| 4 | Netlify site bundle | `node scripts/build-site.mjs` | PASS |
| 4a | 負向：正式 context 開 mock | `CONTEXT=production VITE_KAREO_API_MODE=mock node scripts/build-site.mjs` | 建置失敗（exit 1），如預期 |
| 4b | 負向：`main` 缺 token 要求與同意版本 | `CONTEXT=production BRANCH=main node scripts/build-site.mjs` | 建置失敗（exit 1），如預期 |
| 5 | Adapter／mode／deploy-ignore／gate 測試 | `node --experimental-strip-types --test "tests/**/*.test.*"` | PASS（33 項，含失敗情境） |
| 5a | 突變測試：timer 在讀 body 前清除；忽略 HTTP status | 暫時改壞 `realAdapter.ts` 後跑同上 | 2 項測試 FAIL，如預期（已還原） |
| 6 | 路由／contract／禁止欄位 | `node scripts/check-integration.mjs` | 8 PASS、5 PENDING、0 FAIL |
| 7 | 開發檢查 | `node scripts/acceptance-gate.mjs --mode=dev` | exit 0：9 PASS、0 FAIL、34 PENDING（**不是 MVP 通過**） |
| 8 | 完整驗收 | `node scripts/acceptance-gate.mjs --mode=release` | **exit 1：FAIL**（34 項 PENDING） |
| 9 | API E2E runner（本機 stub，模擬目前 staging 行為） | `node tests/e2e/run-api-e2e.mjs http://localhost:8787` | 2 PASS、0 FAIL、14 PENDING；本機結果不被 gate 採計 |
| 10 | Netlify ignore：純文件 commit | `tests/scripts/netlify-ignore.test.mjs` 情境 1（暫存 git repo） | exit 0（跳過） |
| 10a | Netlify ignore：被前端 import 的 contract | 同上情境 2 | exit 1（建置） |

J-003-r1 的已知問題在本版修正：

- `netlify-ignore.mjs` 把 `contracts/**` 全部視為可略過，但 `apps/web` 直接 import `contracts/mock/*.json`。
- adapter 只看 JSON `success`：HTTP 500＋`success:true` 會被當成功；`null` body 會丟出非 ApiError；timeout 只涵蓋等待 headers。
- 新 session 建立失敗時會留下上一個 session 的 token。
- 部署設定誤開 mock 時，正式環境沒有防護。

### Run 2026-09-23-01 — 本機，J-003-r1 分支

| 項目 | 內容 |
|---|---|
| Base commit | staging `9d5f72c` |
| 環境 | 本機 macOS，Node v24.19.0（CI 使用 Node 22，同 netlify.toml） |
| 資料／知識版本 | 無 Provider 匯入、無 PUBLISHED Knowledge |
| 真實外部服務 | 未使用（Supabase 憑證不在本機；Netlify 暫停） |

| # | 檢查 | 指令 | 結果 |
|---|---|---|---|
| 1 | Backend typecheck | `npm run typecheck --prefix apps/api` | PASS |
| 2 | Backend tests | `npm test --prefix apps/api` | PASS（5 檔、34 項） |
| 3 | Frontend build（real 模式） | `npm run build --prefix apps/web` | PASS；bundle 內無 `MOCK` 字樣（mock 已被移除） |
| 4 | Netlify site bundle | `node scripts/build-site.mjs` | PASS |
| 5 | 路由／mock／禁止欄位／端點覆蓋 | `node scripts/check-integration.mjs` | 7 PASS、4 PENDING、0 FAIL |
| 5a | 同上，用 staging 原本的 netlify.toml | 同上 | **FAIL**：`externalServiceTransportation` 無路由（B-007 已合併但打不到）→ 本 PR 修正 |
| 5b | 負向：mock 加入 `officialCMSLevel` | 同上 | FAIL（如預期） |
| 6 | 知識內容包 | `node scripts/validate-knowledge-pack.mjs .` | PENDING（J-002 PR #19 未合併）；在 J-002 分支上 PASS，負向測試 FAIL 如預期 |
| 7 | Provider 資料 gate | `node scripts/check-provider-data.mjs` | PENDING（A-004 未合併；且目前版本會假通過，見 PR #18 review） |
| 7a | Real 模式 UI（本機 `vite preview`，無後端） | Chrome：同意頁勾選 →「同意並開始評估」 | 顯示「系統回應異常，請稍後再試或直接聯絡 1966。」並停留在同意頁；**沒有**以 mock 放行到評估頁 |
| 8 | Netlify ignore | `CACHED_COMMIT_REF=… COMMIT_REF=… node scripts/netlify-ignore.mjs` | 純文件範圍 → 跳過（exit 0）；含 `.gitignore`／程式 → 建置（exit 1）；無 ref → 建置 |

端點覆蓋（第 5 項）：

| Endpoint | 狀態 |
|---|---|
| POST /api/v1/session | 有路由與 function |
| POST /api/v1/consent | 有路由與 function |
| POST /api/v1/assessments | 有路由與 function（回 KNOWLEDGE_UNAVAILABLE） |
| GET /api/v1/external-services/transportation | 本 PR 補上路由 |
| POST /api/v1/recommendations | PENDING — B-005 |
| GET /api/v1/providers/{providerId} | PENDING — B-004（PR #16） |
| POST /api/v1/leads | PENDING — B-006 |
| GET /api/v1/knowledge/status | PENDING — B-008 |

---

觀察：同意頁文案仍標示「MVP Mock 文案」，需 C 依 PRIVACY_AND_RETENTION §8 更新（核准前可用 DRAFT 並明示）。

## 完整 E2E 驗收清單（尚未執行）

正式清單與狀態以 `tests/e2e/acceptance-cases.json`（27 案例）與 `node scripts/acceptance-gate.mjs --mode=release` 為準；下列為人工操作時的檢查重點。

每一項需記錄：commit、環境、Provider 資料版本、Knowledge 版本、日期、步驟、實際結果、截圖（不含真實個資）。

### 主流程

- [ ] 新 session → 同意（ACTIVE 版本）→ 真實 Assessment（PUBLISHED 知識＋規則引擎 `RULES-*`，ASSESSMENT_RULES §9 案例抽測）
- [ ] Recommendation：3 家、2 家、1 家、0 家（空狀態文案，不是錯誤）
- [ ] 位置：精確位置（DISTANCE）、只有行政區（DISTRICT_ROTATION）、沒有位置、Provider 缺座標
- [ ] 結果頁：可能適用制度與補助說明（D-12 決議後）
- [ ] Provider 詳情 → Google Maps 連結來自資料，不由前端組 URL
- [ ] Lead 送出（含聯絡同意）→ 資料庫可查 → 接件人工具可看到 → 狀態更新 NEW→CONTACTED→ACCEPTED→CLOSED
- [ ] Kareocar：另開分頁到 `https://kareocar.netlify.app/`，無 iframe

### 錯誤與邊界

- [ ] 拒絕同意／同意撤回後不能評估、不能送 Lead
- [ ] 無 PUBLISHED 知識 → KNOWLEDGE_UNAVAILABLE，畫面不顯示假結果
- [ ] 規則引擎：同一輸入重複送出結果相同；「不需要輪椅」等否定句不觸發關鍵字
- [ ] 網路中斷後重試成功，不產生重複資料
- [ ] Lead 重複送出（同一 Idempotency-Key、連點）→ 只有一筆
- [ ] 跨 session：用 session B 的 token 讀寫 session A 的 assessment／lead → 被拒
- [ ] 偽造／過期 token → SESSION_INVALID
- [ ] 限流：超過上限 → RATE_LIMITED，多次請求不能繞過
- [ ] 未知 API → JSON 404，不回首頁 HTML

### 裝置

- [ ] 手機（約 375px）、平板、桌機可完成主流程
- [ ] 鍵盤可完成主流程（skip link、表單、按鈕）

---

## 首次知識發布（待執行）

條件：Jerry 核准 D-03 格式、逐筆核准 `KP-2026-09-23-001` 內容（逐筆）、B-008 合併。

| 項目 | 紀錄 |
|---|---|
| 內容包與核准 PR | （待填） |
| 匯入指令與輸出 | （待填） |
| 核准／發布操作者 | （待填，真實人員） |
| KnowledgeVersion | （待填） |
| `GET /api/v1/knowledge/status` 回應 | （待填） |
