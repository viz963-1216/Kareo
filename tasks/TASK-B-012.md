# TASK-B-012 — Admin Knowledge Review API（知識審核與發布 API）

Owner: Engineer B — Backend  
Status: IN REVIEW — #48 B-012-r2（`5c81cd1`）：10 個端點完成 8 個；publish-preview／publish 依 D-16b 於 r3 完成  
Plan revision: 2026-10-01 / J-002-r6（MVP_DECISIONS D-16、D-16a、**D-16b**；API_CONTRACT v0.5 §26；ARCHITECTURE §22 第 8–9 點；DATA_MODEL §26b–26c）

## Goal / 目標

讓 Jerry 不必下指令，就能在管理頁面（C-006）完成「看每日變更 → 核准／退回 → 按下發布」，讓知識一直維持最新（PRODUCT_SPEC §42–43）。本任務提供受保護的後端 API；畫面由 C-006 負責。

規則不變：**crawler 與管理頁面都不會自動核准或發布**；只有 Jerry 按下核准／發布才生效。內容文字與 `ruleData` 仍由內容包（contracts/knowledge）提供，管理頁面不編輯政策內容。

## Prerequisite / 前置條件

- B-008-r2 已合併（版號、失效紀錄、多內容包發布，D-03-v2）。
- B-009 已合併（KnowledgeChange、CrawlerRun 有資料可看）。
- B-011a 已合併（共用錯誤碼、token 驗證模式）。

## 規格（API_CONTRACT v0.4 §26，D-16／D-16a）

**以 API_CONTRACT §26 為準**（request／response／錯誤碼／計數規則／恢復條件都在契約中），本節只列重點。

- 身分驗證：沿用 `InternalOperator`（DATA_MODEL §36）。操作者以個人密鑰換取短效管理 token（`POST /api/v1/admin/session`，15 分鐘，只存雜湊）；只有 `KNOWLEDGE_PUBLISHER` 角色可呼叫。不另建帳號系統、不使用共用帳號、不提供匿名管理 API。
- 端點：

| 方法與路徑 | 用途 | 契約 |
|---|---|---|
| `POST /api/v1/admin/session` | 以操作者密鑰換取管理 token | §26.1 |
| `GET /api/v1/admin/knowledge/status` | 目前 PUBLISHED 版本（可為 `null`）、最近一次 CrawlerRun | §26.3 |
| `GET /api/v1/admin/knowledge/changes?status=NEEDS_REVIEW` | 每日偵測到的變更 | §26.4 |
| `GET /api/v1/admin/knowledge/records?status=NEEDS_REVIEW` | 待核准紀錄（含 `contentFingerprint`、`effectiveTo`） | §26.5 |
| `POST /api/v1/admin/knowledge/records/{id}/decision` | 核准／退回單筆；必填 `reason`、`expectedContentFingerprint`、`confirm` | §26.6 |
| `POST /api/v1/admin/knowledge/changes/{id}/dismiss` | 變更不影響內容 → `DISMISSED`；必填 `reason`、`confirm` | §26.7 |
| `GET /api/v1/admin/knowledge/publish-preview` | 發布預覽：版號＝`intendedKnowledgeVersion`、新增／沿用／總數、blockers、`previewToken` | §26.8 |
| `POST /api/v1/admin/knowledge/publish` | 發布；必填 `versionId`、`previewToken`、`confirm` | §26.9 |
| `GET /api/v1/admin/knowledge/restorable-versions` | 符合恢復條件的版本 | §26.10 |
| `POST /api/v1/admin/knowledge/withdraw` | 撤回；必填 `withdrawVersionId`、`reason`、`confirm`，`republishVersionId` 必須明確出現（版本或 `null`） | §26.11 |

- 一致性（後端保證）：
  - 核准沿用 B-008-r4 `approveRecords` 的內容指紋原子比對。
  - 預覽與發布使用同一套計算（沿用 B-008 `publishVersion` 規則，D-03／D-03-v2）；發布時重新計算並在與寫入相同的交易或發布鎖內比對 `previewToken`，不一致回 `KNOWLEDGE_STATE_CHANGED`，不寫入。
  - 撤回時在同一交易或鎖內確認目前版本＝`withdrawVersionId`、恢復目標符合 §26.10 條件；恢復目標不得等於撤回版本。
  - 任何錯誤都不寫入、不留成功稽核。
- 稽核：每個成功寫入寫入 `AdminAuditEvent`（DATA_MODEL §41）。

