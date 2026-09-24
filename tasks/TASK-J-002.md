# TASK-J-002 — MVP Decisions + Knowledge + Privacy / Lead / Location Specifications

Owner: Jerry  
Status: 進行中。r1／r2 已合併（PR #19）、r3 已合併（PR #28）、**r4 送審中**（`docs/j-002-mvp-alignment`）。合併≠核准：各項核准狀態見 `docs/MVP_DECISIONS.md`  
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

- [x] Assessment 方式：規則引擎（D-01 SPEC-APPROVED）與規則表 `docs/ASSESSMENT_RULES.md`（r2 PROPOSED，含補助說明模板與知識對應）。**不再**選擇 AI provider／model、不購買 token（已被 D-01 取代）。
- [x] 補助說明：模板、內容對應與 contract（ASSESSMENT_RULES §6.3–§6.4、API_CONTRACT §8 summary 格式、Mock fixture）。
- [x] 位置流程：API_CONTRACT §8–§9、DATA_MODEL §7／§9／§17／§20、ARCHITECTURE §7；原始規格未決定的細節列為 D-13a–g（每項附建議）。
- [x] 位置用途、保存與同意告知草案（PRIVACY_AND_RETENTION §2、§8，DRAFT）。
- [x] `docs/knowledge/source-registry.md` 與 `contracts/knowledge/` 首批內容包、格式、匯入／發布／撤回規則（D-02a、D-03 PROPOSED；D-02 內容 NEEDS_REVIEW）。
- [x] Session 安全、隱私保存、Lead 接件規格（D-04、D-05、D-06 PROPOSED）。
- [x] `docs/MVP_TRACEABILITY.md`：每項原始需求 → 使用者行為 → 任務 → 前置 → 驗收 → 證據／狀態。
- [x] **首批知識逐筆審核**（D-02）：2026-09-24 Jerry 全部核准（9／9），內容包逐筆 `review` 已填；PR #31 留言為審核證據。發布由 J-003 執行。
- [ ] **地方補助知識**（臺北市、新北市）與新北市來源補齊：以新內容包 `KP-*-002` 提交（NEEDS_REVIEW），不改寫既有內容包。目標 9/30。
- [ ] 取得「待 Jerry 決定」清單的決定，把真實證據連結填入 MVP_DECISIONS；決定若改變 contract，更新 contract／fixture 並通知下游。
- [ ] 法務確認（D-05 L-1～L-6）後把同意版本改為 ACTIVE（含位置告知）。

未決定的事項不得用「之後再決定」解鎖依賴；PROPOSED 只允許可逆實作。

## Target

9/24：D-02 審核（完成）；9/26：D-03／D-04 決定；9/30：地方補助知識、D-13／D-14 決定。目標日期不代表已完成或外部審查已取得。

## Submission / Completion

從最新 `staging` 建立分支（r4：`docs/j-002-mvp-alignment`），PR → `staging`，不得直接 push staging/main，不自行合併或部署。
Submission Version 從 `J-002-r1` 起，退回後遞增。PR 必填 Added / Changed / Fixed / Known Issues / Tests or QA / Scope Check。

PR Title：`[J-002] <本次修正摘要>`（r4：`[J-002] Align tasks and acceptance with original MVP`）

## 變更紀錄

- r1（PR #19）：MVP 決策、知識包、隱私、Lead 營運、session 安全規格。
- r2（PR #19）：Assessment 改規則引擎（D-01）；D-10 原子寫入。
- r3（PR #28）：恢復原始 MVP 範圍、分離提案與核准狀態、需求追蹤表。
- r4：D-08／D-11／D-12 標示未核准、已擱置（依原始 MVP 開發）；補助說明模板與 contract；位置流程統一與 D-13a–g／D-14a–b 建議；清理 AI 指示；任務狀態、依賴與驗收整併。
