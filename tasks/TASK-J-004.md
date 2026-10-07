# TASK-J-004 — Release + Lead Operations + Recovery Readiness

Owner: Jerry  
Status: r7 已補唯讀刪除檢查工具及安全回歸；每日清理已啟用、首次自動事件待驗。先前應用資料隔離還原與空白Session雲端操作已完成；release gate CLOSED，完整實體備份／副本退役／真人權利及接件／部署回滾仍待驗。
Plan revision: 2026-09-19 / 10-22 MVP

## Goal / 目標

在 J-003 完整驗收通過後，以可回復的方式把原始 MVP 發布到 production，並確認 Lead 有真人接件、知識每日更新與隱私流程可操作。目標 2026-10-22；未通過 release gate 不得宣稱完成。

## Prerequisite / 前置條件

- J-003 完整驗收（release 模式）通過；B-011b 通過。
- D-05 同意版本 ACTIVE（含位置告知）；D-06 主要接件人為蘇子傑，週一至週五 09:00–21:00；不設備援接件人，以暫停媒合入口處理無法接件情形。回覆時限尚待核准，不得自行承諾。
- B-009 每日知識更新在部署環境有觸發紀錄（原始 MVP 必要項，無替代方案）。
- 可提前準備 checklist 與 runbook。

## 開始前必讀

`AGENTS.md`、`docs/PRODUCT_SPEC.md`、`docs/ARCHITECTURE.md`、`docs/DATA_MODEL.md`、`docs/API_CONTRACT.md`、`docs/GIT_RULES.md`、`tasks/README.md`。
高順位規格優先；本任務不自行定義新欄位、API 或產品規則。需要的規格先由 J-002 合併。

## Allowed Paths / Forbidden Paths

Allowed: `/docs/**`、`/tasks/**`、`/.github/**`、`/scripts/**`、root 部署設定
Forbidden: 所有未列出的路徑；不得提交 secret、真實個資或更改其他模組業務邏輯。

2026-10-07 r7 中心驗收補充：Jerry 既有委託範圍包含 `/tests/scripts/erasure-readiness.test.mjs`；僅測內部工具安全，不修改 A/B/C 業務邏輯。

## Deliverables / 驗收

- [ ] `docs/RELEASE_CHECKLIST.md`：確認 staging/production 資料隔離、環境變數、DB migration、網域、HTTPS、API routes、知識與 Provider 版本，保護既有 Kareocar。
- [ ] 指定接件人以合成 Lead 實演查看、接洽、狀態更新與失敗處理；沒有實際接件責任人不得宣稱媒合申請可營運。
- [ ] 確認隱私/同意/預估免責文案、刪除請求管道與清理排程可執行；測試資料清理。
- [ ] 設定錯誤/可用性觀測及責任人，log 不含個資；記錄 Netlify/Supabase 預算與額度告警、超額時行為（MVP 不使用 AI 服務，D-01）。需要付費或更換平台另由 Jerry 決策，任務不授權自動購買。
- [ ] 備份並在隔離測試環境演練還原，記錄可接受資料損失/恢復時間與結果；前端/Functions 能回復上一版，DB 使用相容 migration/前向修復方案，不以刪 production 資料回滾。
- [ ] staging→main Release PR，固定 release commit 與版本；發布後使用合成資料 smoke test，確認可用再開放正式流程。開放條件不滿足保留整合中提示並回報原因。
- [ ] `docs/RELEASE_RUNBOOK.md` 記錄發布、回滾、接件、告警與維護責任；交接人實際可取得必要權限。

## Target

10/19 功能凍結；10/20–10/21 發布演練與 smoke；10/22 交付。這是排程目標，未通過 release gate 不得冒稱完成。完整後台及會員系統不在 MVP。Crawler B-009 屬原始 MVP，release gate 列為必要項。


## Submission / Completion

