# TASK-J-003 — CI + Staging Integration + End-to-End Acceptance

Owner: Jerry  
Status: 進行中。r25：5包／21筆歷史回補、13項真實雲端操作及5項私人部署空白Session檢查通過；正常清理入口dry-run／commit成功，每日清理已啟用（首次自動事件待驗）。三種標準執行環境診斷已實跑，新北兩來源皆逾時，法規網站Linux改IPv4選擇後已讀取成功，設定已接入排程，完整來源執行待驗；完成6份實體備份清冊，但隔離還原尚待條件；crawler來源失敗、D-05 ACTIVE、49項部署E2E及Integrated尚未完成。（2026-10-07）
Plan revision: 2026-09-19 / 10-22 MVP

## Goal / 目標

在部署環境以真實 API、真實資料與 PUBLISHED 知識，驗證原始 MVP 的每一條使用者行為（`docs/MVP_TRACEABILITY.md` 每一列的「驗收方式」），並記錄可重現證據。C 的 Mock 模組驗收不算本任務的通過。

## Prerequisite / 前置條件

- CI／gate 骨架：已完成（r1–r3）。
- 首次知識發布：D-02 內容核准、D-03 格式核准（2026-09-24 已完成）＋**B-008-r2 合併**（發布版號必須等於 `intendedKnowledgeVersion`）。目標版本 `KB-2026-09-24-001`。不等待最終 E2E，避免與 B-010 循環依賴。
- 階段 E2E（依開發順序逐步開啟，見 tasks/README「建議開發順序」）：B-011a → B-010 → B-005 → B-006 → C-005 → B-009 → B-011b；A-003-r2 提供距離排序的真實案例、A-005 提供推薦案例。
- 部署環境：Jerry 決定提交前再處理 Netlify 付費／正式上線，暫不新增付費正式資料庫；先完成既有驗收與本機準備。現有部署不代表 staging `5edbd1e`；新部署、環境配置與 D-05 阻擋仍列 PENDING。

## 開始前必讀

`AGENTS.md`、`docs/PRODUCT_SPEC.md`、`docs/ARCHITECTURE.md`、`docs/DATA_MODEL.md`、`docs/API_CONTRACT.md`、`docs/GIT_RULES.md`、`tasks/README.md`。
高順位規格優先；本任務不自行定義新欄位、API 或產品規則。需要的規格先由 J-002 合併。

## Allowed Paths / Forbidden Paths

Allowed: `/.github/**`、`/scripts/**`、`/tests/**`、`/docs/**`、`/contracts/**`、`/tasks/**`、root 建置/部署設定；`/apps/web/**`、`/apps/api/**` 僅跨模組 adapter/route/env 接線
Forbidden: 所有未列出的路徑；不得提交 secret、真實個資或更改其他模組業務邏輯。

## Deliverables / 驗收

CI 與整合接線（已交付，持續維護）：

- [x] PR CI：frontend build、backend tests／typecheck、A-004 data validation、contract／mock 檢查；缺模組列 PENDING
- [x] PR 不需 production secret；部署與 E2E 獨立手動觸發，不因 docs commit 消耗部署額度
- [x] Real API adapter；正式模式不回 Mock 成功資料
- [x] 新 function 與路由整合：管理端、撤回／刪除 session、providers 列表與 knowledge/records 已隨 #71 合併。路由靜態／打包後執行通過；部署行為另列 E2E，不以此勾選。
- [x] 打包後 Functions 的實際執行（r4：`scripts/check-functions-runtime.mjs`，CI 與 gate）；`included_files` 帶上執行期讀取的 consent 版本檔
- [x] 每日知識更新排程入口（r4：`.github/workflows/knowledge-crawler.yml`，16:10 UTC＝00:10 Asia/Taipei、20 分鐘上限、不重疊）；需 B-009 合併與 GitHub environment `staging` secrets
- [x] 隔離 DB 驗證（r4：`tests/db/verify-db.mjs`，migration 依序套用、RLS、Provider 匯入回滾、知識發布／撤回；r8：K10–K12／U5／C3 走實際 repository＋resolver 讀取路徑，R2 行為驗證，負向對照；CI 不再忽略失敗，分支保護 required check 未設定）

知識與資料：

