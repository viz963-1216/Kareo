# Kareo Integration Acceptance / 整合驗收紀錄

> 2026-10-09 J-003-r30：既有公開release `56500c8`有6／49實際部署案例PASS（01／03／12／16／21／27），43 PENDING。完整gate121 PASS／0 FAIL／43 PENDING仍失敗；121包含開發檢查，不是E2E案例數。Supabase實際Provider匯入回滾與四表資料比對通過；空白Session正常清理。東京兩官方來源仍逾時；依Jerry決定暫不新增付費實體還原專案。D-05仍DRAFT、Integrated否。見 [完整版本與證據](acceptance/J003-2026-10-09-foundation-and-rollback.md)。

> 2026-10-07 J-004-r11：Jerry 核准獨立、可分享的虛構個案展示站（DEMO_APPROVED）。展示隱私提示不阻擋操作；正式 D-06／49 項部署 E2E 不冒稱完成。見 [展示範圍與操作](acceptance/J004-2026-10-07-shareable-demo.md)。

> 2026-10-07 22:52（J-004-r9）：最新 staging `bb18992` 的 50 項隔離 HTTP/CLI 整合檢查全部 PASS、0 FAIL。僅採計 LOCAL 技術驗證；49 項部署 E2E 不變。見 [精確版本、時間與原始報告](acceptance/D05-2026-10-07-owner-rehearsal-cancellation.md#actual-technical-verification-after-cancellation)。

> 2026-10-07 最新決定（J-004-r9）：Jerry 取消額外真人客服／權利演練 HPR-01～03，狀態為 CANCELLED_BY_OWNER，不再列為驗收阻擋。實際申請核對、刪除請求信箱及原 MVP Lead 接件責任保留；D-05 仍 DRAFT、完整 J-003／J-004 未完成。見 [決定紀錄](acceptance/D05-2026-10-07-owner-rehearsal-cancellation.md)。

Owner: Jerry（TASK-J-003）
Submission Version: J-003-r30

> 只有「部署環境中，以真實 API 與真實資料實際操作成功」才算通過。
> Mock、單元測試、PR 合併都**不算**整合完成。平台額度或模組缺漏造成的阻擋一律記為 `PENDING`，必要項目 PENDING 時完整驗收判定為**失敗**。
> 需求對應見 `docs/MVP_TRACEABILITY.md`（J-002-r4）；決策狀態見 `docs/MVP_DECISIONS.md`。

> 最新：見 [2026-10-07 J-003-r21 雲端操作證據](acceptance/J003-2026-10-07-cloud-retention.md#j-003-r21-actual-execution-update)。回填5包／21筆與13項真正Blobs／DB操作已通過；具部署版本的全49項E2E、D-05 ACTIVE／Integrated仍未完成。另新增只在既有私人驗收分支輸出的空白Session部署檢查頁；它不送同意、健康或媒合，不出現在production／PR／local建置。下列r16/r14為历史。

> 較早：見 [2026-10-06 J-003-r16 安全驗收入口](acceptance/J003-2026-10-06-safe-staging-smoke.md)。預設 GET、健康寫入需明確啟用及 ACTIVE，部分驗證不計整項 PASS；Integrated 仍否。

> 較早快照：見 [2026-10-05 J-003-r14 本機 HTTP 整合](acceptance/J003-2026-10-05-local-http.md)。基底 staging `5edbd1e`（#77），已提交 ABC 模組皆已合併。本輪以正式 Functions、supabase-js、官方 PostgREST 與隔離 PostgreSQL 17 驗證 HTTP 流程；結果只屬 LOCAL，**不採計 49 項部署 E2E，Integrated 仍否**。同意測試版只在暫存建置內，正式 D-05 仍 DRAFT。舊部署及較早快照留作追溯，不代表最新 staging 的驗收。

---

## 兩種檢查（不可混用）

| 檢查 | 指令 | PENDING | 結束碼 | 代表什麼 |
|---|---|---|---|---|
| 開發檢查（每個 PR，CI `acceptance-dev`） | `node scripts/acceptance-gate.mjs --mode=dev` | 允許 | 只有 FAIL → 1 | 「目前沒有壞掉的東西」。沒給目標時 E2E 一律 PENDING（不評估）。exit 0 **不是** MVP 通過，輸出最後一行會明寫 |
| 完整驗收／release gate（手動 workflow `Release gate`、PR → main） | `node scripts/acceptance-gate.mjs --mode=release --commit=<40 碼 SHA> --base-url=<https URL>` | **不允許** | 任何 FAIL 或 PENDING → 1；缺目標或格式錯 → 2 | **這一個 commit** 部署在**這一個環境**時，原始 MVP 所有必要項目都有真實證據 |

新增本機 HTTP 整合：`node tests/local/run.mjs --out=<LOCAL JSON>`，環境與重跑方式見 [tests/local/README.md](../tests/local/README.md)。CI `Local HTTP integration (not deployed E2E)` 使用一次性 PostgreSQL 17，無雲端 secrets；輸出 `releaseAcceptance: false`，禁止寫入 `tests/e2e/results/`。這項測試不改 release gate 的 49 項必要案例。

Gate 內容：路由／contract／禁止欄位（`check-integration.mjs`，含 §26 管理 API）、**打包後的 Functions 能否載入與執行**（`check-functions-runtime.mjs`，J-003-r4）、**驗收案例完整性**（MVP_TRACEABILITY 引用的案例不得缺、每個案例都要被引用，J-003-r4）、知識包格式、**知識內容是否已核准**（格式正確 ≠ 核准）、Provider 資料 gate（A-004），以及 `tests/e2e/acceptance-cases.json` 的 49 個 E2E 案例。

另有兩種**不算 E2E** 的本機檢查，結果只記在本文件：`tests/db/verify-db.mjs`（隔離 PostgreSQL／PGlite：migration、RLS、Provider 匯入回滾、知識發布／撤回；r8 起 K10–K12／U5／C3 以 esbuild 打包實際 `SupabaseKnowledgeRepository`＋`DatabaseKnowledgeResolver`，經 supabase-js 與唯讀 PostgREST shim 讀同一個 PGlite；每項標 `[behaviour]` 或 `[schema]`）與 `tests/integration/`（交回模組的重現案例、首次發布預演）。

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

### D-05 尚未 ACTIVE 時的唯讀檢查（J-003-r10）

`tests/e2e/run-public-api-e2e.mjs` 只送 GET，不建立 session、不送健康／聯絡資料、不核准／發布知識。指定目標 SHA，前後各讀版本標記；版本不符不執行案例。可在 B／D-05 收尾時查證 JSON 404、知識狀態及兩個公開列表的 API 部分：

```bash
node tests/e2e/run-public-api-e2e.mjs --commit=<線上完整 SHA> --base-url=https://kareo-tw.netlify.app --out=tests/e2e/results/public-<日期>.json
```

E2E-44／48 是完整 UI 案例，即使 API 回列表也只記 PENDING；來源、篩選、狀態畫面與瀏覽器沒有建立 session 等仍需另外驗收。知識狀態只是診斷，不算首次發布程序 E2E-25。尚未部署 B-011b 清理時，先用此唯讀 runner；原 full API runner 會建立測試 session，需有清理與逐筆追蹤機制才重跑，不以時間窗批次刪除。

### 指定部署版本 → 跑 E2E → release gate

```bash
export KAREO_RELEASE_COMMIT=<待發布 commit 的完整 SHA>
export KAREO_RELEASE_BASE_URL=https://kareo-tw.netlify.app
curl -s "$KAREO_RELEASE_BASE_URL/kareo-version.json"
node tests/e2e/run-api-e2e.mjs --allow-writes --out="tests/e2e/results/api-$(date -u +%Y%m%dT%H%M%SZ).json"
node tests/e2e/record-manual.mjs --operator="<真實人員>" --case=E2E-16 --status=PASS --evidence="新分頁開啟 Kareocar，無 iframe" --out="tests/e2e/results/manual-$(date -u +%Y%m%dT%H%M%SZ).json"
node scripts/acceptance-gate.mjs --mode=release
```

1. 第 3 行確認 `commit` 就是目標 SHA。不是的話，先部署該 commit。
2. 第 4 行需在驗收環境明確授權合成寫入、已具備清理及 ACTIVE 同意後才執行。無 --allow-writes 或無有效 ACTIVE 時只記前置 PENDING，不送 POST／DELETE。
3. 第 5 行在每次人工（ui／ops）檢查後記錄，每個 case 各給一組 `--case`／`--status`／`--evidence`。
4. 第 6 行驗收，exit 0 才算通過。

也可以在 GitHub Actions 手動執行 `Release gate`，填入 `commit` 與 `base_url`。workflow 預設只跑公開 GET 診斷再跑嚴格 gate。只有手動勾選 run_api_e2e 才啟用合成寫入 runner；PR → main 不自動建立資料。結果上傳 artifact，人工案例結果需先經 PR 提交。

C 的 Mock 模組驗收（C-003／C-004／C-005）只證明畫面與 contract 相容，不填入本文件的 E2E 結果。

---

## 目前結論（2026-09-29，J-003-r8）

**Integrated：否。** 本機／隔離 DB 檢查在 staging `6abe494` 上全部沒有 FAIL，但真實部署 E2E 0 項可執行：兩個網站仍 HTTP 503 `usage_exceeded`（2026-09-29T12:22Z），43 個 E2E 全部 PENDING。詳細輸出見〈Run 2026-09-29-02〉與 [J003-R7-2026-09-29.md](J003-R7-2026-09-29.md)〈r8 後續紀錄〉。

### A. 已合併 staging 的能力（`6abe494`）

#33 B-010、#34 C-005、#36 B-008（至 `c5d4cb4`）、#40 B-005、#37 B-009、#42 前端 CI、#43 J-002 管理 API v0.4 契約、#45 J-004 發布準備。r7 的三項阻擋在 staging 上已解決：

| r7 阻擋 | r8 結果 | 證據 |
|---|---|---|
| typecheck：`findLatestRecordBySourceId` 缺 `contentFingerprint` | **已解決** | `tsc --noEmit` PASS |
| migration 重號（兩個 0013） | **已解決** | M1：0001–0017 無缺號重號；fresh／upgrade 全部套用 |
| K10：resolver 漏讀沿用紀錄 | **已解決，且以實際讀取路徑驗證** | K10 PASS（實際 repository＋resolver＋`getKnowledgeStatus`）；以 `c5d4cb4^` 的舊 repository 執行同一測試 → K10 FAIL（只讀到 1／3 筆） |

r5 交回清單在 staging 上的狀態：H-2、N-2（升級回填）U2／U3／U5 PASS；H-3（內容指紋）由 `apps/api/tests/b008-content-fingerprint.test.ts` A／B／C／D／F 經正式入口 `runApproveKnowledgePack` 通過，J 的首次發布預演也改走同一入口 21／21；H-5 快照 C3 以實際 repository 讀回位元組並重算雜湊 PASS；N-1、N-3、N-4、N-7 已解決；N-5 `b009-baseline` 與 N-6 `b005-distance-and-write`（2／2）重現案例 PASS，R2 以行為驗證 Run／Items 同交易回滾。H-6 排程實跑仍未驗證（需 `staging` environment 與 secrets）。

### B. 未合併 PR 的隔離試驗結果（不代表 staging）

| PR | 試驗組合 | 結果 |
|---|---|---|
| #46 C-006 `557edf8`（審查留言後**沒有新 commit**） | 本機 staging `6abe494`＋#46 → `2d34300`（未推送） | 前端 37 tests PASS、real build PASS、Mock 掃描 0；**審查指出的缺陷仍可重現**：`fetch` 回 HTTP 200 `{"success":true,"data":{}}` 時，`adminRealApi.publish(...)` 與 `withdraw(...)` 都 resolve `{}`，預期 reject `INVALID_RESPONSE`（負責：C-006，`apps/web/src/api/adminRealAdapter.ts`） |
| #39 A-003 `6f8db5c` | 未納入試驗 | 分支上 `data/providers/staging/providers.json` 30 筆皆有非 null 座標；本輪**未審核**來源可追溯性，DISTANCE 仍不採計 |
| #41 J-003-r5 `ca8d405` | — | 兩個 commit（`7c0798b`、`ca8d405`）都是 #44 的祖先，內容已完整包含；建議由 PR 作者以「由 #44 取代」關閉，本次未操作 |

### C. 本機／Mock／PGlite 驗證（本 PR head，staging `6abe494` 合併後）

後端 typecheck PASS、vitest 321／321；前端 31／31、real build、正式 bundle Mock 掃描 0；根目錄 scripts／adapter 54／54；J-004 smoke 3／3；check-integration 11 PASS／12 PENDING／0 FAIL；Admin fixtures 39 PASS；知識包格式 PASS；Provider gate PASS；打包後 Functions 14 PASS／1 PENDING（DELETE session 未實作）／0 FAIL；dev gate 29 PASS／0 FAIL／56 PENDING；隔離 DB fresh 24 PASS（19 behaviour、5 schema）／0 FAIL、`--upgrade-from=0008` 28 PASS（23 behaviour、5 schema）／0 FAIL。

- CI `db-verify` **不再忽略 DB 測試失敗**（任何 FAIL 會讓該 job 失敗、PR 顯示紅燈）：移除 `continue-on-error`；`shell: bash`（`-eo pipefail`），避免 `| tee` 吃掉失敗碼；加入負向對照步驟（舊 repository 必須讓 K10 FAIL）。
- **分支保護另計**：2026-09-29 唯讀查證 `staging`、`main` 皆無 branch protection、無 ruleset（GitHub API 回 `Branch not protected`），因此目前**沒有任何 required check**，紅燈不會在技術上阻擋合併。是否把 `Isolated DB verification` 等 job 設為 required check 由 Jerry 在 GitHub 設定決定；J-003 未變更設定。
- `[schema]` 項（M1、M3、M4、C2、R1）只證明物件存在；原子性、回復、讀取行為只看 `[behaviour]` 項。PGlite 以超級使用者執行，shim 不模擬 JWT／RLS；權限只由 M3／M4 的 catalog 檢查證明。

### D. 真實部署 E2E

**0／43 執行；43 項維持待驗收（PENDING）**，依環境與模組到位情況逐段補證據，本機／隔離 DB 結果不填入 E2E 欄位。 `https://kareo-tw.netlify.app/`、`/api/v1/knowledge/status`、`https://kareocar.netlify.app/` 皆 HTTP 503 `{"error":"usage_exceeded"}`。沒有可採計的結果檔；release gate 必然 FAIL（43 PENDING）。

### E. 外部阻擋與尚缺功能

| 項目 | 缺什麼 | 受阻 E2E | 負責 | 下一步 |
|---|---|---|---|---|
| 部署 | Netlify 額度（D-09），兩站 503 | 全部 43 項 | Jerry | 恢復額度或方案後，部署目標 commit，確認 `/kareo-version.json` |
| staging Supabase | 本 session 沒有 Supabase 連線或憑證，**本輪未重新查 catalog**（r7 紀錄：專案 Kareo 只有 sessions／consents）；不能由名稱推定為隔離 staging | 全部需 DB 的案例 | Jerry | 確認哪個專案是 staging 且與 production 隔離；在該專案唯讀執行 `tests/db/detect-applied-migrations.sql` 回報結果；於 GitHub `staging` environment 設定 secrets |
| 首次知識發布 | `KB-2026-09-24-001` 未發布（需前一列） | `requires` 明列：E2E-04、06、25、31、32；沒有 PUBLISHED 版本時所有評估只會回 `KNOWLEDGE_UNAVAILABLE` | Jerry 授權、J-003 執行 | 預演 21／21 已通過；確認隔離 staging 後依 CLI 匯入 → 核准 → 發布 |
| B-006 Lead API | `POST /api/v1/leads`、內部查件／狀態更新；遠端無分支／PR | E2E-13、14、15、18、22、36、41 | B | 依 API_CONTRACT 交付；J-003 再補路由 |
| B-011b 安全 | `POST /api/v1/consent/withdraw`；`DELETE /api/v1/session` 回未實作 | E2E-19、20、37 | B | 同上 |
| B-012 Admin API | `/api/v1/admin/**` 10 個端點 | E2E-40 | B | 同上；C-006 真實接線依賴此項 |
| C-006 | #46 回應驗證缺陷未修 | E2E-40 | C（負責修正） | 依 #46 審查留言修正同一 PR；J-003 修正後重跑試驗組合 |
| 同意版本 | `contracts/legal/consent-versions.json` 唯一一組為 DRAFT、legalReview PENDING | E2E-02、37、41 | Jerry（D-05） | 法務核准後由 Jerry 改為 ACTIVE（J-003 不代改） |
| 接件人員 | D-06 備援接件人 | E2E-15 | Jerry | — |
| 距離排序 | A-003 #39 未合併、未審核 | E2E-08 | A（已交回 A 工程師接管） | A 完成座標來源後，J-003 整合驗證 |
| 知識排程 | B-009 排程實跑需 `staging` environment／secrets | E2E-26、38、39 | Jerry | 同 Supabase 列 |

## 前次結論（2026-09-27，J-003-r5；歷史，最新狀態以上方 r8 為準）

**Integrated：否。** 完整驗收（release）：**FAIL**（目標 J-003-r5 `7c0798bb6bf98e64d596d18da92274fb246687a2` @ `https://kareo-tw.netlify.app`；43 個 E2E 全部 PENDING）。部署環境 2026-09-27 重新查證仍為 HTTP 503 `{"error":"usage_exceeded"}`（`kareo-tw`、`kareocar` 皆同），**沒有任何可採計的 E2E 紀錄**。

- staging `d7d5107` 已合併：#38 J-003-r4、#32 B-011a、#30 A-005、#35 J-002-r5。
- 仍在審查：#33 B-010（前輪修正已通過）、#36 B-008、#40 B-005、#37 B-009、#34 C-005、#39 A-003。未提交：B-006、B-011b、B-012、C-006。
- 本版的「試驗組合」＝隔離 worktree 的 staging＋#33＋#36＋#40＋#37（合併結果 `45e2330`，衝突解法見下），**不代表 staging 已具備**。
- #39 A-003-r3 `3e44e27`：J-003 確認 30 筆 Provider、非 null 座標 **0**，座標任務未完成；E2E-08 DISTANCE 維持 BLOCKED。
- 首次知識發布**未執行、也不在本次授權範圍**；條件見〈首次知識發布〉。D-05 同意版本仍為 DRAFT，未變更。
- 隔離 DB 驗證仍有真實 FAIL（B-008 相關），CI 的 `db-verify` job 維持 informational；B-008 修正與整合案例通過後改為必要檢查。CI 綠燈不代表資料庫驗證通過。

## 交回清單狀態（2026-09-27 重新驗證；r4 原文保留於下方歷史段落）

| ID | 交回 | 狀態 | 驗證的 commit | 證據 |
|---|---|---|---|---|
| H-1 | B-010：B-011a 共用 token／歸屬、測試衝突、規則 r6／r7 | **已解決** | #33 `98e933f` | J-003 單獨重跑：typecheck PASS、vitest 222/222、`RULES-2026-09-25-r7`、打包後 Functions 12 PASS／1 PENDING／0 FAIL |
| H-2 | B-008：版本追溯、撤回後完整回復 | **全新資料庫已解決；升級路徑仍存在**（見 N-2） | #36 `7b77e9c` | `verify-db.mjs` K4–K6、K9 PASS；`--upgrade-from=0008` U2／U3 FAIL |
| H-3 | B-008：核准綁定被審核內容 | **仍存在**（第一輪情境已解決） | #36 `7b77e9c` | `b008-approval-binding.repro.ts` PASS；`b008-content-fingerprint.repro.ts` A、B、D FAIL（只比對 `source.contentHash`；缺筆不報錯） |
| H-4 | B-008：撤回版本不可立即重發 | **已解決** | #36 `7b77e9c` | K7 PASS |
| H-5 | B-009：PDF 雜湊、去重、原始快照 | **PDF 雜湊與去重已解決；原始快照仍存在** | #37 `467cb14` | `b009-hash-dedupe.repro.ts` 2/2 PASS；C1 PASS；C2 FAIL（只存雜湊） |
| H-6 | B-009：排程入口改用 J-003 workflow | **已解決（文件）；排程實跑尚未驗證** | #37 `467cb14` | `runCrawler.ts` 註解指向 `knowledge-crawler.yml`；workflow 只在 `main` 才會觸發，且缺 `staging` environment／secrets |
| H-7 | C-005：同步 staging、兩題選填、e3a065a | **同步已解決（J-003）；兩題選填與 e3a065a 6 項仍存在** | #34 `599e0a2` | diff 只剩 77 個 apps/web 檔；web build／25 tests PASS；`disabilityCertificate`／`incomeCategory` 仍無；e3a065a 未推送，6 項逐一確認缺少（#34 留言） |
| H-8 | A-005：依 D-13 更新 | **已解決** | #30 `ffc0796`（已合併） | `data/providers/qa/acceptance-cases.md` D13-A／B／C；r1 AC-009 保留為歷史 |
| H-9 | Supabase 未設定時錯誤不外洩 | **已解決** | #38（已合併） | `check-functions-runtime.mjs` 0 FAIL |

## 新發現（J-003-r5）

| ID | 問題 | 狀態 | 負責 | 證據 |
|---|---|---|---|---|
| N-1 | **B-010 × B-008-r3：第二次發布起知識快照不完整。** B-008-r3 讓 carry-forward 的紀錄保留原本 `version`，成員改存 `knowledge_version_records`；B-010 `findPublishedSnapshotRecords()` 與 B-008 `getCurrentPublishedStatus()` 仍以 `knowledge_records.version = 目前版本` 查詢 | 仍存在 | B-010（#33）、B-008（#36） | `verify-db.mjs` K10：應 3 筆、實得 1 筆（試驗組合）；首次發布不受影響（預演 21/21） |
| N-2 | **B-008-r3 無回填**：migration 前已發布的版本升級後成員為空，之後無法回復 | 仍存在 | B-008（#36） | `--upgrade-from=0008` U2、U3 FAIL |
| N-3 | B-005 × B-010 型別衝突：`findById` 未對應新欄位；`city`／`district` 可為 null | 仍存在 | B-005（#40） | 試驗組合 `tsc --noEmit` 6 個錯誤；`tests/assessment.test.ts` 同一測試兩邊皆改 |
| N-4 | B-010 的 4 個 knowledge-version 測試使用 B-008 r1 的 `publishVersion` 參數 | 仍存在（#36 合併後出現） | B-010（#33） | 試驗組合 vitest 296/300（4 FAIL：`缺少內容包。`） |
| N-5 | B-009 HTML 比較基準：正規化文字雜湊 vs Source Registry 的 HTML 原始雜湊 | 仍存在 | B-009（#37） | `b009-baseline.repro.ts` FAIL |
| N-6 | B-005 距離先取整再排序；Run／Items 非原子寫入（Codex 第二輪） | 仍存在 | B-005（#40） | `b005-distance-and-write.repro.ts` 2 FAIL；`verify-db.mjs` R1 FAIL |
| N-7 | Migration 撞號（0009：#33／#40；0013：#36／#37） | 方案已提出，待 B 改名 | B | 〈Migration 全域順序〉；#36／#37／#40 J-003 留言 |
| N-8 | #40 缺推薦路由 | **已解決（J-003）** | J-003 | #40 `e867dbb`：check-integration 0 FAIL、recommendations 打包後可執行（無 token → 401）、dev gate 0 FAIL |

## Migration 全域順序（J-003-r5 提案，2026-09-27）

套用紀錄：repo 沒有任何 staging 套用紀錄（DEPLOYMENT.md 要求記在本文件，但從未填寫）；0001–0002 依 J-001 smoke 推定已套用，0003–0008 **未確認**。0009 以後只存在未合併分支，視為**未套用**。以唯讀查詢 `tests/db/detect-applied-migrations.sql` 確認後才定案；已套用的檔案不改名。

| 順序 | 目前檔名（PR） | 調整 | 依賴 |
|---|---|---|---|
| 0001–0008 | staging | 不變 | — |
| 0009 | `0009_assessment_rules_engine.sql`（#33） | 不變 | 0003 |
| 0010 | `0010_assessment_disability_income.sql`（#33） | 不變 | 0009 |
| 0011 | `0011_knowledge_publish_carry_forward.sql`（#36） | 不變 | 0006、0007 |
| 0012 | `0013_knowledge_version_traceability.sql`（#36） | → `0012_` | 0011（同一函式重定義，必須在後） |
| 0013 | `0009_recommendation.sql`（#40） | → `0013_` | 0003、0004 |
| 0014 | `0012_crawler_runs.sql`（#37） | → `0014_` | 0006 |
| 0015 | `0013_crawler_hash_traceability.sql`（#37） | → `0015_` | 0014；建立前需確認沒有重複的待審變更 |

合併順序＝編號順序：**#33 → #36 → #40 → #37**。順序改變時，較晚合併者在合併前改到下一個可用號碼。

隔離驗證（改名後的試驗組合）：全新套用 M1／M2 PASS（0001–0015 無缺號重複）；`--upgrade-from=0008`（先有已發布知識再升級）M1／M2／U1 PASS，U2／U3 FAIL（N-2）。未改名時 M1 FAIL（重複 0009、0013）。

## 環境查證（2026-09-27，唯讀）

| 項目 | 結果 | 缺什麼 |
|---|---|---|
| Netlify `kareo-tw`、`kareocar` | HTTP 503 `usage_exceeded` | D-09 額度（Jerry 決定） |
| GitHub repository | public；default branch `main`；只有 `CI` workflow 已註冊（其他 workflow 尚未在 `main`） | — |
| GitHub environments | **無** | 建立 `staging` environment（crawler 排程與未來部署驗收用） |
| GitHub secrets | repository 與 environment 皆**無** | `staging` environment 的 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`（只在 GitHub 設定頁輸入） |
| GitHub variables | **無** | `KAREO_RELEASE_BASE_URL`（PR → main 的 release gate 需要） |
| Supabase staging | 本機無憑證，無法唯讀確認專案隔離與已套用 migration | Jerry 在 staging 專案 SQL editor 執行 `tests/db/detect-applied-migrations.sql`，回報結果表（不含資料、不含憑證）；並確認該專案不是 production、不是 Kareocar |


---

# 歷史紀錄：J-003-r4（2026-09-25，保留原文；最新狀態以上方 r5 為準）

## 結論（2026-09-25，J-003-r4）

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

## 整合狀態表（2026-09-25，J-003-r4）

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

## 已知整合風險核對（2026-09-25，J-003-r4）

| # | 風險 | 結果 | 證據 |
|---|---|---|---|
| 1 | B-010 是否使用 B-011a 的共用 token 與歸屬檢查 | **否（B-010 本身）**。PR #33 明寫待 #32 合併後的 B-010-r3 處理；試驗組合中 git 文字合併剛好把 B-011a 的檢查接上，但這不是 B-010 的交付 | 試驗 `assessmentService.ts` L247–259；PR #33 說明 |
| 2 | B-010／B-011a assessment 程式與測試衝突 | **仍存在**：`apps/api/tests/assessment.test.ts` 內容衝突；service 可自動合併 | 試驗 vitest：26 failed／208 passed（全部 `SESSION_INVALID: 缺少…X-Kareo-Session-Token`） |
| 3 | C-005 是否含 disabilityCertificate、incomeCategory 與對應 request | **否** | `grep -rn "disabilityCertificate\|incomeCategory" apps/web/src` 在 `6e5cca6` 無結果 |
| 4 | B-008 核准是否綁定實際內容；撤回是否禁止立即重新發布同一版本 | **兩者皆否**；另發現 r2 的 carry-forward 破壞舊版本追溯與回復 | `tests/integration/repro/b008-approval-binding.repro.ts`（FAIL）；`tests/db/verify-db.mjs` K5／K6／K7 |
| 5 | B-009 快照、相同變更去重、PDF 雜湊 | **三者皆未正確處理** | `tests/integration/repro/b009-hash-dedupe.repro.ts`（2 FAIL）；`crawlerService.ts` 無 snapshot 寫入 |
| 6 | A-005 是否依最新位置契約更新預期結果 | **否** | `data/providers/qa/acceptance-cases.md`（#30）AC-007、AC-009、AC-011 |

## 交回各任務的修正要求（J-003-r4 原文；狀態見上方 r5〈交回清單狀態〉）

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

### Run 2026-09-27-01 — 本機，J-003-r5 分支＋整合試驗組合

| 項目 | 內容 |
|---|---|
| 驗證的 commit | J-003-r5 `7c0798bb6bf98e64d596d18da92274fb246687a2`（staging `d7d5107`＋本版），工作目錄無未提交修改 |
| 試驗組合（**非 staging**） | staging `d7d5107`＋#33 `98e933f`＋#36 `7b77e9c`＋#40 `1a12c62`→`e867dbb`＋#37 `467cb14` → `45e2330`。衝突：#33×#36 兩個 knowledge repository（加總型）；#40×#33 `tests/assessment.test.ts` 一個測試（取 B-010 側）；#37×（#33＋#36）三個檔案（加總型） |
| 其他單獨驗證 | #33 `98e933f`、#37 `467cb14`、#40 `1a12c62`／`e867dbb`、#34 `599e0a2`、#39 `3e44e27` 各自的 checkout |
| 環境 | 本機 macOS，Node v24；PGlite 0.3.16（PostgreSQL 17.5，in-process） |
| 執行時間 | J-003-r5 分支 2026-09-26T16:47:23Z–16:47:37Z；試驗組合與各 PR 驗證：同一工作階段、J-003-r5 分支執行之前（2026-09-27 +08:00） |
| Provider／Knowledge／rulesVersion | Provider：`data/providers/staging`（A-004 PASS；0／30 座標）；Knowledge：雲端無 PUBLISHED，預演用 5 包 21 筆（in-memory）；rules：#33 `RULES-2026-09-25-r7` |
| 外部服務 | Netlify 兩站 503 `usage_exceeded`；未使用 Supabase；GitHub API 只做唯讀查詢與 PR 留言 |
| 資料 | 全部合成 |

J-003-r5 分支（`7c0798b`）：

| # | 檢查 | 指令 | 實際 | 結果 |
|---|---|---|---|---|
| 1 | Backend typecheck／tests（staging 程式） | `npm run typecheck --prefix apps/api`、`npm test --prefix apps/api` | PASS；131/131 | PASS |
| 2 | Frontend real build | `npm run build --prefix apps/web` | 通過、無 `*-MOCK` | PASS |
| 3 | 版本標記 | `node scripts/build-site.mjs` | `7c0798b…` | PASS |
| 4 | 路由／contract | `node scripts/check-integration.mjs` | 10 PASS、11 PENDING、0 FAIL | PASS（dev） |
| 5 | 打包後 Functions | `node scripts/check-functions-runtime.mjs` | 12 PASS、1 PENDING、0 FAIL | PASS（dev） |
| 6 | Script／gate／runner 測試 | `node --experimental-strip-types --test "tests/**/*.test.*"` | 54/54 | PASS |
| 7 | 開發檢查 | `node scripts/acceptance-gate.mjs --mode=dev` | 26 PASS、0 FAIL、55 PENDING | PASS（**不是 MVP 通過**） |
| 8 | 完整驗收 | `… --mode=release --commit=7c0798b… --base-url=https://kareo-tw.netlify.app` | exit 1 | **FAIL** |
| 9 | Runner 對 staging | `node tests/e2e/run-api-e2e.mjs --base-url=https://kareo-tw.netlify.app --commit=7c0798b…` | 版本標記 503 → 未跑案例 | PENDING（D-09） |
| 10 | 隔離 DB（staging 0001–0008） | `node tests/db/verify-db.mjs` | 13 PASS、3 FAIL（K4、K7、K9：B-008 r1 已知）、2 PENDING | FAIL → B-008 |
| 11 | 隔離 DB 升級路徑 | `node tests/db/verify-db.mjs --upgrade-from=0008` | 16 PASS、3 FAIL、2 PENDING | FAIL → B-008 |

試驗組合與各 PR：

| # | 檢查 | 結果 |
|---|---|---|
| T1 | 試驗組合 `apps/api` typecheck | **6 個錯誤**（N-3，B-005×B-010） |
| T2 | 試驗組合 vitest | 296/300；4 FAIL（N-4） |
| T3 | 試驗組合打包後 Functions（含推薦路由） | 14 PASS、1 PENDING、0 FAIL；dev gate 0 FAIL |
| T4 | 隔離 DB：試驗組合原檔名 | M1 FAIL（重複 0009、0013）；K10、C2、R1 FAIL；其餘 PASS（K4–K9 全 PASS） |
| T5 | 隔離 DB：依提案改名、全新套用 | 16 PASS、3 FAIL（K10、C2、R1） |
| T6 | 隔離 DB：依提案改名、`--upgrade-from=0008` | 17 PASS、5 FAIL（U2、U3、K10、C2、R1） |
| T7 | Migration 探測 SQL | staging 結構 0001–0008 present、0009+ absent；完整結構 0001–0015 present |
| T8 | #33 `98e933f` 單獨 | typecheck PASS、222/222、r7、Functions 12/1/0 |
| T9 | #36 `7b77e9c` repro | `b008-approval-binding` PASS；`b008-content-fingerprint` A、B、D FAIL |
| T10 | #37 `467cb14` | vitest 158/158、typecheck PASS；`b009-hash-dedupe` 2/2 PASS；`b009-baseline` FAIL |
| T11 | #40 `1a12c62` | `b005-distance-and-write` 2 FAIL（PROV-A 最遠卻入選；留下孤立 Run） |
| T12 | #40 `e867dbb`（加路由後） | check-integration 0 FAIL；recommendations：PATCH→400、POST 無 token→401；dev gate 0 FAIL；script tests 54/54 |
| T13 | #34 `599e0a2`（同步 staging 後） | apps/web 以外與 staging 完全相同；apps/web 與 `6e5cca6` 完全相同；web build 無 mock、25/25、54/54、dev gate 0 FAIL；GitHub mergeable |
| T14 | #39 `3e44e27` | 30 筆 Provider、非 null 座標 0 |
| T15 | 首次發布預演（試驗組合） | 5 包 21/21 發布為 `KB-2026-09-24-001`；兩市地方行不交叉 |

### Run 2026-09-25-01 — 本機，J-003-r4 分支＋整合試驗組合

| 項目 | 內容 |
|---|---|
| 驗證的 commit | J-003-r4 `c75b3f978864cfac326644eb005823e4f847f78e`（staging `fd4154ae16107ac599bd39bba58795c564370d76`＋本版），工作目錄無未提交修改 |
| 試驗組合 | 隔離 worktree，**不是 staging**：staging `fd4154a`＋#32 `92d787f`＋#33 `2612c05`＋#36 `1c73987`＋#37 `80bd5fc`＋#35 `d10c327`＋#30 `a67156e`＋#34 `6e5cca6`（合併結果 `918334a`，衝突解法見〈整合狀態表〉）＋本版 `netlify.toml`／`supabaseClient.ts` |
| 環境 | 本機 macOS，Node v24（CI 為 Node 22）；PGlite 0.3.16（PostgreSQL 17.5，in-process） |
| 執行時間 | 2026-09-24T18:44:58Z–18:45:11Z（J-003-r4 分支）；試驗組合同日 02:20–02:45 +08:00 |
| Provider 資料 | `data/providers/staging`（A-004 gate PASS）；未匯入任何雲端資料庫 |
| Knowledge | 無 PUBLISHED 版本（雲端）；預演使用 5 個已核准內容包（in-memory） |
| rulesVersion | staging：無規則引擎（Fake Adapter）；試驗組合：B-010-r2 `RULES-2026-09-24-r5` |
| 真實外部服務 | `https://kareo-tw.netlify.app/kareo-version.json` HTTP 503；`https://kareocar.netlify.app/` HTTP 503（D-09）；未使用 Supabase |
| 資料 | 全部合成；無真實姓名、電話、健康資料或憑證 |

J-003-r4 分支（`c75b3f9`）：

| # | 檢查 | 指令 | 預期 | 實際 | 結果 |
|---|---|---|---|---|---|
| 1 | Backend typecheck／tests | `npm run typecheck --prefix apps/api`、`npm test --prefix apps/api` | 通過 | 11 檔、93 項通過 | PASS |
| 2 | Frontend real build | `npm run build --prefix apps/web` | 通過、bundle 無 mock | 通過；無 `*-MOCK` | PASS |
| 3 | 版本標記 | `node scripts/build-site.mjs` | `dist/kareo-version.json` 為目標 SHA | `c75b3f9…`（`git rev-parse HEAD`） | PASS |
| 4 | 路由／contract | `node scripts/check-integration.mjs` | 0 FAIL；缺的 endpoint 列 PENDING | 10 PASS、11 PENDING（withdraw、recommendations、leads、§26 管理 API 8 個）、0 FAIL | PASS（dev） |
| 5 | 打包後 Functions | `node scripts/check-functions-runtime.mjs` | 6 個 function 可載入；錯誤方法 4xx JSON；錯誤不外洩 | 12 PASS、1 PENDING（`DELETE /session` 未實作，B-011b）；修正前 3 FAIL（回應含 `SUPABASE_URL`） | PASS（dev） |
| 6 | Script／adapter／gate／runner 測試 | `node --experimental-strip-types --test "tests/**/*.test.*"` | 通過 | 54／54 | PASS |
| 7 | 知識包格式／Provider gate | `validate-knowledge-pack.mjs`、`check-provider-data.mjs` | 通過 | 通過（格式 ≠ 核准 ≠ 發布） | PASS |
| 8 | 開發檢查 | `node scripts/acceptance-gate.mjs --mode=dev` | exit 0，PENDING 不算通過 | exit 0：26 PASS、0 FAIL、55 PENDING | PASS（**不是 MVP 通過**） |
| 9 | 完整驗收 | `… --mode=release --commit=c75b3f97… --base-url=https://kareo-tw.netlify.app` | exit 1 | exit 1：43 E2E＋12 項 PENDING；無目標 → exit 2 | **FAIL** |
| 10 | Runner 對 staging | `node tests/e2e/run-api-e2e.mjs --base-url=https://kareo-tw.netlify.app --commit=c75b3f97…` | 版本不符就不跑 | 版本標記 HTTP 503 → 未跑任何案例（未提交結果檔） | PENDING（D-09） |
| 11 | 隔離 DB（staging migrations 0001–0007） | `npm ci --prefix tests/db && node tests/db/verify-db.mjs` | 全部 PASS | 12 PASS、3 FAIL：K4、K9（D-03 差異，B-008-r2）、K7（H-4） | FAIL → 交回 B-008 |

試驗組合（`918334a`，只證明「合併後會怎樣」）：

| # | 檢查 | 結果 |
|---|---|---|
| T1 | 合併衝突 | B-010×B-011a：`tests/assessment.test.ts`；B-010×B-009：`repositories/types.ts`、`inMemoryKnowledgeRepository.ts`、`supabaseKnowledgeRepository.ts`（加總型）；C-005×staging：21 個 docs／tasks／contracts 檔（squash 前 commit） |
| T2 | `apps/api` typecheck／vitest | typecheck PASS；vitest 208 PASS、**26 FAIL**（全部是 B-010 測試未帶 session token，H-1） |
| T3 | 打包後 Functions | **不加** `included_files`：consent 無法載入（`Cannot find module '../../../../contracts/legal/consent-versions.json'`）；加上後 13／13 PASS |
| T4 | Frontend（含 C-005）real build／測試 | build PASS、無 mock；48／48 |
| T5 | 隔離 DB（0001–0012） | 12 migration 依序套用 PASS；RLS／權限 PASS；Provider 回滾 PASS；K4、K9 PASS；**K5、K6、K7 FAIL**（H-2、H-4） |
| T6 | 交回重現案例 | `b008-approval-binding` FAIL（H-3）；`b009-hash-dedupe` 2 FAIL（H-5） |
| T7 | 首次發布預演 | 5 包、21／21 筆發布為 `KB-2026-09-24-001`，0 筆排除；臺北市／新北市地方行不互相出現；KR-2026-018 兩市皆適用 |

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

## 首次知識發布（2026-09-27 條件核對，J-003-r5）

**本次不授權、也未執行發布。** 目標版本 `KB-2026-09-24-001`。

| 條件 | 狀態 |
|---|---|
| 5 包 21 筆內容已由 Jerry 核准，且都在 staging | ✅（#35 已合併 `d7d5107`） |
| `intendedKnowledgeVersion` 一致 | ✅ |
| B-008 修正已合併並驗證 | ❌ #36 未合併；H-3 內容指紋、N-2 回填、N-1 `/knowledge/status` 仍 FAIL |
| B-010 讀版本成員（第二次發布起必要） | ❌ N-1（首次發布本身不受影響，但發布後第一次更新就會少知識） |
| 預演 | ✅ 試驗組合 21/21 |
| staging Supabase 已確認隔離、已套用 migration 已知 | ❌ 無憑證；需 Jerry 唯讀執行 `tests/db/detect-applied-migrations.sql` |
| 目標為 staging（非 production） | 待確認 |

條件全部成立後，J-003 會依當時的 B-008 指令介面重新提出逐步命令（下方 r4 指令僅供參考，`approveKnowledgePack` 的輸入在 B-008-r3 之後已改變）。

## 首次知識發布（J-003-r4，2026-09-25 條件核對；歷史）

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

## Run 2026-09-29 — J-003-r7

最新分層驗證與交回項目見 [J003-R7-2026-09-29.md](J003-R7-2026-09-29.md)。B 試驗組合 320 項測試通過，但 typecheck 缺 contentFingerprint；DB M1 重號、K10 沿用紀錄讀取失敗。兩個網站仍 503；雲端 Kareo catalog 只有 sessions／consents。**Integrated：否**。

## Run 2026-09-29-02 — J-003-r8（本機；PR #44 分支合併 staging `6abe494` 後）

環境：macOS、Node v24.19.0（CI 為 Node 22）；獨立 worktree；無雲端憑證、無資料寫入、無部署。

```sh
npm ci --prefix apps/api && npm ci --prefix apps/web && npm ci --prefix tests/db
npm run typecheck --prefix apps/api && npm test --prefix apps/api
npm test --prefix apps/web && npm run build --prefix apps/web
grep -R -l -E 'SES-MOCK|CON-MOCK|ASM-MOCK|KB-MOCK|PROV-MOCK|REC-MOCK|LEAD-MOCK' apps/web/dist   # 無輸出
node --experimental-strip-types --test "tests/**/*.test.*"
node --test scripts/tests/smoke-release.test.mjs
node scripts/check-integration.mjs
node contracts/mock/admin/validate-fixtures.mjs
node scripts/validate-knowledge-pack.mjs .
node scripts/check-provider-data.mjs
node scripts/check-functions-runtime.mjs
node scripts/build-site.mjs
node scripts/acceptance-gate.mjs --mode=dev
node tests/db/verify-db.mjs
node tests/db/verify-db.mjs --upgrade-from=0008
git show c5d4cb4^:apps/api/src/repositories/supabaseKnowledgeRepository.ts > /tmp/legacy-repo.ts
node tests/db/verify-db.mjs --knowledge-repository-from=/tmp/legacy-repo.ts   # 預期 exit 1、K10 FAIL
```

| # | 檢查 | 結果 |
|---|---|---|
| 1 | 後端 typecheck | PASS |
| 2 | 後端 vitest | 24 files、321／321 PASS |
| 3 | 前端 tests | 31／31 PASS |
| 4 | 前端 real build＋bundle Mock 掃描 | PASS；0 個檔案含 Mock ID |
| 5 | 根目錄 scripts／adapter tests | 54／54 PASS |
| 6 | J-004 smoke 工具 tests | 3／3 PASS |
| 7 | 路由／契約／端點覆蓋 | 11 PASS、12 PENDING（B-006 1、B-011b 1、B-012 10）、0 FAIL |
| 8 | Admin fixtures | 39 個 JSON 與跨檔一致性 PASS |
| 9 | 知識包格式 | PASS（格式，不代表核准或發布） |
| 10 | Provider gate（A-004） | PASS（Errors 0） |
| 11 | 打包後 Functions | 14 PASS、1 PENDING（DELETE session）、0 FAIL |
| 12 | Netlify site bundle | PASS |
| 13 | dev gate | 29 PASS、0 FAIL、56 PENDING（非 MVP 驗收） |
| 14 | 隔離 DB fresh（修改前，舊 K10） | 18 PASS、1 FAIL（K10 仍執行已淘汰的 `knowledge_records.version` 查詢；實作已修正） |
| 15 | 隔離 DB fresh（r8） | 24 PASS（19 behaviour／5 schema）、0 FAIL、0 PENDING |
| 16 | 隔離 DB `--upgrade-from=0008`（r8） | 28 PASS（23 behaviour／5 schema）、0 FAIL、0 PENDING |
| 17 | 負向對照：舊 repository（`c5d4cb4^`） | exit 1；K10 FAIL（快照只有 `J003-KREC-6`，預期 3 筆）；C3 FAIL（該舊檔尚無 crawler snapshot 方法，預期中） |
| 18 | 首次發布預演 `tests/integration/first-publish-dryrun.ts`（改用 `runApproveKnowledgePack`） | 5 包、21／21 發布、0 排除；臺北／新北地方資訊不互相套用 PASS |
| 19 | 重現案例 `b005-distance-and-write`、`b009-baseline`、`b009-hash-dedupe` | 2／2、1／1、2／2 PASS |
| 20 | 重現案例 `b008-approval-binding`、`b008-content-fingerprint` | 無法執行：呼叫已淘汰的 `approveRecords(ids)`（現需 `expectedContentFingerprint`）→ VALIDATION_ERROR。這是 J 的重現工具過時，不是 B 缺陷；同情境已由 `apps/api/tests/b008-*.test.ts` 經正式入口涵蓋並通過 |
| 21 | C-006 試驗組合（staging＋#46 `557edf8` → `2d34300`，未推送） | 前端 37／37、build PASS、Mock 掃描 0；空 data 成功回應缺陷重現（見〈目前結論〉B） |
| 22 | 部署探測（2026-09-29T12:22:34Z） | `kareo-tw`（`/`、`/api/v1/knowledge/status`）、`kareocar` 皆 503 `usage_exceeded` |
| 23 | release gate（`--commit=688f3d6…`（staging 合併後）、`--base-url=https://kareo-tw.netlify.app`） | **FAILED**，exit 1：29 PASS、0 FAIL、56 PENDING（43 E2E 沒有任何此目標的結果檔） |

C-006 缺陷重現步驟（試驗組合，`apps/web`）：`sessionStorage` 放入 `kareo.adminToken`，`globalThis.fetch` 回 `new Response('{"success":true,"data":{}}', {status: 200})`，呼叫 `adminRealApi.publish({ targetVersionId: "KB-2026-09-29-001", previewToken: "p", confirm: true })`。預期 reject `code = INVALID_RESPONSE`；實際 resolve `{}`。`withdraw(...)` 相同。位置：`apps/web/src/api/adminRealAdapter.ts`（`request()` 只擋 `data` 為 undefined／null）。負責：C-006。

## 2026-10-04 J-003-r12：併發與回填分層證據

`tests/db/verify-concurrency.mjs` 在真正 PostgreSQL 17 三個獨立 backend 通過 8 項鎖／過期狀態檢查；錯誤鎖對照指定失敗。`scripts/rehearse-content-backfill.mjs` 在私人快照的本機副本通過受保護 CLI 七項檢查。詳見 `docs/acceptance/J003-2026-10-04-postgres-and-backfill.md`。這些不採計 49 項部署 E2E；沒有雲端回填、沒有改 D-05 DRAFT、沒有改憑證或預設分支。

## 2026-10-05 D-05 審閱提案與合成備份再刪除

基底 staging `fccd6d961c96c85b2c5827601ab2ffd8b9c83514`。本機 HTTP 40／40 PASS，新增 LOCAL-39／40 在早期合成應用快照還原後，重套實際撤回／刪除的合成請求及正式 SQL 清理，含復活負向對照與無關有效資料保留。報告 `docs/acceptance/evidence/D05-2026-10-05-local-restore.json` 標記 releaseAcceptance=false、physicalBackupRestored=false；不是 49 項部署 E2E。D-05 候選全文已固定，營運者核准 pending、版本 DRAFT；正式權利工具、獨立刪除紀錄、每日排程及目標部署尚待驗證。Integrated 維持否。

## 2026-10-05 D-05 有條件核准與候選全文取出

Jerry 的直接授權已記為 OWNER_APPROVED_CONDITIONAL；不是外部法律意見或正式同意啟用。候選固定全文可從 `/privacy/versions/2026-10-05-r1-proposed.txt` 保存與取出，SHA-256 固定為 `5f28c3de07e260214bf7e6b12dd45642fceac619076858d253027d0920e6c1a2`。LOCAL-41 實際 HTTP 驗證通過，本機整合 41／41 PASS。報告 `docs/acceptance/evidence/D05-2026-10-05-conditional-review.json` 的 sourceCommit 是提交前基底，workingTreeDirty=true；不是部署驗收。所有實際同意版本仍為 DRAFT、activationAllowed=false；無 token 權利工具、正式獨立刪除紀錄、供應商副本範圍、排程及一致版本部署仍待補齊。Integrated 維持否。

PR #80 乾淨 CI 首次檢查發現測試工具直接呼叫 Vite、未執行 npm prebuild；LOCAL-41 下載取得 SPA HTML，依指紋正確失敗。已修正本機隔離建置以同一個正式全文輸出函式產生暫存下載檔；刪除全部已產生 public 文案後重跑，41／41 PASS。更新報告基底為 `d33160252b06c14595ef74b9502fc168f2d9dd79`、workingTreeDirty=true。先前本機成功依賴已產生檔案，不能替代這次乾淨驗證；合併仍待修正 head CI 通過。

2026-10-07 r22：實際部署平台5項空白Session檢查與後續雲端清理PASS；每日清理已啟用，首次自動事件仍PENDING。這不是完整E2E-19/20/37，49案例不新增PASS。參見 docs/acceptance/J003-2026-10-07-cloud-retention.md。

## 2026-10-07 J-003-r27：私人部署公開 GET 與 UI 部分觀察

#98 已合併，私人分支 `01c267aa38734d62b390fe90516543602e23d14c`、部署 `6ac6310d25ad9673c016b966` 實際在登入瀏覽器執行純 GET，前後 `/kareo-version.json` 相同 SHA／deployId。E2E-21 PASS；E2E-44／48 列表成功仍 PENDING。指定 SHA／網址的 E2E 聚合1 PASS、0 FAIL、48 PENDING；不得混合舊版本結果。資源35／分頁20+15、五所中心、雙北與行政區／名稱篩選、公開知識兩市各2筆申請方式等是另一個6258ac4部署的部分UI觀察，不冒充新版本完整案例。公開站仍舊版、D-05仍DRAFT、未寫雲端健康／聯絡資料。Integrated：否。詳見 docs/acceptance/J003-2026-10-07-public-browser.md 與原始結果 tests/e2e/results/2026-10-07-private-public-get.json。
