# Kareo Tasks

## 2026-10-10 J-004-r20：Netlify 可操作 Demo

依 Jerry 最新要求，新增獨立 `/demo/` 靜態流程，首頁與原 `/consent` 可進入；使用已核對公開機構及已發布知識快照，回答只留本分頁。需求分析、初步結果、地區服務推薦與條列摘要已本機實際操作，未啟用正式健康資料蒐集。根目錄查詢維持 real API，D-05 狀態不變；發布與線上實測於 release PR 記錄。見 [Demo 交付與驗證](../docs/acceptance/J004-2026-10-10-netlify-demo.md)。

## 2026-10-10 J-004-r18／C-005：公開部署與閱讀確認修正

#123 已發布到 Netlify，release `cf32202`／deploy `6ac9d1ae2a09190008cf31c5`。部署 GET smoke 5/5、公開 API matrix 27/27 通過，預設資源 1117 筆；本 SHA 完整 gate 116 PASS／0 FAIL／48 PENDING，舊版 7/49 不沿用。發現正式同意未啟用時也鎖住閱讀勾選框，已修正為可操作的本頁閱讀確認，正式評估未開放原因與公開查詢連結清楚顯示；修正的部署證據待 release PR 記錄。D-05 仍未啟用。見 [發布紀錄](../docs/acceptance/J004-2026-10-10-release-deployment.md)、[勾選框修正](../docs/acceptance/C005-2026-10-10-consent-checkbox.md)。

## 2026-10-10 D-05：改採免費驗證路徑

依 Jerry 指示，已建立 `Kareo Free Verification` Free 組織（US$0/month），準備 `Kareo Recovery Free` 東京表單，待本人設定密碼送出。新資料庫／邏輯還原尚未完成；不新增 Pro 專案，不修改原驗收／Kareocar／公開部署。Physical 與副本退休仍分開待驗，D-05 DRAFT、Integrated否。見 [免費方案與執行順序](../docs/acceptance/D05-2026-10-10-free-recovery-plan.md)。

## 2026-10-10 D-05：最新啟用查核

營運方案有條件核准有效；每日清理已有 schedule 成功，最新受保護唯讀查核讀回4筆刪除receipt、相關Session均停用，觀察健康／聯絡資料0。額外HPR-01～03已取消；實體隔離還原、副本退休及正式同意一致部署仍待完成。未新增付費專案，registry仍DRAFT，完整J-003維持7／49 PASS、42 PENDING、Integrated否。見 [D-05現況與具體還原流程](../docs/acceptance/D05-2026-10-10-readiness.md)。

## 2026-10-09 J-003-r32：公開接線錯誤安全

修正real adapter轉顯內部／未知錯誤訊息；14項本機HTTP測試、root132／frontend87通過。修正未部署，Netlify無重建；部署驗收仍7／49 PASS、42 PENDING，D-05 DRAFT、Integrated否。Dev gate115 PASS／0 FAIL／49 PENDING不採計部署證據。見 [r32紀錄](../docs/acceptance/J003-2026-10-09-public-http-safety.md)。

## 2026-10-09 J-003-r31：過期token與公開查詢

公開release `56500c8`：E2E-01／03／12／16／17／21／27通過，**7／49 PASS、42 PENDING**；完整gate122 PASS／0 FAIL／42 PENDING仍失敗。新空白Session實際過期後被拒絕、已正常清理；公开查詢補充GET組件與部分Chrome操作證據，完整UI仍待驗。根目錄117測試通過。D-05 DRAFT、付費隔離還原暫緩、Integrated否，無Netlify新部署。見 [本輪證據](../docs/acceptance/J003-2026-10-09-token-and-public-query.md)。

## 2026-10-09 J-003-r30：部署基礎與雲端匯入回滾

公開release `56500c8`：E2E-01／03／12／16／21／27通過，**6／49 PASS、43 PENDING**，完整gate121 PASS／0 FAIL／43 PENDING仍失敗。四張正式資源表比對與Supabase實際RPC回滾通過；唯一新空白Session已經正常清理。東京兩官方來源仍逾時、未接入每日爬蟲；Jerry暫不新增付費實體還原專案，D-05 DRAFT、Integrated否。新PR不觸發Netlify部署。見 [本輪證據](../docs/acceptance/J003-2026-10-09-foundation-and-rollback.md)。

## 2026-10-09 A-008-r5／J-003-r28：公開資料與UI複驗

PR #115已合併並完成19筆新北電話的Supabase修正與Pages同步；Netlify無重建，19/19公開API讀回正確。資料QA73／SQL隔離patch2通過，原資料及服務範圍保留。公開UI已實際操作，但完整案例仍保留缺項：release gate116 PASS／0 FAIL／48 PENDING，Integrated=false。詳見 [今日證據](../docs/acceptance/J003-2026-10-09-public-data-verification.md)。

## 2026-10-08 J-004-r17：release 公開查詢部署

正式部署來源改 `release`；停用自動 PR 預覽及其他分支部署，保留 GitHub CI、staging 預設分支與排程。現有驗收資料庫供公開資源／制度資訊查詢，同意與個案流程維持未啟用。詳見 [部署紀錄](../docs/acceptance/J004-2026-10-08-release-deployment.md)。

