# TASK-B-012 — Admin Knowledge Review API（知識審核與發布 API）

Owner: Engineer B — Backend  
Status: QUEUED — 依賴 B-008-r2、B-009、B-011a；未見提交  
Plan revision: 2026-09-24 / J-002-r4（MVP_DECISIONS D-16，Jerry 核准）

## Goal / 目標

讓 Jerry 不必下指令，就能在管理頁面（C-006）完成「看每日變更 → 核准／退回 → 按下發布」，讓知識一直維持最新（PRODUCT_SPEC §42–43）。本任務提供受保護的後端 API；畫面由 C-006 負責。

規則不變：**crawler 與管理頁面都不會自動核准或發布**；只有 Jerry 按下核准／發布才生效。內容文字與 `ruleData` 仍由內容包（contracts/knowledge）提供，管理頁面不編輯政策內容。

## Prerequisite / 前置條件

- B-008-r2 已合併（版號、失效紀錄、多內容包發布，D-03-v2）。
- B-009 已合併（KnowledgeChange、CrawlerRun 有資料可看）。
- B-011a 已合併（共用錯誤碼、token 驗證模式）。

## 規格（API_CONTRACT §26，D-16）

- 身分驗證：沿用 `InternalOperator`（DATA_MODEL §36）。操作者以個人密鑰換取短效管理 token（`POST /api/v1/admin/session`，15 分鐘，只存雜湊）；只有 `KNOWLEDGE_PUBLISHER` 角色可呼叫知識管理 API。不另建帳號系統、不使用共用帳號。
- 端點：

| 方法與路徑 | 用途 |
|---|---|
| `POST /api/v1/admin/session` | 以操作者密鑰換取管理 token |
| `GET /api/v1/admin/knowledge/status` | 目前 PUBLISHED 版本、最近一次 CrawlerRun 結果 |
| `GET /api/v1/admin/knowledge/changes?status=NEEDS_REVIEW` | 每日偵測到的變更（來源、時間、新舊雜湊、差異摘要） |
| `GET /api/v1/admin/knowledge/records?status=NEEDS_REVIEW` | 已匯入、待核准的紀錄 |
| `POST /api/v1/admin/knowledge/records/{id}/decision` | 核准或退回單筆（`APPROVED`／`REJECTED`，必填原因） |
| `POST /api/v1/admin/knowledge/publish` | 發布：指定版號，依 D-03-v2 規則（帶入前版仍有效紀錄）；需二次確認欄位 `confirm: true` |
| `POST /api/v1/admin/knowledge/withdraw` | 撤回目前版本（必填原因，可指定恢復的上一版） |
| `POST /api/v1/admin/knowledge/changes/{id}/dismiss` | 標記變更不影響內容（例如頁面排版改變），必填原因 |

## Allowed Paths

```text
/apps/api/**
/services/**
```

## Deliverables

- 上表端點、管理 token、角色檢查、所有操作寫入稽核紀錄（誰、何時、做了什麼、原因）
- 發布與撤回沿用 B-008 的 service 與 `publish_knowledge_version`／`withdraw_knowledge_version`（D-10），不另寫一套
- `netlify.toml` 路由由 J-003 補；API 回應不得被快取（`Cache-Control: no-store`）
- 失敗行為：無權限 → `FORBIDDEN`；token 過期 → `SESSION_INVALID`；發布條件不符 → `VALIDATION_ERROR`，資料不變

## Acceptance Criteria

- [ ] 無 token、錯誤密鑰、非 `KNOWLEDGE_PUBLISHER` 角色一律被拒
- [ ] 核准只影響指定紀錄；未核准紀錄無法被發布（測試證明）
- [ ] 發布後 `GET /api/v1/knowledge/status` 顯示新版本；前版仍有效的紀錄被帶入（D-03-v2）
- [ ] 撤回後回到上一版或 `KNOWLEDGE_UNAVAILABLE`，不刪資料
- [ ] 每個寫入操作都有稽核紀錄；log 不含密鑰或 token
- [ ] 限流與 payload 上限沿用 B-011 元件
- [ ] 單元／整合測試通過；不連正式資料庫測試

## Not In Scope

編輯政策內容或 `ruleData`、自動核准、多人審核流程、一般使用者帳號、Provider 管理。

## Submission / Completion

Branch：`feat/b-012-admin-knowledge-api`　Submission Version：`B-012-r1`　PR → `staging`
PR Title：`[B-012] Admin Knowledge Review API`

## 變更紀錄

- 2026-09-24 J-002-r4：依 Jerry 核准（D-16）建立。
