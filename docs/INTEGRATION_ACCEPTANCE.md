# Kareo Integration Acceptance / 整合驗收紀錄

Owner: Jerry（TASK-J-003）
Submission Version: J-003-r4

> 只有「部署環境中，以真實 API 與真實資料實際操作成功」才算通過。
> Mock、單元測試、PR 合併都**不算**整合完成。平台額度或模組缺漏造成的阻擋一律記為 `PENDING`，必要項目 PENDING 時完整驗收判定為**失敗**。
> 需求對應見 `docs/MVP_TRACEABILITY.md`（J-002-r4）；決策狀態見 `docs/MVP_DECISIONS.md`。

---

## 兩種檢查（不可混用）

| 檢查 | 指令 | PENDING | 結束碼 | 代表什麼 |
|---|---|---|---|---|
| 開發檢查（每個 PR，CI `acceptance-dev`） | `node scripts/acceptance-gate.mjs --mode=dev` | 允許 | 只有 FAIL → 1 | 「目前沒有壞掉的東西」。沒給目標時 E2E 一律 PENDING（不評估）。exit 0 **不是** MVP 通過，輸出最後一行會明寫 |
| 完整驗收／release gate（手動 workflow `Release gate`、PR → main） | `node scripts/acceptance-gate.mjs --mode=release --commit=<40 碼 SHA> --base-url=<https URL>` | **不允許** | 任何 FAIL 或 PENDING → 1；缺目標或格式錯 → 2 | **這一個 commit** 部署在**這一個環境**時，原始 MVP 所有必要項目都有真實證據 |

Gate 內容：路由／contract／禁止欄位（`check-integration.mjs`，含 §26 管理 API）、**打包後的 Functions 能否載入與執行**（`check-functions-runtime.mjs`，J-003-r4）、**驗收案例完整性**（MVP_TRACEABILITY 引用的案例不得缺、每個案例都要被引用，J-003-r4）、知識包格式、**知識內容是否已核准**（格式正確 ≠ 核准）、Provider 資料 gate（A-004），以及 `tests/e2e/acceptance-cases.json` 的 43 個 E2E 案例。

另有兩種**不算 E2E** 的本機檢查，結果只記在本文件：`tests/db/verify-db.mjs`（隔離 PostgreSQL／PGlite：migration、RLS、Provider 匯入回滾、知識發布／撤回）與 `tests/integration/`（交回模組的重現案例、首次發布預演）。

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

## 目前結論（2026-09-25，J-003-r4）

**Integrated：否。** 完整驗收（release 模式）：**FAIL**（目標 staging `fd4154ae16107ac599bd39bba58795c564370d76` @ `https://kareo-tw.netlify.app`；部署暫停，版本標記 HTTP 503，**沒有任何可採計的 E2E 紀錄**；43 個 E2E 案例全部 PENDING）。

- staging 目前只有 B-002／B-003／B-004／B-007／B-008（r1）後端；B-011a、B-010、B-008-r2、B-009、C-005、A-005、J-002-r5 都還是**未合併的 PR**。B-005、B-006、B-011b、B-012、C-006、A-003-r2 **沒有任何提交**。
- 本版的整合試驗（下表「試驗組合」）是在隔離 worktree 把上述 PR 合併後執行的本機檢查，**不代表 staging 已具備**，也不能填入 E2E 結果。
- 首次知識發布**未執行**：B-008-r2 未合併且有新發現的缺陷；`KP-2026-09-24-005` 仍在 PR #35；staging Supabase 的隔離與憑證未確認（見〈首次知識發布〉）。
- 正式 Consent 版本仍為 DRAFT（D-05 法務 BLOCKED）；本版沒有、也不會把它改成 ACTIVE。

真實使用者流程目前能走到哪一步（staging `fd4154a`）：

