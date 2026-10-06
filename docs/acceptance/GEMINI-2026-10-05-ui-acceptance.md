# Gemini：Kareo 前端操作與最新版本部署驗證報告

- **Submission Version**：`J-003-Gemini-UI-r2`
- **日期**：2026-10-06（Asia/Taipei）
- **基準 Staging Commit**：`1253b08b98c0ac706acb46a0a4b371936f82af0d`（HEAD of `origin/staging`）
- **操作者標示**：Gemini Assistant（AI 自動化分析、靜態程式碼合約檢驗與受限環境操作；未冒用 Jerry 姓名，真人操作與最終核准依既定守則仍由 Jerry 本人執行）
- **整體驗收判定**：**Integrated 維持否（false）**；所有 17 項部署 UI 案例在 Release Gate 上**全數維持 PENDING**。

---

## 本版更新摘要（Changelog）

- **Added**：
  - 依照 Codex 審查意見（PR #83 comment 6007115966），於矩陣中補齊完整欄位：`測試環境/baseUrl`、`apiMode`、`觀察到的完整 SHA`、`操作時間`、`證據引用`與`實際完成範圍`。
  - 新增對公開站點正確契約端點（`/api/v1/consent`、`/api/v1/providers`）的唯讀探測診斷紀錄。
- **Changed**：
  - 修正前版不精確之程式分析用語：移除不存在之 `parseErrorEnvelope`，改為精確引用 `realAdapter.ts` 內實際之 `request` 核心函式及各回應合約驗證函式（`isResourceLookupResponse`、`isAssessmentResponse` 等）。
  - 將「本機 Mock / 單元測試 / 靜態分析」與「部署環境操作」嚴格分開標示；明確註明 5 所輔具中心及知識卡片載入來自本機 Mock / 單元測試，而非部署 Real API。
  - 分開說明 `SESSION_INVALID` 觸發時之 Token 清除（`clearToken` 即時清除 `sessionStorage`）與使用者點擊「重新開始」按鈕後之 React 狀態清空／導頁（`clearState`）。
  - 修正主流程描述：明確標示主流程端到端操作受 D-05 DRAFT 阻擋，E2E-23/24 僅完成公開頁面之視口縮放與 Skip Link / 鍵盤焦點操作，未宣稱完整主流程通過。
- **Fixed**：
  - 修正前版將 `GET /api/resource-lookup` 與 `GET /api/consent` 誤列為正式端點的推論錯誤；將舊測試路徑之 404 移至診斷說明，不據此宣稱正式 API 不存在。
- **Known Issues / 未達成項目**：
  - 線上正式站點部署 Commit 仍為 `8f509c0`，未同步至目標 Commit `1253b08b...`；Netlify 因額度限制暫停生產部署。
  - Netlify PR #82 預覽（deploy `6ac34be1...`）受 Team Login 保護（命令列回傳 HTTP 401 登入 HTML），無法以未授權自動化工具完成版本繫結 E2E。
  - D-05 營運者審閱雖已由蘇子傑有條件核准（`OWNER_APPROVED_CONDITIONAL`），但 `activationAllowed = false`，正式同意文案仍為 `DRAFT`，健康與媒合主流程受前置條件阻擋。

---

## 1. 來源與環境查核紀錄

### 1.1 目標 Commit 與 D-05 狀態
1. **基準 Commit**：`1253b08b98c0ac706acb46a0a4b371936f82af0d`（HEAD of `origin/staging`）。
2. **D-05 候選審閱狀態**（`docs/acceptance/D05-2026-10-05-owner-review.md`）：
   - 狀態：**OWNER_APPROVED_CONDITIONAL**（營運方案有條件核准；正式啟用仍受工程條件阻擋）。
   - 決定者：`approvedBy = 蘇子傑`（記錄依據為對話決定之 GitHub 紀錄）。
   - 審閱日期：`approvedAt = 2026-10-05`。
   - 啟用條件：`approvalConditionsSatisfied = false`，`activationAllowed = false`。
   - 正式同意文案：**仍為 DRAFT**，線上未發布 ACTIVE 同意組合。
   - 規則落實：不繞過版本/token驗證，不替 Codex 或 Jerry 核准 D-05，不自行變更 DRAFT 為 ACTIVE。

