# 給 Gemini：Kareo 前端操作與最新版本部署驗證

請在 https://github.com/viz963-1216/Kareo 執行；這是 Kareo，不是 Kareocar。讀 AGENTS.md、PRODUCT_SPEC、ARCHITECTURE、DATA_MODEL、API_CONTRACT、GIT_RULES、TASK-J-003、tests/e2e/acceptance-cases.json、最新 docs/acceptance/J003-* 與 D05-*。

任務：以最新 staging 完成前端實際操作，並核對最新版本的驗收部署。Codex 負責 D-05、每日 crawler/cleanup、API/DB/ops 與全體 49 項 E2E 彙整；你的 UI 證據供 Codex採計。不要重寫原始 MVP、不刪驗收項目、不替 Codex核准 D-05。

## 2026-10-05 15:12 台北時間的實況（開始時再查新狀態）

- B-015 #81、B-016 #82 已合併；staging 為 `afdf01bb24fdddd03d0eae834916d0171f7bcddc`。0027／0028 已套用 Kareo 驗收資料庫。後端 748 測試、9 CI jobs 與 49 LOCAL 通過；**不是部署 49 項通過**。
- 可登入的 PR #82 預覽：https://6ac34be1269dfa0008dc778c--kareo-tw.netlify.app/ （deploy ID `6ac34be1269dfa0008dc778c`，部署 commit `002ce9b55dc0c7ca76f33603fd66306e3515bef4`）。Netlify 也提供 https://deploy-preview-82--kareo-tw.netlify.app/ ，此別名可能隨分支更新；永久 URL 優先。
- 預覽是 Private，正常使用已獲授權的 Netlify 團隊登入。Codex 以 Chrome 登入後已看到首頁及「草案版本・正式啟用驗證尚未完成」同意頁。未完成全流程或 RWD 驗收。
- 命令列 GET `/kareo-version.json` 是 HTTP 401 HTML 登入頁；版本前後標記尚未取得，因此本輪自動部署 E2E 沒有執行。Chrome 直接開 JSON 標記也曾回 ERR_BLOCKED_BY_CLIENT。這是明確存取阻擋，不能填目標 commit 當成讀到的 commit；Netlify build 的成功與 commit 標籤只列建置證據。
- `https://kareo-tw.netlify.app/kareo-version.json` 仍實際回 `8f509c0567436392b9421bfb2e906d565c6f9438`（2026-10-03），不等於目前 staging。Netlify 顯示 production deploy 因額度略過；不得拿舊公開站代驗新版。
- 先操作已可登入的公開資訊頁與 DRAFT 阻擋；同一部署的有效版本標記、完整健康／媒合及正式同意前置未滿足時保留 PENDING。不要關掉保護、擷取登入 cookie／token、冒用真人簽核、購買或 Publish deploy。需要新權限／費用時交回 Jerry。

完整實況：[J-003-r15](../acceptance/J003-2026-10-05-journal-and-deployment.md)。

## 1. 確認來源與環境

