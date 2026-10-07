# TASK-J-002 — MVP Decisions + Knowledge + Privacy / Lead / Location Specifications

Owner: Jerry  
Status: J-002-r16 正式同意全文／版本接線與新增七筆知識差異核對；D-05 仍 DRAFT，工程啟用及 J-003／J-004 部署驗收待完成
Plan revision: 2026-10-07 / J-002-r16

## Goal / 目標

讓產品規格、架構、資料契約、A／B／C／J 任務與驗收要求一致，維持**原始 MVP**（PRODUCT_SPEC）＋Jerry 已核准變更（以 MVP_DECISIONS 中的 SPEC-APPROVED 項目為準，包括 D-18／D-19 一站式功能），不縮減、不擴增範圍。交付 B／C 開發需要的規格，以及首批經審核的官方知識內容。

## Prerequisite / 前置條件

無（READY）。規格衝突依 AGENTS §1 優先順序；無法判斷時列入 MVP_DECISIONS「待 Jerry 決定」，不自行定案。

## 開始前必讀

`AGENTS.md`、`docs/PRODUCT_SPEC.md`、`docs/ARCHITECTURE.md`、`docs/DATA_MODEL.md`、`docs/API_CONTRACT.md`、`docs/GIT_RULES.md`、`tasks/README.md`。

## Allowed Paths / Forbidden Paths

Allowed: `/docs/**`、`/contracts/**`、`/tasks/**`
Forbidden: 所有未列出的路徑（含 `/apps/**`、`/services/**`、`/tests/**`）；不得提交 secret、真實個資或更改其他模組業務邏輯；不操作正式資料庫、不發布 Knowledge、不部署、不新增付費服務。

## Deliverables / 驗收

