# TASK-C-006 — Admin Knowledge Review Page（知識審核與發布頁）

Owner: Engineer C — Frontend  
Status: QUEUED — 可先以 Mock 開發；真實接線依賴 B-012；未見提交  
Plan revision: 2026-09-24 / J-002-r4（MVP_DECISIONS D-16，Jerry 核准）

## Goal / 目標

給 Jerry 一個管理頁面：看到每天自動檢查發現的官方資料變更與待核准紀錄，逐筆核准或退回，確認後**按一個按鈕發布**，讓評估使用最新的制度與補助資訊。

## Prerequisite / 前置條件

- Contract：API_CONTRACT §26（D-16）。Mock：`contracts/mock/admin/`（J-002 已提供，2026-09-24）。
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
- **發布**：顯示將發布的版號與紀錄數，二次確認後送出；成功後顯示新版本；失敗顯示原因且不顯示假成功
- **撤回**：必填原因，二次確認
- Loading／Empty／Error 狀態；鍵盤可操作；手機可檢視

## Acceptance Criteria（Mock 模組驗收）

- [ ] 未登入看不到任何資料；token 過期回到登入
- [ ] 核准、退回、發布、撤回都有二次確認與結果訊息；連點只送出一次
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