```text
首頁 ✅ 可建置（部署暫停，未能實測）
↓
新 session ⛔ 不發 token（B-011a #32 未合併）
↓
同意 ⛔ 沒有 ACTIVE 同意版本（D-05）；B-011a 合併前後端不驗證版本
↓
評估 ⛔ 線上仍是 Fake Adapter＋Null resolver → 一律 KNOWLEDGE_UNAVAILABLE（B-010 #33 未合併、無 PUBLISHED 知識）
↓
需求／制度／補助結果 ⛔ B-010、C-005 未合併；C-005 缺 disabilityCertificate／incomeCategory
↓
推薦 ⛔ 無 API（B-005 未提交）
↓
Provider 詳情／Google Maps ⚠ API 與路由已在 staging；尚無正式 Provider 匯入（E2E-27）
↓
Lead 送出 ⛔ 無 API（B-006 未提交）
↓
資料庫關聯與內部查件 ⛔ 未開始
（另）Kareocar 外連 ⛔ kareocar.netlify.app 同樣 HTTP 503（D-09）
（另）每日知識更新 ⛔ B-009 #37 未合併；排程入口本版已備妥（knowledge-crawler.yml）
（另）知識管理頁 ⛔ B-012／C-006 未提交
```

## 整合狀態表（2026-09-25）

資料來源：`git fetch`＋GitHub PR API（2026-09-25 02:20 +08:00）。「已驗證」只列本版實際執行過的檢查；「試驗」＝隔離 worktree 中 staging＋#32＋#33＋#36＋#37＋#35＋#30＋#34 的組合。

| 模組 | 最新 PR／commit | 合併 | 已驗證（本版） | 缺口 | 負責 |
|---|---|---|---|---|---|
| B-008 r1 | #26 `0a368dd` | ✅ staging | DB（staging migrations）：K1–K3、K5、K6、K8 PASS | K4（新版本讓未取代紀錄失效）、K9（失效紀錄帶入）＝D-03 差異，由 r2 修正；**K7 撤回的版本可在同一步立即重新發布**；核准不綁定內容（見交回 H-3） | B（clausstar-afk） |
| B-008-r2 | #36 `1c73987` | ❌ | 試驗：可乾淨合併；DB K1–K4、K8、K9 PASS；首次發布預演 5 包 21／21 筆 | **K5 舊版本無法追溯、K6 撤回後回復上一版只剩部分紀錄**（carry-forward 直接改寫 `knowledge_records.version`）；K7；核准不綁定內容 | B |
| B-011a | #32 `92d787f` | ❌ | 試驗：typecheck PASS；打包後 **consent function 無法載入**（`createRequire` 讀 JSON，esbuild 不內嵌）→ 本版以 `included_files` 修正並驗證 | 合併前 staging 不發 token、不驗 ACTIVE 版本；`DELETE /session`、`/consent/withdraw` 屬 B-011b | B |
| B-010 | #33 `2612c05` | ❌ | 試驗：與 B-011a **文字合併後** service 會先驗 token（`requireValidSession`→`requireMatchingSessionId`→Consent），function 帶 `X-Kareo-Session-Token`；首次發布預演：臺北／新北地方行各自獨立、KR-2026-018 兩市皆適用 | **`apps/api/tests/assessment.test.ts` 與 B-011a 衝突**；取 B-010 版本後 26／234 測試失敗（都是未帶 token）；B-010 本身未使用 B-011a 共用元件；規則為 r5，PR #35 已核准 r6／r7 | B |
| B-005 推薦 | — | ❌ 未提交 | — | 全部（`POST /api/v1/recommendations` 無 function／路由） | B |
| B-006 Lead | — | ❌ 未提交 | — | 全部（`POST /api/v1/leads`、冪等、內部查件） | B |
| B-009 Crawler | #37 `80bd5fc` | ❌ | 試驗：與 B-010 在 3 個檔案有**加總型衝突**（types.ts、兩個 knowledge repository，合併後 typecheck PASS）；排程入口本版備妥 | **PDF 雜湊與 Source Registry 基準不一致 → 未變更也每天產生變更**；**同一變更每天重複建立 NEEDS_REVIEW**；未保存 raw snapshot（TASK-B-009 交付項）；原建議的 Netlify Scheduled Function 有約 30 秒限制，不適合 | B |
| B-011b | — | ❌ 未提交 | — | 撤回、刪除、限流、完整安全驗收 | B |
| B-012 Admin API | — | ❌ 未提交 | — | API_CONTRACT §26 共 8 個端點無 function | B |
| C-005 | #34 `6e5cca6` | ❌（mergeable: dirty） | 試驗：`apps/web` 合併後 real 模式 build PASS、bundle 無 mock、前端測試 48／48；呼叫的端點與方法符合 contract | 分支仍含 squash 前的 J-002 commit `a14903a` → 21 個 docs／tasks／contracts 衝突，需同步 staging；**缺 `disabilityCertificate`、`incomeCategory`**；本機另有重複的 C-005-r1（`e3a065a`，vicky19946）待 Jerry 決定 | C |
| C-006 管理頁 | — | ❌ 未提交 | — | 全部 | C |
| A-003-r2 座標 | — | ❌ 未提交 | — | 0／30 已驗證座標（DATA-GAP） | A |
| A-004 | #18 `53b090c` | ✅ staging | `check-provider-data.mjs` PASS；DB P1／P2（匯入交易回滾）PASS | 正式匯入 staging Supabase 未執行（E2E-27） | A |
| A-005 | #30 `a67156e` | ❌（落後 staging 12 commits，可乾淨合併） | — | AC-009 仍寫「待 D-13 決議」（D-13b 已核准：`NO_LOCATION`、空陣列）；AC-007／AC-011 未依 D-13c（任一缺座標 → 整批 `DISTRICT_ROTATION`、precision 仍 `GPS`）；缺 `CITY_ROTATION`（D-13a）案例 | A（luke81168） |
| J-002-r5 | #35 `d10c327` | ❌ | 試驗：`KP-2026-09-24-005` 4 筆可匯入、可與其他 4 包一起發布 | 合併前首次發布會缺臺北市 4 筆 | Jerry |

