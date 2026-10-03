# D-05 隱私告知與實況對照

日期：2026-10-03（Asia/Taipei）
基準：staging `61241455ecc1f84591d0f2673a5630ab357b03fa`。
結論：草案、姓名及聯絡管道已發布；**D-05 未完成，正式同意不可啟用**。本紀錄不是法律意見或法務簽核。

## 已確認與待驗證

| 項目 | 實況／證據 | 狀態／負責人 |
|---|---|---|
| 蒐集者及聯絡管道 | Jerry 提供蘇子傑，核准僅於隱私頁公開；viz963@gmail.com。#61 部署後已在瀏覽器確認 `/privacy` 顯示，首頁不顯示姓名 | 姓名／信箱內容完成；Jerry 10/03 已確認另一信箱能寄入及回覆（本人確認，非端到端演練）。身分確認／資料處理仍待 J-004 |
| 告知內容 | 隱私頁列目的、資料、選填影響、處理對象、權利、規劃期限、外部連結；重點頁的保存期限也明確改為「預定」 | 草案完成；最終內容及適用蒐集依據待 Jerry 審閱（PRIVACY_AND_RETENTION §9） |
| 同意證據與版本 | 後端驗證 ACTIVE 三版本組合、accepted=true、有效 token 及 session 歸屬；目前三組均 DRAFT（本輪新增 r2 草案，保留並凍結 r1 引用），資料庫同意筆數 0 | 未啟用；最終文案須凍結引用，前後端版本一致後再驗收 |
| 位置最小化 | assessmentService.validateLocation 保存前 `Math.round(value * 1000) / 1000`；不提供位置時欄位要求 null | 程式確認；正式流程的告知、拒絕備援及 DB 寫入讀回仍待 J-003 |
| 資料庫地區及存取 | MCP 查 Kareo `ojawadobnaxduxybqolk` 為 ACTIVE_HEALTHY、日本東京 ap-northeast-1；21 public 表全部 RLS；anon/authenticated SELECT 權限均 0 | 實況確認；不代表所有跨境、備份與支援處理只在東京 |
| 實際資料 | 只查彙總：assessments=0、leads=0、consents=0；未讀個人回答、電話或 token | 本輪唯讀核對，沒有新增個資 |
| 撤回／刪除 | staging session handler 只支援 POST；尚無 consent/withdraw function。B-011b #55 未合併 | B-011b 修正後，由 J-003 以合成資料驗收；不得將分支測試當成線上功能 |
| 到期清理 | staging 無保存期限清理入口或排程；DB 未安裝 pg_cron（這不排除可使用其他排程方式） | B-011b 交付 dry-run、冪等、失敗重試及計數；J-004 實跑、還原後再清理 |
| Netlify 地區／日誌 | 登入後於 Cloud compute > Functions > Region 確認 `IAD (N. Virginia, US East)`；8 個 Functions 隨 staging `6124145` 部署。原始碼未指定 region，UI 實況優先於官方預設值 | 函式地區已確認；session Functions 頁明示「Logs are retained for 24 hours」；此證據只涵蓋函式日誌，不涵蓋 CDN／存取／備份／支援紀錄；J-003 |
| Supabase 備份 | Kareo Scheduled backups 頁實際列出 7 份 PHYSICAL 備份；最新為 2026-10-03 05:08:28 台北時間（頁面 UTC 2026-10-02 21:08:28），其餘為 9/25–9/30 的 UTC 日期。PITR 頁顯示需額外啟用，目前未啟用；備份不包含 Storage objects | 已確認備份存在及 PITR 未啟用；方案期限、供應商副本範圍、還原後再次刪除仍待 J-004。不因列出 7 份就推定所有副本 7 天刪除 |
| 業務與主機 log | 程式有 DB 錯誤遮罩及 assessment 事件白名單；主機存取 log、IP、查詢字詞、內部 CLI 聯絡資料輸出須分開驗收 | B-011b／J-003；不把「業務 log 不含個資」當成「主機不處理個資」 |

