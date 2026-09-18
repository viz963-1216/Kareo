# TASK-B-010 — Production Assessment Engine

Owner: Engineer B  
Status: QUEUED（依下列前置條件啟動）  
Plan revision: 2026-09-19 / 10-22 MVP

## Goal / Input

B-003、B-008 已合併；J-002 的 AI 選型/規格與知識內容包已核准。B 實作與自動測試可用明確標示的 fixture；真實 smoke test 必須使用環境中已發布的正式知識。

## 開始前必讀

`AGENTS.md`、`docs/PRODUCT_SPEC.md`、`docs/ARCHITECTURE.md`、`docs/DATA_MODEL.md`、`docs/API_CONTRACT.md`、`docs/GIT_RULES.md`、`tasks/README.md`。
高順位規格優先；本任務不自行定義新欄位、API 或產品規則。需要的規格先由 J-002 合併。

## Allowed Paths / Forbidden Paths

Allowed: `/apps/api/**`、`/services/**`
Forbidden: 所有未列出的路徑；不得提交 secret、真實個資或更改其他模組業務邏輯。

## Deliverables / 驗收

- [ ] 實作 J-002 指定的真實 AI adapter，沿用既有 Assessment contract；正式環境不可選 Fake adapter，也不可在失敗時退回 Fake 成功結果。
- [ ] Assessment 使用 current PUBLISHED Knowledge；保存可追溯的知識版本。無可用版本時依 contract 回 KNOWLEDGE_UNAVAILABLE。
- [ ] 驗證模型輸出 schema、enum、必要欄位及預估/1966 提醒；不合法輸出回受控錯誤，不寫入成功結果。
- [ ] 模型不選 Provider、不輸出未經來源支持的制度結論；將使用者內容當資料，測試誘導忽略規則與不相關輸入。
- [ ] 設定 timeout、有限重試、token/輸入上限及 J-002 核准的費用限制；API key 只在 server env，log 不含健康原文/電話/secret。
- [ ] 測試成功、無知識、知識版本變更、模型逾時、限流、格式錯誤、服務中斷、資料庫失敗；不得把外部失敗偽裝為成功。
- [ ] 附可重現測試指令與一次使用合成資料的真實 adapter smoke 證據（版本、時間、結果，不附 secret）。環境未就緒明列阻塞，由 J-003 完成真實環境驗收後才可釋出。

## Not In Scope

自行選購 AI 服務、Provider 排序、前端整合、官方資格認定。


## Submission / Completion

從最新 `staging` 建立 `feat/b-010-mvp`，PR → `staging`，不得直接 push staging/main。
Submission Version 從 `B-010-r1` 起，退回後遞增。PR 必填 Added / Changed / Fixed / Known Issues / Tests or QA / Scope Check，逐項附驗收證據；未通過不得標記完成。模組合併不等於全站已上線。
