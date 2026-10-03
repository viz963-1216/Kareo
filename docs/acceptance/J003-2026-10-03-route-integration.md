# J-003-r10 — 路由接線、隔離組合與唯讀部署驗證

日期：2026-10-03（Asia/Taipei）  
Owner：Jerry；執行：Codex  
規格基準：staging `05b1c4a537381e04ecc29b841bdb6f43648346e6`（J-002-r13）

**Integrated：否。** 本輪完成 J 可獨立處理的接線與工具；B 的 PR 未合併，D-05 仍 DRAFT。完整 49 必要 E2E 尚未通過，不能標記 J-003 完成或 Production Complete。

## 1. 各 B PR 中已補的 J 路由

| PR | 工程師程式 head | J 路由提交／本輪審查 head | 變更 |
|---|---|---|---|
| #48 B-012-r5 | `d5b21500d69c70169d675dbd7af835579fddba76` | `fa2a113` | admin records `:recordId/decision`、changes `:changeId/dismiss` |
| #55 B-011b-r4 | `3625c83264a801807a3fb340d95009b1756aec77` | `8455529` | `POST /api/v1/consent/withdraw` → consentWithdraw |
| #57 B-013-r2 | `cf6d56edaa6bee5575afadcfdc83c3be340e814d` | `0d77774` | `GET /api/v1/providers` → providers；放在 providers/* 前 |
| #67 B-014-r2 | `9b6e822011693430824a01aabafa6e29c3e8fc63` | `a2abbc5` | `GET /api/v1/knowledge/records` → knowledgeRecords |
| #58 C-007-r3 | `fc957eab7a7835014cb84682143ddae76b9793ab` | 同前 | 未修改 C 程式，納入試驗組合 |

四筆 J 提交只改 root netlify.toml，以一般 push 更新各原 PR；沒有 force push，也沒有直接推 staging/main。三條新路由各自隨真實 B handler 進 PR，不在 staging 建假成功佔位。已在原 PR 留言提醒工程師 pull 並保留路由提交。

