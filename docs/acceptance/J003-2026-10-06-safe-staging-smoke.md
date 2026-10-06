# J-003-r16：安全的 staging smoke 與部署驗收入口

日期：2026-10-06（Asia/Taipei）
基底：staging `891ed2b5bff7b8c78f4e6c0ebc19cb7d1e14bb90`（#84）
Submission Version：`J-003-r16`
Integrated：**否**；49 項必要部署 E2E 不變。

## 問題與結果

原 `scripts/smoke-staging.mjs` 不先核對部署版本，預設建立 Session，送出 `deployment-smoke-test` 寫死版本，沒有 Session token header。即使不選 assessment，也會寫入。舊手動 workflow 亦沿用這個入口及過時的付費 AI 說明。

目前入口預設委派 GET-only runner：指定完整 commit、部署 URL 與輸出檔，開始及結束都讀真正版本標記。初次版本不符或讀不到，停止於標記，不呼叫 API、不建立資料。查詢成功也只算 UI 案例的 API 部分，不把 E2E-44／48 改成 PASS。

## 本版修改

- **Added**：合法 ACTIVE 組合讀取器；smoke／write runner 前置阻擋、版本／保護／重新導向及資訊遮蔽回歸。
- **Changed**：staging smoke 預設 GET；寫入由 `--write-e2e --allow-writes` 明確啟用。legacy `--with-assessment` 仍辨識，但也需 `--allow-writes`，其 scope 是完整 API runner，非單筆評估。
- **Fixed**：不再使用寫死的假同意；API runner 在任何 POST／DELETE 前要求匹配 SHA、明確旗標及 checked-out registry 的合法 ACTIVE 組合。不自動修改 DRAFT。ACTIVE 只回傳三個契約版本欄位，不將核准 metadata 送給 API。
- **Fixed**：不跟隨 HTTP 重新導向傳送自訂 Session header；網路錯誤、錯誤碼與不合法 marker 值不將任意原文寫入共享診斷。
- **Fixed**：E2E-01 檢查 token 及有效未來 expiresAt；E2E-02／04／17 的部分驗證保留 PENDING，不能把未知版本拒絕、careNeeds 比較或單次偽造 token 拒絕當成整項通過。實際不符契約仍 FAIL。
- **Changed**：staging workflow 固定 SHA、checkout 核對、兩個預設 false 的寫入選項及實際 JSON artifact。Release gate 預設公開 GET；只有手動明確勾選 `run_api_e2e` 才啟動寫入，PR → main 不自動建立測試資料。
- **Known Issues**：D-05 仍 DRAFT；受控憑證、目標部署、存取、每日排程／清理及所有必要部署 E2E 仍需實際完成。自動 API runner 尚未涵蓋所有案例，PENDING 不因模組已合併而改成 PASS。

## 執行方式

先在倉庫根目錄、指定驗收部署執行：

```text
node scripts/smoke-staging.mjs --base-url=https://<acceptance-site> --commit=<full40SHA> --out=<diagnostic.json>
```

預設不寫資料；exit 0 僅代表本次有限 GET 檢查沒有 FAIL，**不是 release gate 通過**。
版本／存取不符 exit 1；缺少參數或互相矛盾的寫入旗標 exit 2。

只有在驗收環境與清理已準備、明確授權合成寫入、D-05 的正式 ACTIVE 組合已交付後，才加 `--write-e2e --allow-writes`。
即使提供旗標，DRAFT／registry 無法讀取或初次版本不符仍不送 POST／DELETE。測試 Session 必須追蹤並依保存與清理規則處理；不以時間窗批次刪除其他資料。

`--local` 只供本機測試，既有 release gate 不採計 loopback 結果。測試內的 ACTIVE fixture 僅存在於一次性暫存目錄，不修改倉庫或雲端同意組合。

## 本機實際驗證

| 檢查 | 結果與界線 |
|---|---|
| `node --experimental-strip-types --test 'tests/**/*.test.*'` | 79 PASS、0 FAIL；涵蓋現有 gate／adapter 與新安全回歸，不是部署 E2E |
| `node scripts/check-integration.mjs` | 25 PASS、0 FAIL；靜態路由與契約，不是 handler 或部署行為 |
| 兩個 workflow YAML 解析 | 通過；實際 Actions job 另以 PR CI 核對 |
| `node scripts/acceptance-gate.mjs --mode=dev` | 115 PASS、0 FAIL、49 PENDING；4 個舊結果檔未採計，不是 MVP 通過 |
| `git diff --check` | 通過 |
| 本機 HTTP 安全回歸 | 實際子程序與 loopback server；無允許旗標、DRAFT、registry 無法讀取時，只讀 marker，無 POST／DELETE |
| 本機重新導向回歸 | marker 登入重新導向停止；API 自訂 header 不跟隨重新導向；結果檔仍可記錄失敗 |
| 證據完整性 | partial API／fixture／原始碼測試不當作整項 PASS；49 項 catalog 未修改 |

## 真實部署診斷

已以程式碼 commit `f55f01b2c24b6bd27138c75d1d4e0b4d53e35971`，在 2026-10-06 09:38（Asia/Taipei）對兩個部署各執行一次預設 GET 入口：

| 環境 | 真正觀察 | 結果 |
|---|---|---|
| `https://kareo-tw.netlify.app` | marker HTTP 200，commit `8f509c0567436392b9421bfb2e906d565c6f9438` | 目標不符，exit 1；results=[]，沒有 API 案例或資料寫入 |
| `https://6ac34be1269dfa0008dc778c--kareo-tw.netlify.app` | marker HTTP 401 登入保護，commit=null | 存取受阻，exit 1；results=[]，不保存登入 HTML、不執行 API |

原始輸出位於 [公開站診斷](evidence/J003-2026-10-06-public-smoke-blocked.json) 與 [預覽診斷](evidence/J003-2026-10-06-preview-smoke-blocked.json)。兩份由工具產生，未修改觀察欄位；存放 docs/acceptance/evidence，**不納入 tests/e2e/results 或 release gate**。沒有案例被執行，不能把顯示的 0 FAIL 當成驗收通過。後續證據文件提交不改 f55f01b 的程式碼；新部署仍須以該部署實際 marker 重新驗證。

## Scope

僅 scripts／tests／.github workflows／docs／tasks。前後端業務程式、API 契約、Provider 數量、推薦規則、同意狀態、帳號憑證與雲端資料不變。未購買服務、未執行部署／發布或雲端健康寫入。
