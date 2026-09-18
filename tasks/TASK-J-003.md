# TASK-J-003 — CI + Staging Integration + End-to-End Acceptance

Owner: Jerry  
Status: QUEUED（依下列前置條件啟動）  
Plan revision: 2026-09-19 / 10-22 MVP

## Goal / Input

READY NOW：先建 CI/測試骨架。完整驗收依賴 A-004/A-005、B-003 至 B-008、B-010/B-011、C-002 至 C-005 與 J-002。B-009 不阻擋 MVP。

## 開始前必讀

`AGENTS.md`、`docs/PRODUCT_SPEC.md`、`docs/ARCHITECTURE.md`、`docs/DATA_MODEL.md`、`docs/API_CONTRACT.md`、`docs/GIT_RULES.md`、`tasks/README.md`。
高順位規格優先；本任務不自行定義新欄位、API 或產品規則。需要的規格先由 J-002 合併。

## Allowed Paths / Forbidden Paths

Allowed: `/.github/**`、`/scripts/**`、`/tests/**`、`/docs/**`、`/contracts/**`、`/tasks/**`、root 建置/部署設定；`/apps/web/**`、`/apps/api/**` 僅跨模組 adapter/route/env 接線
Forbidden: 所有未列出的路徑；不得提交 secret、真實個資或更改其他模組業務邏輯。

## Deliverables / 驗收

- [ ] PR CI 執行實際 frontend build、backend tests/typecheck、A-004 data validation 與 contract 相容檢查；記錄指令，缺模組時明列 pending，不以空腳本假通過。
- [ ] PR 不需 production secret；第三方/fork PR 不取得 secret。部署與付費 AI smoke 獨立手動觸發，不因每次 docs commit 消耗部署/AI 額度。
- [ ] 完成 Netlify function routing、環境參數與 frontend Real API adapter；正式模式不能回 Mock 成功資料。產品缺陷回原 owner 修復，不藉整合重寫業務。
- [ ] 依 J-002 已核准內容，使用 B-008 匯入→審核→發布流程，在整合環境建立第一個 PUBLISHED 版本，留下來源、審核與版本證據。未核准資料不得發布。
- [ ] 正式 Provider 匯入前通過 A-004；確認資料列數、關聯與回滾/重新匯入流程。
- [ ] E2E：新 session→Consent→真實 Assessment→Recommendation 0/1/2/3 家→Provider 詳情/Maps→Lead 持久化→內部可查與狀態更新；另驗證 Kareocar 外連。
- [ ] E2E：拒絕/失效同意、GPS 拒絕後行政區路徑、無資料、無知識、AI/API 失敗、網路重試、重複送出、跨 session 存取與限流；不可有假成功。
- [ ] 手機/平板/桌機基本可用性及鍵盤操作；截圖/結果不含真實個資。
- [ ] `docs/INTEGRATION_ACCEPTANCE.md` 記錄 commit、環境、資料/Knowledge 版本、日期、步驟與實際結果。只有全部必要項通過才標記 Integrated；平台額度阻擋時保持 pending。

## Target

9/26 前建立 CI 骨架；10/12 前完成功能接線，10/13–10/18 完整驗收與修正。


## Submission / Completion

從最新 `staging` 建立 `feat/j-003-mvp`，PR → `staging`，不得直接 push staging/main。
Submission Version 從 `J-003-r1` 起，退回後遞增。PR 必填 Added / Changed / Fixed / Known Issues / Tests or QA / Scope Check，逐項附驗收證據；未通過不得標記完成。模組合併不等於全站已上線。
