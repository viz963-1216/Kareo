# TASK-B-014 — Public Knowledge Records API（公開長照資訊查詢 API）

Owner: Engineer B — Backend  
Status: QUEUED — 契約 API_CONTRACT v0.6 §13a 已核准（D-19 Q3）；B 的工作順序在 B-012-r3、B-013 之後  
Plan revision: 2026-10-01 / J-002-r8（MVP_DECISIONS D-19，[Issue #49 comment 5926683690](https://github.com/viz963-1216/Kareo/issues/49#issuecomment-5926683690)；PRODUCT_SPEC §14c；ARCHITECTURE §9.1）

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
