# J-003-r12：真正 PostgreSQL 併發與受保護回填預演

日期：2026-10-04。基底 staging：`2ecf3eec1d3ef9e13310f1d0aa845be4506b6e59`（#71 中央整合＋#72 J-004-r4）。**Integrated：否。** 49 項必要部署 E2E 尚未全數通過；本紀錄不補填其結果。

## 真正 PostgreSQL 17 併發

工具：`tests/db/verify-concurrency.mjs`。本機以臨時 PostgreSQL 17.6 原生程序執行；CI 使用 `postgres:17` service。三個不同 `pg_backend_pid()`，不是 PGlite 或同一個連線模擬。

| 案例 | 實際行為 | 本機結果 |
|---|---|---|
| PG-M1 | PostgreSQL 17、22 個實際 migration、三個獨立 backend | PASS |
| PG-L1 | CLI publish 等待另一連線持有的共同鎖 | PASS |
| PG-L2 | CLI withdraw 等待同一把鎖 | PASS |
| PG-L3 | Admin publish 等待同一把鎖 | PASS |
| PG-L4 | Admin withdraw 等待同一把鎖 | PASS |
| PG-C1 | 等待期間候選內容變動，釋鎖後舊預覽遭 STATE_CHANGED 拒絕，無發布／成功稽核 | PASS |
| PG-C2 | 等待期間 CLI 發布新版，舊撤回目標遭 STATE_CHANGED 拒絕，保留新版 | PASS |
| PG-C3 | 兩個真實 Admin 發布串行執行，只提交一個版本及一筆成功稽核 | PASS |

PG-L1～L4 查 `pg_locks` 未授予 advisory waiter 及 `pg_blocking_pids`，並在釋鎖前比對內容、版本、membership 與稽核未變；不是只量測延遲。PG-C3 的第二個請求因候選已用完，現行 SQL 可回 `VALIDATION_ERROR: NO_APPROVED_RECORDS`；測試不宣稱這個情境必然是 409。

負向對照只在可丟棄本機資料庫把 CLI publisher 的鎖 `8823001` 改成 `8823002`。預期及實際：初始化 PASS、`FAIL PG-CONCURRENCY SHARED_LOCK_NOT_OBSERVED`、exit 1。CI 必須觀察到這個指定失敗，不能把初始化失敗誤算為成功對照。

工具只接受 loopback、固定 `kareo_concurrency_test` 資料庫／`kareo_test` 帳號及明確 disposable flag。**會重建 public schema，只能對專用可丟棄本機庫執行。** URI query／fragment 也遭拒絕，避免 pg 連線參數覆寫 loopback 限制；遠端主機、host query、錯誤資料庫及帳號四項實際入口檢查均在初始化前以 CONFIG_REJECTED 拒絕。本機臨時 cluster 已停止並刪除。未修改業務 SQL、未連 Supabase、未寫雲端。

新增 CI job `Real PostgreSQL concurrency`；失敗會紅燈，沒有 `continue-on-error`。GitHub 分支保護尚未設定，不能把此描述為已設 required check。

## 內容包回填離線預演

工具：`scripts/rehearse-content-backfill.mjs`。輸入是現有 Kareo 在 0019 前保存的私人應用資料快照，在本機還原再升級到 0022。快照檔不在 repo；只保存無原始資料／金鑰的結果 JSON。

實際執行已編譯的 `runBackfillCli`、正式 Supabase repositories、supabase-js，再經 loopback GET/RPC shim 呼叫實際 `upsert_content_pack`／`backfill_record_review_event` SQL。合成的本機個人操作者只存在副本，不捏造 Jerry 已在雲端執行。

| 案例 | 結果 |
|---|---|
| BF-01 錯誤個人金鑰在讀包／RPC 前拒絕 | PASS |
| BF-02 五個既有包、21 筆歷史核准事件回填 | PASS |
| BF-03 原知識內容／狀態、版本及 membership 逐列不變 | PASS |
| BF-04 歸屬實際通過驗證的本機合成操作者 | PASS |
| BF-05 重跑無重複事件、首輪 metadata 不變 | PASS |
| BF-06 篡改內容遭拒，既有內容及 metadata 不變 | PASS |
| BF-07 停用操作者在讀包／RPC 前拒絕 | PASS |

證據：`J003-2026-10-04-backfill-rehearsal.json`。本機 shim 不評估 JWT／RLS；這不是雲端回填或部署 E2E。雲端 content_packs／internal_operators 尚待正式個人操作者及受保護 CLI，不能直接 SQL 填入假稽核或改用共用操作者。

## 文件與下一步

依 GitHub 合併狀態更正 A／B／C 的過時 Task header，不把 MERGED 升級為 INTEGRATED。既有 Kareo 保持驗收用途，Jerry 決定暫不新增付費 Production DB。

Preview Functions 與 GitHub staging 的 DB 憑證目的地授權、個人操作者建立、預設分支／排程啟用、D-05 正式審閱、49 項部署 E2E 與 J-004 正式發布／完整恢復仍待處理。此 PR 不改憑證範圍、預設分支、雲端內容或同意狀態。
