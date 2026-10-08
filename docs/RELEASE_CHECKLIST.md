# Kareo MVP Release Checklist / 發布檢查表

Owner: Jerry（TASK-J-004）
Submission Version: J-004-r9
Target: 2026-10-22（10/19 功能凍結、10/20–10/21 發布演練）
Release gate status: **CLOSED**

2026-10-04 更新：#71 與六個來源 PR 已合併；現有 Kareo 指定驗收，已套用至0022及35資源／30服務／98範圍／19特約縣市。Jerry暫不建立付費正式DB。21表應用資料本機隔離還原PASS；完整physical／刪除重套／部署回滾未驗。清理workflow尚未啟用，Preview待憑證，D-05 DRAFT；以下正式 Gate 不因此勾選。證據：`acceptance/J004-2026-10-04-acceptance-environment.md`。

> Gate 0–6 是正式合併與部署前置；可先建立草稿 Release PR 整理證據。Gate 7 在發布後執行，不能作為建立 PR 的前置，避免循環依賴。正式媒合須等發布後 smoke 與接件演練通過才開放。
> 未通過時，正式站維持「整合中」狀態並在本文件記錄原因。

## 2026-10-08 公開查詢恢復（不勾選完整營運 Gate）

Jerry 指定 release 為 Netlify 正式部署来源，自動PR預覽與其他分支部署停用；現有驗收資料庫、D-05 DRAFT 與個案流程封閉保留。此為公開資源發布，不採計完整MVP完成，不以分支名取代獨立正式DB、49項E2E或ACTIVE同意。部署記錄見 `acceptance/J004-2026-10-08-release-deployment.md`。

## 2026-10-03 準備快照

以下是已確認的整合環境，不是正式 production 清單；舊 Gate 項目逐項核對後才勾選。

| 項目 | 已確認／仍需完成 |
|---|---|
| GitHub | staging `d12992b`（#63 合併）；當時正式 main 尚未接收完整 MVP |
| Netlify（10/03歷史） | `kareo-tw` 當時從 staging 部署；已恢復，不能因 Netlify context 名叫 production 就當作 J-004 完成 |
| Supabase | Kareo `ojawadobnaxduxybqolk`，Tokyo；目前供整合使用，獨立正式目標尚未指定，禁止重用 Kareocar |
| Provider | 30 家／30 服務／86 已確認範圍，整合匯入及原子回滾已有 J-003 證據 |
| Knowledge | `KB-2026-09-24-001`：18 來源／21 紀錄／21 成員；lastVerifiedAt 保留來源原核對日 |
| 同意 | 全 DRAFT，正式版啟用及回歸未完成 |
| 信箱 | viz963@gmail.com 已公布；Jerry 確認能收信及回覆，權利端到端演練未完成 |
| E2E | 完整 49 必要案例；376f3ef 的 4 項 PASS 不能移植成新 release SHA 的證據 |
| Crawler | staging 有 workflow，release 尚無；GitHub staging environment 無 secrets，未定時實跑 |
| 備份 | 10/03 查到 7 份 physical；當時最新早於 migration／資料匯入，不可作本次完整恢復證據；PITR 未啟用 |

證據：[J-003 首次發布](acceptance/J003-2026-10-03-first-knowledge-publication.md)、[D-05 實況](acceptance/D05-2026-10-03-privacy-review.md)、[權利處理手冊](PRIVACY_REQUEST_RUNBOOK.md)。

## 發布前填寫的固定目標表

所有空白均 PENDING；環境對應及部署方案未指定前不建立或付費購買新專案。

| 欄位 | 正式發布值／證據 |
|---|---|
| 版本標籤／待發布 staging 完整 SHA／Release PR head SHA | 待指定；head 改變需重驗 |
| 正式 release merge SHA／實際部署 marker／deploy ID | 部署後記錄；不得假定與 Release PR head 相同 |
| 整合與正式 Netlify site、branch、base URL | 待 Jerry 決定；正式 branch=release |
| 整合與正式 Supabase project ref、region | 分開記錄，必須確認隔離 |
| Migration 清單／雜湊／已套用狀態／schema 相容性 | 待本次版本核對；不能只看檔名順序 |
| Provider 資料來源 commit／核對列數／關聯／未知範圍 | 待固定正式匯入目標；不任意補造服務範圍 |
| Knowledge 版號／已核准內容包／來源核對時間 | 待固定正式目標；來源核對時間不等於發布時間 |
| 三種 ACTIVE 同意版號／文案固定引用／核准紀錄 | 待 D-05；禁止把舊草案原地改字覆寫 |
| Secret 名稱／用途／目標環境／設定者 | 僅記 metadata，絕不記值；後端 key 不可進 VITE_* |
| 備份時間點／還原目標／實測與可接受 RPO、RTO | 待隔離演練及 Jerry 決定 |
| 暫停入口及恢復操作／實際授權工具 | 待確認；前端隱藏不足以阻止 API 寫入 |

