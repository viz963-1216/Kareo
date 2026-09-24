# TASK-B-010 — Production Assessment Engine（規則引擎＋正式知識接線）

Owner: Engineer B  
Status: QUEUED — 依賴 B-011a（B-003、B-008 已合併）；未見提交  
Plan revision: 2026-09-23 / J-002-r4 / 10-22 MVP

## Goal / 目標

讓使用者完成**真實**的免費初評，取得可能需要的服務、可能適用的制度與補助說明，以及下一步（PRODUCT_SPEC §1、§3、§14–16、§33–34、§44、§50–51）：

- 依 `docs/ASSESSMENT_RULES.md`（`RULES-2026-09-23-r2`）實作確定性規則引擎，取代線上的 Fake Adapter（D-01 SPEC-APPROVED：MVP 不使用 AI）。
- 線上 `assessment` function 接上 B-008 的 **PUBLISHED Knowledge resolver**，取代 `NullKnowledgeVersionResolver`。
- `summary` 依 §6 模板產生，包含補助說明（S-SUB-*）與地方資訊（S-LOCAL-*）；**所有政策數值只從 PUBLISHED Knowledge 讀取**。
- `location` 依 API_CONTRACT v0.2.2 §8 的 precision 規則驗證：`NONE`／`CITY` 可以完成評估。

既有介面名稱含 AI（例如 `CareAssessmentAIAdapter`）不需重新命名，本任務不做命名重構。

## Prerequisite / 前置條件

- B-003、B-008 已合併（完成）。
- **B-011a 已合併**（session token 與共用錯誤碼；避免與本任務同時修改 `assessment` function）。
- 規則表 D-01a r2 已核准（2026-09-24）；日後規則表修改時同步調整測試。
- 自動測試使用明確標示的 fixture 知識；真實 smoke 需要環境中已發布的正式知識（D-02 核准＋J-003 首次發布）。未就緒時在 PR 明列阻塞。

## 開始前必讀

`AGENTS.md`、`docs/PRODUCT_SPEC.md`、`docs/ASSESSMENT_RULES.md`、`docs/API_CONTRACT.md`（§8、§15）、`docs/DATA_MODEL.md`（§7、§9、§24–26）、`contracts/knowledge/README.md`、`docs/GIT_RULES.md`、`tasks/README.md`。
高順位規格優先；本任務不自行定義新欄位、API 或產品規則。

## Allowed Paths / Forbidden Paths

Allowed: `/apps/api/**`、`/services/**`
Forbidden: 所有未列出的路徑；不得提交 secret、真實個資或更改其他模組業務邏輯。

## Deliverables

- 規則引擎（ASSESSMENT_RULES §2–§5）：YES／NO 永遠優先；結構化規則與關鍵字只補充 UNKNOWN；否定詞處理。
- Summary（§6）：模板組成、`\n` 分段、固定順序；S-ELIG-*、S-SUB-*、S-LOCAL-*、S-NEXT 依 `ruleData.type`＋jurisdiction 查找 PUBLISHED 紀錄，依 `effectiveFrom`／`effectiveTo` 判斷當下是否適用；缺紀錄時省略該句；S-NEXT 無法產生時回 `KNOWLEDGE_UNAVAILABLE`。
- 地方制度隔離：只讀取使用者縣市（TAIPEI／NEW_TAIPEI）的地方紀錄；缺少時用 S-LOCAL-MISSING，不套用另一縣市。
- `location` 驗證（API_CONTRACT §8）：依 precision 的必填／null 組合；`city` 只接受臺北市、新北市；`GPS`／`EXACT` 的座標依 D-13e 建議約略化後保存。
- 保存 `knowledgeVersion`、`rulesVersion`、`ruleTrace`（DATA_MODEL §7；需要的 migration 屬本任務）；不保存關鍵字命中片段；log 不含 freeText 或座標。
- 線上 function 組裝規則引擎＋PUBLISHED resolver；staging／production 不得組裝 Fake Adapter 或 Null resolver（Fake 只可用於自動測試）。
- 失敗行為：資料庫、resolver 或知識查詢失敗 → `KNOWLEDGE_UNAVAILABLE` 或 `INTERNAL_ERROR`，不寫入 COMPLETED Assessment，不回成功格式的預設結果。

## Acceptance Criteria

- [ ] ASSESSMENT_RULES §9 **T1–T23** 全部實作並通過（含 T20 哨兵測試：程式沒有寫死政策數值）
- [ ] 另測：資料庫失敗、resolver 失敗、無 PUBLISHED 版本、知識版本切換後結果引用新版本
- [ ] 每種 location precision 的合法與非法組合測試；`NONE`、`CITY` 可完成評估
- [ ] 回應格式與 `contracts/mock/assessment-response.json`、`contracts/mock/assessments/WITH-SUBSIDY-NEW_TAIPEI.json` 相容，無 API_CONTRACT §14 禁止欄位，warnings 必定存在
- [ ] 不呼叫任何外部 AI／LLM，不新增相關套件或金鑰
- [ ] 附可重現測試指令；真實 smoke（合成使用者資料＋已發布知識）證據，或明列阻塞；真實環境驗收由 J-003

## Not In Scope

任何 AI／LLM 服務、Provider 排序、前端畫面、補助計算器或個人核定額度、官方資格認定、介面命名重構、撰寫或修改知識內容（屬 J-002）。

## Submission / Completion

從最新 `staging` 建立 `feat/b-010-mvp`，PR → `staging`，不得直接 push staging/main。
Submission Version 從 `B-010-r1` 起，退回後遞增。PR 必填 Added / Changed / Fixed / Known Issues / Tests or QA / Scope Check，逐項附驗收證據；未通過不得標記完成。模組合併不等於全站已上線。

PR Title：`[B-010] Production Assessment Engine`

## 變更紀錄

- 2026-09-19：建立（原為真實 AI adapter）。
- 2026-09-23 J-002-r2：改為規則引擎（D-01 方案 B）。
- 2026-09-23 J-002-r3：補助說明缺口指向 D-12。
- 2026-09-23 J-002-r4：D-12 已擱置；補助說明模板（ASSESSMENT_RULES §6.3）與位置驗證納入本任務主文；新增 T14–T23；前置改為 B-011a；明確承接正式知識接線與失敗行為。
