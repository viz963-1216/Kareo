# D-05：不新增付費專案的驗證方案

Submission Version: D-05-readiness-r2

Jerry 最新指示：Supabase 優先使用不用收費的方式。這取代前輪新增付費還原專案的建議；不代表降級既有組織、搬移現有 Kareo／Kareocar、刪除資料，或核准將 D-05 改為 ACTIVE。

## 已完成的免費準備

2026-10-10（Asia/Taipei），在已登入的同一 Supabase 帳號建立：

| 項目 | 實際狀態 |
|---|---|
| 組織 | `Kareo Free Verification`，ID `ddsaltqezessxtjilwnv` |
| 方案 | 介面顯示 Free - $0/month；MCP get_organization 回傳 plan=free、tier=tier_free |
| 專案表單 | `Kareo Recovery Free`，Northeast Asia (Tokyo)，尚未提交、沒有 project ref |
| 安全設定 | Data API 開啟，新表自動曝光關閉、自動 RLS 開啟；未連接 GitHub 自動部署 |
| 本人交接 | Database password 未輸入，須由 Jerry 本人設定、保存及送出；若出現費用則停止 |
| 既有環境 | 原 Kareo／Kareocar、Netlify、GitHub secrets 與公開部署均未修改 |

僅組織建立已完成；不得把表單當成資料庫已建立、資料已匯入或還原已通過。get_cost 工具本輪回覆 UNAVAILABLE，沒有假填成本確認 ID 或使用 create_project 繞過；免費方案依实际 UI 與組織查詢核對，建立專案時仍須核對最终介面。

## 官方依據與費用範圍

[Supabase 組織計費](https://supabase.com/docs/guides/platform/billing-on-supabase)：免費專案上限跨 Owner／Administrator 所屬組織計算；Pro 與 Free 不能混在同一組織。已付費者仍可使用另外的免費額度，必須建立獨立 Free 組織，見 [官方操作說明](https://supabase.com/docs/guides/troubleshooting/keeping-free-projects-after-pro-upgrade-Kf9Xm2)。不建立多帳號規避額度。

新方案避免新增 Pro Compute、PITR、付費 Branch 或 Restore-to-new-project。既有 Pro 組織的原帳單不會因新 Free 組織自動取消；此處「不用收費」指新增驗證目的地採 Free，不承諾既有服務、資料輸出或其他供應商用量永遠為零。若遇免費額度限制，改用既有本機隔離環境，不轉付費或自行升級。

## 驗證分工與可證明的範圍

| 方法 | 可驗證 | 不能替代 |
|---|---|---|
| 已有 PGlite／本機 PostgreSQL 整合 | Schema、規則、權限、合成資料還原與刪除重套 | 實際雲端備份產生／還原，以及供應商實體備份 |
| 新 Free Supabase + 手動邏輯備份 | 真正 Supabase 上的應用資料備份／還原、RLS、RPC、資料比對、合成資料重套刪除（完成實跑後才採計） | 原 Kareo 的 Physical snapshot 還原、Storage 物件、供應商歷史副本汰換 |
| 原 Kareo Physical 備份 | 現有介面備份清冊仍可唯讀核對 | 不能從 UI 直接免費下載後還原本機；不得為省費用覆寫共享驗收 DB |

[官方備份文件](https://supabase.com/docs/guides/platform/backups) 建議 Free 專案自行以 CLI db dump 保存邏輯備份；[官方備份／還原流程](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) 區分 pg_dump／psql 邏輯還原與平台 Physical 還原。兩者分開記錄，不將邏輯驗證冠名為 physicalBackupVerified。

## 免費專案建立後的具體執行順序

1. 讀回新 project ref、free 方案、東京區域及空白資料庫；目標必須不同於 `ojawadobnaxduxybqolk` 與 Kareocar。未有 ref 前不猜連線字串、不中途換原 DB 的 URL／金鑰。
2. 核對並套用已審查的 Kareo migrations，保留 RLS／RPC 權限。先不接公開站、不启用郵件、排程或外部 webhook；不用平台 Auth／Vault 的全量複製。
3. 先用可追溯的公開 Provider／已發布知識及自建合成資料；不搬移真人健康、電話、Auth 密碼或現有 operator key。若需要來源 dump，先核對資料範圍、權限與一致快照，使用私有保存位置，資料不進 repo／公開 artifact。
4. 在合成資料仍存在時建立真正邏輯備份，保留 SHA-256、產生時間、版本、表清單／數量與來源／目標 ref；驗證 dump 沒有漏表／截斷。只有重新寫 JSON 不是 pg_dump 證據。
5. 使用正常刪除入口，將要求記錄保存在備份之外。正式 journal 目前限定 Kareo 驗收 ref，不可直接把新目標裝成原 ref；需獨立的目標／來源綁定與 DATA_STEWARD 授權，不能鬆綁既有 guard。相關接線未實作前列 PENDING。
6. 僅在獨立、已確認可清理的目標還原：先證明合成資料復現，再重套刪除，核對健康／聯絡清除、Session 停用、非目標保留、交易失敗與重試。原驗收 DB 不覆寫。
7. 保存去敏結果與實際 RPO／RTO；原始 dump 依實際保存／汰換規則处理，不默認授權永久清除。正式 D-05 仍需副本退休及正式同意一致部署等證據。

如果要以邏輯備份作為正式主要恢復方案，須另提交清楚的範圍變更及風險決定，不能為了採用 Free 就悄悄刪掉現有 Physical 驗證條件。本輪只確立免費驗證路徑；[D-05 最新現況](D05-2026-10-10-readiness.md) 的 activationAllowed／approvalConditionsSatisfied 仍 false、registry 仍 DRAFT，49 部署 E2E 不增加 PASS。

## Changelog / QA

Added: 實際 Free 組織及交接狀態、免費邏輯驗證順序。

Changed: 付費還原建議改列暫不採用，優先 Free／本機。

Fixed: 明確區分 Pro 組織的新專案與獨立 Free 組織，避免誤以為 Pro 下可選免費 Compute。

Known Issues: 新資料庫尚未建立；邏輯備份／還原未執行；跨目標 journal 接線及 Physical／副本驗證仍 PENDING。

QA: 組織 UI 與 API plan 核對；文件連結／diff 檢查；不變更候選文案指紋、registry、程式、Secrets 或正式部署。