## 2026-10-08 C-009-r2／J-004-r16：摘要易讀性

依 Jerry 指示，初步評估重點正文200字內；完整制度與補助可展開，個管師摘要保留完整原文並以條列呈現，複製／列印一致。中心同步前端、規格與公開資料版；不變更評估規則、API欄位、資料庫或同意狀態。

## 2026-10-08 J-004-r12／A-008-r1

Jerry 要求公開網址改用真實機構及依輸入條件計算，不再固定 demo 回應。新增 [A-008](TASK-A-008.md)：真實資料與可追溯範圍；本輪重用正式規則引擎／資源 filter，保留原 35 筆並補一筆真實輔具商家。公開資料版不送雲端個案、不建立 Lead、不代替完整 J-003／D-05。詳見 [r12 報告](../docs/acceptance/J004-2026-10-08-real-public-data.md)。


> 2026-10-07 J-004-r11：Jerry 核准獨立、可分享的虛構個案展示站（DEMO_APPROVED）。展示隱私提示不阻擋操作；正式 D-06／49 項部署 E2E 不冒稱完成。見 [展示範圍與操作](../docs/acceptance/J004-2026-10-07-shareable-demo.md)。

> 2026-10-07 22:52（J-004-r9）：最新 staging `bb18992` 的 50 項隔離 HTTP/CLI 整合檢查全部 PASS、0 FAIL。僅採計 LOCAL 技術驗證；49 項部署 E2E 不變。見 [精確版本、時間與原始報告](../docs/acceptance/D05-2026-10-07-owner-rehearsal-cancellation.md#actual-technical-verification-after-cancellation)。

> 2026-10-07 最新決定（J-004-r9）：Jerry 取消額外真人客服／權利演練 HPR-01～03，狀態為 CANCELLED_BY_OWNER，不再列為驗收阻擋。實際申請核對、刪除請求信箱及原 MVP Lead 接件責任保留；D-05 仍 DRAFT、完整 J-003／J-004 未完成。見 [決定紀錄](../docs/acceptance/D05-2026-10-07-owner-rehearsal-cancellation.md)。

所有工程 Task 必須：

```text
從最新 staging 建 Feature Branch
→ 執行 Task
→ Test
→ PR → staging
→ Jerry Review
```

A / B / C 不直接 Push `staging` 或 `main`。

每次 PR 必須提供：Submission Version、Added、Changed、Fixed、Known Issues、Test / QA Result、Scope Check。

全站 Release Version 只由 Jerry 管理。

**產品範圍依據**：`docs/PRODUCT_SPEC.md` 原始 MVP＋Jerry 已核准變更（`docs/MVP_DECISIONS.md` 中全部 `SPEC-APPROVED` 項目，含 D-18／D-19 一站式功能）。會縮減範圍的提案 D-08（不收 GPS）、D-11（crawler 延後）、D-12（不顯示補助金額）**未核准、已擱置**，不影響任何任務。需求對應見 `docs/MVP_TRACEABILITY.md`。

---

# 狀態用語（四個層級分開記錄，不得互相代替）

| 層級 | 用語 | 意義 |
|---|---|---|
| 文件 | `DOC-MERGED` | 規格／任務文件已合併 staging；其中 PROPOSED 項目仍待核准 |
| 模組 | `MERGED` | Feature PR 已合併 staging（Module Complete），通常只有單元測試或 Mock 驗收 |
| 整合 | `INTEGRATED` | 部署環境以真實 API＋真實資料＋PUBLISHED 知識通過 J-003 對應 E2E 案例 |
| 正式 | `PROD-ACCEPTED` | production 發布後以合成資料 smoke 通過（J-004） |
| 進度 | `READY`／`QUEUED`／`IN REVIEW`／`未見提交`／`未確認` | `READY`＝前置已滿足可開工；`QUEUED`＝前置未滿足；`未見提交`＝遠端沒有分支或 PR（不代表本機沒有開發）；`未確認`＝沒有證據 |

---

# 最新來源連線與備份清冊（2026-10-07；J-003-r25）

#93／#94／#95 各八項 CI 通過並合併。三種標準環境均無法連到新北兩個careyou來源；Linux法規網站改IPv4連線選擇後，在受保護實際crawler成功。完整18來源手動執行結果：**16 SUCCESS／2 FAILED（PARTIAL，exit 1）**；16快照已保存且SHA-256重算一致，已發布21知識／1版本／21成員完整雜湊不變，7新變更只列NEEDS_REVIEW（目前合計25筆）。兩失敗來源仍列#88，不停用或自動核准。每日更新／清理固定Ubuntu24.04以維持已驗證OS；清理首次自動事件仍待驗。備份畫面已重新核對6份Physical，隔離還原／副本退休未執行，D-05 DRAFT、49部署E2E與Integrated仍未完成。[来源結果](../docs/acceptance/J003-2026-10-07-runner-network.md)、[備份清冊](../docs/acceptance/D05-2026-10-07-backup-inventory.md)。以下較早快照保留為歷史。

# 最新私人部署與每日清理（2026-10-07；J-003-r22）

#91 八項 CI 通過並合併；既有私人分支實際部署完成，**5/5 空白 Session 部署檢查 PASS**（版本前後一致、建立、DELETE、token 失效），真實平台 Blobs context 正常。兩筆雲端 receipt 經既有清理入口讀回；手動 dry-run／commit SUCCESS，僅清理此次自建無健康 Session。每日清理已啟用 KAREO_RETENTION_ENABLED=true，設定台灣00:30，**首次自動觸發仍待觀察，不能用手動成功代替排程驗收**。D-05 DRAFT／完整49 E2E／Integrated仍未完成；實體備份及真人權利／接件演練仍待處理；爬蟲來源失敗見 #88。詳見 [部署證據](../docs/acceptance/J003-2026-10-07-cloud-retention.md#j-003-r22-actual-deployed-checkpoint)。以下快照保留為歷史。

# 最新雲端刪除紀錄與清理實跑（2026-10-07；J-003-r21）

#90 已合併；本人交接 Netlify key 後，受保護入口使用真實 Blobs／Supabase 完成 **13/13 雲端操作檢查**。單筆無健康資料測試 Session 刪除、清理、單列恢復後重套清理通過，兩筆 SUCCESS 紀錄；原有8筆雜湊不變，健康／媒合／同意仍0。排程既有入口另做手動 dry-run SUCCESS（0 待清理）。每日清理尚未啟用；部署平台 context、實體備份恢復、權利／接件人工演練、D-05 ACTIVE 與49項部署E2E仍待驗。見 [實跑紀錄](../docs/acceptance/J003-2026-10-07-cloud-retention.md#j-003-r21-actual-execution-update)。以下 r20/r19 的「待key／待實跑」保留為歷史，不代表目前狀態。

# 最新雲端回填完成與刪除紀錄驗證準備（2026-10-07；J-003-r20）

個人 key 已由 Jerry 儲存，#89 已合併，正式回填入口在真實驗收 DB 完成 **5 個內容包／21 筆歷史核准**，重跑不重複，知識／版本／成員完整雜湊不變。新增預設關閉、僅 staging 的雲端刪除紀錄驗證入口，尚待本人交接 Netlify 存取與實跑；未把準備工作列為通過。它使用真實雲端 SDK／DB，但 named handler 在工作執行器中執行，不採計部署 E2E 或實體備份恢復。D-05 DRAFT、Integrated 否；詳見 [r20 證據與界線](../docs/acceptance/J003-2026-10-07-cloud-retention.md)。下方 r19 為歷史快照，回填待 key 的敘述已由實跑結果取代。

# 最新個人操作者與實際排程（2026-10-07；J-003-r19）

Kareo 驗收 DB 已建立蘇子傑個人操作者 `OP-SU-ZIJIE-ACCEPTANCE`，三項既定角色與雜湊核對成功；個人 key 儲存由本人在準備好的 GitHub 表單交接。新增只允許 staging、預設不執行的歷史包回填入口，實際雲端回填仍待 key。每日更新已觀察到 schedule 觸發（04:57，設定00:10），但15成功／3失敗；清理排程被跳過，未啟用。公開站仍舊SHA；D-05 DRAFT、49項部署E2E／Integrated仍未完成。詳見 [本輪證據](../docs/acceptance/J003-2026-10-07-operator-and-backfill.md)。以下舊快照保留，不能用舊「尚未觸發」或「操作者0」代替本次結果。

# 最新 J-003 驗收入口（2026-10-06；r16）

基底 staging `891ed2b`（#84）。舊 smoke 預設建立 Session、寫死同意且未核對 SHA 的問題已修正：預設 GET；API 寫入需明確啟用、ACTIVE 及版本匹配。部分測試保留 PENDING，完整 49 部署 E2E、正式同意啟用、環境設定與排程仍待驗證。見 [r16](../docs/acceptance/J003-2026-10-06-safe-staging-smoke.md)。以下較早紀錄保留。

# 最新 D-05 提案與合成備份再刪除（2026-10-05）

D-05 官方研究及同類告知比較完成，Jerry 2026-10-05 授權後營運方案有條件核准；正式工程條件未完成，版本保持 DRAFT。兩項合成應用快照還原及重套刪除測試新增至本機整合，共 40／40 LOCAL 通過，不能填入 49 項部署 E2E。正式獨立刪除紀錄保存、權利工具、排程實跑與部署仍待完成。見 `docs/acceptance/D05-2026-10-05-owner-review.md`；Gemini 分工提示詞位於 `docs/handoffs/GEMINI-J003-UI-AND-DEPLOY-2026-10-05.md`。

# 最新本機 HTTP 整合（2026-10-05；J-003-r14）

基底 staging `5edbd1e`（#77）；目前已提交 ABC 模組均已 MERGED。新增一次性 PostgreSQL 17＋官方 PostgREST＋正式 Functions／supabase-js HTTP 整合與 CI，驗證主流程、權限、管理知識與清理回滾；只使用隔離資料及暫存測試同意。38 項 LOCAL 檢查不計入 49 項部署 E2E，D-05 仍 DRAFT，Integrated 仍否。Jerry 暫緩付費正式上線，現階段可持續本機驗證、操作／資料權利與復原準備。證據見 `docs/acceptance/J003-2026-10-05-local-http.md`；以下為較早快照。

# 最新晚到健康寫入修正（2026-10-04；J-003-r13）

基底 #76 已合併（staging `e1ec25a`）。J 複驗重現四種評估／推薦晚到請求：撤回／刪除已提交，舊服務仍能建立健康資料。前向 0026＋正式 repository/service 在最後原子交易重新檢查 token／Session／同意與歸屬；14 項實際服務＋SQL 回歸、真正 PG17 22 PASS。公共 API 与規則引擎／排序不變。證據見 `docs/acceptance/J003-2026-10-04-late-health-writes.md`；Integrated 仍否。

# 最新清理併發修正（2026-10-04；B-011b-r8）

基底 #75 已合併（staging `4866937`）。前向 0025 在刪健康資料前鎖 Session 並重新確認期限，避免恢復使用後仍被舊候選名單刪除；撤回改成 Session → Consent／Lead 鎖顺序。PG17 16 PASS，舊 withdrawal 的 40P01 deadlock 對照 FAIL 已納入 CI；716 項 API PASS。證據見 `docs/acceptance/B011b-2026-10-04-cleanup-concurrency.md`。未啟用排程、未把 E2E 標完成。

# 最新媒合寫入修正（2026-10-04；B-006-r3）

基底 #74 已合併（staging `74f235b`）。J 複驗重現 ledger 失敗留下孤立 Lead、撤回／刪除後晚到請求仍成功。前向 0024＋正式 repository/service 改成 Session 鎖內重新驗證並原子寫入 Lead 與 ledger；716 項 API 測試、真正 PG17 六項媒合競態通過。維持既有 API；此結果不計入部署 E2E，不啟用排程、不啟用 D-05。證據見 `docs/acceptance/B006-2026-10-04-atomic-lead.md`。

# 最新清理驗收修正（2026-10-04；B-011b-r7）

基底 #73 已合併（staging `6a4ffe6`）。J-004 複驗抓到「刪除已提交、成功紀錄寫入失敗」缺口；前向 0023＋正式 repository/service 改為清理與 SUCCESS 紀錄同交易。六項回歸、704 項 API 測試通過；本提交未把排程、D-05、雲端回填或完整 E2E 標為完成。證據見 `docs/acceptance/B011b-2026-10-04-atomic-cleanup.md`。

# 最新整合工具更新（2026-10-04；J-003-r12）

基底 #72 已合併，staging `2ecf3eec1d3ef9e13310f1d0aa845be4506b6e59`。新增真正 PostgreSQL 17 三連線併發驗證，本機 8 PASS、錯誤鎖對照按預期 FAIL；實際 protected CLI 的離線回填 7 PASS，五包／21 歷史核准事件且原知識內容／版本不變。雲端回填尚未執行。更正各 A／B／C Task 的過時「待提交／待審」header：已提交的模組均已 MERGED，部署 E2E 仍待驗。證據見 `docs/acceptance/J003-2026-10-04-postgres-and-backfill.md`。

# 最新驗收環境快照（2026-10-04；J-003-r11 已合併／J-004-r4 工具與部分實演）

- #71 已合併，staging `9b3fc3036745052d2a16196c2ca4019de1440262`；A-007 #70、B-012 #48、B-011b #55、B-013 #57、B-014 #67、C-007 #58 也都已合併。ABC 目前已提交模組均為 MERGED，不能據此標記 INTEGRATED。
- 現有 Kareo 已指定為驗收 DB；Jerry 明確暫不新增每月估計 US$10 的正式專案。Kareocar 未改動。
- 實際套用 0019～0022；28 應用表 RLS 開啟且 anon/authenticated 無表權限。實際原子匯入 35 資源／30 服務／98 已確認範圍／19 特約縣市；原 30 家及86範圍業務欄位完整保留。5 中心不進推薦／媒合。
- 21 表應用快照已在隔離本機逐列還原比對 PASS；不等同 Supabase physical 備份還原、刪除重套或部署回滾。J-004 12 個工具測試 PASS。
- 清理 workflow 已準備且預設未啟用；個人操作者、憑證授權／配置及預設分支決定仍待處理。Crawler 亦未定時實跑。
- Netlify Preview #71 成功並使用 real 模式；保留團隊存取保護，簽入 Chrome 可看首頁。Preview DB 憑證未配置，資源查詢仍顯示錯誤；這不是API E2E通過。production deploy credits耗盡，既有發布版本仍8f509c0，未購買。
- D-05仍DRAFT；J-003完整49項E2E、J-004真人接件／權利／完整恢復／正式發布仍待驗。最新證據：`docs/acceptance/J004-2026-10-04-acceptance-environment.md`。

# 中央接手前快照（2026-10-04；以下為 #71 合併與雲端操作前歷史）

Jerry 已授權 Codex 接手目前 ABCJ 任務與一般技術選擇。現有 Kareo (`ojawadobnaxduxybqolk`) 指定為驗收 DB；新增正式 DB 報價每月估計 US$10，Jerry 決定暫不建立。

- 組合來源：A-007 #70 `a9ab406`、B-012 #48 `cab4d3f`、B-011b #55 `b1ba906`、B-013 #57 `5a9f929`、B-014 #67 `f9f361f`、C-007 #58 `fc957ea`。
- 中央修正：19／20／21／22 migration 唯一且順序正確；管理端 payload／IP／操作者限流，公開查詢 120／小時限流；B-012/B-014 repository 介面均保留；測試 fixture 同步。
- A-007-r2：5 個輔具中心官方門牌座標＋可重算報告；原 30／30／86／19 資料逐 ID／全部欄位指紋保護。仍只供查詢；新北中心未證實行政區服務範圍，維持未知。
- 本機：API 698 PASS、web 78 PASS，fresh DB 24 PASS／upgrade 28 PASS，打包後 Functions 86 PASS、路由25 PASS。這些不是部署 E2E。
- 目前雲端仍 18 migration／30 providers／21 published records。Netlify 2026-10-04 再度顯示 production deploy credits exhausted（網站維持在線）；PR Preview 能否部署須以此次實際結果為準，不自行購買。
- D-05 仍 DRAFT；J-003 完整49 E2E／J-004正式發布尚未完成。各原 PR 狀態仍以 GitHub 為準，下面 10-03 看板為歷史快照。

# 最新規格與整合快照（2026-10-03，J-002-r13／J-003-r10）

- 文件基準 staging `05b1c4a`；r10 唯讀 E2E 1 PASS／2 PENDING，49 必要項目尚有 48 項未通過。r9 的 4 PASS 只屬 `376f3ef`，不能移植。Netlify 已恢復，staging／production DB 隔離仍待核對。
- A-006 #53、Session runtime #59、隱私 #61/#62 已合併。Provider 已匯入 30 家／30 服務／86 已確認範圍。
- 首次知識版本 `KB-2026-09-24-001` 已發布：18 來源、21 筆紀錄、21 版本成員。知識狀態 API HTTP 200。lastVerifiedAt 保留來源原核對時間，不改成發布日。
- 開啟 PR：B-012 #48 r5＋J 路由 `fa2a113`、B-011b #55 r4＋J 路由 `8455529`、B-013 #57 r2＋J 路由 `0d77774`、B-014 #67 r2＋J 路由 `a2abbc5`、C-007 #58 r3；均未合併，收尾見下表。
- A-007 未見 PR；C-008 #65、C-009 #66 已合併。A-006 #53 已完成模組，公開查詢整合仍待 B-013/C-007。
- D-05：90 天／180 天／1 年／3 年產品規劃已確認；D-05a 及 D-16c 已定案。自助刪除仍要求 7 天內完成，B 須修正等待滿 7 天的差異。同意仍 DRAFT，工程及最終審閱未完成。
- 每日 crawler：staging 有 workflow，但 main 沒有；GitHub staging environment 已建立，只允許 staging 分支，目前無 secrets。尚未定時實跑。
- D-18/D-19 六項新增驗收已列 E2E-44～49；合計 49 必要案例，不以早期 43 項代替完整範圍。Integrated 維持否。
- 最新證據：`docs/acceptance/J003-2026-10-03-route-integration.md`；r9 歷史首次發布見 `docs/acceptance/J003-2026-10-03-first-knowledge-publication.md`。
- J-004-r3：發布／回滾／隔離還原及 D-05 權利處理文件已準備；Jerry 已確認信箱收信回覆。實際資料處理與演練仍待完成，D-05 DRAFT／release gate CLOSED。

# Task Board（2026-10-03，J-002-r13）

模組合併不等於部署／整合。本表依 GitHub PR 狀態核對；測試只證明所列 head／情境，詳見本輪交付紀錄。

| 負責 | Task | 模組狀態 | 下一步／整合限制 |
|---|---|---|---|
| A | A-001～A-005 | MERGED（A-003 #39；30／30 座標） | J-003 距離／推薦驗收；不以匯入成功代替服務範圍證據 |
| A | A-006 | MERGED（#53） | 真實公開查詢等 B-013／C-007 |
| A | A-007 輔具資源中心 | READY，未見 PR | 依已核准 D-19 與資料規格提交；不進推薦／媒合 |
| B | B-001～B-010、B-011a | MERGED（含 B-006 #47、B-009 #37） | 知識／Provider 已有雲端資料；完整業務 E2E 與每日 crawler 待驗 |
| B | B-012 | IN REVIEW（#48 r5＋J `fa2a113`） | D-16c 操作者／舊包規則、限流；r5 排序測試及組合562測試已過；規格缺項仍須修。19／20 migration |
| B | B-011b | IN REVIEW（#55 r4＋J `8455529`） | D-05a 已定案；修正七天內完成、共用安全元件整合；21 migration |
| B | B-013 | IN REVIEW（#57 r2＋J `0d77774`） | 公開查詢限流、同步與22 migration；J 路由已補在原 PR |
| B | B-014 | IN REVIEW（#67 r2＋J `a2abbc5`） | 限流、B-012 介面同步；J 路由已補，真實查詢等部署 |
| C | C-001～C-006 | MERGED | 真實初評／媒合等 D-05；管理流程等 B-012 |
| C | C-007 | IN REVIEW（#58 r3 `fc957ea`） | 本機78測試／型別PASS；B-013 之後合併與部署驗收 |
| C | C-008 | MERGED（#65） | 真實知識查詢等 B-014；10 個 category 已一致 |
| C | C-009 | MERGED（#66） | 瀏覽器摘要模組完成，真實評估／列印流程待 J-003 |
| J | J-001 | 環境可用，非完整驗收 | staging／production 隔離、設定與權限仍需確認 |
| J | J-002-r13 | 本輪規格交付完成 | D-05a／D-16c／B-013 範圍已同步；D-05 最終審閱另行收尾 |
| J | J-003 | 工具與部分真實證據已合併（#44、#63）；r10 接線／工具交付，Integrated 否 | #48 → #55 → #57 → #67；#58 在 #57 後。三路由已補在原 PR；仍需 DB／回填、共用安全整合與49項E2E |
| J | J-004 | 準備文件已合併（#22、#45、#64），gate CLOSED | 隔離還原、權利／接件演練、同意正式啟用與發布驗收 |

J-002 本輪證據：[工程規格收尾](../docs/acceptance/J002-2026-10-03-spec-closeout.md)。D-05 工程／最終審閱與 J-004 尚未完成，不因規格文件合併變成 ACTIVE 或 PROD-ACCEPTED。

---

# 歷史開發順序（2026-09-24；當時前置，不代替上方最新收尾順序）

| 階段 | 目標：真實環境可以做到 | 需要完成 | 平行進行 |
|---|---|---|---|
| 1 | 同意 → **真實初評**與可能適用的制度／補助說明 | Jerry：D-04（D-02、D-03 已核准）；B：B-008-r2 → B-011a → B-010；J-003：B-008-r2 合併後首次知識發布 | C：C-005（Mock）；A：A-003-r2、A-005 |
| 2 | **行政區／縣市推薦** → Provider 詳情 → Google Maps | B-005；J-003：Provider 正式匯入、推薦路由 | Jerry：D-13、D-14 決定 |
| 3 | **我要媒合**與內部接件 | B-006；C-005 合併；Jerry：D-06 備援接件人與服務日別（主要接件人已指定） | Jerry：審核地方知識 KP-2026-09-24-002 |
| 4 | **精確位置距離排序** | A-003-r2 座標＋B-005 已有 DISTANCE 分支；D-05 同意版本 ACTIVE（D-13g） | — |
| 5 | **每日知識更新**與完整安全 | B-009 → B-011b | — |
| 6 | 完整 E2E（release 模式）→ 發布 | J-003 → J-004 | — |

理由：評估是整條流程的第一步且目前完全不可用（一律 `KNOWLEDGE_UNAVAILABLE`），所以 B-011a、B-010 與知識審核排在最前；B-011a 先做可避免 B-010／B-005／B-006 各自實作 session 驗證、事後返工。B-009 屬 MVP 必要，排在使用者流程之後但在最終驗收之前。

---

# Dependency Flow

```text
A-004 ✅ ─┬─→ A-003-r2（已驗證座標）──────────────┐（真實 DISTANCE 案例）
          └─→ A-005（QA 案例）──────────────────┐ │
B-004 ✅ ─┐                                      │ │
B-008 ✅ ─┼─→ B-008-r2 ─→ J-003 首次知識發布      │ │
          ├─→ B-011a ─┬─→ B-010（規則引擎＋知識）│ │
          │           └─→ B-005 ─→ B-006         │ │
          └─→ B-009（每日 00:10）─→ B-012 ─→ C-006（管理頁面）
J-002-r6／r8 契約（D-18、D-19）─┬─→ A-006、A-007（資料，可立即開始）
                      ├─→ B-013（B-012-r3 之後）─┐
                      └─→ C-007（Mock）──────────┴─→ J-003 路由＋同機構對照案例
                      ├─→ B-014（B-013 之後）─→ C-008 真實接線
                      └─→ C-008（Mock）、C-009（前端，可立即開始）
B-005＋B-006＋B-010 ─→ B-011b                    │ │
C-004 ✅ ─→ C-005（Mock）                        │ │
J-002：D-02、D-03 核准 ✅ ＋ B-008-r2 ─→ J-003 首次知識發布 ─→ B-010 真實 smoke
全部必要模組＋A-005＋A-003-r2 ─→ J-003 完整 E2E（release）─→ J-004 release
```

關卡：

- 首次知識發布只依賴 D-02、D-03 核准（完成）＋B-008-r2，不等待最終 E2E，避免與 B-010 循環。
- B-006 依賴 B-005（Lead 需驗證 recommendationId），B-005 不依賴 B-006。
- D-01a、D-02a、D-03、D-04、D-13、D-14 已於 2026-09-24 核准；仍為 PROPOSED 的只有 D-05（法務）、D-06（接件人），相關正式驗收需等它們。
- 同意版本 ACTIVE（D-05）是正式收集座標與正式開放服務的條件，不是 C-005 開發的前置。

---

# 待 Jerry 決定

2026-09-24 已核准：D-01a、D-02、D-02a、D-03、D-04、D-10 延伸、D-13a–g、D-14a–b（[PR #31 comment 2026-09-24](https://github.com/viz963-1216/Kareo/pull/31#issuecomment-5806704685) 等，見 `docs/MVP_DECISIONS.md`）。

| 狀態 | 事項 |
|---|---|
| 已解除（2026-10-03） | **D-09 原額度阻擋**；預算／告警仍待 J-004 |
| 已完成（2026-09-24） | D-03-v2、規則表 r3、D-15（雲端硬碟資料夾來源）、D-16（管理頁面） |
| 已完成（2026-09-24） | `KP-2026-09-24-002` 6 筆核准；來源 `SR-2026-09-24-01` 核准；接件人蘇子傑（週一至週五 09:00–21:00），不設備援 |
| 待輸入 | D-05 草案及蒐集者蘇子傑已補；客服信箱 viz963@gmail.com，處理地區／刪除／最終審閱待驗（2026-10-03） |

---

# 歷史修正要求（2026-09-27，J-003-r5；新狀態以上方看板為準）

逐項狀態、commit 與可重現命令見 `docs/INTEGRATION_ACCEPTANCE.md`〈交回清單〉。各 PR 上已有 Jerry／Codex 第二輪提示詞與 J-003-r5 留言（2026-09-27），本節只列摘要。

**Engineer A**：#39 補可追溯的已驗證座標（目前 0／30）；缺 Service Area 的類別另列證據缺口。

**Engineer B**（依序）：
1. #36 B-008：審核內容指紋與原子核准；版本成員回填；`/knowledge/status` 讀版本成員；migration 改 `0012_knowledge_version_traceability.sql`。
2. #40 B-005：未取整距離排序；Run＋Items 原子寫入；與 #33 的型別衝突；migration 改 `0013_recommendation.sql`；推送前先 pull J-003 的路由 commit `e867dbb`。
3. #37 B-009：原始快照保存；同一表示法比較；migration 改 `0014_crawler_runs.sql`、`0015_crawler_hash_traceability.sql`。
4. #33 B-010（#36 合併後）：快照改讀 `knowledge_version_records`；更新 4 個 publishVersion 測試。

**Engineer C**：#34 C-005-r2：先 pull J-003 的 staging 同步 commit `599e0a2`；新增兩題選填；移植 e3a065a 的 6 項。

**Jerry（J-003）**：merge 順序依 migration 編號（#33 → #36 → #40 → #37）；唯讀確認 staging 已套用的 migration（`tests/db/detect-applied-migrations.sql`）；B-008 驗證通過後才提出首次知識發布執行步驟。

---

# Milestones（建議目標日期，非已完成承諾）

| 日期 | 目標 |
|---|---|
| 9/26 | B-008-r2 合併 → 首次知識發布（整合環境可用時；D-02、D-03 已於 9/24 核准）；D-04 決定 |
| 9/30 | B-011a 合併；地方知識 KP-2026-09-24-002 審核（9/24 已送審） |
| 10/3 | B-010 合併 → 階段 1 真實初評 E2E；A-003-r2、A-005 合併 |
| 10/7 | B-005 合併 → 階段 2 推薦 E2E；C-005 合併 |
| 10/10 | B-006 合併 → 階段 3 媒合 E2E；D-06 接件人演練 |
| 10/12 | B-009、B-011b 合併；D-05 同意版本 ACTIVE → 階段 4、5 |
| 10/13–10/18 | 完整 E2E（release 模式）、安全、手機驗收與缺陷修復 |
| 10/19 | 功能凍結 |
| 10/20–10/21 | 備份還原、發布演練與 smoke |
| 10/22 | Kareo MVP 交付 |

阻塞時在 PR／Issue 寫出缺少的輸入、責任人及對日期的影響；不得把 Fake／Mock／未發布知識視為正式完成。

---

# Handoff

```text
Engineer A：Provider Data / Research / QA
        ↓ clean / validated data
Engineer B：Backend / Database / Business Logic
        ↓ API Contract
Engineer C：Frontend / UX
```

所有跨模組 Integration 由 Jerry 在 `staging` 完成。Feature PR Merge 到 staging 只能稱為 Module Complete。只有通過 A＋B＋C＋Supabase＋Netlify＋Integration／E2E（release 模式）後，才能稱為 Integrated。

「MVP 完成」必須同時有：正式知識（PUBLISHED）與每日 00:10 自動更新（B-009）、真實評估（含可能適用的制度與補助說明）、可追溯 Provider 資料、依位置精度的確定性推薦（精確位置、行政區、無位置）、可保存並由負責人接件的 Lead、隱私／權限驗收、部署後 E2E、可操作的回復方案。

2026-10-05 本輪補充：J-002-r15 已完成候選全文下載、指紋防竄改及 LOCAL-41；本機 41／41 PASS，非 49 項部署驗收。營運方案已依本人授權有條件核准，D-05 工程條件與正式啟用尚未完成。

2026-10-05 B-015-r1（中心代辦）：客服無 token 權利工具已實作，46 項本機整合通過；雲端套用、真人核對與外部刪除紀錄待後續。驗收文件 docs/acceptance/D05-2026-10-05-privacy-rights.md。

2026-10-05 B-015 更新：PR #81 九項 CI 通過、已合併 staging e5c13c9，0027 已套用現有 Kareo 驗收 DB；沒有執行真實個案權利操作。B-016-r1 補獨立 Netlify Blobs 刪除紀錄、故障拒絕假成功、受保護重套刪除與清理稽核同交易；49／49 LOCAL、後端 748 測試通過。尚須本次 PR CI／雲端部署、排程帳號設定、備份汰換核對與實際回復演練；D-05 DRAFT、Integrated 否。參考 docs/acceptance/D05-2026-10-05-deletion-journal.md，勿把本機 49 項當成部署 49 項。

2026-10-05 J-003-r15：#82 九項 CI 通過並合併 afdf01b，雲端 0028 已套用。PR #82 Private Preview 已建立，登入 Chrome 可看到 DRAFT 同意頁，但自動 marker HTTP 401，公開站仍 8f509c0。兩次 runner 均沒執行案例，本輪部署驗收採計 0／49；預設分支／Secrets／個人 DATA_STEWARD 及每日實跑仍待完成。詳見 docs/acceptance/J003-2026-10-05-journal-and-deployment.md，Gemini 提示詞已更新。

2026-10-07 J-002-r16：新增七筆官方來源差異核對，未修改雲端審核狀態；正式同意全文／ACTIVE 三版本接線與前端阻擋已實作。本機合成 Chrome 可進入評估，50／50 HTTP 檢查 PASS；真實 D-05 仍 DRAFT、49 項部署 E2E 不新增 PASS。證據：[D-05 接線](../docs/acceptance/D05-2026-10-07-consent-binding.md)、[七筆來源核對](../docs/acceptance/J002-2026-10-07-seven-source-comparisons.md)。

2026-10-07 J-003-r26：私人部署已操作資源／制度資訊的部分 UI；新增受保護同源 GET 驗收入口，不建立 Session。完整案例仍待驗證，詳見 docs/acceptance/J003-2026-10-07-public-browser.md。

2026-10-07 J-003-r27：私人部署 runtime 前後 marker 實跑一致；E2E-21 真正404 JSON PASS，該 SHA／網址完整49清單仍48 PENDING。原始 GET 證據已保存；公開站仍8f509c0，不把其他版本／本機測試混入。D-05 DRAFT，Integrated 否。

2026-10-07 J-004-r7：新增個人 DATA_STEWARD 保護的唯讀刪除觀察工具；11項安全回歸通過。它不刪除雲端資料或紀錄、不替代真人核對與實體還原、不授權 D-05 ACTIVE。雲端執行結果另記 [r7報告](../docs/acceptance/J004-2026-10-07-erasure-readiness.md)。

2026-10-07 J-004-r8：真實雲端唯讀觀察成功，2筆journal／2筆DELETED，健康／接洽／聯絡0；前後10筆Session內容摘要、清理4／權利0筆數相同。沒有purge、實體restore、ACTIVE或E2E新增。真人合成案例已準備，仍待本人演練；備份退役與完整發布未完成。

2026-10-08 J-004-r13／A-008-r2～r3：官方名冊擴充已合併；原36保留，總800（居服199、居護3、輔具581、中心／分站17），公版分類與中心服務同步。來源及未特約／空白區域如實保留。

2026-10-08 J-004-r15／A-008-r4：以新北衛生局轉介之1151007居服名冊全366筆為依据，318新增／48合併；原800及原範圍不變，新增1394範圍。總1118（居服517，其中1暫停派案停用；居護3、輔具581、中心17）。四間跨縣市所在地只收錄有直接證據的新北服務。驗證與雲端／網站實際執行狀態見 [本輪報告](../docs/acceptance/J004-2026-10-08-ntpc-home-care.md)。居護全名冊／輔具未知範圍、正式D-05／J-003／J-004发布驗收仍待完成。

2026-10-08 r15 收尾：#109 已合併，驗收 Supabase 差額匯入完成且逐欄讀回一致；原800及子表保留，總1118／ACTIVE1117，新北官方居服可用365。公開 Pages 真實資料快照已發布，實際操作新北365／板橋159與DB一致；非瀏覽器即時DB查詢。八項CI、50項LOCAL HTTP及71項資料QA通過，完整正式發布仍待驗。詳見 [實際執行證據](../docs/acceptance/J004-2026-10-08-ntpc-home-care.md#executed-closeout--2026-10-08)。
