# TASK-J-002 — MVP Decisions + Knowledge + Privacy / Lead / Location Specifications

Owner: Jerry  
Status: r1–r4 已合併（PR #19、#28、#31）；r5（臺北市地方知識）送審中。合併≠核准：各項核准狀態見 `docs/MVP_DECISIONS.md`  
Plan revision: 2026-09-23 / J-002-r4 / 10-22 MVP

## Goal / 目標

讓產品規格、架構、資料契約、A／B／C／J 任務與驗收要求一致，維持**原始 MVP**（PRODUCT_SPEC）＋Jerry 已核准變更（目前：D-01 規則引擎、D-10 Provider 匯入原子寫入），不縮減、不擴增範圍。交付 B／C 開發需要的規格，以及首批經審核的官方知識內容。

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
- [x] Session 安全（D-04 已核准）、隱私保存（D-05 PROPOSED，法務待確認）、Lead 接件規格（D-06 PROPOSED，人選待指定）。
- [x] `docs/MVP_TRACEABILITY.md`：每項原始需求 → 使用者行為 → 任務 → 前置 → 驗收 → 證據／狀態。
- [x] **首批知識逐筆審核**（D-02）：2026-09-24 Jerry 全部核准（9／9），內容包逐筆 `review` 已填；審核證據：[PR #31 comment 2026-09-24](https://github.com/viz963-1216/Kareo/pull/31#issuecomment-5806103227)。發布由 J-003 執行。
- [x] **地方知識**：`KP-2026-09-24-002`（臺北市 2 筆、新北市 4 筆，2026-09-24 核准）、來源登錄 `SR-2026-09-24-01`、規則表 r3（修正 S-LOCAL-*）已提交（2026-09-24）。官方頁面未找到地方現金加碼補助。
- [x] Jerry 核准 `KP-2026-09-24-002`（6 筆）與新來源（2026-09-24）。
- [x] 規則表 r3、D-03-v2、D-15（雲端硬碟資料夾來源）、D-16（管理頁面）核准（2026-09-24）。
- [x] 讀取雲端硬碟 8 個檔案（Jerry 下載提供），整理 `KP-2026-09-24-003`（2 筆 NEEDS_REVIEW）；Source Registry 補登並註記各檔狀態（2026-09-24）。
- [x] Jerry 審核：KR-2026-016 核准、017 退回、018 核准；規則表 r4、r5（D-17、D-17a）確認（2026-09-24）。
- [x] 提供 C-006 用的 `contracts/mock/admin/` fixtures（2026-09-24）。
- [x] 臺北市輔具／喘息地方流程：開啟社會局附件整理為 `KP-2026-09-24-005`（4 筆）（2026-09-24）。
- [x] Jerry 核准 `KP-2026-09-24-005`（4 筆）、4 個新來源與規則表 r6（2026-09-24）。
- [x] PR #35 查核：KR-2026-019～021 summary／ruleData 與 excerpt 不一致，已修正並回到 NEEDS_REVIEW；規則表 r7 提案（2026-09-24）。
- [x] 4 份原文本機逐頁、逐格核對（2026-09-25）：SHA-256 相符；KR-2026-019、021 內容無誤；KR-2026-020 補品項旗標（評估／居家限定／批次上限）與 `copayAtOrAboveMax`；KR-2026-022 無誤。
- [ ] Jerry 重新核准 KR-2026-019～021 與規則表 r7。
- [x] 取得「待 Jerry 決定」清單的決定（2026-09-24 第 1–8 項核准，[PR #31 comment 2026-09-24](https://github.com/viz963-1216/Kareo/pull/31#issuecomment-5806704685)），證據連結已填入 MVP_DECISIONS。
- [ ] D-09 Netlify 額度（Jerry：日後補充）。
- [ ] 法務確認（D-05 L-1～L-6）後把同意版本改為 ACTIVE（含位置告知）。Jerry 2026-09-24 指示暫不填。
- [x] 主要接件人：蘇子傑，09:00–21:00（LEAD_OPERATIONS §2、§5）。
- [x] 接件服務日別：週一至週五；不設備援接件人（2026-09-24）。

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
- r4（PR #31）：D-08／D-11／D-12 標示未核准、已擱置（依原始 MVP 開發）；補助說明模板與 contract；位置流程統一與 D-13a–g／D-14a–b 建議；清理 AI 指示；任務狀態、依賴與驗收整併。
