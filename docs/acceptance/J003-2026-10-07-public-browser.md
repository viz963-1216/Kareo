# J-003-r26：私人部署的公開查詢與 GET 驗收入口

日期：2026-10-07（Asia/Taipei）。基底 staging `98a9da401b24bcd5369eacb1ed8edea43ef335d0`（#97）。Integrated：否。

## 問題與結果

受保護的私人部署可由既有登入瀏覽器操作，但命令列版本標記回 HTTP 401。原 GET runner 正確停止，沒有 API 案例或資料寫入。新增只在已授權私人分支產生的公開 GET 檢查頁，透過正常瀏覽器登入存取；不繞過保護、不複製 cookie 或 token，也不新增憑證範圍。

頁面只讀取實際 `/kareo-version.json`、未知公開 API、資源列表與已發布知識列表。每一請求固定 GET、同源、禁止重新導向；不接受自訂 URL／header／body，不建立 Session，不呼叫同意、評估、Lead 或管理端點。只在前後版本、分支、context 與 deployId 一致時保留可採計結果。未知端點 JSON 404 對應 E2E-21；列表成功仍將 E2E-44／48 保留 PENDING，不冒充完整 UI／錯誤狀態／無 Session 驗收。

## 私人部署的實際 UI 操作

既有分支由一般 merge 同步成 `6258ac4a2dc591d9a24fae136cf6c0df899e2c12`；tree `ea74830d6a2bfd7b66bd89c71157e08997a7151c` 與上述 staging 完全相同。官方 Netlify API 確認 branch deploy `6ac6063f5d79aa53001770e6` READY。永久網址：https://6ac6063f5d79aa53001770e6--kareo-tw.netlify.app。

已在實際私人部署操作：35 筆資源、第一頁 20／第二頁 15；輔具資源中心 5 筆且服務類別停用；其他縣市只顯示雙北限制／1966；臺北萬華居家照顧 10 筆；名稱不存在時 0 筆與調整條件提醒；吉評可查詢，詳細頁顯示雙北特約及服務範圍待確認，沒有媒合按鈕，Maps 外連 target=_blank。公開資訊顯示 KB-2026-09-24-001，臺北申請方式篩選顯示 2 筆，來源及 1966 提醒可見。

這些是實際 UI 部分觀察，並非完整 E2E-12／44～48。舊部署的命令列 marker 仍受保護，沒有把平台 metadata 當成 runtime 前後版本標記。此報告不往 tests/e2e/results 填入 UI PASS。新 GET 檢查頁合併後，另以實際部署執行結果補證據，不預先填成功。

## 本機驗證

根目錄 scripts／adapter／guard 測試：91 PASS，0 FAIL（含新增 4 項）。檢查涵蓋只送 GET、不帶 Session header／body、錯誤分支／SHA／context 在 API 前停止、後置部署變更清除可採計結果、HTML 登入頁／錯誤訊息拒絕且不外洩原文、只在已授權私人 branch-deploy 產生資產。路由／契約靜態檢查 25 PASS，0 FAIL；不等於部署測試。

## 範圍與待辦

只修改 scripts／tests／docs／tasks；無前後端業務修改、資料庫 migration、D-05 狀態更改、秘密或雲端寫入。保留現有私人分支授權範圍與 Team Protection。公開 staging 最新部署仍因 account credit usage exceeded 被略過；不加購、不改付款或公開保護。D-05 正式全文／核准與刪除副本條件、完整 49 部署 E2E、每日排程完整成功與隔離還原仍待驗證。

## r27：實際部署後結果（2026-10-07 19:48 Asia/Taipei）

PR #98 exact head `3c08e6ac9a783f8bdcfa38ecbf6c962ac8820f0a` 的 CI run 37616082643 共 8 jobs SUCCESS，Netlify 預覽 SUCCESS；squash 合併 staging `eb654aa87316856eaa08b69f06982acd9c5c9bfe`。既有私人分支一般 merge 至 `01c267aa38734d62b390fe90516543602e23d14c`，檔案 tree 與該 staging 完全相同。

私人 branch-deploy `6ac6310d25ad9673c016b966` READY；已正常登入並點擊「執行公開 GET 檢查」。實際執行 11:48:19.959Z–11:48:30.594Z，前後 marker HTTP 200，觀察 SHA 都是 `01c267aa38734d62b390fe90516543602e23d14c`，deployId 相同，context=branch-deploy。沒有移除登入保護或輸出 cookie／token。

- E2E-21：**PASS**，未知 API 真正 HTTP 404，success=false、NOT_FOUND JSON。
- E2E-44：公開資源 API HTTP 200，列表 20 筆；**PENDING**，未將列表成功當作完整 UI／錯誤／無 Session 驗收。
- E2E-48：公開知識 API HTTP 200，列表 20 筆、版本 KB-2026-09-24-001；**PENDING**，無版本與錯誤狀態尚未部署驗證。GET probe 的 total=null 是未擷取分頁總數，不能解讀成資料總數為零或用來驗收總數。

原始輸出從瀏覽器顯示的 JSON 原樣保存為 `tests/e2e/results/2026-10-07-private-public-get.json`，不是人工編寫 PASS。Gate 的 E2E 聚合對上述**指定 SHA／私人網址**確認 **1 PASS、0 FAIL、48 PENDING**；不是把過往其他部署的 PASS 加總。新 commit／網址需重跑，不搬改證據 SHA；完整 J-003／Integrated 維持否。

[舊部署 UI 部分觀察](evidence/J003-2026-10-07-public-ui-partial.json) 記錄 11 個實際畫面，包含新北申請方式 2 筆與 DRAFT checkbox/start disabled。公開知識頁在 375／768／1280 px 的實際 document scrollWidth 等於 clientWidth，未水平溢出；只是公開頁，不採計完整主流程 E2E-23。無 Session 網路捕捉尚未驗證，不能以 UI 沒有聯絡欄位或資料庫計數不變代替。

[命令列受阻輸出](evidence/J003-2026-10-07-private-cli-blocked.json) 保留真實 401、results=[]，沒有修改成成功。SQL 唯讀計數在 08:44:19.179Z、11:44:23.062Z、11:50:26.352Z 都為 sessions=10，assessments=0、leads=0、consents=0。這是前後總數觀察，不宣稱已捕捉每項 API 網路呼叫。

公開站再次讀到旧 SHA `8f509c0567436392b9421bfb2e906d565c6f9438`、deploy `6ac0d01145b99700084c2c48`。私人預覽成功不代表公開版已更新。D-05 仍 DRAFT，未部署 ACTIVE、未建立雲端健康／聯絡資料、未買服務或變更帳號保護。
