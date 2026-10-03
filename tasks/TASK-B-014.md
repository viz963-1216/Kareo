# TASK-B-014 — Public Knowledge Records API（公開長照資訊查詢 API）

Owner: Engineer B — Backend  
Status: IN REVIEW（#67，B-014-r2 `9b6e822`）；限流、B-012 介面同步、J 路由與真實查詢待完成
Plan revision: 2026-10-03 / J-002-r13

## Goal / 目標

提供 `GET /api/v1/knowledge/records`：不需 session，讓使用者瀏覽目前已發布、今天有效的長照制度與補助資訊。

## Prerequisite / 前置條件

- B-008（`knowledge_version_records`）已合併。
- 真實資料需要第一個 PUBLISHED 版本（J-003 首次發布）；沒有時依契約回 `KNOWLEDGE_UNAVAILABLE`。

## Allowed Paths

```text
/apps/api/**
```

`netlify.toml` 路由由 J-003 補（`/api/v1/knowledge/records` 放在 `/api/*` 404 之前）。

## Deliverables

- 新 function 處理 `GET /api/v1/knowledge/records`，參數、排序、分頁、回應欄位、錯誤完全依 API_CONTRACT §13a。
- 讀取目前 PUBLISHED 版本的 `knowledge_version_records` 快照，篩選今天（Asia/Taipei）有效的紀錄；與 Assessment 的 knowledge resolver 共用「目前版本」與「有效期間」判斷，不另寫一套。
- `source.title`／`source.publisher`／`source.url` 依 §13a 對照；`KAREO_DRIVE` 來源 `url = null`。
- 只讀；不回 `ruleData`、原文、雜湊、內容指紋、狀態、內容包或審核欄位。
- 限流沿用 B-011 元件（120 次／小時，ARCHITECTURE §20.4）；元件未完成時列為 Known Issue。

## Acceptance Criteria

- [ ] 回應格式與 `contracts/mock/knowledge/*-response.json` 相同（J-003 以 fixtures 對照）
- [ ] 沒有 PUBLISHED 版本回 `KNOWLEDGE_UNAVAILABLE`（503）
- [ ] 只回目前版本、今天有效的紀錄：測試涵蓋尚未生效、已失效、被取代（SUPERSEDED）、未發布（APPROVED／NEEDS_REVIEW）四種都不出現
- [ ] 回應不含內部欄位（測試證明）；`KAREO_DRIVE` 來源沒有網址
- [ ] 各種錯誤參數回 `VALIDATION_ERROR`
- [ ] `npx tsc --noEmit`、`npx vitest run` 通過；不連正式資料庫

## Not In Scope

個人資格判斷、金額計算、搜尋全文、未發布內容、管理功能。

## Submission / Completion

Branch：`feat/b-014-knowledge-records-api`　Submission Version：`B-014-r1`　PR → `staging`，引用 Issue #49  
PR Title：`[B-014] Public knowledge records API`

## 變更紀錄

- 2026-10-01 J-002-r8：依 D-19 Q3 建立。

## J-002-r13 收尾順序（2026-10-03）

B-012／B-011b 到位後同步 staging，repository 同時保留內容包方法與 findPublicKnowledgeRecords；測試 KnowledgeVersion 補齊 withdrawnAt／withdrawnBy／withdrawalReason。接上共用限流（120 次／小時、429／Retry-After、不記明文 IP／查詢條件），J-003 補 knowledgeRecords 路由。Kareo 已有 KB-2026-09-24-001（21 筆），但仍須在部署後驗證 §13a／E2E-48；不把分支環境沒有資料寫成整個 Kareo 尚未發布。