---

## Gate 0 — 前置依賴（全部要有證據連結）

| # | 條件 | 證據 | 狀態 |
|---|---|---|---|
| G0-1 | J-003 完整 E2E 全數通過（`docs/INTEGRATION_ACCEPTANCE.md`） | | ⛔ |
| G0-2 | B-011b 安全驗收矩陣通過 | | ⛔ |
| G0-3 | 知識 PUBLISHED 版本存在，且來源／審核／發布紀錄齊全 | | ⛔ |
| G0-4 | Provider 資料通過 A-004 gate，並已匯入（列數、關聯核對） | | ⛔ |
| G0-5 | 同意文件版本為 `ACTIVE`（非 DRAFT），法務待確認事項已處理 | | ⛔ |
| G0-6 | 主要接件人已指定並完成實演（見 Gate 3）；**不設備援接件人**（Jerry 2026-09-24 決定） | 主要接件人：蘇子傑，週一至週五 09:00–21:00（LEAD_OPERATIONS §2） | ⛔（未實演） |
| G0-7 | 權利／刪除請求管道、責任人及受保護處理工具可用 | viz963@gmail.com；Jerry 10/03 已確認收信與回覆；B-015 合成 HTTP/CLI 驗證；[10/07 取消額外真人客服演練](acceptance/D05-2026-10-07-owner-rehearsal-cancellation.md) | 信箱／責任已確認、工具 LOCAL 通過；額外真人演練 CANCELLED_BY_OWNER；部署驗收另列，不冒稱已通過 |
| G0-8 | 評估規則表 `RULES-*`（D-01 方案 B，不使用 AI）已由 Jerry 逐條確認 | | ⛔ |
| G0-9 | Netlify 額度足以完成發布與發布後 smoke；Kareocar 已恢復 | Kareo 10/03 已恢復；發布前仍核對實際額度與 Kareocar 可用性 | ⛔（未完成本次發布核對） |
| G0-10 | 每日 00:10（Asia/Taipei）知識更新（B-009）在部署環境有觸發紀錄，變更進 NEEDS_REVIEW、失敗保留 Last Published | | ⛔ |
| G0-11 | 精確位置：ACTIVE 同意版本含位置告知後才開啟「使用目前位置」（MVP_DECISIONS D-13g）；位置流程細節 D-13a–g 與補助呈現 D-14a–b 已有 Jerry 決定紀錄 | | ⛔ |
| G0-12 | 臺北市、新北市地方制度知識已審核並發布（PRODUCT_SPEC §39、§46）；兩市各一例的 E2E 顯示各自的地方資訊、不互相套用 | | ⛔ |

## Gate 1 — 環境隔離

- [ ] **Production 使用獨立 Supabase 專案**，不與 staging 共用資料庫；不重用 Kareocar 資料庫。
- [ ] Production 與 staging 的 Netlify 環境變數完全分開：`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY` 各自一組。MVP 不使用 AI，不應設定任何 AI API key。
- [ ] 決定 production 前端的部署方式（**需要 Jerry 決定**）：
  - 方案 1：另建一個 Netlify site，production branch = `release`（staging site 維持 `staging`）。
  - 方案 2：同一 site 把 production branch 改為 `release`，`staging` 改為 branch deploy。
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
- [ ] 接件人確認已核准的服務時段（週一至週五 09:00–21:00）；回覆時限另待核准，前端不得先承諾「1 個工作天內」。
- [ ] 接件人實際取得所需權限（操作者密鑰）。Jerry 2026-09-24 決定不設備援接件人；以「逾時暫停對外媒合入口」作為替代措施，需演練一次開關。

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

- [ ] 建立 `staging → release` Release PR，固定 release commit 與版本號（例如 `v0.1.0`）。
- [ ] PR 附本檢查表所有證據連結。
- [ ] 發布後以合成資料執行 smoke（不含真實個資），逐項記錄。
- [ ] smoke 全通過後才開放正式媒合入口；未通過立即回滾並記錄原因。
- [ ] 交付紀錄寫入 `docs/RELEASE_RUNBOOK.md` §7。

## r2 演練紀錄

使用 docs/RELEASE_REHEARSAL.md 逐項記錄；空白、BLOCKED、PENDING 均不算通過。2026-09-29 尚未部署／演練，所有未完成 gate 保持關閉。

## r3 準備交付（2026-10-03）

更新已確認環境、固定發布目標表與信箱本人確認；準備工作完成，不勾選尚未實測 gate。保留原 r2 作歷史；最新執行狀態見 RELEASE_REHEARSAL.md 的 r3 區段。