- [ ] 依 D-02 核准內容，用 B-008 import → approve → publish 在整合環境建立第一個 PUBLISHED 版本；未核准資料不得發布；記錄來源、審核、版本與 `GET /knowledge/status`
- [ ] Provider 正式匯入通過 A-004；staging Supabase 回滾測試（D-10）

真實 E2E（release 模式，`tests/e2e/acceptance-cases.json`）：

- [ ] 主流程：新 session → Consent（ACTIVE 版本）→ 真實 Assessment → 結果頁可能適用制度與補助說明 → 推薦 0／1／2／3 家 → Provider 詳情／Google Maps → Lead 保存 → 內部查件與狀態更新；Kareocar 外連
- [ ] **規則引擎**：同輸入同輸出；ASSESSMENT_RULES §9 抽測（含否定句、使用者回答優先）；summary 的金額／比率與 PUBLISHED 紀錄一致；臺北市與新北市各一例，地方資訊不互相套用；缺地方知識顯示 S-LOCAL-MISSING
- [ ] **Knowledge resolver**：無 PUBLISHED 版本 → `KNOWLEDGE_UNAVAILABLE` 與 1966 引導，無假結果；發布新版本後 Assessment 引用新 `knowledgeVersion`；撤回後回到上一版或 `KNOWLEDGE_UNAVAILABLE`
- [ ] **API 失敗行為**：資料庫／resolver 失敗 → 安全錯誤（不回成功格式）；網路中斷重試不產生重複資料；未知 API → JSON 404
- [ ] **位置**：GPS 且候選都有已驗證座標 → DISTANCE；GPS 但缺座標 → DISTRICT_ROTATION＋說明；GPS 拒絕 → 改選行政區完成；只有行政區 → 同 session 同日穩定；只有縣市 → CITY_ROTATION；不提供位置 → 完成評估、不呼叫推薦、不顯示「附近」
- [ ] 安全：拒絕／撤回同意、偽造／過期 token、跨 session、限流、Lead 重複送出
- [ ] 每日知識更新：B-009 排程觸發紀錄、變更進 NEEDS_REVIEW、失敗保留 Last Published
- [ ] 手機／平板／桌機與鍵盤操作；截圖不含真實個資
- [ ] `docs/INTEGRATION_ACCEPTANCE.md` 記錄 commit、環境、Provider 資料版本、Knowledge 版本、rulesVersion、日期、步驟與實際結果。只有全部必要項通過才標記 Integrated

後續維護（J-003 自己的路徑，J-002-r4 不修改）：

- [x] 更新 `tests/e2e/acceptance-cases.json`（r4）：E2E-05 前置由 D-12 改為 D-01a；E2E-08 前置移除 D-08、改為 A-003-r2＋D-13g；E2E-10 前置改為 D-13b；E2E-26 移除 D-11；新增 E2E-28〜43（只有縣市、GPS 拒絕、兩市隔離、版本切換與追溯、未發布／撤回／失效／不適用知識、D-17、D-17a、補助用語、Lead 併發、刪除 session、crawler 失敗保留上一版、快照／PDF 雜湊／去重、D-16 管理頁、主流程一次走完、錯誤不外洩、session 失效流程）；gate 檢查 MVP_TRACEABILITY 引用的案例不得缺

## Target

9/26 前建立 CI 骨架；10/12 前完成功能接線，10/13–10/18 完整驗收與修正。


## Submission / Completion

從最新 `staging` 建立 `feat/j-003-mvp`，PR → `staging`，不得直接 push staging/main。
Submission Version 從 `J-003-r1` 起，退回後遞增。PR 必填 Added / Changed / Fixed / Known Issues / Tests or QA / Scope Check，逐項附驗收證據；未通過不得標記完成。模組合併不等於全站已上線。

---

## 驗收分層

- **開發檢查（dev）**：缺少的模組、資料或知識列 `PENDING`，只有 `FAIL` 讓 CI 失敗。用於日常 PR。
- **完整驗收（release）**：必要項目只要 `PENDING` 或 `FAIL` 就失敗。E2E／release gate 一律用此模式；process exit 0 只代表「目前沒有 FAIL」，不代表原始 MVP 已通過。
- C 的 Mock 模組驗收（C-003／C-004／C-005）與本任務的真實 API 驗收分開記錄；Mock 結果不得填入真實 E2E 欄位。
- 驗收案例需涵蓋 `docs/MVP_TRACEABILITY.md` 每一列的「驗收方式」。

