# D-05：同意全文與版本接線驗證

Submission Version: J-002-r16

## 完成的工程接線

真實前端不再只用版號是否有 -draft 判斷正式狀態。它比對同次建置中的 ACTIVE 組合、正式全文封存審閱資料與 SHA-256；未知、草案、缺少全文或指紋不符時，停止正式送出。建置不會把核准條件尚未具備的候選文案輸出為正式版本。

勾選文字從同一份核准全文抽出。完整三文案於隱私頁以純文字顯示，提供下載保存、列印入口及歷史版本指定查閱。營運者名稱仍只在隱私頁全文中呈現，前端不公開審閱檔的私人決定欄位。不載入任意外部全文網址、不將 HTML 當正式文件、不採用取回 index 的指紋覆蓋編入的預期指紋。

建立 Session 前重新驗證全文，不使用閱讀時的快取跳過送出前檢查；通過後傳送的 disclaimerVersion／privacyVersion／termsVersion 必須等於顯示版本。後端既有 ACTIVE 白名單與 Session 持有證明保持生效。未就緒時明示尚未開放並提供公開資訊入口，不讓使用者點擊後才遇到 Session 錯誤。

正式封存檔及審閱格式見 [versions/README](../../contracts/legal/versions/README.md)。本輪未新增真實正式文案、未改已固定候選全文、未改 API request／response 或資料庫欄位、未啟用 ACTIVE、未對雲端寫入健康／同意資料。

## 本輪驗證

- 前端測試 81／81 PASS；包含實際打包 API 的未知版本、全文被改、閱讀後被改、正確版本送出四種情境。拒絕情境沒有任何 Session／Consent API 請求。
- 根目錄測試 87／87 PASS；正式全文輸出測試拒絕未完成審閱、內容被改、後端版本／指紋不符及缺少全文，並保留歷史下載。
- real 模式 build／typecheck PASS。真實 registry 仍全部 DRAFT，正式 archive 清單為空。
- 28 migrations 的 PostgreSQL 17＋官方 PostgREST＋實際 Functions 本機 HTTP 整合 50／50 PASS。新增 LOCAL-50 只用暫存合成全文／審閱，驗證三版本、UTF-8 原始位元組、SHA-256、text/plain 與真實 DRAFT 檔案未被改動。這 50 項與部署 E2E 的 49 項是不同清單。
- Chrome 實際操作：真實 DRAFT 的 checkbox 與開始按鈕 disabled；本機合成版本可讀取全文，未勾選時不能送出，勾選後成功建立**本機合成** Session／Consent 並進入評估表單。未填送評估資料、未啟用雲端正式版本。不是正式部署／法規核准。

本機報告見 [consent-binding-local.json](evidence/D05-2026-10-07-consent-binding-local.json)。sourceCommit 是開發基底 dc6d38c，workingTreeDirty=true；提交後的 CI 必須另查實際 head，不能把基底當成已提交／已部署版本。

首輪瀏覽器驗證也發現本機靜態伺服器把 .txt 當 application/octet-stream；前端因此正確拒絕。已補 text/plain 並加入 LOCAL-50 回應類型驗證後重跑。案例編號與總數已調整為唯一的 LOCAL-01–50，未刪既有項目。

## 仍待正式收尾

D-05 保持 OWNER_APPROVED_CONDITIONAL、activationAllowed=false、真實同意版 DRAFT。供應商副本／日誌與刪除紀錄汰換、實際可恢復備份還原後重套刪除、真人權利處理演練及部署回歸尚須取得相應證據。物理備份不能覆寫共享驗收 DB 來演練；Jerry 已決定暫不新增付費正式專案，現階段沒有已核准的隔離雲端還原目的地。

每日清理首個自動事件、完整 crawler 自動執行及兩個新北 careyou 來源失敗仍需另行收尾。正式全文將依查核後的營運現況另立版次與決定紀錄；不改候選 r1 指紋或用合成核准替代本人決定。49 項部署 E2E 不新增 PASS，Integrated 維持否。
