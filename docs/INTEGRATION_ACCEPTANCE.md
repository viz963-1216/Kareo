# Kareo Integration Acceptance / 整合驗收紀錄

Owner: Jerry（TASK-J-003）
Submission Version: J-003-r3

> 只有「部署環境中，以真實 API 與真實資料實際操作成功」才算通過。
> Mock、單元測試、PR 合併都**不算**整合完成。平台額度或模組缺漏造成的阻擋一律記為 `PENDING`，必要項目 PENDING 時完整驗收判定為**失敗**。
> 需求對應見 `docs/MVP_TRACEABILITY.md`（J-002-r4）；決策狀態見 `docs/MVP_DECISIONS.md`。

---

## 兩種檢查（不可混用）

| 檢查 | 指令 | PENDING | 結束碼 | 代表什麼 |
|---|---|---|---|---|
| 開發檢查（每個 PR，CI `acceptance-dev`） | `node scripts/acceptance-gate.mjs --mode=dev` | 允許 | 只有 FAIL → 1 | 「目前沒有壞掉的東西」。沒給目標時 E2E 一律 PENDING（不評估）。exit 0 **不是** MVP 通過，輸出最後一行會明寫 |
| 完整驗收／release gate（手動 workflow `Release gate`、PR → main） | `node scripts/acceptance-gate.mjs --mode=release --commit=<40 碼 SHA> --base-url=<https URL>` | **不允許** | 任何 FAIL 或 PENDING → 1；缺目標或格式錯 → 2 | **這一個 commit** 部署在**這一個環境**時，原始 MVP 所有必要項目都有真實證據 |

Gate 內容：路由／contract／禁止欄位（`check-integration.mjs`）、知識包格式、**知識內容是否已核准**（格式正確 ≠ 核准）、Provider 資料 gate（A-004），以及 `tests/e2e/acceptance-cases.json` 的 27 個 E2E 案例。

### Release 目標與部署版本證據（J-003-r3）

Release gate 一次只驗收**一個目標**：待發布的完整 commit SHA＋指定部署環境的 base URL。

| 用途 | CLI | 環境變數 | Workflow |
|---|---|---|---|
| 目標 commit（40 碼小寫 SHA，不接受短 SHA） | `--commit=<sha>` | `KAREO_RELEASE_COMMIT` | 手動：input `commit`；PR → main：PR head SHA |
| 目標環境（https、非 localhost） | `--base-url=<url>` | `KAREO_RELEASE_BASE_URL` | 手動：input `base_url`；PR → main：repository variable `KAREO_RELEASE_BASE_URL` |

gate、`tests/e2e/run-api-e2e.mjs`、`tests/e2e/record-manual.mjs` 共用同一組參數（`scripts/lib/release-target.mjs`）。gate 不從 repo HEAD 推定線上版本；workflow 會 checkout 目標 commit 跑靜態檢查。

**部署版本證據**：目前沒有既有的部署 metadata，因此在 J-003 範圍內新增最小的版本標記：

- `scripts/build-site.mjs` 建置時寫出 `dist/kareo-version.json`：`commit`（Netlify 內建的 `COMMIT_REF`，完整 SHA）、`branch`、`context`、`deployId`、`builtAt`。只有公開的建置資訊，**不含 secret**。
- 本機建置沒有 `COMMIT_REF` 時用 `git rev-parse HEAD`；工作目錄有未提交修改時寫 `commit: null`，不宣稱任何版本。
- Functions 與靜態檔在同一次 Netlify 部署中原子發布，所以這個檔案代表整個部署。`netlify.toml` 對它設 `Cache-Control: no-store`。
- Runner 在跑案例**前、後**各讀一次 `<base-url>/kareo-version.json`，把實際觀察到的 commit、URL、時間寫進結果檔的 `deployment`。前次讀到的不是目標（或讀不到、回 HTML／503）就**不跑任何案例**並 exit 1；跑完後版本變了也 exit 1。`--commit` 只是「要驗哪個版本」，不是證據。
- 注意：純文件 commit 會被 `netlify-ignore.mjs` 略過部署，線上版本仍是較早的 commit。這時要驗收的目標就是線上實際部署的 commit，或手動觸發一次部署。