### 1.2 部署站點與版本標記實際觀察
1. **公開 Staging 站點**（`https://kareo-tw.netlify.app/kareo-version.json` 及 `https://staging--kareo-tw.netlify.app/kareo-version.json`）：
   - 完整 Commit：`8f509c0567436392b9421bfb2e906d565c6f9438`
   - Context：`production`
   - Deploy ID：`6ac0d01145b99700084c2c48`
   - Built At：`2026-10-03T09:51:33.396Z`
   - 比對結果：`matches: false`（觀察到之 `8f509c0...` 不等於目標 `1253b08b...`）。
2. **受保護 PR #82 預覽**（`https://6ac34be1269dfa0008dc778c--kareo-tw.netlify.app/`，deploy ID `6ac34be1269dfa0008dc778c`，部署 Commit `002ce9b55dc0c7ca76f33603fd66306e3515bef4`）：
   - 設有 Netlify Team Protection。未授權命令列抓取 `/kareo-version.json` 回傳 `HTTP 401 Unauthorized` 登入 HTML。
   - 自動化測試無法取得非保護之版本標記，不偽造目標 Commit 為已讀取之版本。

### 1.3 唯讀 API 端點探測與診斷說明
- **正式端點規格**（依 `docs/API_CONTRACT.md`）：
  - 資源查詢：`GET /api/v1/providers`
  - 知識紀錄：`GET /api/v1/knowledge/records`
  - 同意程序：`POST /api/v1/consent`
- **公開站點（`8f509c0`）實測現象**：
  - `GET /api/v1/consent` 回傳 `HTTP 400 INVALID_REQUEST`（訊息：「僅支援 POST /api/v1/consent。」）。證明端點存在，但因本輪未送出 POST，且 D-05 仍為 DRAFT，未進行寫入操作。
  - `GET /api/v1/providers?page=1&pageSize=1` 回傳 `HTTP 400 VALIDATION_ERROR`（訊息：「缺少有效的 providerId。」）。此為舊版 provider 端點契約行為，尚未具備 PR #71 所引入之公開列表查詢功能。
- **路徑誤判之修正診斷**：
  - 前版報告所提 `GET /api/resource-lookup` 與 `GET /api/consent` 回傳 404，係因未帶 `/api/v1` 前綴或路徑非契約端點所致，屬測試指令之診斷偏差，不作為「正式 API 不存在」之論據。

---

## 2. 17 項 UI 案例分類矩陣（含詳細環境與證據）

依驗收規範，將 17 項案例逐項歸類為：
- **「已實際操作」**：在指定環境中具備實際操作步驟與觀察結果（若僅涵蓋部分頁面，如實標明實際完成範圍）。
- **「僅程式邏輯分析」**：透過靜態原始碼掃描、單元測試、型別守衛或合約檢驗證明其規範符合性。
- **「受前置條件阻擋」**：受限於 D-05 仍為 DRAFT、目標 Commit 未部署或缺少後端環境，無法執行端到端操作。

> **Release Gate 判定**：依 `tests/e2e/results/README.md`，因線上版本標記不符且前置條件未齊備，**所有 17 項部署案例在部署驗收上全數維持 PENDING**。本報告嚴格禁止將本機或靜態測試結果灌入 `tests/e2e/results/` 作為部署 PASS。

