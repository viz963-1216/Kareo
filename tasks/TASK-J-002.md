# TASK-J-002 — MVP Decisions + Initial Knowledge + Privacy / Lead Specifications

Owner: Jerry  
Status: QUEUED（依下列前置條件啟動）  
Plan revision: 2026-09-19 / 10-22 MVP

## Goal / Input

READY NOW。輸入為現有產品規格與 2026-10-22 MVP 期限。先交付可讓 B/C 開發的規格，再交付首批經審核的官方知識內容。

## 開始前必讀

`AGENTS.md`、`docs/PRODUCT_SPEC.md`、`docs/ARCHITECTURE.md`、`docs/DATA_MODEL.md`、`docs/API_CONTRACT.md`、`docs/GIT_RULES.md`、`tasks/README.md`。
高順位規格優先；本任務不自行定義新欄位、API 或產品規則。需要的規格先由 J-002 合併。

## Allowed Paths / Forbidden Paths

Allowed: `/docs/**`、`/contracts/**`、`/tasks/**`
Forbidden: 所有未列出的路徑；不得提交 secret、真實個資或更改其他模組業務邏輯。

## Deliverables / 驗收

- [ ] `docs/MVP_DECISIONS.md`：選定 Assessment AI provider/model、費用上限、逾時/失敗行為與供應商資料處理條件；不得由 B 猜測或自行購買。若改採規則引擎，先修訂產品/架構規格。
- [ ] `docs/knowledge/source-registry.md` 與 `contracts/knowledge/` 首批內容包：官方原始 URL、管轄地、生效/擷取日期、適用條件、來源摘錄與版本、審核人/日期。涵蓋 MVP Assessment 所需制度，不以測試知識充當正式內容；衝突、過期與未確認項目不得核准。
- [ ] 為 B-008 定義內容包格式、匯入驗證、版本發布/撤回規則；「內容核准」不代表已在資料庫發布，實際發布由 J-003 驗證。
- [ ] `docs/PRIVACY_AND_RETENTION.md` 與對應文案/contract：資料用途、保存期限、聯絡/刪除管道、同意版本與撤回、委外 AI 資料流；列明姓名電話、健康回答、GPS 各自必要性。需要正式法務判斷時列為待確認，不宣稱已合規。
- [ ] 更新 ARCHITECTURE / DATA_MODEL / API_CONTRACT：匿名 session 的持有證明（不可只憑公開 sessionId）、有效期、資源歸屬檢查、濫用限制、重複 Lead 請求處理、刪除策略及錯誤格式。原規格未涵蓋的設計先合併，B-011 才實作。
- [ ] `docs/LEAD_OPERATIONS.md`：指定接件人、查看方式、回覆目標時間、允許的狀態轉移、責任角色與個資存取方式；MVP 可使用受保護內部指令，不要求建立完整 CRM。更新必要 contract/schema 後 B-006 才實作新增操作。
- [ ] 逐項記錄 decision owner / 狀態 / 版本 / 下游任務。不得用「之後再決定」解鎖依賴；可按上述交付物分批 PR。

## Target

9/23 前完成 AI、安全、隱私與 Lead 操作規格；9/26 前完成首批知識內容審核。這是計畫目標，不代表內容已完成或外部審查已取得。


## Submission / Completion

從最新 `staging` 建立 `feat/j-002-mvp`，PR → `staging`，不得直接 push staging/main。
Submission Version 從 `J-002-r1` 起，退回後遞增。PR 必填 Added / Changed / Fixed / Known Issues / Tests or QA / Scope Check，逐項附驗收證據；未通過不得標記完成。模組合併不等於全站已上線。

---

## 2026-09-23 進度（J-002-r3）

- r1／r2 已合併（PR #19）。**合併不代表核准**：各交付的規格核准、內容核准與發布狀態見 `docs/MVP_DECISIONS.md`「交付物核准矩陣」。
- r3 更正：D-07 改為資料缺口（原始 MVP 距離排序不變）、D-08 改為範圍變更提案、B-009 納回 MVP（延後提案 D-11）、補助說明缺口（D-12）、無位置回應（D-13）、新增 `docs/MVP_TRACEABILITY.md`。
- 本任務**未完成**：知識內容 0 筆核准（目標 9/26）、D-02～D-06 未核准、接件人與法務 BLOCKED。