**採計規則**（細節與格式見 `tests/e2e/results/README.md`）：

- 只採計 `commit` 等於目標、`baseUrl` 正規化後等於目標環境，而且 `deployment.before`／`after` 都在該環境的版本標記上觀察到目標 commit 的紀錄。
- URL 以 WHATWG URL parser 正規化：host 大小寫、預設 port、結尾 `/` 視為相同；**路徑不同就是不同環境**（`/app` ≠ `/app2` ≠ `/`）。
- 其他 commit、其他環境、mock、本機的紀錄保留，但輸出 `IGNORED` 並附原因，不算 PASS。
- 聲稱是目標、但部署證據缺漏或不符 → **FAIL**。
- 損壞 JSON、缺欄位、時間不是含時區的完整 ISO timestamp、狀態不是 PASS／FAIL／PENDING → **FAIL**（dev 模式也一樣）。
- 同一目標可以合併多次執行。每個 case 取時間最新的一筆（`recordedAt`，否則為該檔 `finishedAt`），不論狀態：後來的 FAIL／PENDING 會蓋過先前的 PASS。最新兩筆同時間但狀態不同 → FAIL（無法判斷先後）。
- 沒有符合的紀錄 → PENDING；release 因此失敗。

以上情境都有測試：`tests/scripts/acceptance-gate.test.mjs`、`tests/scripts/run-api-e2e.test.mjs`（本機 stub，含子路徑、版本不符、無版本標記、執行中版本改變）。

### 指定部署版本 → 跑 E2E → release gate

```bash
export KAREO_RELEASE_COMMIT=<待發布 commit 的完整 SHA>
export KAREO_RELEASE_BASE_URL=https://kareo-tw.netlify.app
curl -s "$KAREO_RELEASE_BASE_URL/kareo-version.json"
node tests/e2e/run-api-e2e.mjs --out="tests/e2e/results/api-$(date -u +%Y%m%dT%H%M%SZ).json"
node tests/e2e/record-manual.mjs --operator="<真實人員>" --case=E2E-16 --status=PASS --evidence="新分頁開啟 Kareocar，無 iframe" --out="tests/e2e/results/manual-$(date -u +%Y%m%dT%H%M%SZ).json"
node scripts/acceptance-gate.mjs --mode=release
```

1. 第 3 行確認 `commit` 就是目標 SHA。不是的話，先部署該 commit。
2. 第 4 行跑 API 案例。
3. 第 5 行在每次人工（ui／ops）檢查後記錄，每個 case 各給一組 `--case`／`--status`／`--evidence`。
4. 第 6 行驗收，exit 0 才算通過。

也可以在 GitHub Actions 手動執行 `Release gate`，填入 `commit` 與 `base_url`。workflow 會先在 CI 跑 API runner（結果上傳為 artifact），再跑 gate。人工案例的結果檔需先經 PR 提交。

C 的 Mock 模組驗收（C-003／C-004／C-005）只證明畫面與 contract 相容，不填入本文件的 E2E 結果。

---

## 目前結論（2026-09-23，J-003-r3）

**Integrated：否。** 完整驗收（release 模式）：**FAIL**（10 PASS、0 FAIL、33 PENDING；目標 staging `9af91e5`，部署暫停，無任何可採計的 E2E 紀錄）。

真實使用者流程目前能走到哪一步：