| 案例編號 | 標題與規格要求 | 前置條件 | 分類 | 測試環境 / baseUrl | apiMode | 觀察到的完整 SHA | 操作時間 | 證據引用 | 實際完成範圍 | 部署狀態 |
|---|---|---|---|---|---|---|---|---|---|---|
| **E2E-44** | 首頁公開資源查詢：雙北類別／所在地／行政區／名稱、分頁、錯誤及詳細資料；不建立 session、不收健康／聯絡資料 | B-013, C-007 | **已實際操作** | `https://kareo-tw.netlify.app/resources` 及本機 loopback | real（線上）/ mock（本機） | 8f509c0567436392b9421bfb2e906d565c6f9438 | 2026-10-05T10:48Z | 本機 `resourceLookupC007.test.ts`、線上 HTTP 400 回應 | 線上確認未發起 `/session` 且呈現安全錯誤；本機 Mock 驗證各篩選控制項與雙北限制面板 | **PENDING** |
| **E2E-47** | 雙北特約廠商標示與 contractCity 篩選、輔具資源中心可查詢；特約欄位與資源中心不進推薦或媒合 | A-006, A-007, B-013, C-007, B-005, D-05 | **僅程式邏輯分析** | 本機環境 | mock | 未取得（線上無成功資料） | 未取得 | `resourceLookupC007.test.ts`、`contracts/mock/providers/lookup/` | 5 所中心與特約標示來自本機單元測試與 Mock fixtures；線上受 API 400 阻擋，未取得部署操作證據 | **PENDING** |
| **E2E-48** | 公開長照制度／補助資訊查詢，只列目前 PUBLISHED 且有效紀錄、來源與版本；無版本／無資料／錯誤狀態正確，不做個人核定或建立 session | B-014, C-008 | **已實際操作**（部分） | `https://kareo-tw.netlify.app/info` 及本機 loopback | real（線上）/ mock（本機） | 8f509c0567436392b9421bfb2e906d565c6f9438 | 2026-10-05T10:48Z | `knowledgeInfoC008.test.ts`、線上無 Session 請求 | 線上確認純 GET 不帶 Session；知識卡片渲染與 10 類別篩選來自本機 Mock 驗證 | **PENDING** |
| **E2E-12** | Provider 詳情與卡片一致；不存在時 Not Found；Google Maps 連結等於資料值、新分頁 | B-004, C-004 | **僅程式邏輯分析** | 本機環境 | mock | 未取得（線上無成功資料） | 未取得 | `resourceLookupC007.test.ts`、`ProviderDetailPage.tsx` | 欄位比對、Not Found 畫面與 Google Maps 外連新分頁來自本機合約測試；線上未取得成功資料 | **PENDING** |
| **E2E-49** | 完成評估後列印／複製需求摘要，含核准詢問問題與1966提醒；排除姓名／電話／自由文字／座標；不保存、不送後端、不產生分享連結 | C-009, D-05 | **僅程式邏輯分析** | 本機環境 | n/a（純前端模組） | 未取得（部署主流程未通） | 未取得 | `caseManagerSummaryC009.test.ts`、`styles.css` @media print | 純前端組裝函式與去識別化驗證通過；因主流程受阻，線上部署未實際操作列印／剪貼簿 | **PENDING** |
| **E2E-23** | 手機（375px）、平板（768px）、桌機完成主流程 | C-005 | **已實際操作**（部分頁面） | `https://kareo-tw.netlify.app/` 及各公開頁 | real | 8f509c0567436392b9421bfb2e906d565c6f9438 | 2026-10-05T10:48Z | `styles.css` 行 15/78、瀏覽器視窗縮放檢視 | 僅完成首頁、資源頁、隱私頁之 375px/768px/1440px 響應式排版檢視；主流程因前置受阻未完成 | **PENDING** |
| **E2E-24** | 只用鍵盤完成主流程（skip link、表單、按鈕、外連） | C-005 | **已實際操作**（部分頁面） | `https://kareo-tw.netlify.app/` | real | 8f509c0567436392b9421bfb2e906d565c6f9438 | 2026-10-05T10:48Z | DOM 焦點檢視、`styles.css` :focus-visible | 僅完成首頁 Skip Link（Tab 滑入、Enter 移至 `#main-content`）及表單元素焦點檢驗；主流程未完成 | **PENDING** |
| **E2E-42** | 失敗畫面與 API 錯誤不暴露個資、token 或資料庫錯誤；成功畫面只對應真實 API 成功回應 | C-005 | **僅程式邏輯分析** | 本機程式碼審查 | real / mock | 8f509c0567436392b9421bfb2e906d565c6f9438 | 2026-10-05T10:48Z | `realAdapter.ts` 行 351-413、`uiCopy.test.ts` | 程式分析證實 `request` 攔截錯誤並由 `FALLBACK_MESSAGES` 轉為安全文字；線上實測 400 亦未洩漏內部堆疊 | **PENDING** |
| **E2E-43** | Session 失效流程：SESSION_INVALID 時前端清除 token、引導重新開始，不顯示或送出舊資料 | B-011a, C-005 | **僅程式邏輯分析** | 本機程式碼審查 | real | 未取得（部署未觸發過期） | 未取得 | `realAdapter.ts` 行 410、`SessionProblem.tsx`、`realAdapterC005.test.ts` | 程式分析證實 `request` 即時移除 Token，使用者點擊「重新開始」觸發 `clearState`；線上未實際模擬過期 | **PENDING** |
| **E2E-35** | 補助估算只依正式規則與已發布知識：來源與知識版本可見；無「已核定」「您可獲得」等宣稱；1966／照管中心提醒 | B-010, C-005, E2E-25 | **僅程式邏輯分析**＋**受前置阻擋** | 本機環境 | mock | 未取得 | 未取得 | `uiCopy.test.ts`、`ResultPage.tsx` | 靜態掃描確認無「已核定」等誇大用語且無寫死金額比率；結果頁端到端受 D-05 DRAFT 阻擋 | **PENDING** |
| **E2E-22** | 網路中斷／逾時後重試成功，不產生重複資料、不顯示假成功 | C-005, B-006 | **僅程式邏輯分析**＋**受前置阻擋** | 本機環境 | mock | 未取得 | 未取得 | `leadIdempotency.test.ts`、`LeadPage.tsx` | 單元測試證明相同內容沿用同一 Idempotency-Key 且前端設有同步連點鎖；線上受 Lead API 阻擋 | **PENDING** |
| **E2E-46** | 公開查詢詳細頁沒有我要媒合；繞過 UI 以查詢結果直接建立 Lead 被拒絕 | B-006, C-007, D-05 | **僅程式邏輯分析**＋**受前置阻擋** | 本機環境 | mock | 未取得 | 未取得 | `ProviderDetailPage.tsx` 行 115-128、B-006 後端測試 | 程式分析確認 `fromResourceLookup` 隱藏我要媒合；線上受查詢 API 400 阻擋，未送出繞過請求 | **PENDING** |
| **E2E-45** | 同一真實機構：服務範圍未知可查詢並標示；SERVICE_AREA 預設排除，主動包含列最後；不進入 Top 3，查詢與推薦用語分開 | A-006, B-013, C-007, B-005, D-05 | **僅程式邏輯分析**＋**受前置阻擋** | 本機環境 | mock | 未取得 | 未取得 | `ResourceLookupPage.tsx`、`resourceLookupC007.test.ts` | 本機 Mock 驗證待確認機構勾選後獨立置底；Top 3 推薦比對受主流程阻擋，線上未取得操作數據 | **PENDING** |
| **E2E-05** | 結果頁顯示可能需要的服務、可能適用制度與補助說明；summary 數值與 PUBLISHED 一致；預估用語與 1966 提醒 | B-010, C-005, D-01a, E2E-25 | **受前置條件阻擋** | 線上環境 | real | 未取得（前置阻擋） | 未取得 | `D05-2026-10-05-owner-review.md` | 受 D-05 DRAFT（`activationAllowed=false`）及線上目標 API 未部署阻擋，無法提交評估 | **PENDING** |
| **E2E-10** | 不提供位置 → 完成初評與服務建議、不呼叫推薦、提醒補充縣市／行政區、不顯示「附近」 | B-010, C-005, D-13b | **受前置條件阻擋** | 線上環境 | real | 未取得（前置阻擋） | 未取得 | 同上 | 同上；無位置評估鏈路受 D-05 阻擋，未實際操作 | **PENDING** |
| **E2E-29** | GPS 拒絕／失敗／逾時 → 顯示原因、改選行政區（或不提供）完成評估，評估不中斷 | C-005, B-010, D-13g | **受前置條件阻擋** | 線上環境 | real | 未取得（前置阻擋） | 未取得 | 同上 | 同上；定位降級與評估流程受 D-05 阻擋，未實際操作 | **PENDING** |
| **E2E-41** | 主流程一次走完：首頁 → 新 session → 有效同意 → 評估 → 需求／制度／補助結果 → 推薦 → 詳情／Maps → Lead → DB關聯 | B-011a, B-010, B-005, B-006, C-005, E2E-25, D-05 | **受前置條件阻擋** | 線上環境 | real | 8f509c0567436392b9421bfb2e906d565c6f9438 | 2026-10-05T10:48Z | 同上 | 線上確認同意頁呈現草案標示，因前置未滿足禁止送出真實健康／聯絡資料，主流程未執行 | **PENDING** |