## 變更紀錄

- 2026-09-23 J-002-r3：加入驗收分層。
- 2026-09-23 J-002-r4：移除 AI／付費 AI smoke 相關要求（D-01 規則引擎），改為驗證規則引擎、Knowledge resolver 與 API 失敗行為；位置與補助驗收依 API_CONTRACT v0.2.2；B-009 不再有 D-11 替代方案。
- 2026-09-25 J-003-r4：整合狀態表與風險重新核對、驗收案例 27→43、案例完整性檢查、打包後 Functions 檢查、`included_files`、Supabase 未設定時不外洩環境變數名稱、隔離 DB 驗證、crawler 排程入口、交回清單 H-1〜H-9。
- 2026-09-27 J-003-r5：交回清單狀態（H-1、H-4、H-8、H-9 已解決；H-2 升級路徑、H-3 內容指紋、H-5 快照、H-7 兩題選填仍存在）；新發現 N-1〜N-8；migration 全域順序（#33 → #36 → #40 → #37，0012〜0015 改名）；`verify-db.mjs --upgrade-from`、K10、C1／C2、R1；唯讀 migration 探測 SQL；#40 推薦路由；#34 同步 staging；任務看板更新。

## 2026-09-29 r7 複驗

詳見 docs/J003-R7-2026-09-29.md。C-005／B-010 已合併；J 測試接線完成更新，B 最新組合仍有 3 項阻擋，部署仍 503。不得以此版交付宣稱 TASK-J-003 完成。

## 2026-09-29 r8 複驗（同一 PR #44）

詳見 docs/J003-R7-2026-09-29.md〈r8 後續紀錄〉與 docs/INTEGRATION_ACCEPTANCE.md〈目前結論（J-003-r8）〉。本機／隔離 DB 0 FAIL；真實 E2E 0／43 執行（部署 503）；B-006、B-011b、B-012 未交付，C-006 缺陷未修。**Integrated：否**。

## 2026-10-03 r9 真實環境驗證

首次知識版本已發布；部署 `376f3ef` 的真實 API E2E 4 PASS／0 FAIL，完整 49 必要案例仍有 45 項未通過。D-18／D-19 新增 E2E-44～49，原 43 項保留。詳見 `docs/acceptance/J003-2026-10-03-first-knowledge-publication.md`；Integrated 維持否。後續部署須重跑，不沿用不同 commit 的證據。

## 2026-10-03 r10 接線與隔離組合

最新：[J003-2026-10-03-route-integration.md](../docs/acceptance/J003-2026-10-03-route-integration.md)。J 可處理部分已交付；B-012／B-011b／B-013／B-014／C-007 仍待模組修正與合併。B 可平行修正，不需等 J-003 全部完成。D-05 未 ACTIVE、隔離及雲端更新未驗證，release gate 維持失敗。

## 2026-10-04 r12 PostgreSQL 併發與回填預演

真正 PostgreSQL 17、三個獨立 backend、22 個實際 migration：8 個行為檢查 PASS，錯誤 mutex 負向對照按預期 FAIL。受保護回填 CLI＋實際 repository／SQL 在既有驗收快照的隔離本機副本通過 7 項；五包／21 筆歷史核准事件、原內容與發布版本不變、重跑不重複。雲端回填未執行；JWT／RLS 與部署驗收不由本機 HTTP shim 證明。見 `docs/acceptance/J003-2026-10-04-postgres-and-backfill.md`。


## J-003-r13：最後健康寫入授權（2026-10-04）

基底 #76；Jerry 已委託中心修復 ABCJ。實際 service＋Supabase repositories＋SQL 重現四種晚到評估／推薦請求：撤回／刪除完成後仍寫入。新增前向 0026 的 Session 鎖／token／期限／同意與歸屬檢查，保留 B 原子寫入，公開契約／規則引擎／排序不變。14 項 SQL 回歸、PG17 22 PASS＋兩個特定 FAIL 對照；缺傳安全 context 的正式 repository 拒絕。Known Issues：D-05、正式排程、內容包雲端回填與 49 項部署 E2E 仍待完成；不能把本機測試算 E2E。詳見 docs/acceptance/J003-2026-10-04-late-health-writes.md。