## 已知整合風險核對（2026-09-25 重新確認）

| # | 風險 | 結果 | 證據 |
|---|---|---|---|
| 1 | B-010 是否使用 B-011a 的共用 token 與歸屬檢查 | **否（B-010 本身）**。PR #33 明寫待 #32 合併後的 B-010-r3 處理；試驗組合中 git 文字合併剛好把 B-011a 的檢查接上，但這不是 B-010 的交付 | 試驗 `assessmentService.ts` L247–259；PR #33 說明 |
| 2 | B-010／B-011a assessment 程式與測試衝突 | **仍存在**：`apps/api/tests/assessment.test.ts` 內容衝突；service 可自動合併 | 試驗 vitest：26 failed／208 passed（全部 `SESSION_INVALID: 缺少…X-Kareo-Session-Token`） |
| 3 | C-005 是否含 disabilityCertificate、incomeCategory 與對應 request | **否** | `grep -rn "disabilityCertificate\|incomeCategory" apps/web/src` 在 `6e5cca6` 無結果 |
| 4 | B-008 核准是否綁定實際內容；撤回是否禁止立即重新發布同一版本 | **兩者皆否**；另發現 r2 的 carry-forward 破壞舊版本追溯與回復 | `tests/integration/repro/b008-approval-binding.repro.ts`（FAIL）；`tests/db/verify-db.mjs` K5／K6／K7 |
| 5 | B-009 快照、相同變更去重、PDF 雜湊 | **三者皆未正確處理** | `tests/integration/repro/b009-hash-dedupe.repro.ts`（2 FAIL）；`crawlerService.ts` 無 snapshot 寫入 |
| 6 | A-005 是否依最新位置契約更新預期結果 | **否** | `data/providers/qa/acceptance-cases.md`（#30）AC-007、AC-009、AC-011 |

## 交回各任務的修正要求（J-003 不改模組業務邏輯）

