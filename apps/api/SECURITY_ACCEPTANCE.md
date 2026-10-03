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

B-011b-r4 起，刪除／撤回與到期清理的 SQL 行為測試常態留在 repo：`tests/retentionCleanup.pglite.test.ts`
用 `@electric-sql/pglite`（`apps/api` devDependency，版本與 #48 相同的 0.3.16）套用本分支全部 migrations，
直接呼叫 RPC 並核對資料列，隨 `npx vitest run` 執行。涵蓋：有 Lead／無 Lead、7 天／90 天邊界內外、
Lead 結案 1 年後與隔日重跑時 Assessment／CareNeedProfile／RecommendationRun／RecommendationItem 的實際
筆數；刪除與撤回兩個 RPC 的 CLOSED／CANCELLED／未終態三組 Lead；`rls_auto_enable` 權限收緊（以替身
函式模擬雲端既有函式）。其餘項目（`check_rate_limit`、四時鐘計數等）仍是先前以一次性 scratch script
驗證，結果記錄於 PR 說明。

驗證涵蓋：

- `check_rate_limit`：同一 key 在視窗內正確計數與封鎖、視窗過期後重置、不同 key 互不影響。
- `request_session_deletion`／`withdraw_consent`：session 轉 `DELETION_REQUESTED`（CAS，重複呼叫
  安全）、同一 session 的未終態 Lead 立即 `CANCELLED`、`lead_status_events` 寫入
  `operator_id = null`；該 session **全部** Lead（含已 `CLOSED`／`CANCELLED`）的聯絡欄位立即清空，
  終態 Lead 不改狀態、不寫事件（B-011b-r3 修正 Jerry P1-2）。
- `run_deletion_cleanup`（D-05 四個時鐘，2026-10-03 Jerry 確認）：
  1. Session：`DELETION_REQUESTED` 滿 7 天（明確刪除請求）與 `ACTIVE` 閒置滿 90 天（一般未使用到期）
     兩者聯集，7 天／90 天邊界內外皆驗證。該 session 的 Assessment／CareNeedProfile／
     RecommendationRun／RecommendationItem **不論是否建立過 Lead** 都在此時刪除（B-011b-r3 修正
     Jerry P1-1：已移除 `leads` 對 `assessments`／`recommendation_runs` 的外鍵，Lead 保留 id 值）。
  2. Lead 聯絡欄位：`CLOSED`／`CANCELLED` 且 `closed_at` 滿 180 天即清空 `contact_name`／
     `contact_phone`，Lead 列本身保留；已清空的不重複計數（冪等）。
  3. Lead 整筆刪除：`CLOSED`／`CANCELLED` 且 `closed_at` 滿 1 年，先刪子表
     （`lead_idempotency_records`／`lead_access_events`／`lead_status_events`）再刪 `leads` 本體
     （無 `ON DELETE CASCADE`，需手動依序刪除）。
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

- （B-011b-r3 修正）r2 曾寫「曾建立 Lead 的評估資料會在 Lead 滿 1 年刪除後自動清理」，經 Jerry
  2026-10-03 重現證明不成立（session 已轉 DELETED 後不會再被選到，評估資料永久殘留）。r3 已改為
  評估資料依 7 天／90 天期限直接刪除，與 Lead 案件骨架的 1 年期限各自獨立。
- **待 J-002 決定（schema／關聯調整提案）**：為了讓評估資料依 7 天／90 天刪除、Lead 依 1 年保存，
  r3 移除了 `leads` 對 `assessments`／`recommendation_runs` 的外鍵（Lead 保留 id 值）。此關聯調整已
  在 PR 提案交 J-002 決定並補登 DATA_MODEL §22；若 J-002 選擇其他做法（例如欄位改為可為 null 並在
  清理時設為 null），本 PR 依決定修改。
- **migration 改名 0021 待 #48 合併**：staging 尚無 B-012 的 0019／0020，現在改名會使
  `verify-db.mjs` M1 判定缺號失敗。
- `public.rls_auto_enable()`：r3 已撤銷 `anon`／`authenticated` 的 `EXECUTE`（函式存在時才執行，
  不刪函式、不動 event trigger）。本機以替身函式驗證；雲端 security advisor 重跑仍待 J 確認。

## 4. 操作指令

```bash
# 每日到期清理（dry-run，不寫入任何資料）
node dist/scripts/cleanupExpiredData.js --dry-run [operatorId]

# 實際執行
node dist/scripts/cleanupExpiredData.js --commit [operatorId]
```

需要先 `npm run build`；需要 `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` 環境變數。輸出只有模式、
狀態與筆數，不含任何個資；失敗時結束碼非零，可直接重試。
