# Gemini UI 回報與 Codex 複核紀錄

- **Submission Version**：`J-003-Gemini-UI-r3`（Codex 中心整合修訂；不是 Gemini 的新增操作宣告）
- **日期**：2026-10-06（Asia/Taipei）
- **原回報**：Gemini r2，分支 `docs/gemini-j003-ui-acceptance-oct05`，commit `e66b5f394f82b594c10af447ce36fa8617104682`
- **程式碼驗證基準**：`1253b08b98c0ac706acb46a0a4b371936f82af0d`。原回報及本修訂只改此驗收文件，應用程式與基準相同。
- **分工**：Gemini 回報前端分析及部分公開頁面操作；Codex 核對原始碼、測試與部署診斷，未冒用 Jerry 或 Gemini 操作瀏覽器。
- **判定**：文件可作為分析與阻擋紀錄。**17 項部署 UI 案例全部 PENDING；Integrated=false。** 不能以本機檢查或敘述減少 49 項部署驗收要求。

## 本版更新摘要

- **Added**：Codex 複核範圍、原回報來源、部分瀏覽器操作的證據缺口。
- **Changed**：本機 Node 單元測試、fixture、靜態檢查與瀏覽器操作分開記錄；線上觀察 SHA 與被分析的原始碼 SHA 分開。
- **Fixed**：不再把錯誤 API 路徑的 404 視為正式端點不存在；不宣稱所有成功回應都排除額外欄位，或所有錯誤訊息都由安全白名單取代。
- **Known Issues**：目標版本未確認部署、預覽保護及資料庫設定受阻、D-05 未啟用；Gemini 部分操作尚未附可供獨立複核的瀏覽器證據。
- **Scope**：僅 `docs/acceptance/GEMINI-2026-10-05-ui-acceptance.md`；未改前端、後端、契約、同意狀態、部署設定或 E2E 結果 JSON。

## 1. 已核對的環境與 D-05

### 1.1 D-05 候選審閱與正式啟用

依 `contracts/legal/proposals/2026-10-05-r1.review.json`：

- `status=OWNER_APPROVED_CONDITIONAL`。
- `approvedBy=蘇子傑`、`approvedAt=2026-10-05`，日期精度為日。
- `approvalConditionsSatisfied=false`、`activationAllowed=false`。
- 有條件核准營運方案與候選文案，不等於已取得外部法律意見或完成工程驗收。
- `contracts/legal/consent-versions.json` 的正式組合仍為 DRAFT，未新增 ACTIVE。不得以這份文件自行啟用。

### 1.2 部署診斷

公開網址：`https://kareo-tw.netlify.app/`。

Codex 2026-10-06 的唯讀探測觀察：

| GET 路徑 | HTTP／觀察 | 可支持的結論 |
|---|---|---|
| `/kareo-version.json` | 200；commit `8f509c0567436392b9421bfb2e906d565c6f9438`；context production；deploy `6ac0d01145b99700084c2c48`；builtAt `2026-10-03T09:51:33.396Z` | 與程式碼驗證基準不符 |
| `/api/v1/consent` | 400 INVALID_REQUEST：「僅支援 POST /api/v1/consent。」 | 這次 GET 不符合方法要求；不能說正式同意端點不存在，也未證明 POST 成功 |
| `/api/v1/providers?page=1&pageSize=1` | 400 VALIDATION_ERROR：「缺少有效的 providerId。」 | 本次公開查詢未成功；僅此回應不能完整證明路由問題的原因 |
| `/api/resource-lookup`、`/api/consent` | 404 NOT_FOUND | 不是目前正式契約路徑，不能據此判斷正式端點缺少 |

本輪未送出同意 POST、評估、Lead 或其他雲端資料寫入。