## 資料庫顧問結果的解讀

- 21 項 INFO `rls_enabled_no_policy`：符合目前只由後端 service role 存取、瀏覽器角色沒有 SELECT 權限的模式，不能為消除提示而增加公開政策。
- 2 項 WARN 指向同一函式 `public.rls_auto_enable()` 的匿名／已登入 EXECUTE 權限。唯讀核對回傳類型為 `event_trigger`，用途是建立 public 表時自動啟用 RLS；不直接判定它可經 RPC 讀取業務資料。仍應由 B-011b 收緊不必要的 EXECUTE grant，確認 event trigger 保留，再跑顧問。此輪未變更雲端權限。
- 來源及修正說明：[RLS 無政策提示](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)、[匿名可執行 SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)。

## 正式啟用前的六個關卡

1. **文案與合法依據**：Jerry 確認 §9 L-1／L-3／L-6、保存必要性及資料流；不填虛構法務姓名或日期。保留最終免責、隱私及服務條款全文與固定 commit 引用。
2. **委託實況**：記錄 Netlify 函式地區、主機／Functions log 與備份實際範圍；核對 Supabase 備份、PITR 與供應商委託條款。不接受未經核對的供應商預設值。
3. **工程功能**：B-011b 合併、部署且完成撤回、刪除、聯絡欄位清除、到期清理及失敗重試；只用合成資料。
4. **權利申請演練**：Jerry 自行確認能收取客服信件；J-004 演練收件、最少識別、找出相關資料、停止聯繫、刪除、回覆與稽核。測試紀錄不用真實電話、健康資料或 token。
5. **備份與事故演練**：隔離環境還原合成資料並再次套用刪除紀錄；確認不會復活已撤回案件。事故紀錄包含發現時間、範圍、限制存取、調查、通知評估與改善；不預先宣稱已完成。
6. **版本與回歸**：前五項有證據後，由 Jerry 核准具體最終文案；新增不含 `-draft` 的正式版本，保留舊版本、核准人與時間；部署一致的前後端設定並由 J-003 驗收同意／拒絕／舊版／撤回流程。不繞過版本驗證讓網站先通過。

## 不需要等待 D-05 的下一步

J-003 可繼續審查 B-012、B-013、公開資料查詢、每日知識更新與首次知識發布預演；公開制度內容不包含使用者個資。正式首次發布需另核對當前已核准內容與資料庫狀態。含使用者資料的 E2E 待以上關卡及必要模組到位，再用合成資料執行。

## 官方來源（2026-10-03 查閱）

- [個人資料保護法](https://law.pdpc.gov.tw/LawContent.aspx?id=FL010627)：權利、告知與適用蒐集依據；部分修法尚未施行，不能直接混用。
- [Netlify 函式設定](https://docs.netlify.com/build/functions/configuration/)：實際 region 的 UI 查核位置。
- [Netlify 函式日誌](https://docs.netlify.com/build/functions/logs/)：至少 24 小時、部分方案 7 天；不等於此專案的所有日誌期限。
- [Supabase 資料庫備份](https://supabase.com/docs/guides/platform/backups)：每日備份與 PITR 區別，Pro 近 7 天備份可存取；不等於實際本專案已驗收。

備份範圍提醒：最新備份時間早於本輪 15 個 migration 與 Provider 匯入；不能假定它涵蓋最新資料庫結構與機構資料。J-004 須核對後續備份及演練目標，不直接還原此專案或付費建立 PITR。

## 權利處理準備補充（2026-10-03）

Jerry 已確認信箱收件與回覆；流程及未執行案例見 [權利申請處理手冊](../PRIVACY_REQUEST_RUNBOOK.md)。此確認只完成收件管道，不完成工程功能、備份再刪除或正式文案核准。