---

## 3. 程式分析與合約安全技術說明

依審查意見，本節修正並精確引用前端實際之 API 配接器架構：

1. **網路請求核心與錯誤防護（`apps/web/src/api/realAdapter.ts`）**：
   - 核心請求函式為 `request<T>(method, path, body, extraHeaders)`（行 351–413）。
   - 前端**無** `parseErrorEnvelope` 函式。`request` 內部依序進行：
     1. 檢查非公開端點之 Token，若缺少且設定 `requireSessionToken`，直接拋出 `ApiError("SESSION_INVALID")`。
     2. 透過 `AbortController` 實施 25 秒超時防護。
     3. 解析回應 JSON，若格式不符 `{ success: boolean }` 封裝，一律視為 `INVALID_RESPONSE` 或 `HTTP_ERROR`。
     4. 若 `payload.success === false`，由 `FALLBACK_MESSAGES[code]` 進行訊息轉換，優先採用白名單安全文字，不暴露資料庫錯誤、資料表或 SQL 結構。
   - **型別系統與執行時防護界線**：TypeScript 僅提供編譯期型別約束，不能保證伺服器執行時回傳之資料安全；因此 `realAdapter.ts` 針對各個成功回傳值嚴格調用執行時驗證函式（如 `isResourceLookupResponse`、`isAssessmentResponse`、`isKnowledgeRecordsResponse` 等），校驗欄位鍵值完整性，防止伺服器意外洩漏未授權欄位。
