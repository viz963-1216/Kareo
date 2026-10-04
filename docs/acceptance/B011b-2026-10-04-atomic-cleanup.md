# B-011b-r7：清理與成功執行紀錄的交易一致性

2026-10-04；基底 staging `6a4ffe6f52f6db828aecc368497a3a385f14d565`（#73）。Integrated：否。這是 J-004 複驗找到的 B-011b 修正，不是正式排程或備份還原驗收。

## 已重現的問題

舊 `runRetentionCleanup` 先以 RPC 刪除資料，收到回應後才另外 INSERT SUCCESS DeletionRun。隔離測試經實際 SupabaseSessionRepository／service 及全部 migration SQL，刻意讓 SUCCESS INSERT 失敗：服務拒絕，但 Assessment、CareNeedProfile、RecommendationRun、RecommendationItem 已從各一筆變成零筆；FAILED 計數為零。測試在舊實作 exit 1，說明只測「刪除 RPC 回滾」不足以涵蓋紀錄失敗。

## 修正與相容性

- 新前向 migration `0023_retention_cleanup_audit.sql`；0021 等已套用檔案不變。使用 Supabase CLI 2.119.0 `migration new` 建立，再依 repo 連續編號命名。
- 新內部 RPC `run_deletion_cleanup_recorded` 在一筆交易中呼叫既有期限／刪除 SQL，再 INSERT SUCCESS；INSERT 失敗時所有清理回滾。
- SQL 查操作者仍有效且具 DATA_STEWARD，以 SHARE 鎖避免交易途中撤銷；Node CLI 在之前驗個人金鑰，不以 SQL 的 operatorId 取代密鑰驗證。
- 正式 repository/service 只用新交易入口；失敗於回滾後另記 FAILED；dry-run 只計數、不寫資料或執行紀錄。
- 同一個共同鎖序列化正式清理，防止兩次排程重複計數。security invoker、固定 search_path、只有 service_role EXECUTE；不新增公開 HTTP endpoint、表或欄位。
- 所有保存期限與自助刪除／撤回方式不變。不增加共享帳號、不改 D-05 狀態、不自行啟用排程。

網路中斷可能使呼叫端無法確認交易結果；不能據此宣稱一定沒刪除。SUCCESS 與資料仍同交易，run ID 主鍵禁止失敗補記覆蓋已提交的 SUCCESS。應查執行紀錄並用既有冪等 CLI 重試，不把輸出錯誤當作完整刪除證據。FAILED 寫入本身也可能因 DB 故障失敗，指令必須保持失敗，不捏造紀錄。

## 實際驗證

`apps/api/tests/retentionAuditAtomic.test.ts` 的 SDK 邊界將真實 repository 所發的 RPC／INSERT 傳進隔離 PGlite 的實際 SQL；不連 Supabase，也不使用正式個資。

| 案例 | 實際結果 |
|---|---|
| SUCCESS INSERT 失敗 | 四類健康資料全部保留、session 待刪、只有 FAILED／0 |
| 故障解除後重試，再執行一次 | 首次刪除及 SUCCESS／1 同時提交；後次 SUCCESS／0 |
| dry-run | 真實 SQL 計數，資料與執行紀錄均不變 |
| 健康資料 DELETE 失敗 | 所有健康資料保留，只有 FAILED／0 |
| 停用／撤銷／沒有 DATA_STEWARD | 新 RPC 在清理前拒絕 |
| anon／authenticated | 新 RPC 權限拒絕 |

成功執行與 dry-run 也用 service_role 實測，不僅以 postgres 超級使用者驗證。六項 PASS；完整後端 **704 PASS／49 files**，source typecheck PASS。src＋tests 嚴格型別檢查補齊 recommendation fixture 的新 repository 方法後通過。

升級自 0018：28 PASS／0 FAIL；包含 23 個 migration、28 表 RLS、20 RPC 的權限。真正 PostgreSQL 17 三連線八項鎖驗證仍 PASS，錯誤 mutex 對照仍按預期 FAIL。fresh DB 與最終 CI 結果於 PR 留言確認。

## 未完成的驗收

此處不證明雲端定時觸發、HTTP Session／Consent 全流程、客服無 token 刪除、正式備份還原後重套刪除，或資料權利查詢／複製／更正工具。個人操作者與憑證目的地授權仍待處理；D-05 仍 DRAFT、49 項部署 E2E 尚未全通過。