```text
首頁 ✅（程式可建置；部署環境暫停，未能實測）
↓
同意 ⛔ 沒有 ACTIVE 同意版本（D-05，法務 BLOCKED）；後端尚未驗證版本是否 ACTIVE
↓
初步評估 ⛔ 後端一律 KNOWLEDGE_UNAVAILABLE（B-008 PR #26 審核中、B-010 未見提交、0 筆知識核准）
↓
制度／補助說明 ⛔ 模板已由 J-002-r4 補上（ASSESSMENT_RULES §6.3，PROPOSED）；待 B-010 實作、C-005 顯示、知識 PUBLISHED
↓
推薦 ⛔ API 不存在（B-005 未見提交）；精確位置另缺已驗證座標（D-07）
↓
服務單位詳情 ⛔ B-004 已合併 staging（PR #16），`/api/v1/providers/*` 路由由本版補上；C-004 PR #27 審核中；尚無正式 Provider 匯入（A-004 PR #18）
↓
送出媒合 ⛔ B-006、C-005 未見提交
↓
內部查件與狀態更新 ⛔ 未開始；接件人 BLOCKED（D-06）
（另）每日知識更新 ⛔ B-009 未見提交（原始 MVP 必要，無替代方案）
（另）Kareocar 外連 ⚠ API 與路由可用；Kareocar 站因 Netlify 額度暫停（D-09）
```

**Netlify 團隊額度用完，`kareo-tw` 與 `kareocar` 兩個站都暫停中**（MVP_DECISIONS D-09），部署後驗收目前無法執行。

---

## Contract 差異：目前後端 vs 目標 contract

目標為 API_CONTRACT v0.2（**D-04／D-05／D-06 仍是 PROPOSED**）。前端 adapter 已依目標實作，但**後端未提供的能力一律視為依賴未完成**，不因 adapter 寫好而算整合完成。

| 項目 | 目前 staging 後端（`9af91e5`） | 目標 contract | 前端 adapter（J-003-r2） | 狀態／負責 |
|---|---|---|---|---|
| Session token | `POST /session` 只回 `sessionId`、`createdAt`；不發 token、不回 `expiresAt` | 回 `sessionToken`（≥256 bits）與 `expiresAt`；受保護 API 需 `X-Kareo-Session-Token` | 新 session 先清除舊 token；有 token 就帶出；`VITE_KAREO_REQUIRE_SESSION_TOKEN=true` 時缺 token 直接失敗，否則標示「未受保護」並警告 | **依賴未完成**：B-011a；D-04 |
| Session 歸屬 | 未檢查 body `sessionId` 與持有者 | 不一致 → `FORBIDDEN`；跨 session 資源 → `NOT_FOUND` | 不處理（後端責任） | **依賴未完成**：B-011a |
| `DELETE /session`、`POST /consent/withdraw` | 不存在 | 存在 | 未接（等後端與 C-005 畫面） | **依賴未完成**：B-011a／B-011b、C-005；D-05 |
| Consent 版本 | 接受任何非空字串 | 只接受 `consent-versions.json` 中 ACTIVE 組合，否則 `VALIDATION_ERROR` | 只送部署設定的版本；未設定就拒絕記錄同意；`main` 分支缺版本時建置失敗 | **依賴未完成**：B-011a；**BLOCKED**：D-05 無 ACTIVE 版本 |
| Lead 冪等 | 無 Lead API | `Idempotency-Key`（UUID）必填；同 key 同內容回原結果、不同內容 `IDEMPOTENCY_CONFLICT` | 未接（等 B-006 與 C-005） | **依賴未完成**：B-006、C-005；D-04 |
| 錯誤碼 | `AppError` 只有 v0.1 七個碼 | 另有 `SESSION_INVALID`、`FORBIDDEN`、`RATE_LIMITED`、`PAYLOAD_TOO_LARGE`、`IDEMPOTENCY_CONFLICT`、`INVALID_STATUS_TRANSITION` | 已能顯示這些碼；`SESSION_INVALID` 會清除 token | **依賴未完成**：B-011a |
| HTTP status | v0.1 碼已依 §3.2 對照 | §3.2 全表；429 附 `Retry-After` | 以 HTTP status＋envelope 一起判斷（見下） | 部分 |
| 錯誤格式 | `{success:false,error:{code,message}}`；未知 API 回 JSON 404 | 同左 | 非 2xx、`null`、空 body、非 JSON（平台 502 HTML）、缺 `data` 的 success 一律成為明確錯誤 | 完成（adapter） |
| 推薦／詳情 | 無推薦 API；詳情 function 已合併（B-004），staging 原本缺路由，J-003-r3 補上 | §9、§10 | 推薦已接；詳情由 C-004 PR #27 加入 | **依賴未完成**：B-005、C-004、A-004 資料匯入 |
| Knowledge status | 無 | §13 | 未使用 | **依賴未完成**：B-008 |

---

## 執行紀錄

### Run 2026-09-23-03 — 本機，J-003-r3 分支

| 項目 | 內容 |
|---|---|
| Base commit | staging `9af91e5`（已合併進本分支） |
| 環境 | 本機 macOS，Node v24.19.0（CI 使用 Node 22） |
| 資料／知識版本 | 無 Provider 匯入、無 PUBLISHED Knowledge（0／9 筆核准） |
| 真實外部服務 | `https://kareo-tw.netlify.app/kareo-version.json` 回 503（Netlify 暫停） |

| # | 檢查 | 指令 | 結果 |
|---|---|---|---|
| 1 | Backend typecheck／tests | `npm run typecheck --prefix apps/api`、`npm test --prefix apps/api` | PASS（9 檔、66 項） |
| 2 | Script／adapter 測試 | `node --experimental-strip-types --test "tests/**/*.test.*"` | PASS（48 項；gate 15、runner 4） |
| 3 | 路由／contract | `node scripts/check-integration.mjs` | 9 PASS、4 PENDING、0 FAIL（合併 staging 後原為 FAIL：`providerDetail` 無路由） |
| 4 | 版本標記 | `COMMIT_REF=<sha> CONTEXT=production node scripts/build-site.mjs` | `dist/kareo-version.json` 內含該 SHA；本機有未提交修改時為 `commit: null` |
| 5 | 開發檢查 | `node scripts/acceptance-gate.mjs --mode=dev` | exit 0：10 PASS、0 FAIL、33 PENDING（**不是 MVP 通過**） |
| 6 | Release 缺目標 | `node scripts/acceptance-gate.mjs --mode=release` | exit 2（缺 commit 與 base URL） |
| 7 | 完整驗收 | `… --mode=release --commit=9af91e5c24306fc99a0bc8c5afa5d47c255ad0d6 --base-url=https://kareo-tw.netlify.app` | **exit 1：FAIL**（33 PENDING） |
| 8 | Runner 對 staging | `node tests/e2e/run-api-e2e.mjs --base-url=https://kareo-tw.netlify.app --commit=9af91e5…` | exit 1：版本標記 HTTP 503 → 版本未知，未跑任何案例（未提交結果檔） |

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
- [ ] 位置（API_CONTRACT v0.2.2 §9）：精確位置（DISTANCE）、精確位置但缺座標（DISTRICT_ROTATION＋說明）、GPS 拒絕 → 行政區備援、只有行政區（DISTRICT_ROTATION）、只有縣市（CITY_ROTATION）、沒有位置（完成評估、不呼叫推薦）
- [ ] 結果頁：可能適用制度與補助說明（ASSESSMENT_RULES §6.3）；數值與 PUBLISHED 紀錄一致；臺北市、新北市各一例，地方資訊不互相套用
- [ ] Provider 詳情 → Google Maps 連結來自資料，不由前端組 URL
- [ ] Lead 送出（含聯絡同意）→ 資料庫可查 → 接件人工具可看到 → 狀態更新 NEW→CONTACTED→ACCEPTED→CLOSED
- [ ] Kareocar：另開分頁到 `https://kareocar.netlify.app/`，無 iframe

### 錯誤與邊界

- [ ] 拒絕同意／同意撤回後不能評估、不能送 Lead
- [ ] 無 PUBLISHED 知識 → KNOWLEDGE_UNAVAILABLE，畫面不顯示假結果；發布新版本後 Assessment 引用新 `knowledgeVersion`；資料庫／resolver 失敗不回成功格式
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

條件：Jerry 核准 D-03 格式（待補）、逐筆核准 `KP-2026-09-23-001` 內容（✅ 2026-09-24，9／9）、B-008 合併（✅ #26）。目標版本 `KB-2026-09-24-001`。

| 項目 | 紀錄 |
|---|---|
| 內容包與核准 PR | `KP-2026-09-23-001`（9 筆 APPROVED，2026-09-24）；PR #31 留言（待補連結） |
| 匯入指令與輸出 | （待填） |
| 核准／發布操作者 | （待填，真實人員） |
| KnowledgeVersion | （待填） |
| `GET /api/v1/knowledge/status` 回應 | （待填） |
