# 正式同意全文封存（D-05 工程準備）

目前沒有正式全文或 ACTIVE 組合。本目錄的存在不代表正式啟用。

正式啟用時，由 Jerry 審閱完成後新增不可變的 `YYYY-MM-DD-rN.md` 與同名 `.review.json`。不得把仍寫 PROPOSED 的候選全文直接搬入、修改其原指紋或以程式生成真人核准。重大文字變更必須另立版本，保留歷史全文及審閱紀錄。

全文須以 `# Kareo 同意文案 — YYYY-MM-DD-rN` 加空白行開頭；依序含 `## 免責聲明`、`## 隱私告知`、`## 服務條款`、`## 評估同意文字`。最後一節是一段無換行、明確的評估勾選文字，從同一份指紋綁定的全文抽出顯示，不另外寫死一份。正式文字必須依實際查核結果重新定稿；這些格式要求不取代營運／法規審閱。

審閱檔必要欄位：

- intendedVersion：封存檔版號。
- consentVersions：disclaimerVersion、privacyVersion、termsVersion，須與後端清單完全相同。
- fullTextPath：`contracts/legal/versions/<版號>.md`。
- fullTextSha256：檔案原始 UTF-8 位元組 SHA-256（64 字元 hex）。
- status：OWNER_APPROVED；activationAllowed、approvalConditionsSatisfied 均為 true。
- approvedBy、approvedAt、approvalEvidence：實際決定者、日期與可追溯證據，不填合成值。

後端 `contracts/legal/consent-versions.json` 的 ACTIVE 那一筆，另填同一個 fullTextSha256，textRef 使用上述本機全文相對路徑。缺少審閱／全文、條件尚未具備、指紋不符或三個版本無法唯一對應時，正式建置失敗。任何非 ACTIVE 的部署設定組合也無法通過前端同意流程。

建置輸出：`/privacy/versions/<版號>.txt`、`formal-index.json`。只有版號、三版本、指紋、下載網址、評估勾選文字及 active 標記可公開，不輸出私人審閱欄位。已核准的歷史全文即使不再 ACTIVE，仍保留下載；歷史頁不得拿來建立新同意。

前端的預期指紋由同一次建置編入，不能由下載的 index 自行替換。全文以純文字在隱私頁顯示、提供保存／列印；不執行 HTML 或 Markdown。營運者名稱只在隱私頁的全文中呈現。載入失敗、回到 SPA／登入 HTML、內容不符時，不建立 Session、不送 Consent。正式送出的三個版本必須等於這份已驗證文件的三個版本。此工程檢查不是法律認證，後端仍保留 ACTIVE 組合與 Session 驗證。

本機整合使用暫存目錄中的合成審閱及全文，不寫入本目錄、真實版本清單或雲端；不能採計為正式核准或部署 E2E。