## J-003-r14：本機 HTTP 整合（2026-10-05）

基底 staging `5edbd1e`（#77）。新增 `tests/local/` 與獨立 CI：套用全部 26 migration，透過受保護的正式 CLI 匯入 35 資源／30 服務／98 範圍／19 特約與 5 包／21 筆已核准知識；正式 Functions 經官方 PostgREST 與 supabase-js 實際 HTTP 讀寫。測試同意只加入暫存 bundle，原契約保留 DRAFT。

涵蓋 Session／同意、評估、推薦、媒合重送、內部接件、管理核准／發布／撤回、故障回滾及實體清理。38 項 LOCAL 檢查與防止誤連雲端的 guard，結果见 [本輪證據](../docs/acceptance/J003-2026-10-05-local-http.md)。前端 real build 與首頁 HTTP 送達另列；瀏覽器自動化阻擋本機網址，RWD／鍵盤／畫面操作尚未驗證。

**未完成的完整任務**：D-05 審閱及 ACTIVE、目標 commit 部署與 49 項真實 E2E、實際每日排程、內容包雲端回填、操作／資料權利與完整復原演練。沒有新增付費服務、雲端健康資料或正式核准；不得勾選 Integrated。

## J-003-r15：獨立刪除紀錄與部署存取查證（2026-10-05）

B-015 #81、B-016 #82 已合併；0027／0028 套用現有驗收專案。新增的 SDK、故障拒絕假成功、還原後重套刪除及清理稽核同交易，由本機 49 項及 exact-head CI 9 jobs 驗證。正式排程沒有實跑：預設分支 main、staging credentials／個人 DATA_STEWARD 尚未配置。僅有入口不等於每日更新／清理完成。

預覽 #82 建置成功並可登入看 DRAFT 頁，但自動版本標記 HTTP 401；公開 URL 仍部署 8f509c0。新增工具診斷將受保護的 401／403 與非 JSON 建置問題分開，保留嚴格前後版本核對，不新增登入繞過。兩次實際 runner 均未執行案例，完整 49 項仍無本輪可採計結果。Gemini 提示詞已加入 exact-head preview 及限制。詳見 docs/acceptance/J003-2026-10-05-journal-and-deployment.md。


## J-003-r16：安全的 staging 驗收入口（2026-10-06）

基底 staging `891ed2b`（#84）。移除 smoke 寫死同意版本及預設建立 Session；預設委派公開 GET runner。指定完整 SHA／環境／輸出檔，寫入模式需 --write-e2e --allow-writes、有效 ACTIVE 組合及實際版本標記。API runner 不跟隨重新導向傳送自訂 token header，拒絕缺 expiresAt；身障／經濟身分測試移到撤回前，避免失效 token 假失敗；E2E-02／04／17 的部分檢查不當作整項 PASS。手動 smoke 保存實際 artifact；Release gate 預設只做 GET，PR → main 不自動啟用寫入，49 必要項不變。見 [r16 證據](../docs/acceptance/J003-2026-10-06-safe-staging-smoke.md)。尚未部署、未改同意／帳號憑證或雲端資料。

## J-003-r17：每日更新首次實跑修正（2026-10-06）

Jerry 已儲存 GitHub staging 的 SUPABASE_URL／SUPABASE_SERVICE_ROLE_KEY，並同意預設分支 staging 與 crawler 試跑。首次 Actions 執行建立 11 筆 FAILED，沒有快照；確認是 snapshot-before-run 與已啟用但尚無 KnowledgeRecord 的來源未登錄造成外鍵失敗。補 RUNNING → 同 id 完成、錯誤保留真實 FAILED、官方來源缺漏登錄；不覆寫既有来源與 PUBLISHED 知識。新增實際 SQL 外鍵及負向對照測試。詳見 [r17 證據](../docs/acceptance/J003-2026-10-06-crawler-runtime.md)。手動試跑不代表午夜排程或完整 E2E 已通過。

2026-10-07 r22：實際私人部署空白 Session 建立／刪除／失效及版本前後檢查5/5通過；受保護清理實跑SUCCESS。每日清理設定已啟用，首次自動執行待觀察；完整49部署E2E仍待驗，不以部分操作通過標記 Integrated。