- [x] Assessment 方式：規則引擎（D-01 SPEC-APPROVED）與規則表 `docs/ASSESSMENT_RULES.md`（r2，含補助說明模板與知識對應；2026-09-24 核准）。**不再**選擇 AI provider／model、不購買 token（已被 D-01 取代）。
- [x] 補助說明：模板、內容對應與 contract（ASSESSMENT_RULES §6.3–§6.4、API_CONTRACT §8 summary 格式、Mock fixture）。
- [x] 位置流程：API_CONTRACT §8–§9、DATA_MODEL §7／§9／§17／§20、ARCHITECTURE §7；原始規格未決定的細節列為 D-13a–g（每項附建議）。
- [x] 位置用途、保存與同意告知草案（PRIVACY_AND_RETENTION §2、§8，DRAFT）。
- [x] `docs/knowledge/source-registry.md` 與 `contracts/knowledge/` 首批內容包、格式、匯入／發布／撤回規則（D-02a、D-03 已核准；D-02 內容已核准，2026-09-24）。
- [x] Session 安全（D-04 已核准）、隱私保存（D-05 PROPOSED，營運者審閱及工程待確認）、Lead 接件規格（D-06 PROPOSED，人選待指定）。
- [x] `docs/MVP_TRACEABILITY.md`：每項原始需求 → 使用者行為 → 任務 → 前置 → 驗收 → 證據／狀態。
- [x] **首批知識逐筆審核**（D-02）：2026-09-24 Jerry 全部核准（9／9），內容包逐筆 `review` 已填；審核證據：[PR #31 comment 2026-09-24](https://github.com/viz963-1216/Kareo/pull/31#issuecomment-5806103227)。發布由 J-003 執行。
- [x] **地方知識**：`KP-2026-09-24-002`（臺北市 2 筆、新北市 4 筆，2026-09-24 核准）、來源登錄 `SR-2026-09-24-01`、規則表 r3（修正 S-LOCAL-*）已提交（2026-09-24）。官方頁面未找到地方現金加碼補助。
- [x] Jerry 核准 `KP-2026-09-24-002`（6 筆）與新來源（2026-09-24）。
- [x] 規則表 r3、D-03-v2、D-15（雲端硬碟資料夾來源）、D-16（管理頁面）核准（2026-09-24）。
- [x] 讀取雲端硬碟 8 個檔案（Jerry 下載提供），整理 `KP-2026-09-24-003`（2 筆 NEEDS_REVIEW）；Source Registry 補登並註記各檔狀態（2026-09-24）。
- [x] Jerry 審核：KR-2026-016 核准、017 退回、018 核准；規則表 r4、r5（D-17、D-17a）確認（2026-09-24）。
- [x] 提供 C-006 用的 `contracts/mock/admin/` fixtures（2026-09-24）。
- [x] D-16a（[PR #34 comment 5883232266](https://github.com/viz963-1216/Kareo/pull/34#issuecomment-5883232266)）：API_CONTRACT v0.4 §26 補發布預覽、可恢復版本、decision／dismiss／withdraw 完整回應與 `KNOWLEDGE_STATE_CHANGED`；ARCHITECTURE §20.8 更正；DATA_MODEL v0.2.3；`contracts/mock/admin/**` 補成功、空清單與錯誤 fixtures（2026-09-29）。
- [x] 臺北市輔具／喘息地方流程：開啟社會局附件整理為 `KP-2026-09-24-005`（4 筆）（2026-09-24）。
- [x] Jerry 核准 `KP-2026-09-24-005`（4 筆）、4 個新來源與規則表 r6（2026-09-24）。
- [x] PR #35 查核：KR-2026-019～021 summary／ruleData 與 excerpt 不一致，已修正並回到 NEEDS_REVIEW；規則表 r7 提案（2026-09-24）。
- [x] 4 份原文本機逐頁、逐格核對（2026-09-25）：SHA-256 相符；KR-2026-019、021 內容無誤；KR-2026-020 補品項旗標（評估／居家限定／批次上限）與 `copayAtOrAboveMax`；KR-2026-022 無誤。
- [x] Jerry 重新核准 KR-2026-019～021 修正版與規則表 r7（2026-09-25）。
- [x] ~~洽臺北市政府社會局確認~~（Jerry 2026-09-25 決定不洽詢，依原文現況直接核准）：(a) 115 年項目表公告文號與生效日；(b) 購置金額等於或高於品項上限時是否扣部分負擔；(d)「其他政府機關相同性質之補助」是否含中央長照輔具給付。確認前結果頁不寫出這些情形的金額。
- [x] 取得「待 Jerry 決定」清單的決定（2026-09-24 第 1–8 項核准，[PR #31 comment 2026-09-24](https://github.com/viz963-1216/Kareo/pull/31#issuecomment-5806704685)），證據連結已填入 MVP_DECISIONS。
- [x] **r6（2026-10-01）D-16b**：B-012 內容包登錄、逐筆審核紀錄、發布序列化與 pglite 依賴（Jerry 決定，[PR #48 comment 5925628146](https://github.com/viz963-1216/Kareo/pull/48#issuecomment-5925628146)）；DATA_MODEL §26b–26c、ARCHITECTURE §22 第 8–9 點、API_CONTRACT §26.8、contracts/knowledge/README §4。
- [x] **r6（2026-10-01）D-18 公開資源查詢**（[Issue #49](https://github.com/viz963-1216/Kareo/issues/49)）：PRODUCT_SPEC v0.7 §1／§14a／§19／§53–55、API_CONTRACT v0.5 §10a／§10、DATA_MODEL v0.2.4 §17／§19、ARCHITECTURE v0.5.3 §7.1／§20.4、`contracts/reference/service-districts.json`、`contracts/mock/providers/lookup/`（含 `validate-fixtures.mjs`）、TASK-A-006／B-013／C-007、MVP_TRACEABILITY §5。
- [x] Jerry 核准 D-18a–e（2026-10-01，[PR #50 comment 5925833841](https://github.com/viz963-1216/Kareo/pull/50#issuecomment-5925833841)）；r6 已合併（#50）。
- [x] Jerry 已回答 D-19 Q1–Q5、Q7，A-007／B-014／C-008／C-009 已建立；提交與整合狀態見 tasks/README。
- [x] **r8（2026-10-01）D-19**：Jerry 決定 Q1–Q5、Q7（[Issue #49 comment 5926683690](https://github.com/viz963-1216/Kareo/issues/49#issuecomment-5926683690)）；PRODUCT_SPEC v0.8 §13／§14a–c、API_CONTRACT v0.6（§10／§10a 追加、§13a）、DATA_MODEL v0.2.5（§17、§19b）、ARCHITECTURE v0.5.4（§7.1、§9.1、§10、§20.4）、`contracts/mock/knowledge/`、lookup fixtures 追加、TASK-A-007／B-014／C-008／C-009 與 A-006／B-013／C-007 追加。
- [x] Jerry 核准 PRODUCT_SPEC §14b 建議問題文字（2026-10-01，[PR #54 comment 5927605020](https://github.com/viz963-1216/Kareo/pull/54#issuecomment-5927605020)）；r8 已合併（#54）。
- [x] D-09 原額度阻擋已解除（J-003 10/03 真實部署證據）；監控與正式發布仍由 J-004 驗收。
- [ ] Jerry 審閱具體營運方案與文案、工程啟用條件具備證據後，把同意版本改為 ACTIVE（含位置告知）。2026-10-05 營運方案及候選全文有條件核准；工程條件未完成，不填虛構法務結果。
- [x] 主要接件人：蘇子傑，09:00–21:00（LEAD_OPERATIONS §2、§5）。
- [x] 接件服務日別：週一至週五；不設備援接件人（2026-09-24）。
- [x] **r13（2026-10-03）**：D-05a 資料保存／Lead 關聯與清理計數、D-16c 匯入操作者／未登錄舊包不可變規則、B-013 範圍矛盾及最新任務狀態已同步。交付證據與交回要求見 docs/acceptance/J002-2026-10-03-spec-closeout.md。

未決定的事項不得用「之後再決定」解鎖依賴；PROPOSED 只允許可逆實作。

## Target

9/24：D-02 審核（完成）；9/26：D-03／D-04 決定；9/30：地方補助知識、D-13／D-14 決定。目標日期不代表已完成或外部審查已取得。

## Submission / Completion

從最新 `staging` 建立分支（r4：`docs/j-002-mvp-alignment`；r5：`docs/j-002-taipei-local-knowledge`），PR → `staging`，不得直接 push staging/main，不自行合併或部署。
Submission Version 從 `J-002-r1` 起，退回後遞增。PR 必填 Added / Changed / Fixed / Known Issues / Tests or QA / Scope Check。

PR Title：`[J-002] <本次修正摘要>`（r4：`[J-002] Align tasks and acceptance with original MVP`）

## 變更紀錄

- r1（PR #19）：MVP 決策、知識包、隱私、Lead 營運、session 安全規格。
- r2（PR #19）：Assessment 改規則引擎（D-01）；D-10 原子寫入。
- r3（PR #28）：恢復原始 MVP 範圍、分離提案與核准狀態、需求追蹤表。
- r5：臺北市地方知識（KP-2026-09-24-005）、規則表 r6 提案。
- r8（2026-10-01）：D-19 一站式功能定案（特約縣市、輔具資源中心、長照資訊查詢、需求摘要只在前端產生、Kareocar 常駐入口；住宿機構延後）。
- r7（2026-10-01，#51）：D-18a–e 標示核准。
- r6（2026-10-01）：資源查詢與個案推薦分離（D-18）、一站式缺口盤點（D-19）、B-012 內容包規則（D-16b）；更正過時狀態（座標 30／30、KR-019～021 已重新核准）。
- r4（PR #31）：D-08／D-11／D-12 標示未核准、已擱置（依原始 MVP 開發）；補助說明模板與 contract；位置流程統一與 D-13a–g／D-14a–b 建議；清理 AI 指示；任務狀態、依賴與驗收整併。

- r13（2026-10-03）：依 Jerry「好那先幫我完成J002」授權完成工程定案；七天內清理保留原期限、首次知識發布／Netlify 狀態更新，不修改 DRAFT 或法律審閱結果。

## J-002-r14：D-05 營運者審閱提案（2026-10-05）

依 Jerry 最新要求，查核官方個資法、施行細則、電子簽章法及供應商公開委託資料，提出 L-1／L-3／L-6、境外資料流及權利處理方案；新增固定三文案全文及 SHA-256，核准欄位保持空白。見 `docs/acceptance/D05-2026-10-05-owner-review.md`。本輪不啟用 ACTIVE、不宣稱法務意見、D-05 完成或正式發布。Gemini 前端／驗收部署提示詞已交付；每日排程與 49 項證據由 Codex 接續。

## J-002-r15：有條件核准與固定全文取出（2026-10-05）

Jerry 授權依適用法規與同類平台做法通過審閱，記錄營運方案有條件核准、日期精度、固定全文指紋與真實 GitHub 證據；不新增 ACTIVE 或宣稱法律認證。建置候選全文下載及指紋驗證，隱私頁提供入口；仍待正式同意與權利工具、備份刪除紀錄、排程及部署回歸。

本輪中心整合範圍依 Jerry 持續完成 ABCJ 與 D-05 的授權，包含 `/apps/web/**` 的草案狀態文案與候選下載連結、前端 npm 建置鉤子、`/scripts/**` 的全文輸出與檢查、`/tests/**` 的實際 HTTP 與指紋負向驗證，以及根 `.gitignore`。這是 J 負責的本輪跨模組整合授權；不更改 A／B／C 的一般 Ownership 或所有 Task 的 Allowed Paths。未改 API、資料庫 schema、實際同意版本狀態或套件版本。

本輪驗證：前端 78 PASS；全文輸出負向測試 1 PASS；根目錄正式建置 PASS；真實 PostgreSQL／PostgREST 本機整合 41／41 PASS（新增 LOCAL-41 取回全文的位元組及指紋）。報告 `docs/acceptance/evidence/D05-2026-10-05-conditional-review.json` 記錄基底 commit 與 dirty 工作樹，非部署 E2E；PR CI 將驗證提交後的實際 head。

PR #80 乾淨 CI 首次檢查發現測試工具直接呼叫 Vite、未執行 npm prebuild；LOCAL-41 下載取得 SPA HTML，依指紋正確失敗。已修正本機隔離建置以同一個正式全文輸出函式產生暫存下載檔；刪除全部已產生 public 文案後重跑，41／41 PASS。更新報告基底為 `d33160252b06c14595ef74b9502fc168f2d9dd79`、workingTreeDirty=true。先前本機成功依賴已產生檔案，不能替代這次乾淨驗證；合併仍待修正 head CI 通過。
## J-002-r16：正式全文接線與七筆新來源差異（2026-10-07）

依 Jerry「持續完成 ABCJ、繼續執行」的中心整合授權，延續 r15 跨模組範圍：apps/web（同意頁／隱私頁／送出前檢查及 Vite 公開文案 manifest）、scripts（封存驗證）、tests（本機合成 HTTP 整合）、contracts/legal/versions 的格式說明與驗收文件。未修改其他模組業務規則、依賴、API／DB schema 或真實 ACTIVE 狀態。

真實同意送出必須綁定 ACTIVE 清單與核准全文位元組；無文件或不符時，在建立 Session 前拒絕。前端 81／81、根測試 87／87、本機 HTTP 50／50 PASS；本機合成 Chrome 操作可進入評估表單。見 [D-05 接線驗證](../docs/acceptance/D05-2026-10-07-consent-binding.md)。這不是 D-05 正式啟用、法律認證或 49 項部署驗收。

crawler 新增七筆差異的既有選取行仍出現在整頁擷取中；交通頁的乘號差異是 HTML entity。逐筆 ID／雜湊／方法／限制見 [七筆核對](../docs/acceptance/J002-2026-10-07-seven-source-comparisons.md)。未在雲端 dismiss 或批准新全文，不把片段包含當成整頁政策未變。
