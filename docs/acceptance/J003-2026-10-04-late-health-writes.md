# J-003-r13：評估／推薦晚到寫入與撤回序列化

2026-10-04；基底 staging `e1ec25a54953a8455e3519f73ef619e65e5707cc`（#76）。Integrated：否。Jerry 委託中心持續修復 ABCJ，落實既有 Session／Consent 授權要求；沒有改產品規則。

## 修正前的實際重現

實際 createAssessment／createRecommendation、Supabase repositories 与全部 migration SQL，隔離 PGlite；在 Node 檢查完成後、最終 RPC 前先提交 request_session_deletion 或 withdraw_consent。四項舊碼測試都 FAIL：應 SESSION_INVALID，實際服務成功回傳。Session 已待刪，仍可新增 Assessment／Profile 或 RecommendationRun，可能在實體清理後留下沒有後續清理候選的健康資料。

## 修正

前向 0026（CLI 2.119.0，生成 20261004121212）新增三個 service_role-only、invoker、固定 search_path 函式：require_writable_session、create_assessment_authorized、create_recommendation_authorized。Session 鎖內重新檢查 token hash／ACTIVE／expiry／仍有效的 Consent；Assessment 的 session 與推薦來源歸屬也再確認，然後在同一交易呼叫原有 Assessment＋Profile、Run＋Items 原子寫入。

正式 service 傳入安全 context（session id＋hash，明文 token 不送 SQL），repository 漏傳就拒絕；沒有不安全 fallback。內存 repository 的 fixture 可省略第二參數，只供單元測試；實際 SQL 授權由專用測試驗證。原低層 SQL 仍只供受信任 service_role／資料庫工具，保持備份還原及既有原子性檢查。

不新增公開 Kareo HTTP 端點、表／欄位，不修改既定 request／response、規則引擎、知識版本、推薦排序、A 資料、C UI 或 D-05 狀態。Recommendation 錯誤文案改成安全通用文案；網路失聯時不能宣稱一定沒有提交。

## 驗證

- apps/api/tests/healthWriteAtomicSql.test.ts：14 PASS。四項晚到請求、兩條流程各自 token 變更／expiry／Consent 失效、兩個正常 service_role 流程、anon／authenticated EXECUTE 拒絕、Profile／Item INSERT 失敗回滾與正確重試、最後歸屬檢查。
- transport shim 轉發實際 repository SQL／RPC；不模擬 JWT，也不宣稱完整 Supabase HTTP 驗收。資料全部合成；規則引擎使用明確測試快照。
- 真正 PostgreSQL 17 三 backend：22 PASS。六項新增：撤回／刪除先持有 Session 鎖，評估／推薦排隊後拒絕；健康寫入先完成，刪除隨後提交，再執行實際 cleanup，四種健康表全部歸零。
- 既有錯誤知識 mutex、舊 withdrawal 的實際 40P01 對照仍各按預期 FAIL，CI 要求特定錯誤。
- API 全套、fresh／upgrade、CI／Netlify 最終結果於 PR 留言確認。

## 仍待驗收

此修正不代表 D-05 正式簽核、每日排程已執行、正式內容包雲端回填、客服無 token 資料權利工具、完整備份復原與 49 項部署 E2E 已完成。未建立付費正式庫或寫入雲端測試健康資料。
