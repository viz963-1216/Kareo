# TASK-B-010 — Production Assessment Engine（規則引擎）

Owner: Engineer B  
Status: QUEUED（依下列前置條件啟動）  
Plan revision: 2026-09-19 / 10-22 MVP

## Goal / Input

2026-09-23 修訂（J-002-r2）：MVP 不使用 AI（MVP_DECISIONS D-01 方案 B）。本任務改為依 `docs/ASSESSMENT_RULES.md` 實作確定性規則引擎，取代線上目前的 Fake Adapter。

前置：B-003、B-008 已合併；ASSESSMENT_RULES 規則表經 Jerry 確認。自動測試可用明確標示的 fixture；真實 smoke 必須使用環境中已發布的正式知識。

## 開始前必讀

`AGENTS.md`、`docs/PRODUCT_SPEC.md`、`docs/ARCHITECTURE.md`、`docs/DATA_MODEL.md`、`docs/API_CONTRACT.md`、`docs/GIT_RULES.md`、`tasks/README.md`。
高順位規格優先；本任務不自行定義新欄位、API 或產品規則。需要的規格先由 J-002 合併。

## Allowed Paths / Forbidden Paths

Allowed: `/apps/api/**`、`/services/**`
Forbidden: 所有未列出的路徑；不得提交 secret、真實個資或更改其他模組業務邏輯。

## Deliverables / 驗收

- [ ] 依 ASSESSMENT_RULES 實作規則引擎，實作既有 `CareAssessmentAIAdapter` 介面（或同等介面），Assessment Service 與 API 格式不變。
- [ ] 線上 `assessment` function 組裝規則引擎與 B-008 的 PUBLISHED Knowledge resolver；不得再組裝 Fake Adapter 或 NullKnowledgeVersionResolver。
- [ ] 使用者回答 YES／NO 永遠優先；結構化規則與關鍵字只補充 UNKNOWN 項目；否定詞處理依 §4。
- [ ] Summary 只由 §6 模板組成，引用的知識紀錄不在 PUBLISHED 版本時省略該句；無 PUBLISHED 版本回 KNOWLEDGE_UNAVAILABLE。
- [ ] 保存 `rulesVersion` 與每個需求的觸發規則 ID；不保存關鍵字命中片段；log 不含 freeText。
- [ ] 實作 ASSESSMENT_RULES §9 全部 13 個測試案例，另測資料庫失敗、無知識、知識版本變更。
- [ ] 不得呼叫任何外部 AI／LLM 服務，不新增相關套件或金鑰。
- [ ] 附可重現測試指令與一次使用合成資料、已發布知識的 smoke 證據；環境未就緒明列阻塞，由 J-003 完成真實環境驗收。

## Not In Scope

任何 AI／LLM 服務、Provider 排序、前端整合、官方資格認定。


## Submission / Completion

從最新 `staging` 建立 `feat/b-010-mvp`，PR → `staging`，不得直接 push staging/main。
Submission Version 從 `B-010-r1` 起，退回後遞增。PR 必填 Added / Changed / Fixed / Known Issues / Tests or QA / Scope Check，逐項附驗收證據；未通過不得標記完成。模組合併不等於全站已上線。