管理路由原本用中段 `*`；Netlify 不支援這種 splat，改用 named placeholder，API URL 與 handler 不變。依據：[Netlify Redirect options：Splats／Placeholders](https://docs.netlify.com/manage/routing/redirects/redirect-options/)。列表需在較一般的 provider 詳細規則之前：本輪真實部署 `/api/v1/providers` 被舊詳細 handler 接到，回 400「缺少有效的 providerId」。不是新列表成功。

## 2. J 工具修正

- `scripts/lib/netlify-routes.mjs` 共用 contract endpoint／route 解析；支援 §26 編號標題及端點表、去掉 query、去重十個管理端點。識別 terminal splat、named placeholder、trailing slash 與 first-match；靜態模型不是 Netlify 實際部署的替代品。
- `check-integration.mjs` 拒絕中段 splat、檢查 route shadowing；契約欄位改稱「contract route declared」，不再稱靜態路由檢查為 deployed 成功。詳細 wildcard 不可冒充缺少的公開列表。
- `check-functions-runtime.mjs` 除 PATCH 以外，會執行十個管理 API 的真實 GET／POST；沒有 esbuild 時報 PENDING，不再因未定義的 format 變數 crash；清除已完成 handler 的 timeout timer。
- 新 `run-public-api-e2e.mjs` 僅 GET，可在 D-05 DRAFT 時檢查公開能力。執行前後確認同一部署 SHA；不建立 session、不送同意／評估／Lead、不核准或發布知識。列表成功也只記 E2E-44／48 PENDING，不能拿 API 部分宣稱 UI 案例通過。
- 根目錄 scripts／adapter 測試 62 PASS（新增 route 5、public runner 3）；J-004 smoke 3 PASS。版本不符不跑案例、缺列表欄位拒絕、GET only 及 UI 部分不可 PASS 均有負向測試。

## 3. 本機隔離組合（不代表 staging）

組合分支：`integration/j003-oct03-combination`；本機 head `a1587f1616b0d4a00d852b47ac93a3c5e590fa8f`。從 staging 05b1c4a 加上本輪 J 工具，再依次合併上述五個 PR；未推送此試驗分支。

跨模組衝突只在這個試驗組合處理：

1. #48＋#55：headers 保留 getAdminTokenHeader 和 getClientIp；repository types 保留 PublishPlan、RateLimitCheckResult。
2. #48＋#67：KnowledgeRepository、Supabase／in-memory implementation 同時保留內容包／審核方法與公開知識查詢方法；不任意捨棄其中一組。
3. 初次 DB M1 **FAIL**：三個 0019。只在試驗組合改名 security → 0021、resource lookup → 0022；19/20 仍屬 B-012。沒有改 SQL 內容、沒有更名已套用雲端 migration。工程師仍需在原 PR 提交這個順序並同步介面。

| 驗證 | 實際結果 | 限制 |
|---|---|---|
| API typecheck／Vitest | PASS／562 PASS（42 files） | 現有測試未涵蓋所有 J-002-r13 新要求 |
| Web tests／typecheck／real build | 78 PASS／PASS／PASS | 沒有真實瀏覽器 E2E |
| 靜態路由／契約 | 25 PASS、0 PENDING、0 FAIL | 21 Functions、22 method/path 宣告，不證明有權限業務可用 |
| Functions ESM＋CommonJS bundle | 86 PASS、0 PENDING、0 FAIL | 無 DB 憑證的 method／錯誤 envelope；不是成功業務交易 |
| 隔離 DB，原始編號 | 23 PASS、1 FAIL、0 PENDING | M1 確認重號 |
| 隔離 DB，試驗編號，fresh | 24 PASS（19 behaviour／5 schema）、0 FAIL | PGlite，不是雲端 migration 或多連線併發 |
| 隔離 DB，試驗編號，upgrade 0008 | 28 PASS（23 behaviour／5 schema）、0 FAIL | 同上 |
| 組合 dev gate | 115 PASS、0 FAIL、49 PENDING | 49 E2E 都未在此本機組合驗收 |

原 PR 還有規格缺項，故測試綠燈不能直接核准：

- **B-012**：匯入與回填仍為 `CLI:...`；SQL 重跑更新 importedAt/importedBy；未登錄 legacy 的未發布 record 仍可用同一 ID 修正。依 D-16c 必須實際授權操作者、保留首次匯入證據、已提交 ID 不可改內容。管理端限流／payload 整合與雲端回填未完成。
- **B-011b**：cleanup SQL `updated_at <= now - interval '7 days'` 仍等滿七天才開始選資料。現有 6／8 天測試不能證明 D-05a 七天內完成；須修截止期限、邊界與失敗重跑。
- **B-013／B-014**：公開 API 120 次／小時共用限流仍未接上；B-013 原 PR migration 仍 0019，B-014 與 B-012 介面同步需正式提交。
- **C-007**：78 測試通過；先等 B-013 正確合併部署，再做真實 lookup／詳細頁對照。

建議收尾順序：#48 → #55 → #57 → #67；#58 在 #57 後。B 可立即平行完成上述修正，不需要等 J-003 全部驗收。

## 4. 真實部署，唯讀

執行時間：2026-10-03T09:40:04.203Z–09:40:10.611Z（17:40 Taipei）。目標 `https://kareo-tw.netlify.app`；前後版本標記均為 `05b1c4a537381e04ecc29b841bdb6f43648346e6`，staging branch、Netlify production context、deployId `6ac0bdd527664e000897ca52`。

結果檔：`tests/e2e/results/public-2026-10-03-j003-r10.json`。

| 案例／診斷 | 結果 |
|---|---|
| E2E-21 | PASS：未知 API 回 HTTP 404、success=false、NOT_FOUND |
| E2E-44 | PENDING：providers 列表回舊詳細 handler 的 HTTP 400，B-013 未合併／部署 |
| E2E-48 | PENDING：knowledge/records 回 JSON 404「尚未提供」，B-014 未合併／部署 |
| knowledge/status | HTTP 200、KB-2026-09-24-001；僅診斷，不另算 E2E-25 |

**本部署 E2E 1／49 有 PASS；其餘 48 尚未通過。** r9 的四筆 PASS 屬較舊部署 376f3ef，gate 正確 IGNORED，不能抄到這個部署。

Release gate：**FAILED**，49 PASS／0 FAIL／63 PENDING。這裡的 49 PASS 是全部 gate 檢查（含路由、格式與 bundle），**不是 49 個 E2E 都 PASS**；只有一個真實 E2E PASS。後续部署新 SHA 也必須重跑，不能沿用此檔。

## 5. 尚待完成

- B 模組修正／合併、migration 正式編號與雲端 catalog／回填驗證；只對已指定隔離環境作有準備的操作。
- staging／production DB 隔離、crawler secrets／排程實跑、多 function instance 限流與真實權限測試。
- D-05 最終文本與資料流程、撤回／七天清理、權利處理／備份還原演練及正式版本確認；目前同意仍 DRAFT。
- A-007 資料；49 必要案例的真實業務、瀏覽器與操作證據；J-004 release gate。

本輪未啟用正式同意、未套用雲端 SQL／migration、未修改任何雲端資料、未付新費用。GitHub route 提交可能觸發既有 Netlify PR preview，這不代表正式 E2E 已完成。
