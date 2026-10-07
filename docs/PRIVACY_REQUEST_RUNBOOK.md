# D-05／J-004 個人資料權利申請處理手冊

> 2026-10-07 22:52（J-004-r9）：最新 staging `bb18992` 的 50 項隔離 HTTP/CLI 整合檢查全部 PASS、0 FAIL。僅採計 LOCAL 技術驗證；49 項部署 E2E 不變。見 [精確版本、時間與原始報告](acceptance/D05-2026-10-07-owner-rehearsal-cancellation.md#actual-technical-verification-after-cancellation)。

Submission Version: J-004-r9 / B-015-r1（2026-10-07；驗收程序更新）
Owner／處理者：Jerry（蘇子傑，沿用資料管理者職責）  
管道：viz963@gmail.com  
Status：受保護工具已實作、合成端到端通過；額外真人客服演練已由營運者取消。實際申請仍須核對本人／代理權限；完整部署、備份退役及 D-05 ACTIVE 尚待驗證。

> 2026-10-07 營運者決定：不再要求另外寄信、電話或真人訓練報告作為驗收阻擋；見 [取消紀錄](acceptance/D05-2026-10-07-owner-rehearsal-cancellation.md)。下方操作步驟仍適用於實際權利請求；舊 P-02～P-08 狀態是當時紀錄，不能取代最新技術證據。

## 依據與已確認項目

本文件落實 PRIVACY_AND_RETENTION §3、§6，不新增公開 API 或對外 SLA。2026-10-05 的中心代辦 B-015 補了必要最小權利操作稽核表（1 年上限並提早檢視必要性）；B-016 補了依備份汰換檢查點處理的獨立刪除紀錄。Jerry 於 2026-10-03 在對話確認已用另一信箱測試收件及回覆；這是本人確認，未保存郵件內容或驗證實際刪除。

權利種類包含查詢／閱覽／複製、補充更正、停止蒐集處理利用、刪除。依[個資法第 3、10、11、13 條](https://law.pdpc.gov.tw/LawContent.aspx?id=FL010627)分流：第 10 條請求的准駁決定為 15 日內，必要延長最多 15 日並書面告知原因；第 11 條請求為 30 日內，必要延長最多 30 日並書面告知原因。實際適用及例外由最終審閱確認，不因補件自行重設期限。現有規格「7 個工作天完成回覆」僅為未核准產品建議，不能替代法定准駁期限；自助刪除的 7 天清理則是另一項既有工程規格。

## 現在可以做與執行前條件

- 可以：收件確認、分類、記錄收到時間與期限、確認操作權限、用虛構申請做桌上演練。
- 執行真實資料操作前：確認目標環境、適用 request、授權操作者與正式工具；B-011b 已合併、部署並可實測。不得用 service-role 臨時 SQL 代替缺少的權利處理功能。
- 調閱／複製／更正缺少正式工具時，標記受阻、向 B/J-002 提出缺口；不假稱已交付、不擅自加公開管理 API。
- 只在受控工作紀錄保存必要申請資料；GitHub 僅記去識別結果。不得要求申請人寄 session token、密鑰、病歷、身分證照片。

## 處理步驟

| 步驟 | 實際動作 | 成功判準／受阻處理 |
|---|---|---|
| 1 收件 | 建立受控申請編號，記收到時間、權利種類、聯絡管道及適用期限 | 回覆已收件；不能說已刪除 |
| 2 最少身分確認 | 優先引導仍持有 token 的本人使用網站自助流程；無 token 時按 §6.2 以 Lead 編號／原聯絡電話做必要比對 | 知道 Lead 編號或電話本身不等於身分驗證。使用原登記聯絡管道確認本人；不在回信揭露是否存在特定案件。代理申請須確認代理權 |
| 3 查找範圍 | 經授權工具比對相關 session、評估、推薦與 Lead；保存必要關聯 ID 於受控紀錄 | 不匯出全庫、不以相近姓名批次刪除；無法確定歸屬先補必要資訊 |
| 4 停止聯繫 | 撤回／停止利用／刪除請求確認後，按既有規格停止接洽；涉及已轉告 Provider 時記對象、範圍並確認停止後續處理 | 使用正式狀態及原因碼；通知內容不夾帶評估全文。不把未送出的通知標為完成 |
| 5 執行 | 自助刪除用正式 DELETE session；同意撤回用正式 withdraw；客服無 token 走正式資料管理者工具 | 工具未交付即 BLOCKED，不能借用訪客 token 或直接改 DB。更正／複製另按核准工具辦理 |
| 6 核對 | 驗證 token 失效、不能新增評估／推薦／Lead、聯絡欄位清空、案件狀態、排程清理與必要稽核 | 查實際狀態，不以 HTTP 200 或前端成功提示代替。依契約區分撤回與 USER_DELETED 原因，不混用 |
| 7 回覆 | 說明已完成項目、仍待清理項目及原因；如准駁／延長須清楚說明及記時間 | 未完成不得用「全部永久刪除」。不附電話、健康資料或內部 ID 清單 |
| 8 結案與備份 | 記必要結果與證據位置，按核准保存規則處理；備份依實際汰換／還原後重套刪除方案 | 不宣稱線上刪除等於所有備份即時刪除。備份再刪除需隔離還原實測 |

客服信箱本身可能收到個資；提醒申請人勿寄多餘敏感資料，勿將郵件轉貼 GitHub。申請工作紀錄及郵件的保存必要性與期限尚需最終審閱，不套用「同意證據 3 年」作為全部郵件的期限。

## 回覆範本（人工檢查後送出）

收件：

> 已收到您對 Kareo 的資料權利申請。我們會依申請種類確認處理範圍及必要資訊。請勿寄送病歷、證件影本或網站 token。如需補充確認，我們會透過本管道聯繫您。這封信僅確認收件，不代表操作已完成。

需確認身分：

> 為避免誤刪或揭露他人資料，我們需要透過原登記的聯絡管道確認申請。若您仍可使用原裝置，請優先使用網站的自助功能；否則請提供申請所需的最少案件資訊，勿寄送健康內容或證件。

結果：

> 本次申請已完成：[核對後填入實際項目]。尚待完成：[項目、原因及處理安排]。備份處理：[依實際方案填寫，未驗證不得宣稱已刪除]。若內容有誤或仍有疑問，請回覆此信。

本版僅提供範本，不授權自動寄信，也不新增回覆時限承諾。

## 演練與證據

每案記：日期、操作者、申請種類、受控編號、環境／commit／deploy、預期／實際、去識別證據位置、清理結果與 PASS／FAIL／BLOCKED。不能填真實電話、健康內容、token、郵件正文。

| ID | 合成情境 | 預期 | 現況 |
|---|---|---|---|
| P-01 | 另一信箱寄不含個資測試信 | 能收到及回覆 | USER-CONFIRMED，Jerry 2026-10-03；非端到端權利驗收 |
| P-02 | 申請人只有別人的 Lead 編號 | 不揭露、不刪除；完成必要身分確認前暫停 | PENDING |
| P-03 | 本人持有有效 token 自助刪除 | token 失效、聯絡欄位清空、清理可追蹤 | BLOCKED：B-011b |
| P-04 | 無 token，由資料管理者處理 | 授權及歸屬確認、正式工具操作、稽核及結果回覆 | BLOCKED：工具與端到端演練 |
| P-05 | 撤回後仍有未結案件 | 停止聯繫、狀態符合契約，禁止新資料寫入 | BLOCKED：B-011b |
| P-06 | 清理途中故障後重試 | 不假成功、冪等，最終資料及紀錄一致 | BLOCKED：B-011b |
| P-07 | 隔離還原含已刪合成資料的舊備份 | 重套刪除後無可見聯絡／評估，入口開放前完成核對 | BLOCKED：隔離目標、還原及再刪除 |
| P-08 | 查詢／更正／代理申請／延長 | 正確分類、必要驗證、合法准駁及書面原因，無跨人資料 | PENDING：桌上演練及工具核對 |

## 2026-10-05 protected tool specification

B-015-r1 is the formal lost-token tool. A DATA_STEWARD first completes human identity/authority checks using the original registered contact route; code cannot certify that phone call. Prepare a private JSON request with controlled reference and verification attestation. No identifiers-only attestation or phone search. Export/copy writes a 0600 file with no tokens, key hashes or other users; transmit it only after human identity and recipient checks, never post it to GitHub. Contact correction targets a single Lead; health correction re-evaluates exact assessment through the current published rules, deletes stale recommendations and cancels unresolved old outreach. Operators must separately handle any already disclosed data with its recipient; code does not pretend to have notified them. All read/change operations leave transactional minimal audit; originals/identity documents stay out of database audit. Audit ceiling 1 year with early-purpose review. Detailed command examples and actual verification results will be added after implementation.

## Protected CLI usage

Build: `npm run build --prefix apps/api`. Put the private JSON request in an operator-owned 0700 directory, file mode 0600. Supply SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, KAREO_OPERATOR_ID and KAREO_OPERATOR_KEY through the secure environment (never command history). Run `node apps/api/dist/scripts/privacyRights.js --request=/absolute/private/request.json`; EXPORT also requires `--output=/absolute/private/export.json`. Output file is exclusive 0600 and never stdout. Do not choose a CI workspace/artifact or publish private requests/exports.

Required request fields: requestId (`PRQ-...` controlled reference), action (`EXPORT`, `CORRECT_CONTACT`, `CORRECT_ASSESSMENT`, `STOP`, `DELETE`), receivedAt, verifiedAt (within seven days of execution), verificationMethod (`ORIGINAL_CONTACT_CONFIRMED` or `AUTHORIZED_PROXY_CONFIRMED`), verificationRef (controlled case reference), sessionId or exact leadId. Proxy also needs separately recorded proxyAuthorityRef. Case references are codes only, never phone/health/mail text.

CORRECT_CONTACT additionally supplies leadId and correction `{name,phone}`; it may correct retained closed-case contact, never recreate erased fields. CORRECT_ASSESSMENT supplies assessmentId and correction as a complete existing Assessment input including its sessionId; generation binds the source timestamp and current publication. Unknown/expired knowledge or changed row stops the operation. Requests are not guessed from a name or phone. No session/Lead and no reliable verification: document inability to identify safely, request the minimum useful information, and make an actual decision within the applicable deadline.

Never automatically interpret a pasted verificationMethod as proof. The human DATA_STEWARD attests only after the original-channel/proxy check; code can enforce its presence and scope but cannot certify a call. Independent request/identity evidence stays in the restricted case record, not GitHub. Transmit any export only to the checked recipient with a suitable protected channel.

Earlier local evidence: 46/46 actual HTTP/CLI checks and protected SQL regression, see [verification](acceptance/D05-2026-10-05-privacy-rights.md). P-02/P-04/P-08 technical paths use synthetic attestations. The extra human rehearsal was cancelled by the owner on Oct 7; cancellation is not a human PASS. Earlier BLOCKED rows above are historical, not current module status. Independent journal cloud checks now have [Oct 7 read-only evidence](acceptance/J004-2026-10-07-erasure-readiness.md); physical-backup/copy retirement and full deployed E2E remain pending.

## B-016 update (2026-10-05)

Independent journal and guarded replay are now implemented with the actual official Netlify SDK. The expanded local suite passes 49/49; this does not count as deployed release E2E. See [journal verification and restore/checkpoint runbook](acceptance/D05-2026-10-05-deletion-journal.md). Before STOP/DELETE, the private rights CLI also needs delegated Netlify Blobs access; it writes no external record until personal authorization, human-verification attestation, target scope and unused request reference checks pass. Do not change a manifest/receipt by hand to bypass a failure. Keep the visitor entry closed after restore until replay and recorded cleanup have completed.

2026-10-07 J-004-r7: before any future receipt retirement, the manual **Acceptance read-only erasure readiness** workflow can record sanitized current erasure observations. It does not prove backup retirement, perform purge or replace human identity verification. Exit 0 only means the read completed; all backup checkpoints and purge permission remain blocked. See [tool scope, limitations and execution](acceptance/J004-2026-10-07-erasure-readiness.md).
