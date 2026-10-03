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
| 每日到期清理作業（D-05 四個保存期限時鐘、dry-run、可重試、留執行紀錄） | PRIVACY_AND_RETENTION §6.3、DATA_MODEL §40、D-05（2026-10-03 確認，見 Jerry 2026-10-03 審查留言） | migration `run_deletion_cleanup` RPC、`src/services/retentionService.ts`、`src/scripts/cleanupExpiredData.ts` | `tests/retentionService.test.ts`（13 案例，涵蓋四個時鐘個別與合併執行、dry-run、重跑冪等）；SQL 層見 §2 |
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
- `run_deletion_cleanup`（D-05 四個時鐘，2026-10-03 Jerry 確認）：
  1. Session：`DELETION_REQUESTED` 滿 7 天（明確刪除請求）與 `ACTIVE` 閒置滿 90 天（一般未使用到期）
     兩者聯集，7 天／90 天邊界內外皆驗證。
  2. Lead 聯絡欄位：`CLOSED`／`CANCELLED` 且 `closed_at` 滿 180 天即清空 `contact_name`／
     `contact_phone`，Lead 列本身保留；已清空的不重複計數（冪等）。
  3. Lead 整筆刪除：`CLOSED`／`CANCELLED` 且 `closed_at` 滿 1 年，先刪子表
     （`lead_idempotency_records`／`lead_access_events`／`lead_status_events`）再刪 `leads` 本體
     （無 `ON DELETE CASCADE`，需手動依序刪除）；此規則生效後，原本「曾建立 Lead 的 Assessment／
     RecommendationRun 因 FK 被保留」的限制會在 1 年後自動解除（見 migration 內 NOTE）。
  4. Consent 整筆刪除：`accepted_at` 滿 3 年；precise boundary 另以 ±10 天的獨立 scratch script
     確認（避免天數換算誤差，見 PR 說明）。
  - dry-run 全部四個時鐘皆只回傳計數、不寫入／不異動；重跑（同一批已處理資料）皆正確回 0
    （冪等）；單一呼叫同時回傳四個計數並寫入單筆 `deletion_runs`。
  - 注意：180 天與 1 年的篩選條件並非互斥——一筆已逾 1 年的 Lead 若聯絡欄位仍非空，會同時被
    180 天清空與 1 年刪除兩個時鐘各計一次（先清空、後整筆刪除），`leadsContactCleared` 與
    `leadsDeleted` 因此可能同時計入同一筆 Lead；此行為在 TypeScript 層（`tests/retentionService.test.ts`
    「a single run reports and executes all four clocks together」）與 SQL scratch 驗證中均已明確
    驗證並記錄為預期設計，非 Bug。
- RLS／權限：`anon`、`authenticated` 對 `rate_limit_counters`、`deletion_runs` 的 `select` 與對四個
  新 RPC 的 `execute` 皆回 `permission denied`；`service_role` 可正常執行。

官方工具 `node tests/db/verify-db.mjs`（repo 根目錄執行）的 M3／M4 針對全部資料表／函式做 schema
層級的 RLS／權限掃描，涵蓋本次新增的表與函式。

### DeletionRun schema 延伸（待 Jerry 核准）

`deletion_runs` 新增 `leads_deleted`／`consents_deleted` 兩個計數欄位，對應 TypeScript 的
`DeletionRun.leadsDeleted`／`DeletionRun.consentsDeleted`；DATA_MODEL §40 原核准的 `DeletionRun` 只有 9 個欄位，
這兩個是本輪因 D-05 四時鐘需求新增的附加欄位，尚待 Jerry 在 `docs/DATA_MODEL.md` 正式補登，實作面
先以此處與 PR 說明標註，不視為私自擴充核心規格。

## 3. 已知限制 / Known Issues（詳見 PR）

- （已於本輪解除）原本「`run_deletion_cleanup` 不刪除曾建立過 Lead 的 Assessment／RecommendationRun」
  的限制，隨 D-05 新增的 1 年 Lead 整筆刪除時鐘生效後自動解除：Lead 列滿 1 年即整筆刪除，其
  `recommendation_id` FK 不再阻擋 RecommendationRun 的後續清理。
- （已於本輪解除）原本「一般 session 90 天未使用到期的清理不在範圍內」的限制，已以 D-05 的
  90 天閒置 `ACTIVE` session 時鐘補上。
- SQL 層行為驗證未留存於 repo（見 §2 說明），下一輪建議隨 B-012-r3 的 `@electric-sql/pglite` 依賴
  一起補上常態測試。
- `public.rls_auto_enable()`（Supabase security advisor WARN）：確認為 `RETURNS event_trigger`、
  `SECURITY DEFINER` 的自動 RLS 啟用函式，非可讀業務資料的 RPC；尚待另一輪收斂 `anon`／
  `authenticated` 不必要的 `EXECUTE` 權限（保留 event trigger 本身），本輪未處理。

## 4. 操作指令

```bash
# 每日到期清理（dry-run，不寫入任何資料）
node dist/scripts/cleanupExpiredData.js --dry-run [operatorId]

# 實際執行
node dist/scripts/cleanupExpiredData.js --commit [operatorId]
```

需要先 `npm run build`；需要 `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` 環境變數。輸出只有模式、
狀態與筆數，不含任何個資；失敗時結束碼非零，可直接重試。