PR #82 永久預覽：`https://6ac34be1269dfa0008dc778c--kareo-tw.netlify.app/`。
既有部署紀錄的 commit 為 `002ce9b55dc0c7ca76f33603fd66306e3515bef4`，未登入的 runner 讀版本標記回 401 登入 HTML。此 SHA 來自部署紀錄，**不是本輪自動化成功讀到的標記**。既有 Functions log 顯示缺少 Supabase 設定，見 [#82 診斷留言](https://github.com/viz963-1216/Kareo/pull/82#issuecomment-5990022756)。r3 未重新操作雲端控制台或改設定。

### 1.3 Gemini 瀏覽器自述的證據界線

r2 自述曾於 `2026-10-05T10:48Z` 操作公開頁面：資源查詢錯誤、知識頁請求、375／768／1440px 排版、Skip Link、鍵盤焦點及草案同意頁。

該分支僅提交一份 Markdown，未附上述操作的截圖、HAR、瀏覽器逐步紀錄或可核對的 artifact 連結。**Codex 沒有獨立確認這些操作或時間**；不能把 CSS 或單元測試路徑當成瀏覽器操作證據。原自述保留於 r2 commit，不推測或補造缺少的紀錄。

矩陣中「Gemini 自述／未獨立核對」只表示收到回報；不是已採計的部署操作。若保有既有紀錄，後續提供去敏 artifact；若沒有，待環境就緒後重新操作。不得倒填舊操作時間。

## 2. 17 項 UI 案例的複核矩陣

本機證據環境為 Node 測試與原始碼，**沒有瀏覽器 baseUrl，也不是啟動中的 Mock 網站**。fixture 驗證不表示實際頁面載入；假 fetch 的 real adapter 測試也不表示呼叫雲端 API。其程式碼基準為 `1253b08b98c0ac706acb46a0a4b371936f82af0d`。

| 案例 | 範圍 | 證據分類／環境 | 可核對的證據與實際完成範圍 | 部署狀態 |
|---|---|---|---|---|
| E2E-44 | 公開資源篩選、分頁、詳細與免 session | 本機測試；Gemini 公開 `/resources` 部分操作自述未獨立核對 | `resourceLookupC007.test.ts` 檢查純函式、fixture、原始碼及假 fetch；Codex 公開 GET 得 400；無成功列表瀏覽器紀錄 | PENDING |
| E2E-47 | 特約縣市、輔具中心與推薦隔離 | 本機測試／靜態分析 | lookup fixture 及欄位校驗不證明已從真實資料庫查得 5 所中心；特約與推薦須部署後比對 | PENDING |
| E2E-48 | 公開制度、有效 PUBLISHED 資料與來源 | 本機測試；Gemini 公開 `/info` 部分操作自述未獨立核對 | `knowledgeInfoC008.test.ts` 檢查 fixture、分類、來源處理及假 fetch 無 token；未取得已發布卡片部署操作證據 | PENDING |
| E2E-12 | 詳情一致、Not Found、Maps 外連 | 本機 fixture／靜態分析 | `resourceLookupC007.test.ts` 校驗兩個詳情 fixture；`ProviderDetailPage.tsx` 為程式碼依據，不能證明已點擊外連或渲染 Not Found | PENDING |
| E2E-49 | 需求摘要複製／列印與資料排除 | 本機測試／靜態分析 | `caseManagerSummaryC009.test.ts` 檢查組裝函式、樣本輸出及 CSS／呼叫點；沒有實際剪貼簿或列印預覽紀錄 | PENDING |
| E2E-23 | 三種尺寸完成主流程 | Gemini 公開頁面部分操作自述未獨立核對；CSS 分析 | 375／768／1440px 公開頁面排版為自述；缺截圖或 artifact，主流程未執行 | PENDING |
| E2E-24 | 純鍵盤完成主流程 | Gemini 首頁部分操作自述未獨立核對；CSS／DOM 程式分析 | Skip Link 與焦點為自述；缺逐步紀錄，不能當作完整主流程鍵盤驗收 | PENDING |
| E2E-42 | 安全錯誤與真實成功 | 程式分析及有限 GET 診斷 | `realAdapter.ts` 檢查 envelope 與部分欄位；本輪兩個 400 的訊息未包含堆疊，不證明所有失敗／成功分支安全 | PENDING |
| E2E-43 | 過期 token 與重新開始 | 本機測試／程式分析 | `realAdapterC005.test.ts`、`SessionProblem.tsx`；清 token 與按下重新開始後清狀態分開，未在部署觸發過期 | PENDING |
| E2E-35 | 預估補助、正式規則與版本 | 靜態分析＋主流程受阻 | `uiCopy.test.ts` 只涵蓋指定原始碼；未比對部署結果與 PUBLISHED 金額／版本 | PENDING |
| E2E-22 | 斷線重試、無重複／假成功 | 本機測試／程式分析＋受阻 | `leadIdempotency.test.ts` 與同步鎖程式碼；未操作部署斷線重試或核對資料庫唯一案件 | PENDING |
| E2E-46 | 公開詳情無媒合、繞過 UI 被拒 | 本機測試／程式分析＋受阻 | `ProviderDetailPage.tsx`、resource-origin 靜態測試；沒有部署繞過請求／拒絕證據 | PENDING |
| E2E-45 | 未知服務範圍可查但不進 Top 3 | 本機測試／fixture＋受阻 | 查詢分組及 fixture 隔離不證明同一真實機構在部署 Top 3 被排除 | PENDING |
| E2E-05 | 結果制度、補助及 PUBLISHED 一致 | 受前置條件阻擋 | D-05 未啟用；未取得部署評估結果 | PENDING |
| E2E-10 | 無位置評估、不呼叫推薦 | 受前置條件阻擋 | 未執行部署無位置鏈路 | PENDING |
| E2E-29 | GPS 拒絕／失敗／逾時降級 | 受前置條件阻擋 | 未執行部署定位降級與評估 | PENDING |
| E2E-41 | 首頁到 Lead 與 DB 關聯的主流程 | 受前置條件阻擋 | 草案頁為 Gemini 自述；沒有有效同意、評估、推薦、Lead 與資料庫關聯的完整操作證據 | PENDING |

所有項目均缺少可採計的「同一目標 SHA／同一 baseUrl」部署前後標記及完整行為證據；矩陣不填入本機 SHA 作為 observed deployment SHA。原自述的線上 SHA `8f509c0567436392b9421bfb2e906d565c6f9438` 與基準不同，不能移植為新部署證據。

## 3. 原始碼能支持與不能支持的結論

- `apps/web/src/api/realAdapter.ts` 的網路核心為 `request<T>`，沒有 `parseErrorEnvelope`。非 JSON／不一致 envelope 會拒絕，具超時處理。
- 已知錯誤碼優先使用 `FALLBACK_MESSAGES`；目前未知錯誤碼可能使用伺服器的 `error.message`。因此不能宣稱所有錯誤都已被前端白名單遮蔽，或以一個安全 400 推論整站不洩漏。後端安全錯誤與各部署分支仍需測試。
- 部分方法使用執行時驗證函式，公開資源與知識資料包含 exact-key 檢查；其他方法的驗證範圍不同。例如 `isAssessmentResponse` 主要驗證必要欄位，`acceptConsent` 使用通用 request。不能一概說所有成功回應都嚴格排除額外欄位或已證明個資不外洩。
- TypeScript 不會對伺服器 JSON 自動執行資料校驗。原始碼及 fixture 可支持特定檢查存在，不能代替真實 API／瀏覽器驗收。
- `SESSION_INVALID` 會在通訊層清 token；`SessionProblem` 顯示重新開始，由使用者操作後清 React 狀態並導頁。兩個階段不是全部自動同時發生。
- `uiCopy.test.ts` 的禁詞檢查針對去除註解後的 .tsx；金額與百分比等規則掃描 .ts／.tsx。測試使用特定模式，不能證明所有措辭、數值或後端動態內容合規。
- 摘要測試驗證指定樣本與禁用欄位標記，及原始碼無新增持久化／API 呼叫。實際內容來源與剪貼簿、列印行為仍需部署操作。

以上是驗收證據的範圍描述，不是新產品規格，也未據此修改業務邏輯。

## 4. Codex 本機複驗（2026-10-06）

在僅增加文件的工作分支、相同應用程式基準下執行：

| 指令／檢查 | 結果 | 意義與限制 |
|---|---|---|
| `npm test --prefix apps/web` | 78 PASS、0 FAIL | Node 單元／合約／靜態測試，不是瀏覽器 E2E |
| `npm run typecheck --prefix apps/web` | exit 0 | 編譯期型別檢查 |
| `VITE_KAREO_API_MODE=real VITE_KAREO_DEPLOY_CONTEXT=production npm run build --prefix apps/web` | 成功 | 明確 real 模式的本機建置，不是 Netlify 部署 |
| 掃描 `apps/web/dist` 的 CI Mock 識別字 | 0 個命中文件 | 規則為 `SES-MOCK\|CON-MOCK\|ASM-MOCK\|KB-MOCK\|PROV-MOCK\|REC-MOCK\|LEAD-MOCK`；只證明此掃描未命中，不宣稱全面秘密掃描 |

本輪沒有新增測試來重複實作、沒有新增 secret、沒有健康／聯絡資料寫入、沒有支付或正式發布。

## 5. 後續交回

1. 依 Jerry 的環境授權完成受控驗收資料庫設定，部署可確認的目標版本；保護存取、設定缺失與版本不符分開處理。
2. 按 `docs/handoffs/GEMINI-J003-UI-AND-DEPLOY-2026-10-05.md`，環境到位後重做 UI 操作，逐項記錄真正觀察到的完整 SHA、URL、操作時間及去敏 artifact。
3. 本輪文件合併只代表分析與阻擋紀錄被收錄，不代表 D-05 ACTIVE、J-003 完成或 J-004 正式發布。
4. 維持 `tests/e2e/results/README.md` 的採計規則；結果檔由工具產生，不手填或搬用舊版本 PASS。

審查來源：[Codex r2 交回留言](https://github.com/viz963-1216/Kareo/pull/83#issuecomment-6007115966)。
