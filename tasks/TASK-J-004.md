# TASK-J-004 — Release + Lead Operations + Recovery Readiness

Owner: Jerry  
Status: 準備文件已合併（PR #22）；release gate CLOSED；未演練  
Plan revision: 2026-09-19 / 10-22 MVP

## Goal / 目標

在 J-003 完整驗收通過後，以可回復的方式把原始 MVP 發布到 production，並確認 Lead 有真人接件、知識每日更新與隱私流程可操作。目標 2026-10-22；未通過 release gate 不得宣稱完成。

## Prerequisite / 前置條件

- J-003 完整驗收（release 模式）通過；B-011b 通過。
- D-05 同意版本 ACTIVE（含位置告知）；D-06 接件人與備援人已由 Jerry 指定並同意。
- B-009 每日知識更新在部署環境有觸發紀錄（原始 MVP 必要項，無替代方案）。
- 可提前準備 checklist 與 runbook。

## 開始前必讀

`AGENTS.md`、`docs/PRODUCT_SPEC.md`、`docs/ARCHITECTURE.md`、`docs/DATA_MODEL.md`、`docs/API_CONTRACT.md`、`docs/GIT_RULES.md`、`tasks/README.md`。
高順位規格優先；本任務不自行定義新欄位、API 或產品規則。需要的規格先由 J-002 合併。

## Allowed Paths / Forbidden Paths

Allowed: `/docs/**`、`/tasks/**`、`/.github/**`、`/scripts/**`、root 部署設定
Forbidden: 所有未列出的路徑；不得提交 secret、真實個資或更改其他模組業務邏輯。

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
