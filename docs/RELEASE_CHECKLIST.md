# Kareo MVP Release Checklist / 發布檢查表

Owner: Jerry（TASK-J-004）
Submission Version: J-004-r1
Target: 2026-10-22（10/19 功能凍結、10/20–10/21 發布演練）
Release gate status: **CLOSED**

> 任何一項未勾選，都不得建立 staging → main Release PR，也不得開放正式媒合。
> 未通過時，正式站維持「整合中」狀態並在本文件記錄原因。

---

## Gate 0 — 前置依賴（全部要有證據連結）

| # | 條件 | 證據 | 狀態 |
|---|---|---|---|
| G0-1 | J-003 完整 E2E 全數通過（`docs/INTEGRATION_ACCEPTANCE.md`） | | ⛔ |
| G0-2 | B-011 安全驗收矩陣通過 | | ⛔ |
| G0-3 | 知識 PUBLISHED 版本存在，且來源／審核／發布紀錄齊全 | | ⛔ |
| G0-4 | Provider 資料通過 A-004 gate，並已匯入（列數、關聯核對） | | ⛔ |
| G0-5 | 同意文件版本為 `ACTIVE`（非 DRAFT），法務待確認事項已處理 | | ⛔ |
| G0-6 | 主要／備援接件人已指定並完成實演（見 Gate 3） | | ⛔ |
| G0-7 | 刪除請求客服信箱已公布且有人處理 | | ⛔ |
| G0-8 | 評估規則表 `RULES-*`（D-01 方案 B，不使用 AI）已由 Jerry 逐條確認 | | ⛔ |
| G0-9 | Netlify 額度足以完成發布與發布後 smoke；Kareocar 已恢復 | | ⛔（2026-09-23 兩站暫停） |
| G0-10 | 每日 00:10（Asia/Taipei）知識更新（B-009）在部署環境有觸發紀錄，變更進 NEEDS_REVIEW、失敗保留 Last Published | | ⛔ |
| G0-11 | 精確位置：ACTIVE 同意版本含位置告知後才開啟「使用目前位置」（MVP_DECISIONS D-13g）；位置流程細節 D-13a–g 與補助呈現 D-14a–b 已有 Jerry 決定紀錄 | | ⛔ |
| G0-12 | 臺北市、新北市地方制度知識已審核並發布（PRODUCT_SPEC §39、§46）；兩市各一例的 E2E 顯示各自的地方資訊、不互相套用 | | ⛔ |

## Gate 1 — 環境隔離

- [ ] **Production 使用獨立 Supabase 專案**，不與 staging 共用資料庫；不重用 Kareocar 資料庫。
- [ ] Production 與 staging 的 Netlify 環境變數完全分開：`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY` 各自一組。MVP 不使用 AI，不應設定任何 AI API key。
- [ ] 決定 production 前端的部署方式（**需要 Jerry 決定**）：
  - 方案 1：另建一個 Netlify site，production branch = `main`（staging site 維持 `staging`）。
  - 方案 2：同一 site 把 production branch 改為 `main`，`staging` 改為 branch deploy。
  - 兩者都會影響額度；以 D-09 額度決策為準。
- [ ] Production 移除 `X-Robots-Tag: noindex`（僅 production 設定）。
- [ ] 前端 production 建置：`VITE_KAREO_API_MODE` 未設定或為 `real`；`VITE_CONSENT_*` 為 ACTIVE 版本。
- [ ] 沒有任何 secret 出現在 `VITE_` 變數、repo、build log。

## Gate 2 — 資料庫與資料

- [ ] Production 依序套用所有 migration，逐一記錄時間與操作者；每支 migration 附權限（RLS）測試結果。
- [ ] anon／authenticated 無法讀寫任何業務資料表（實測）。
- [ ] Provider 匯入：dry-run 報告 → 正式匯入 → 列數與 staging 驗收版本一致。
- [ ] 知識：以同一核准內容包在 production 匯入並發布，版本號記錄於本文件。
- [ ] 清理排程（保存期限）已啟用，dry-run 結果合理。
- [ ] 測試資料（smoke、E2E 合成資料）已從 production 清除或從未寫入。

## Gate 3 — Lead 營運

- [ ] 接件人以合成 Lead 完成：list → show → reveal-contact → CONTACTED → ACCEPTED → CLOSED。
- [ ] 非法狀態轉移被拒、未授權操作者被拒、`reveal-contact` 產生存取紀錄。
- [ ] 接件人確認可承諾的服務時段與回覆時程，並與前端顯示文字一致。
- [ ] 接件人實際取得所需權限（操作者密鑰），Jerry 以外至少一人可操作。

## Gate 4 — 文案

- [ ] 所有結果頁有「初步預估」與 1966 提醒。
- [ ] 不出現正式資格、CMS 等級、補助核定用語。
- [ ] 隱私告知、同意、媒合聯絡同意文案與 ACTIVE 版本一致。
- [ ] Kareocar 以新分頁外連，無 iframe。

## Gate 5 — 觀測、額度與告警

| 項目 | 設定 | 責任人 | 狀態 |
|---|---|---|---|
| Functions 錯誤率 | Netlify function logs 每日檢查；log 不含個資 | （待指定） | ⛔ |
| 可用性 | 外部 uptime 檢查 `/` 與 `GET /api/v1/knowledge/status` | （待指定） | ⛔ |
| Netlify 額度 | 用量頁每週檢查；接近上限時暫停非必要部署 | Jerry | ⛔ |
| Supabase 用量 | 專案用量頁每週檢查 | Jerry | ⛔ |
| 超額行為 | 見 RELEASE_RUNBOOK §5 | — | ⛔ |

不啟用任何自動加值；付費或換平台由 Jerry 決策。

## Gate 6 — 備份與復原演練

- [ ] 確認 production Supabase 方案的備份能力與保存天數（記錄方案名稱與查閱日期）。
- [ ] 若無自動備份：發布前以 `pg_dump` 做一次完整備份，存放於 Jerry 控管的加密位置。
- [ ] **在隔離的測試專案**還原備份，確認資料表、列數、權限正確；記錄耗時（RTO）與資料時間點（RPO）。
- [ ] 前端／Functions 回滾演練：Netlify 發布上一個 deploy，確認可用。
- [ ] 資料庫只做相容 migration；回滾以前向修復處理，不刪除 production 資料。

## Gate 7 — Release PR 與發布後

- [ ] 建立 `staging → main` Release PR，固定 release commit 與版本號（例如 `v0.1.0`）。
- [ ] PR 附本檢查表所有證據連結。
- [ ] 發布後以合成資料執行 smoke（不含真實個資），逐項記錄。
- [ ] smoke 全通過後才開放正式媒合入口；未通過立即回滾並記錄原因。
- [ ] 交付紀錄寫入 `docs/RELEASE_RUNBOOK.md` §7。
