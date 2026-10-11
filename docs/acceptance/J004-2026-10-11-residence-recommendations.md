# J-004-r19：Demo 居住地推薦

Jerry 決定：完整住址依距離推荐，只填行政區則隨機推薦，卡片不必顯示推薦原因。此實作範圍是 Netlify `/demo/` 本分頁分析，正式同意、雲端 Assessment／Lead 與完整 J-003 gate 保持既有条件。

## 實作

- 選填完整門牌，仍需選縣市／行政區，不填可完成初評。地址只存在 AssessmentForm／App 記憶體，API payload 不加地址欄位。
- 使用雙北政府免費公開門牌資料於瀏覽器比對。41行政區、732,883個門牌、1,035家機構精確對應座標。來源／license／投影／原檔及分檔 hash 見 `data/residence/manifest.json`。
- 動態載入所選行政區公開JS module，URL只有行政區檔名和內容hash；connect-src none不變。無外部地圖API、付費憑證或個案資料寫入。
- 精確住址→服務資格候選→已定位候選 Haversine 距離排序；先比原始距離才顯示一位小數。同距離依providerId。部分缺座標時揭露已定位／總家數，名次僅涵蓋已定位候選；全部缺則清楚回退到行政區隨機。
- 行政區隨機以新session／assessment UUID作SHA-256種子，同評估／類別快取首次結果，返回不重抽。未知服務範圍、資源中心不混入推荐。
- 住址查無／歧義／行政區不符→不送评估，保留表單可修正或清空。卡片移除原因，官方評鑑不合格警示保留。

## 本機驗證（不是正式部署 E2E）

- Frontend91/91 PASS，包含實際本機 engine／provider API、住址正規化／錯區拒絕、距離排序、服務範圍、首次名單緩存、重啟失效與無網路请求。
- Typecheck、双产物build、embedded Demo CSP／assets／fixture scan PASS；mode guard8/8 PASS。
- 公開索引完整性 PASS：41個雜湊／筆數／範圍、1,035機構位置逐筆對應。
- Chrome localhost：使用公開新北市府門牌「新北市板橋區中山路一段161號」完成初評，居家照顧148／159候選已定位，前三家距離0.4／0.4／0.5公里；無推薦原因，電話／Maps保留。
- 返回評估保留地址；改成999999號留在表單顯示查無門牌；清空地址成功進入行政區隨機推薦。
- localhost HTTP紀錄截至首次測試19GET、0非GET、0API，僅一筆 `/demo/residence/nt01.js` 公開索引（最終版改帶內容hash），沒有輸入住址出現在請求路徑。

## 發布證據

待同一feature PR合併、release promotion與 Netlify實際部署後，於PR留言記錄確切SHA／deploy／線上操作證據；本文件不先宣告部署成功，不增加49項正式E2E PASS。