## r3 要求（D-16b，2026-10-01，[PR #48 comment 5925628146](https://github.com/viz963-1216/Kareo/pull/48#issuecomment-5925628146)）

- 先同步 staging（#47 B-006-r2 已合併，`2ef21a8`），取代本分支內的 B-006 r1 程式。
- 維持 `PACK_NOT_APPROVED`：內容包登錄（DATA_MODEL §26b）、同 packId 重新匯入只允許在內容指紋不變時升為 APPROVED、回填指令。
- 逐筆審核紀錄（DATA_MODEL §26c）：CLI 與管理頁核准寫同一份紀錄，與狀態更新同一交易。
- 預覽與發布共用同一套計畫計算；`previewToken` 涵蓋內容包狀態與指紋（API_CONTRACT §26.8 v0.5）；發布在同一交易內取得鎖、重算、比對、寫入、稽核。
- 四個發布／撤回入口共用同一個 `pg_advisory_xact_lock`（ARCHITECTURE §22 第 9 點）；`admin_*` RPC 的一致性檢查為 §22 第 8 點核准例外。
- 可在 `apps/api` 新增 `@electric-sql/pglite` 開發依賴（含 lock 檔），RPC 行為測試保留在 repo；雙連線併發驗證由 J-003 以真實 Postgres 執行。
- 10 個 admin 路由由 J 在 r3 完成後補 `netlify.toml`。

## Allowed Paths

```text
/apps/api/**
/services/**
```

## Deliverables

- 上表端點、管理 token、角色檢查、所有操作寫入稽核紀錄（誰、何時、做了什麼、原因）
- 發布與撤回沿用 B-008 的 service 與 `publish_knowledge_version`／`withdraw_knowledge_version`（D-10），不另寫一套
- 發布預覽與可恢復版本清單的計算與發布／撤回共用同一套規則，不在 handler 內另寫一份
- `netlify.toml` 路由由 J-003 補；API 回應不得被快取（`Cache-Control: no-store`）
- 失敗行為依 API_CONTRACT §26.1：無 token／過期／密鑰錯誤 → `SESSION_INVALID`；角色不符 → `FORBIDDEN`；欄位或發布條件不符 → `VALIDATION_ERROR`；已處理 → `INVALID_STATUS_TRANSITION`；畫面資料已改變 → `KNOWLEDGE_STATE_CHANGED`；資料一律不變
- 回應格式與 `contracts/mock/admin/**` fixtures 一致（J-003 以 fixtures 對照真實回應）

## Acceptance Criteria

- [ ] 無 token、錯誤密鑰、非 `KNOWLEDGE_PUBLISHER` 角色一律被拒
- [ ] 核准只影響指定紀錄；未核准紀錄無法被發布（測試證明）
- [ ] 發布後 `GET /api/v1/knowledge/status` 顯示新版本；前版仍有效的紀錄被帶入（D-03-v2）
- [ ] 預覽的版號＝內容包 `intendedKnowledgeVersion`；五個數量符合 §26.8 計數規則，且與隨後發布的回應相同（測試證明）
- [ ] 預覽後核准／退回、內容更新、另一次發布或跨日後，以舊 `previewToken` 發布回 `KNOWLEDGE_STATE_CHANGED` 且資料不變（測試證明）
- [ ] 核准時 `expectedContentFingerprint` 不符回 `KNOWLEDGE_STATE_CHANGED`；decision／dismiss／withdraw 缺 `reason` 或 `confirm` 不是 `true` 回 `VALIDATION_ERROR`
- [ ] 可恢復版本清單不含目前版本、曾被撤回的版本與含失效紀錄的版本；空清單回 `versions: []`
- [ ] 撤回：`republishVersionId` 省略 → `VALIDATION_ERROR`；等於撤回版本 → `VALIDATION_ERROR`；提交時不符恢復條件或目前版本已變 → `KNOWLEDGE_STATE_CHANGED`
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
- 2026-10-01 J-002-r6：依 D-16b 補 r3 要求（內容包登錄、逐筆審核紀錄、發布序列化、pglite 依賴）；狀態改為 IN REVIEW（#48）。
- 2026-09-29 J-002：依 D-16a 補齊契約（API_CONTRACT v0.4 §26：發布預覽、可恢復版本、完整寫入回應、`KNOWLEDGE_STATE_CHANGED`）與 fixtures；新增驗收項目。
