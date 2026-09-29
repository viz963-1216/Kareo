# J-004-r2 發布演練與證據表

2026-09-29：準備文件已整理；**未演練、未上線、release gate CLOSED**。

## 已確認與待確認

| 項目 | 狀態／下一步 |
|---|---|
| 接件人 | 已指定：蘇子傑，週一至週五 09:00–21:00；不設備援 |
| 回覆承諾／逾時門檻 | 待 Jerry 決定，1 個工作天仍是草案 |
| 刪除請求信箱與實際處理流程 | 待補；未公布不能視為完成 |
| staging／production 對應 | 待確認獨立資料庫與部署目標；不能拿 Kareocar 當測試環境 |
| Netlify | 2026-09-29 J-003 探測 Kareo／Kareocar 都 503；尚未確認恢復 |
| Supabase | J-003 只讀 catalog：Kareo 只有 sessions／consents；未做 migration／備份／還原 |
| D-05 | 同意版本全 DRAFT；不自行改 ACTIVE |
| J-003 | #44：正式驗收未通過；不得跳過 |
| 備份可接受 RPO／RTO | 待決定；先記實測，不捏造承諾 |

## 演練案例

每次記錄：日期、操作者、環境、完整 commit、部署 ID、資料／知識版本、步驟、預期、實際、證據位置、清理结果、PASS／FAIL／BLOCKED。缺任何必要證據不算 PASS。

| ID | 操作及預期 | 前置／執行者 | 現況 |
|---|---|---|---|
| R-01 | 固定 release commit 執行完整 release gate；缺 E2E 必須拒絕 | J-003；Jerry | BLOCKED |
| R-02 | 唯讀 smoke：首頁200、commit一致、PUBLISHED版號一致、未知API JSON404 | 部署可用；Jerry | 本機模擬通過，真實環境未通過 |
| R-03 | 合成 Lead：list/show 不顯示電話；reveal-contact 寫稽核；CONTACTED→ACCEPTED→CLOSED | B-006；蘇子傑本人 | BLOCKED |
| R-04 | 非法狀態轉移、未授權、撤銷密鑰後拒絕；不留下半套操作 | B-006／B-011b | BLOCKED |
| R-05 | 暫停媒合入口，前端及直接API不能新增Lead；既有案件可處理；恢復後可用 | 開關交付；Jerry | BLOCKED |
| R-06 | 備份至受控加密位置，隔離還原，核對表／列數／RLS／權限與必要函式，記RPO/RTO | 確認隔離目標與方案；Jerry | BLOCKED |
| R-07 | 回到前一個相容的前端／Functions deploy，核對marker與smoke；保留資料 | 可回復deploy及schema相容確認 | BLOCKED |
| R-08 | 每日crawler有觸發證據；變更待審；故障不改發布版 | B-009部署；Jerry | BLOCKED |
| R-09 | 發布／撤回知識；失效預覽拒絕；恢復合法版本或明確無版本 | B-012/C-006與知識資料；Jerry | BLOCKED |
| R-10 | 刪除請求、撤回同意與保存期限清理；失敗不假成功 | B-011b、D-05與客服管道 | BLOCKED |

## 執行紀錄

| 日期 | 案例 | 環境／commit／deploy | 操作者 | 實際結果／證據 | 清理 | 判定 |
|---|---|---|---|---|---|---|
| 尚未執行真人或部署演練 | — | — | — | — | — | BLOCKED |

## 本機工具驗證

`node --test scripts/tests/smoke-release.test.mjs`：3 PASS，涵蓋唯讀 GET、版本錯誤／知識不可用、HTML 404 不得假通過。

正式健康檢查須傳入確切目標，不可填預計發布但尚未存在的版號並宣稱通過：

```sh
node scripts/smoke-release.mjs --base-url=https://<已確認的站點> --commit=<40位SHA> --knowledge-version=<已發布KB版號>
```

exit 0 僅代表四項唯讀健康檢查通過；exit 1 代表檢查失敗；exit 2 代表輸入不完整。沒有任何情況可代替 J-003 release gate 或真人演練。