- 使用獨立 worktree／資料夾，git fetch 後從 origin/staging 開始；記錄 40 碼 commit。開始時查最新 D-05 狀態，不能沿用這份提示詞撰寫時的狀態。
- 若需修 UI，feature branch → staging PR，一般 push；不要直接推 staging/main，不合併自己的 PR。最少修改 apps/web/**，跨 API/schema/資料缺陷寫精確重現交回 Codex。
- 驗收資料庫已指定 Kareo ojawadobnaxduxybqolk；暫不建立付費 production DB。使用者暫緩正式上線付費。優先既有受保護 Netlify Preview／branch deploy，正式發布／付費不在此任務。
- 部署 real API mode，Session token 必須啟用。service-role key 不得進 VITE_*、browser bundle、GitHub、截圖或報告；只使用已獲授權且已配置的服務端憑證，不把憑證開給所有未知 PR。
- 查 /kareo-version.json，實測前後都必須等於目標 commit。記完整 URL、deploy ID、context、branch、commit 與日期；建置綠燈不能代替功能驗收。
- D-05 未 ACTIVE 時：先驗收公開查詢及 DRAFT 的阻擋畫面；健康/媒合流程列 PENDING 並寫前置。不繞過版本/token驗證，不自行改 DRAFT→ACTIVE。
- 若改用本機隔離環境，依 tests/local/README.md；local mock/合成同意結果只屬 LOCAL，不能填部署 E2E。standard runner 會結束服務，需持續預覽時準備僅 loopback 的可停止伺服器，不能使用雲端真實個資。

## 2. 逐項操作

本輪 UI 案例清單：E2E-05, E2E-10, E2E-12, E2E-22, E2E-23, E2E-24, E2E-29, E2E-35, E2E-41, E2E-42, E2E-43, E2E-44, E2E-45, E2E-46, E2E-47, E2E-48, E2E-49

請讀每項完整 title/requires，不以清單摘要替代驗收要求。依目前已滿足前置逐項執行：

1. 公開資源／制度查詢：不建立 Session；只服務雙北；類別、所在地、行政區、名稱、分頁、空／錯誤狀態，五個輔具中心與特約標示；範圍未知仍可查但不宣稱可服務、不進推薦。
2. 首頁→同意→評估→需求與制度補助結果→推薦→詳情→Maps→Lead。只用虛構案例和測試聯絡資料，不放真實健康資料；提交後交 Codex 查 DB/內部接件，不憑 UI 成功畫面宣稱 DB 驗收完成。
3. 縣市、行政區、不提供位置；GPS 同意／拒絕／失敗／逾時與降級。使用模擬位置，不向報告輸出你的實際 GPS。不提供位置仍完成評估，前端不呼叫附近推薦。
4. 推薦卡片／詳情 ID、名稱、服務、Maps 一致；0/1/2 候選不補滿，沒有結果有下一步。需更動資料的案例交 Codex安排隔離 fixture，勿改正式 Provider 或知識資料。
5. 媒合驗證、聯絡同意、重複點擊、逾時／網路失敗重試；成功狀態只對應 real API 成功，不假成功。
6. 撤回、刪除、Session 失效及重新開始；舊資料不重送，token不出現在網址／畫面／截圖。
7. 375px 手機、平板（例如768px）、桌機（例如1440px）；只用鍵盤完成主流程、skip link、焦點、錯誤讀取、loading 防重送。
8. 估算保留1966提醒、來源與版本；無核定／診斷宣稱。需求摘要列印／複製不得含姓名、電話、自由文字或座標，也不能保存到後端或長期儲存。
9. Kareocar 只能外部新分頁連結 https://kareocar.netlify.app/；不得修改它的專案、資料庫或登入。Google Maps 也是外部連結，不夾帶評估內容或token。

## 3. 證據與交付

- 每項 PASS/FAIL/PENDING、前置、步驟、預期/實際、去識別截圖、console/network 關鍵現象；遮罩所有 headers/tokens/contact，HAR 不原樣提交。
- 本機檢查不得放 tests/e2e/results，不得把任何 LOCAL 或 CI 通過算成 49 部署案例通過。
- 真實部署 UI 證據可以按 tests/e2e/record-manual.mjs 格式記錄，但它要求 --operator 為真實人；AI 自動執行不冒用 Jerry 姓名。請據實標示 Gemini 實際工具/操作者類型，供 Codex檢查記錄工具與採計方式；human-only演練仍由 Jerry本人完成。
- 交回 commit/deploy/version marker 前後、UI case matrix、截圖位置、修正 PR、未解決的前置與缺陷。部署或憑證不可用時保留可驗證阻擋，不說全部完成。
- 前端有缺陷時先給最小重現與根因，再做最小修正、相關 build/tests 與重新操作；不改 A 的數量、座標、啟用範圍，不改 B 核心規則。

Acceptance：符合原始MVP並完成所有可執行的 UI 案例；剩餘明確 PENDING。完整49項彙整與 Integrated 最終判定由 Codex/Jerry完成。
