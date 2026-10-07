# J-003-r26：私人部署的公開查詢與 GET 驗收入口

日期：2026-10-07（Asia/Taipei）。基底 staging `98a9da401b24bcd5369eacb1ed8edea43ef335d0`（#97）。Integrated：否。

## 問題與結果

受保護的私人部署可由既有登入瀏覽器操作，但命令列版本標記回 HTTP 401。原 GET runner 正確停止，沒有 API 案例或資料寫入。新增只在已授權私人分支產生的公開 GET 檢查頁，透過正常瀏覽器登入存取；不繞過保護、不複製 cookie 或 token，也不新增憑證範圍。

頁面只讀取實際 `/kareo-version.json`、未知公開 API、資源列表與已發布知識列表。每一請求固定 GET、同源、禁止重新導向；不接受自訂 URL／header／body，不建立 Session，不呼叫同意、評估、Lead 或管理端點。只在前後版本、分支、context 與 deployId 一致時保留可採計結果。未知端點 JSON 404 對應 E2E-21；列表成功仍將 E2E-44／48 保留 PENDING，不冒充完整 UI／錯誤狀態／無 Session 驗收。

## 私人部署的實际 UI 操作

既有分支由一般 merge 同步成 `6258ac4a2dc591d9a24fae136cf6c0df899e2c12`；tree `ea74830d6a2bfd7b66bd89c71157e08997a7151c` 與上述 staging 完全相同。官方 Netlify API 確認 branch deploy `6ac6063f5d79aa53001770e6` READY。永久網址：https://6ac6063f5d79aa53001770e6--kareo-tw.netlify.app。

已在實際私人部署操作：35 筆資源、第一頁 20／第二頁 15；輔具資源中心 5 筆且服務類別停用；其他縣市只顯示雙北限制／1966；臺北萬華居家照顧 10 筆；名稱不存在時 0 筆與調整條件提醒；吉評可查詢，詳細頁顯示雙北特約及服務範圍待確認，沒有媒合按鈕，Maps 外連 target=_blank。公開資訊顯示 KB-2026-09-24-001，臺北申請方式篩選顯示 2 筆，來源及 1966 提醒可見。

這些是實際 UI 部分觀察，並非完整 E2E-12／44～48。舊部署的命令列 marker 仍受保護，沒有把平台 metadata 當成 runtime 前後版本標記。此報告不往 tests/e2e/results 填入 UI PASS。新 GET 檢查頁合併後，另以實際部署執行結果補證據，不預先填成功。

## 本機验证

根目錄 scripts／adapter／guard 測試：91 PASS，0 FAIL（含新增 4 項）。檢查涵蓋只送 GET、不帶 Session header／body、錯誤分支／SHA／context 在 API 前停止、後置部署變更清除可採計結果、HTML 登入頁／錯誤訊息拒絕且不外洩原文、只在已授權私人 branch-deploy 產生資產。路由／契約靜態檢查 25 PASS，0 FAIL；不等於部署測試。

## 範圍與待辦

只修改 scripts／tests／docs／tasks；無前後端業務修改、資料庫 migration、D-05 狀態更改、秘密或雲端寫入。保留現有私人分支授權範圍與 Team Protection。公開 staging 最新部署仍因 account credit usage exceeded 被略過；不加購、不改付款或公開保護。D-05 正式全文／核准與刪除副本條件、完整 49 部署 E2E、每日排程完整成功與隔離還原仍待驗證。
