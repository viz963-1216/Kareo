# TASK-C-006 — Admin Knowledge Review Page（知識審核與發布頁）

Owner: Engineer C — Frontend  
Status: MERGED（#46）；管理前端與回應驗證已交付，後端 B-012 亦已合併；個人管理登入與部署管理 E2E 待 J-003。（2026-10-04 J-003-r12 核對）
Plan revision: 2026-09-29 / J-002（MVP_DECISIONS D-16、D-16a，Jerry 核准；API_CONTRACT v0.4 §26）

## Goal / 目標

給 Jerry 一個管理頁面：看到每天自動檢查發現的官方資料變更與待核准紀錄，逐筆核准或退回，確認後**按一個按鈕發布**，讓評估使用最新的制度與補助資訊。

## Prerequisite / 前置條件

- Contract：API_CONTRACT v0.4 §26（D-16、D-16a）。Mock：`contracts/mock/admin/`（2026-09-24 提供；2026-09-29 補齊寫入、預覽、可恢復版本、空清單與錯誤）。操作↔fixture 對照見 `contracts/mock/README.md`「Admin Knowledge fixtures」。
- 真實 API 接線：B-012 合併後由 J-003 接線驗收。

## Allowed Paths

```text
/apps/web/**
```

## Deliverables

- 路由 `/admin/knowledge`（不出現在一般導覽列；`noindex`）
- 登入：輸入操作者密鑰換取管理 token；token 只存 `sessionStorage`，不進 URL、console、localStorage
- 三個區塊：
  1. **目前狀態**：已發布版本、發布時間、最近一次每日檢查結果（成功／失敗、時間）
  2. **每日變更**：來源、偵測時間、差異摘要；按鈕「不影響內容」（需填原因）
  3. **待核准紀錄**：標題、縣市、官方來源連結、摘要、生效日；按鈕「核准」「退回」（退回需填原因）
- **核准／退回**：兩者都必填原因並二次確認；送出時帶回該紀錄的 `contentFingerprint`（`expectedContentFingerprint`）
- **不影響內容（dismiss）**：必填原因並二次確認
- **發布**：先呼叫 `GET …/publish-preview`，顯示 `targetVersionId` 與新增（`publishedRecordCount`）、沿用（`carriedForwardCount`）、總數（`totalRecordCount`），有 `excludedRecordCount`／`supersededRecordCount` 時一併顯示；`canPublish: false` 時顯示 `blockers[].message` 並停用發布。二次確認後以預覽的 `versionId`＋`previewToken` 送出。**不得自行產生版號、不得以待審清單筆數推算數量。**成功後重新讀取狀態；失敗顯示原因且不顯示假成功
- **撤回**：先呼叫 `GET …/restorable-versions`；操作者只能從 `versions[]` 選擇恢復版本，或明確選「不恢復任何版本」（送 `republishVersionId: null`，並明示撤回後可能沒有可用知識、評估會暫停）。清單為空時只提供「不恢復」。`currentVersion` 為 `null` 時停用撤回。必填原因、二次確認；不得讓操作者輸入版號
- **錯誤**：`SESSION_INVALID` 回登入並清除 token；`FORBIDDEN` 顯示無權限；`KNOWLEDGE_STATE_CHANGED` 重新載入相關資料後要求重新確認；`VALIDATION_ERROR`／`INVALID_STATUS_TRANSITION` 顯示 `message`（API_CONTRACT §26.12）
- Loading／Empty／Error 狀態；鍵盤可操作；手機可檢視

## Acceptance Criteria（Mock 模組驗收）

- [ ] 未登入看不到任何資料；token 過期回到登入
- [ ] 核准、退回、不影響內容、發布、撤回都有二次確認與結果訊息；連點只送出一次
- [ ] 核准、退回、不影響內容、撤回沒有填原因時無法送出
- [ ] 發布確認畫面的版號與三個數量逐字來自預覽回應；`canPublish: false` 顯示原因且無法發布
- [ ] 撤回只能選清單中的版本或明確不恢復；空清單、無目前版本兩種畫面正確
- [ ] 每個 fixture 情境（成功、空清單、`SESSION_INVALID`、`FORBIDDEN`、`VALIDATION_ERROR`、預覽失效、發布條件不符、恢復版本不可用）都有對應畫面
- [ ] 頁面不能編輯政策內容或數字
- [ ] 發布成功以 API 回覆為準；錯誤時畫面明確顯示失敗
- [ ] 不直接連 Supabase；不修改 Backend／Contract
- [ ] PR 標示「Mock 驗收」；真實驗收由 J-003

## Not In Scope

內容編輯器、Provider 管理、Lead 管理介面、多人權限管理。

## Submission / Completion

Branch：`feat/c-006-admin-knowledge-page`　Submission Version：`C-006-r1`　PR → `staging`
PR Title：`[C-006] Admin Knowledge Review Page`

## 變更紀錄

- 2026-09-24 J-002-r4：依 Jerry 核准（D-16）建立。
- 2026-09-29 J-002：依 D-16a 補齊寫入流程契約與 fixtures，C-006 可完成 Mock 實作；更新 Deliverables 與驗收項目。