從最新 `staging` 建立 `feat/j-004-mvp`，PR → `staging`，不得直接 push staging/main。
Submission Version 從 `J-004-r1` 起，退回後遞增。PR 必填 Added / Changed / Fixed / Known Issues / Tests or QA / Scope Check，逐項附驗收證據；未通過不得標記完成。模組合併不等於全站已上線。

## 變更紀錄

- 2026-09-23 J-002-r4：Goal／前置整併；移除 AI 預算項目；B-009 不再以 D-11 為替代；位置告知納入同意版本條件。

## r2 準備交付（2026-09-29）

修正發布前／後 gate 順序、接件責任與未核准時限；新增唯讀 smoke 與演練紀錄範本 docs/RELEASE_REHEARSAL.md。這些文件與本機測試不代表 J-004 已完成，真人及隔離環境演練均仍待執行。

## r3 操作準備（2026-10-03）

新增 docs/PRIVACY_REQUEST_RUNBOOK.md，涵蓋收件、最少身分確認、停止聯繫、正式工具處理、核對、回覆與備份再刪除；Jerry 已確認信箱能收信與回覆。更新發布固定目標表、回滾及隔離還原步驟與最新演練狀態。文件準備完成，不勾選未執行的 Deliverables；D-05仍DRAFT、release gate仍CLOSED，整體J-004未完成。

## r4 現有驗收環境與恢復工具（2026-10-04）

Jerry 指定現有 Kareo 為驗收並暫不建立付費正式 DB。#71 與六個來源模組 PR 已合併；既有核准 migration 0019～0022 已套用，35 資源／30 服務／98 範圍／19 特約縣市已匯入，原始業務資料完整保留。21 表應用快照在本機 PGlite 還原並逐列雙向比對通過；這不是 Supabase physical 還原或正式 RPO/RTO。每日清理沿用受保護 DATA_STEWARD CLI，workflow 預設未啟用，人工執行預設 dry-run。12 個操作工具測試通過。詳見 `docs/acceptance/J004-2026-10-04-acceptance-environment.md`；未完成項目仍不勾選。

## J-004-r5：合成備份再刪除（2026-10-05）

LOCAL-39／40 已在 PGlite 應用資料還原後，重套真實本機 HTTP 產生的合成撤回／刪除紀錄與既有 SQL 清理，通過；涵蓋還原復活的負向對照、四類健康資料、聯絡清空、同意證據、無關有效資料與冪等重試。原始快照與請求只存記憶體，報告只列筆數。這不是雲端實體備份還原，也尚未交付正式獨立刪除紀錄保存或無 token 權利工具；不勾選完整 J-004。

## 2026-10-07 雲端操作更新

受保護工具及真實 Supabase／Blobs 13項檢查通過；私人實際部署空白Session建立、DELETE及失效5項通過，既有清理workflow dry-run／commit實跑成功。每日清理開關已啟用；首次自動事件仍待觀察。單列合成還原不是實體備份演練，不勾選完整還原／發布。J-003 Integrated仍否，D-05 DRAFT；目前未正式發布。證據見 docs/acceptance/J003-2026-10-07-cloud-retention.md。


2026-10-07 r25準備補充：[實際6份Physical清冊與隔離還原檢查點](../docs/acceptance/D05-2026-10-07-backup-inventory.md)已完成；沒有點Restore、覆寫共用驗收資料庫或新增付費專案。實體備份恢復／副本退休仍待核對，不勾選完整還原或正式發布。每日更新及清理已固定已驗證Ubuntu24.04；來源仍有2失敗，首次自動清理待驗。

## 2026-10-07 J-004-r7：移除刪除紀錄前的唯讀檢查

新增受保護既有 staging 環境入口，個人 DATA_STEWARD 驗證後讀獨立紀錄與真實 HEAD 筆數，前後改變或錯誤即停止。只觀察健康資料、Session 停用、接洽／聯絡清除，另列保留案件與同意證據；永不授權 purge／ACTIVE，備份退役六條件維持待驗。11 項新增安全測試通過，實際雲端執行另記；詳見 [r7 報告](../docs/acceptance/J004-2026-10-07-erasure-readiness.md)。