| ID | 交回 | 可重現方式 | 精確修正要求 |
|---|---|---|---|
| H-1 | B-010-r3 | 試驗組合 `npx vitest run tests/assessment.test.ts` | 合併 #32 後以 B-011a 的 `requireValidSession`／`requireMatchingSessionId` 為唯一入口（不另建）；`buildDeps` 建立 session 時取得 `sessionToken`，所有 `createAssessment` 呼叫帶 token；保留 B-011a 的 SESSION_INVALID／FORBIDDEN 測試；依 PR #35 核准的規則 r6／r7 更新 `RULES_VERSION` 與 S-EST-LOCAL-AD |
| H-2 | B-008-r3 | `node tests/db/verify-db.mjs --migrations=<含 0011 的目錄>` K5、K6 | 帶入新版本時不得覆寫舊紀錄的 `version`：以「版本—紀錄」關聯表（或等效方式）記錄每個版本包含的紀錄；resolver 依關聯表取快照；`withdraw` 的 `republishVersionId` 必須完整回復該版本當時的紀錄集合 |
| H-3 | B-008-r3 | `tests/integration/repro/b008-approval-binding.repro.ts` | 匯入時 `(packId, recordId)` 已存在但內容（contentHash、summary、ruleData、effective 日期）不同 → 拒絕並列出，不得靜默略過；`approve` 前比對資料庫紀錄與內容包紀錄的內容雜湊，不一致就拒絕核准 |
| H-4 | B-008-r3 | `verify-db.mjs` K7 | `withdraw_knowledge_version` 拒絕 `republishVersionId` 等於正在撤回的版本；只允許回復未被撤回（`withdrawn_at is null`）的 ARCHIVED 版本 |
| H-5 | B-009-r2 | `tests/integration/repro/b009-hash-dedupe.repro.ts` | PDF 以 `arrayBuffer()` 位元組計算 SHA-256（與 Source Registry「PDF sha256」相同基準），HTML 依來源定義的正文基準；比對基準改為「該來源最近一次 snapshot」而非內容包雜湊；同一 `newContentHash` 已有 NEEDS_REVIEW 變更時不再建立；每次抓取保存 raw snapshot（TASK-B-009 交付項） |
| H-6 | B-009-r2 | — | 移除「Netlify Scheduled Function `10 16 * * *`」建議（約 30 秒上限）；排程入口改由 J-003 的 `.github/workflows/knowledge-crawler.yml` 呼叫 `dist/scripts/runCrawler.js` |
| H-7 | C-005-r2 | `grep` 同上 | 同步最新 staging（不要帶入 `a14903a` 的 docs 內容）；依 API_CONTRACT v0.3.1／v0.3.2 新增兩題選填（YES／NO／UNKNOWN；LOW_INCOME／MIDDLE_LOW_INCOME／ALLOWANCE／GENERAL／UNKNOWN），未回答送 `UNKNOWN`；Mock 用 `WITH-DISABILITY-NEW_TAIPEI.json`、`WITH-ESTIMATE-GENERAL-NEW_TAIPEI.json` 驗收；決定 `e3a065a` 的去留 |
| H-8 | A-005-r2 | — | 同步 staging；AC-009 依 D-13b（`NO_LOCATION`、空陣列、提醒）；AC-007／AC-011 依 D-13c；新增 `CITY_ROTATION`（D-13a）與同日穩定／跨日輪替（D-13f）案例 |
| H-9 | B-002（或 J-003 已處理） | `node scripts/check-functions-runtime.mjs` | 已由本版修正：Supabase 未設定時回應不再帶環境變數名稱，細節只寫 function log |


---

## Contract 差異：目前後端 vs 目標 contract（J-003-r3 紀錄，staging `9af91e5`；最新狀態見〈整合狀態表〉）

目標為 API_CONTRACT v0.2（D-04 已於 2026-09-24 核准；**D-05／D-06 仍是 PROPOSED**）。前端 adapter 已依目標實作，但**後端未提供的能力一律視為依賴未完成**，不因 adapter 寫好而算整合完成。

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

## 首次知識發布（待執行；2026-09-25 條件核對）

目標版本 `KB-2026-09-24-001`。**本版未執行任何雲端寫入**：下列條件未全部成立。

