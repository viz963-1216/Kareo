# TASK-C-009 — Case Manager Summary（給個管師／1966 的需求摘要）

Owner: Engineer C — Frontend  
Status: MERGED（#66）；瀏覽器內個管師摘要／複製／列印已交付；部署操作 E2E 待 J-003。（2026-10-04 J-003-r12 核對）
Submission Version: C-009-r2（2026-10-08，Jerry 授權中心實作閱讀調整）
Plan revision: 2026-10-01 / J-002-r8（MVP_DECISIONS D-19 Q5，[Issue #49 comment 5926683690](https://github.com/viz963-1216/Kareo/issues/49#issuecomment-5926683690)；PRODUCT_SPEC §14b）

## Goal / 目標

讓使用者在評估結果頁一鍵產生需求摘要，可列印或複製，帶去和個管師或 1966 溝通。**完全在瀏覽器產生，不保存任何使用者資料。**

## Allowed Paths

```text
/apps/web/**
```

## Deliverables

- 評估結果頁新增「產生給個管師／1966 的需求摘要」按鈕，開啟摘要檢視：
  - 開頭與結尾：PRODUCT_SPEC §34 正式評估提醒，以及「本摘要為初步預估，不代表正式資格或補助核定」。
  - 可能需要的服務（`careNeeds`／`priority` 的中文名稱）。
  - 初步照護建議與補助說明：照原文逐行以條列顯示評估回應的 `summary`；附 `knowledgeVersion` 與產生日期。
  - 「建議詢問 1966／照管專員的問題」：照 PRODUCT_SPEC §14b 的 5 題原文。
- 「列印」：`window.print()` 搭配列印樣式（只印摘要）。「複製文字」：純文字寫入剪貼簿，失敗時提示可手動選取。
- 不含姓名、電話、自由文字原文、座標、地址。

## 禁止

- 不呼叫任何新 API、不送後端、不寫入 `localStorage`／`sessionStorage`／IndexedDB／cookie、不產生分享連結或 QR code、不送分析事件含摘要內容。
- 不改寫、不計算、不補上 `summary` 沒有的金額或資格結論。

## Acceptance Criteria

- [ ] 用 `contracts/mock/assessments/` 既有 fixtures（含補助、身障、自付估算情境）產生的摘要內容正確、提醒文字完整
- [ ] 測試證明：產生摘要時沒有任何網路請求、沒有寫入瀏覽器儲存
- [ ] 列印樣式只輸出摘要；複製的純文字與畫面一致
- [ ] 摘要不含聯絡資料、自由文字、座標
- [ ] 既有前端測試全部通過；real API 模式 build 通過

## Not In Scope

保存或分享摘要（D-19 已決定不做）、修改評估邏輯或 API。

## Submission / Completion

Branch：`feat/c-009-case-manager-summary`　Submission Version：`C-009-r1`　PR → `staging`，引用 Issue #49  
PR Title：`[C-009] Case manager summary`

## 變更紀錄

- 2026-10-01 J-002-r8：依 D-19 Q5 建立。

## r2 — 初評與個管師摘要閱讀調整（2026-10-08）

Jerry 明確要求：初評正文200字內，個管師摘要較完整但條列易讀。中心允許路徑：apps/web/**、相關docs/tasks及公開資料版發布；不修改後端、資料庫、個案資料或同意狀態。依 careNeeds／priority 產生簡短導讀，完整政策原文可展開；個管師摘要畫面、複製與列印全部條列，原始金額／條件／來源與既有提醒保留。驗收包含全16種服務組合的字數上限、完整補助內容保留、前端測試與real build、公開頁實際操作。此輪不代表正式部署E2E通過。
