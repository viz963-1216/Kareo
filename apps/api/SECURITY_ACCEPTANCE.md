# Security + Privacy Acceptance（TASK-B-011b）

依 `docs/ARCHITECTURE.md` §20.4-20.7、`docs/PRIVACY_AND_RETENTION.md` §6、`docs/DATA_MODEL.md` §39-40。
供 J-003／J-004 驗收與操作參考，不是正式規格本身（規格以 `docs/**` 為準）。

## 1. 驗收矩陣

| 項目 | 規格依據 | 實作位置 | 驗證方式 |
|---|---|---|---|
| 持久化限流（不可被單一 function instance 記憶體繞過） | ARCHITECTURE §20.4 | migration `0019_security_acceptance.sql`（`rate_limit_counters` + `check_rate_limit`）、`src/services/rateLimitService.ts` | `tests/rateLimitService.test.ts`；RLS／權限見 §3 |
| 7 條限流規則套用到對應端點 | ARCHITECTURE §20.4 表格 | `src/functions/session.ts`（CREATE_SESSION）、`consent.ts`（CONSENT）、`assessment.ts`（ASSESSMENT）、`recommendations.ts`（RECOMMENDATION）、`providerDetail.ts`（PROVIDER_DETAIL）、`leads.ts`（LEAD、LEAD_PHONE） | `tests/functions.test.ts`、各自 handler 的既有測試；規則上限見 `src/services/rateLimitService.ts` `RATE_LIMIT_RULES` |
| Payload 上限（16 KB body、freeText 500 字） | ARCHITECTURE §20.4 | `src/services/requestLimitsService.ts`，套用於 assessment／consent／recommendations／leads 四個會解析 JSON body 的 handler | `tests/requestLimitsService.test.ts`、`tests/functions.test.ts`（413 PAYLOAD_TOO_LARGE 案例） |
| `DELETE /api/v1/session` | API_CONTRACT §6 v0.2、PRIVACY_AND_RETENTION §6.1 | `src/functions/session.ts`（DELETE 分支）、`src/services/sessionService.ts` `deleteSession` | `tests/session.test.ts`（`deleteSession` describe 區塊） |
| `POST /api/v1/consent/withdraw` | API_CONTRACT §7 v0.2、PRIVACY_AND_RETENTION §3.3 | `src/functions/consentWithdraw.ts`、`src/services/consentService.ts` `withdrawConsent` | `tests/consent.test.ts`（`withdrawConsent` describe 區塊） |
| 同意撤回／使用者刪除立即取消未終態 Lead、清空聯絡欄位 | PRIVACY_AND_RETENTION §3.3、§6.1 | migration `request_session_deletion`／`withdraw_consent` RPC | `tests/session.test.ts`、`tests/consent.test.ts` 的 Lead 級聯案例；SQL 層見 §2 |
| 每日到期清理作業（dry-run、可重試、留執行紀錄） | PRIVACY_AND_RETENTION §6.3、DATA_MODEL §40 | migration `run_deletion_cleanup` RPC、`src/services/retentionService.ts`、`src/scripts/cleanupExpiredData.ts` | `tests/retentionService.test.ts`；SQL 層見 §2 |
| 敏感資料表 RLS、anon／authenticated 無權限 | ARCHITECTURE §20、PRIVACY_AND_RETENTION §7 | migration `0019_security_acceptance.sql` 的 `alter table ... enable row level security` + `revoke all ... grant ... to service_role` | 見 §2（PGlite 行為驗證，非一次性留存於 repo；詳見 PR 說明） |
| log／錯誤不含敏感原文 | ARCHITECTURE §20.6 | `src/services/retentionService.ts`（`errorMessage` 固定分類訊息，不帶出原始例外）、`src/scripts/cleanupExpiredData.ts`（只印筆數與狀態） | 人工檢查（見本檔 §4） |
| Lead 冪等與併發 | ARCHITECTURE §20.5 | B-006 既有（`lead_idempotency_records`、`leads_session_provider_service_open_idx` 唯一約束） | 既有 `tests/leadCli.test.ts`、`tests/idempotencyKey.test.ts`（本輪未修改，確認仍通過） |

## 2. SQL 層行為驗證（RPC／RLS）

依專案慣例，新增 RPC／RLS 的行為驗證以一次性 PGlite scratch script 完成（寫、跑、刪），結果記錄於 PR
說明，不留存在 repo（`@electric-sql/pglite` 目前只是 `tests/db/`（J-003 工具）的 devDependency，尚未
加進 `apps/api/package.json`；B-012-r3 已取得 Jerry 核准加入，待該 PR 合併後本分支可透過 rebase 取得，
屆時可比照改為常態留存的 PGlite 測試，不在本輪重複申請同一個套件的 GIT_RULES §9 核准）。

驗證涵蓋：

- `check_rate_limit`：同一 key 在視窗內正確計數與封鎖、視窗過期後重置、不同 key 互不影響。
- `request_session_deletion`／`withdraw_consent`：session 轉 `DELETION_REQUESTED`（CAS，重複呼叫
  安全）、同一 session 的未終態 Lead 立即 `CANCELLED` 並清空聯絡欄位、`lead_status_events` 寫入
  `operator_id = null`。
- `run_deletion_cleanup`：7 天內／外的邊界、dry-run 不寫入、曾建立 Lead 的 Assessment／
  RecommendationRun 因 FK 保留不刪除（見 migration 內的 NOTE 已知限制）、沒有 Lead 的 session 正確
  清除其 Assessment／CareNeedProfile／RecommendationRun／RecommendationItem。
- RLS／權限：`anon`、`authenticated` 對 `rate_limit_counters`、`deletion_runs` 的 `select` 與對四個
  新 RPC 的 `execute` 皆回 `permission denied`；`service_role` 可正常執行。

官方工具 `node tests/db/verify-db.mjs`（repo 根目錄執行）的 M3／M4 針對全部資料表／函式做 schema
層級的 RLS／權限掃描，涵蓋本次新增的表與函式。

## 3. 已知限制 / Known Issues（詳見 PR）

- `run_deletion_cleanup` 不刪除曾建立過 Lead 的 Assessment／RecommendationRun（`leads.recommendation_id`
  為 not null FK、且 Lead 案件骨架依規格永久保留），與 PRIVACY_AND_RETENTION §6.1 字面「7 天內刪除」
  在這個案例上有落差，需要 Jerry 決定是否調整 Lead 的保存期限規則或 schema。
- `run_deletion_cleanup` 目前只處理 `DELETE /session` 與同意撤回觸發的 `DELETION_REQUESTED` 清理；
  一般 session 90 天未使用到期（ARCHITECTURE §20.2 的 `expiresAt`）後的清理不在本輪範圍（`expiresAt`
  過期只影響 `requireValidSession` 回 `SESSION_INVALID`，不會自動觸發刪除流程）。
- SQL 層行為驗證未留存於 repo（見 §2 說明），下一輪建議隨 B-012-r3 的 `@electric-sql/pglite` 依賴
  一起補上常態測試。

## 4. 操作指令

```bash
# 每日到期清理（dry-run，不寫入任何資料）
node dist/scripts/cleanupExpiredData.js --dry-run [operatorId]

# 實際執行
node dist/scripts/cleanupExpiredData.js --commit [operatorId]
```

需要先 `npm run build`；需要 `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` 環境變數。輸出只有模式、
狀態與筆數，不含任何個資；失敗時結束碼非零，可直接重試。