| 條件 | 狀態 | 證據 |
|---|---|---|
| 內容已由 Jerry 核准 | ✅ 5 包：`KP-2026-09-23-001`（9）、`-24-002`（6）、`-24-003`（1 核准＋1 退回）、`-24-004`（1）、`-24-005`（4）＝ **21 筆**，每筆有 `review.reviewedBy` | [PR #31 comment（001）](https://github.com/viz963-1216/Kareo/pull/31#issuecomment-5806103227)、[PR #31 comment（002）](https://github.com/viz963-1216/Kareo/pull/31#issuecomment-5807237910)、[PR #31 第三批（KR-016）](https://github.com/viz963-1216/Kareo/pull/31#issuecomment-5810344725)、[PR #31 第四批（KR-017 退回、KR-018 核准）](https://github.com/viz963-1216/Kareo/pull/31#issuecomment-5810416966)、005：[PR #35（KR-022）](https://github.com/viz963-1216/Kareo/pull/35#issuecomment-5810649551)、[PR #35 修正版 KR-019〜021](https://github.com/viz963-1216/Kareo/pull/35#issuecomment-5819498531)、[PR #35 疑點核准](https://github.com/viz963-1216/Kareo/pull/35#issuecomment-5819667212)（commit `d10c327`） |
| 全部內容包都在同一個 commit | ❌ `KP-2026-09-24-005` 只在 **PR #35（未合併）** | 發布前需先合併 #35，否則版本會漏掉臺北市 4 筆 |
| `intendedKnowledgeVersion` 一致 | ✅ 5 包皆 `KB-2026-09-24-001` | `contracts/knowledge/packs/*.json` |
| B-008 必要修正已合併並驗證 | ❌ B-008-r2（#36）未合併；另有 H-2／H-3／H-4 | 〈整合狀態表〉、`tests/db/verify-db.mjs` |
| 預演 | ✅（本機、in-memory、試驗組合）5 包 21 筆全部匯入、核准、發布為 `KB-2026-09-24-001`，0 筆因失效排除；B-010 在該快照上的臺北市／新北市案例地方行不互相出現 | `tests/integration/first-publish-dryrun.ts` |
| 目標為確認過的 staging（非 production） | ❌ 未確認：本機沒有 staging Supabase 憑證，也無法確認專案隔離 | — |

建議順序：#36 B-008-r2 → B-008-r3（H-2／H-3／H-4）→ #35 J-002-r5 → Jerry 確認 staging Supabase 專案 → 依下列指令執行。

目標環境：Jerry 確認的 **staging** Supabase 專案（`SUPABASE_URL`／`SUPABASE_SERVICE_ROLE_KEY` 只放在執行者的 shell 環境，不寫入 repo、PR 或對話）。影響：新增 21 筆 `knowledge_records`、1 筆 `knowledge_versions`（PUBLISHED）；staging 上的 Assessment 從 `KNOWLEDGE_UNAVAILABLE` 變成引用 `KB-2026-09-24-001`。已發布版本不得覆寫；要修正只能撤回後發布新版本號。

```bash
npm ci --prefix apps/api && npm run build --prefix apps/api
for p in KP-2026-09-23-001 KP-2026-09-24-002 KP-2026-09-24-003 KP-2026-09-24-004 KP-2026-09-24-005; do node apps/api/dist/scripts/importKnowledgePack.js --dry-run contracts/knowledge/packs/$p.json || break; done
for p in KP-2026-09-23-001 KP-2026-09-24-002 KP-2026-09-24-003 KP-2026-09-24-004 KP-2026-09-24-005; do node apps/api/dist/scripts/importKnowledgePack.js --commit contracts/knowledge/packs/$p.json || break; done
for p in KP-2026-09-23-001 KP-2026-09-24-002 KP-2026-09-24-003 KP-2026-09-24-004 KP-2026-09-24-005; do node apps/api/dist/scripts/approveKnowledgePack.js contracts/knowledge/packs/$p.json || break; done
node apps/api/dist/scripts/publishKnowledgeVersion.js "<執行者>" "Jerry" --notes="first publication, 5 packs, 21 records" -- contracts/knowledge/packs/KP-2026-09-23-001.json contracts/knowledge/packs/KP-2026-09-24-002.json contracts/knowledge/packs/KP-2026-09-24-003.json contracts/knowledge/packs/KP-2026-09-24-004.json contracts/knowledge/packs/KP-2026-09-24-005.json
curl -s https://<staging 網址>/api/v1/knowledge/status
```

預期：dry-run 全部 0 拒收；`Approved` 合計 21；`Published version: KB-2026-09-24-001`、`Published records: 21`；status 回 `KB-2026-09-24-001`。任何一步不符就停止，不要改用其他版本號重試。

| 項目 | 紀錄 |
|---|---|
| 內容包與核准 PR | 見上表 |
| 匯入指令與輸出 | （待填） |
| 核准／發布操作者 | （待填，真實人員） |
| KnowledgeVersion | （待填） |
| `GET /api/v1/knowledge/status` 回應 | （待填） |