2. **Session 失效清理兩階段機制**：
   - **第一階段（通訊層）**：當 `request` 收到後端回傳之 `SESSION_INVALID` 錯誤碼時，立即執行 `clearToken()`（行 410），即時從 `sessionStorage` 移除 `kareo.sessionToken`。
   - **第二階段（畫面與記憶體層）**：畫面顯示 `<SessionProblem>` 元件，使用者主動點擊「重新開始」按鈕後，調用 `App.tsx` 之 `clearState()`，始清空 React 記憶體內已填寫之健康與聯絡狀態，並導頁至 `/session-ended`。兩者並非全部在底層自動即時完成。
3. **靜態合約掃描之有效界線**：
   - `apps/web/tests/uiCopy.test.ts` 僅能保證被掃描之 `.tsx` 原始碼中未硬編碼「最近」、「附近」、「已核定」及特定金額百分比。
   - 該測試**不證明**後端動態產出之訊息必定合規，亦不能代替對已發布知識庫內容版本之實質審核。

---

## 4. 前端建置與代碼健康度

在當前 staging 基準（`1253b08b...`）下重新驗證前端專案：
1. **單元與合約測試**（`npm test --prefix apps/web`）：
   - 涵蓋 `uiCopy`、`resourceLookupC007`、`caseManagerSummaryC009`、`realAdapterC005`、`leadForm`、`leadIdempotency`、`location` 等 10 個測試套件。
   - 結果：**78 PASS / 0 FAIL**（耗時約 380ms）。
2. **TypeScript 型別檢查**（`npm run typecheck --prefix apps/web`）：
   - `tsc --noEmit` exit 0，無任何型別錯誤。
3. **生產打包建置**（`npm run build --prefix apps/web`）：
   - Vite 成功輸出生產 bundle，確認 mock adapter 與 fixtures 均被死碼消除（Dead Code Elimination），未打包進生產產物。
4. **代碼修改確認**：
   - 本輪維持「不修改 `apps/web/**` 業務程式碼」之準則，未變更任何前端業務程式。

---

## 5. 交付結論與後續交回事項

1. **版本與阻擋現況**：
   - 目標 Commit `1253b08b98c0ac706acb46a0a4b371936f82af0d` 尚未有對應之公開生產部署（線上仍為 `8f509c0`，PR #82 預覽受 401 保護）。
   - D-05 營運者審閱雖獲蘇子傑有條件核准，但正式文案仍為 `DRAFT`，`activationAllowed = false`。
2. **採計規範遵守**：
   - 本報告將 17 項案例中「已實際操作（含部分操作）」、「僅程式邏輯分析」與「受前置條件阻擋」嚴格分開陳述，未取得部署操作證據者均如實標註「未取得」。
   - **所有 17 項部署 E2E 案例在 Release Gate 上維持 PENDING**，不減少 49 項部署案例之驗收門檻，亦未在 `tests/e2e/results/` 偽造任何 PASS 記錄。
3. **交付分支**：
   - 本報告提交於分支 `docs/gemini-j003-ui-acceptance-oct05`，推送到 GitHub 供 Codex 彙整 49 項 E2E 及 Jerry 進行後續審查。
