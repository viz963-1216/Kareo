# TASK-J-003 — CI + Staging Integration + End-to-End Acceptance

Owner: Jerry  
Status: 進行中。r1（PR #20）、r2／r3（PR #29）已合併：CI、路由、Real API adapter、release gate。**Integrated：否**；完整驗收 FAIL（PENDING 未清）  
Plan revision: 2026-09-19 / 10-22 MVP

## Goal / 目標

在部署環境以真實 API、真實資料與 PUBLISHED 知識，驗證原始 MVP 的每一條使用者行為（`docs/MVP_TRACEABILITY.md` 每一列的「驗收方式」），並記錄可重現證據。C 的 Mock 模組驗收不算本任務的通過。

## Prerequisite / 前置條件

- CI／gate 骨架：已完成（r1–r3）。
- 首次知識發布：D-02 內容核准、D-03 格式核准（2026-09-24 已完成）＋**B-008-r2 合併**（發布版號必須等於 `intendedKnowledgeVersion`）。目標版本 `KB-2026-09-24-001`。不等待最終 E2E，避免與 B-010 循環依賴。
- 階段 E2E（依開發順序逐步開啟，見 tasks/README「建議開發順序」）：B-011a → B-010 → B-005 → B-006 → C-005 → B-009 → B-011b；A-003-r2 提供距離排序的真實案例、A-005 提供推薦案例。
- 部署環境可用（D-09 Netlify 額度；目前暫停）。平台阻擋一律記 PENDING。

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
- [ ] 新 function 的路由（`/api/v1/recommendations`、`/api/v1/leads`、`/api/v1/consent/withdraw`）在 B-005／B-006／B-011b 合併時補上

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

- [ ] 更新 `tests/e2e/acceptance-cases.json`：E2E-05 前置由 D-12 改為 D-01a；E2E-08 前置移除 D-08、改為 A-003-r2＋D-13g；E2E-10 前置改為 D-13b；新增「只有縣市 → CITY_ROTATION」「GPS 拒絕 → 行政區備援」「臺北市／新北市地方補助隔離」「Knowledge 版本切換」案例

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
