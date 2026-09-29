# Kareo Tasks

所有工程 Task 必須：

```text
從最新 staging 建 Feature Branch
→ 執行 Task
→ Test
→ PR → staging
→ Jerry Review
```

A / B / C 不直接 Push `staging` 或 `main`。

每次 PR 必須提供：Submission Version、Added、Changed、Fixed、Known Issues、Test / QA Result、Scope Check。

全站 Release Version 只由 Jerry 管理。

**產品範圍依據**：`docs/PRODUCT_SPEC.md` 原始 MVP＋Jerry 已核准變更（`docs/MVP_DECISIONS.md` 中 `SPEC-APPROVED`：D-01 規則引擎、D-10 Provider 匯入原子寫入）。會縮減範圍的提案 D-08（不收 GPS）、D-11（crawler 延後）、D-12（不顯示補助金額）**未核准、已擱置**，不影響任何任務。需求對應見 `docs/MVP_TRACEABILITY.md`。

---

# 狀態用語（四個層級分開記錄，不得互相代替）

| 層級 | 用語 | 意義 |
|---|---|---|
| 文件 | `DOC-MERGED` | 規格／任務文件已合併 staging；其中 PROPOSED 項目仍待核准 |
| 模組 | `MERGED` | Feature PR 已合併 staging（Module Complete），通常只有單元測試或 Mock 驗收 |
| 整合 | `INTEGRATED` | 部署環境以真實 API＋真實資料＋PUBLISHED 知識通過 J-003 對應 E2E 案例 |
| 正式 | `PROD-ACCEPTED` | production 發布後以合成資料 smoke 通過（J-004） |
| 進度 | `READY`／`QUEUED`／`IN REVIEW`／`未見提交`／`未確認` | `READY`＝前置已滿足可開工；`QUEUED`＝前置未滿足；`未見提交`＝遠端沒有分支或 PR（不代表本機沒有開發）；`未確認`＝沒有證據 |

---

# Task Board（2026-09-29，J-003-r8 依 staging `6abe494`、GitHub PR 與遠端分支核對）

「模組」欄只代表 PR 狀態；「整合」欄只在 J-003 有對應證據時才寫。逐項證據與交回清單見 `docs/INTEGRATION_ACCEPTANCE.md`〈目前結論（2026-09-29，J-003-r8）〉。

## Engineer A

| Task | 模組 | 整合 | 前置 | 下一步 |
|---|---|---|---|---|
| A-001、A-002 | MERGED（#2；A-002 隨 #13） | 未確認 | — | — |
| A-003 r1 | MERGED（#13） | — | — | — |
| **A-003-r3 已驗證座標** | IN REVIEW（#39 `6f8db5c`）：分支上 30／30 筆已有非 null 座標，J-003 **尚未審核**來源可追溯性 | 否：未合併，DISTANCE 無法真實驗收 | A-004 ✅ | **已交回 A 工程師接管**（2026-09-29）；A 完成後 J-003 再做整合驗證 |
| A-004 Validation Gate | MERGED（#18） | 未確認：正式匯入未執行 | — | 供 B-004 正式匯入（J-003） |
| A-005 QA Cases | MERGED（#30 `ffc0796`，位置案例已依 D-13 更新） | — | — | 供 B-005／J-003 推薦驗收 |

## Engineer B（#33、#36、#40、#37 已合併；待交付 B-006 → B-011b、B-012）

| Task | 模組 | 整合 | 前置 | 下一步 |
|---|---|---|---|---|
| B-001、B-002 | MERGED | 未確認 | — | — |
| B-003 Assessment API 基礎 | MERGED（#12） | 否：staging 線上仍為 Fake Adapter | — | 由 B-010 替換 |
| B-004 Provider Domain + Import | MERGED（#16） | 未確認：正式匯入與 staging 回滾未執行 | — | — |
| B-007 Kareocar API | MERGED（#14） | 否：Kareocar 站 503（D-09） | — | — |
| B-008 r1 | MERGED（#26） | 否：無 PUBLISHED 版本 | — | — |
| B-008-r2〜r5 | MERGED（#36，至 `c5d4cb4`） | 否：尚未首次發布 | — | 本機：內容指紋、回填（U2／U3／U5）、讀版本成員（K10 實際讀取路徑）皆 PASS |
| B-011a Session／歸屬保護 | MERGED（#32） | 否（部署暫停） | — | — |
| B-010 規則引擎 | MERGED（#33） | 否：部署 503、無 PUBLISHED 版本 | B-011a ✅ | 首次知識發布後真實驗收 |
| B-005 Recommendation | MERGED（#40） | 否：部署 503；Provider 未正式匯入 | B-011a ✅ | 本機：repro 2／2 PASS、R2 原子寫入 PASS |
| **B-006 Lead API＋內部查件** | 未見提交（2026-09-29 重新查證） | — | B-005 ✅ | 缺 `POST /api/v1/leads`、內部查件／狀態更新；阻擋 E2E-13、14、15、18、22、36、41 |
| B-009 每日知識更新 | MERGED（#37，至 `d3f630f`） | 否：排程未實跑（缺 `staging` environment／secrets） | — | 本機：C1、C3、baseline／hash-dedupe repro PASS |
| **B-011b 完整安全驗收** | 未見提交（2026-09-29 重新查證） | — | B-005 ✅、B-006、B-010 ✅ | 缺 `POST /api/v1/consent/withdraw`、`DELETE /api/v1/session` 實作；阻擋 E2E-19、20、37 |
| **B-012 Admin Knowledge API（D-16）** | 未見提交（2026-09-29 重新查證） | — | B-008 ✅、B-009 ✅ | 缺 `/api/v1/admin/**` 10 個端點；阻擋 E2E-40 與 C-006 真實接線 |

## Engineer C

| Task | 模組 | 整合 | 前置 | 下一步 |
|---|---|---|---|---|
| C-001〜C-004 | MERGED（Mock） | 未確認 | — | 真實驗收由 J-003 |
| C-005 | MERGED（#34） | 真實 API 待驗 | — | staging 31 項前端測試與 real build 通過；不等於真實 E2E |
| **C-006 知識審核與發布頁（D-16）** | IN REVIEW（#46 `557edf8`）：退回待修，審查後無新 commit | — | Mock 契約 #43 ✅；真實接線 B-012 | 試驗組合 37 PASS，但空 data 成功回應仍被當成功（J-003-r8 重現）；**由 C 修正**（依 #46 審查留言，同一 PR）；J-003 於修正後重跑試驗組合 |

**C 的驗收分層**：Mock 模組驗收不代替 J-003 真實 API E2E。


## Jerry

| Task | 狀態 | 下一步 |
|---|---|---|
| J-001 Netlify + Supabase staging | MERGED（#6） | 部署仍 503 `usage_exceeded`（2026-09-29 重新查證，D-09）；staging Supabase 隔離未確認 |
| J-002 規格／知識 | r1–r5 DOC-MERGED（#19、#28、#31、#35）；5 包 21 筆核准、1 筆退回，**尚未發布** | — |
| J-003 CI + Integration | r1–r4 MERGED（#20、#29、#38）、前端 CI MERGED（#42）；r5–r8 IN REVIEW（#44，#41 已被包含）；**Integrated：否** | J 持續負責整合與驗證；43 項真實 E2E 依環境與模組到位逐段補證據（見 INTEGRATION_ACCEPTANCE〈目前結論（J-003-r8）〉） |
| J-004 Release readiness | 準備文件 MERGED（#22、#45）；gate CLOSED | smoke 工具測試 3／3 PASS；真實演練待部署恢復 |


---

# 建議開發順序（讓真實使用者流程較早跑通；不刪除任何 MVP 工作）

| 階段 | 目標：真實環境可以做到 | 需要完成 | 平行進行 |
|---|---|---|---|
| 1 | 同意 → **真實初評**與可能適用的制度／補助說明 | Jerry：D-04（D-02、D-03 已核准）；B：B-008-r2 → B-011a → B-010；J-003：B-008-r2 合併後首次知識發布 | C：C-005（Mock）；A：A-003-r2、A-005 |
| 2 | **行政區／縣市推薦** → Provider 詳情 → Google Maps | B-005；J-003：Provider 正式匯入、推薦路由 | Jerry：D-13、D-14 決定 |
| 3 | **我要媒合**與內部接件 | B-006；C-005 合併；Jerry：D-06 備援接件人與服務日別（主要接件人已指定） | Jerry：審核地方知識 KP-2026-09-24-002 |
| 4 | **精確位置距離排序** | A-003-r2 座標＋B-005 已有 DISTANCE 分支；D-05 同意版本 ACTIVE（D-13g） | — |
| 5 | **每日知識更新**與完整安全 | B-009 → B-011b | — |
| 6 | 完整 E2E（release 模式）→ 發布 | J-003 → J-004 | — |

理由：評估是整條流程的第一步且目前完全不可用（一律 `KNOWLEDGE_UNAVAILABLE`），所以 B-011a、B-010 與知識審核排在最前；B-011a 先做可避免 B-010／B-005／B-006 各自實作 session 驗證、事後返工。B-009 屬 MVP 必要，排在使用者流程之後但在最終驗收之前。

---

# Dependency Flow

```text
A-004 ✅ ─┬─→ A-003-r2（已驗證座標）──────────────┐（真實 DISTANCE 案例）
          └─→ A-005（QA 案例）──────────────────┐ │
B-004 ✅ ─┐                                      │ │
B-008 ✅ ─┼─→ B-008-r2 ─→ J-003 首次知識發布      │ │
          ├─→ B-011a ─┬─→ B-010（規則引擎＋知識）│ │
          │           └─→ B-005 ─→ B-006         │ │
          └─→ B-009（每日 00:10）─→ B-012 ─→ C-006（管理頁面）
B-005＋B-006＋B-010 ─→ B-011b                    │ │
C-004 ✅ ─→ C-005（Mock）                        │ │
J-002：D-02、D-03 核准 ✅ ＋ B-008-r2 ─→ J-003 首次知識發布 ─→ B-010 真實 smoke
全部必要模組＋A-005＋A-003-r2 ─→ J-003 完整 E2E（release）─→ J-004 release
```

關卡：

- 首次知識發布只依賴 D-02、D-03 核准（完成）＋B-008-r2，不等待最終 E2E，避免與 B-010 循環。
- B-006 依賴 B-005（Lead 需驗證 recommendationId），B-005 不依賴 B-006。
- D-01a、D-02a、D-03、D-04、D-13、D-14 已於 2026-09-24 核准；仍為 PROPOSED 的只有 D-05（法務）、D-06（接件人），相關正式驗收需等它們。
- 同意版本 ACTIVE（D-05）是正式收集座標與正式開放服務的條件，不是 C-005 開發的前置。

---

# 待 Jerry 決定

2026-09-24 已核准：D-01a、D-02、D-02a、D-03、D-04、D-10 延伸、D-13a–g、D-14a–b（[PR #31 comment 2026-09-24](https://github.com/viz963-1216/Kareo/pull/31#issuecomment-5806704685) 等，見 `docs/MVP_DECISIONS.md`）。

| 狀態 | 事項 |
|---|---|
| 待決定 | **D-09 Netlify 額度**（Jerry：日後補充） |
| 已完成（2026-09-24） | D-03-v2、規則表 r3、D-15（雲端硬碟資料夾來源）、D-16（管理頁面） |
| 已完成（2026-09-24） | `KP-2026-09-24-002` 6 筆核准；來源 `SR-2026-09-24-01` 核准；接件人蘇子傑（週一至週五 09:00–21:00），不設備援 |
| 待輸入 | D-05 法務意見與客服信箱（暫不填） |

---

# 修正要求（2026-09-27，依最新 PR 與 J-003-r5 驗證）

逐項狀態、commit 與可重現命令見 `docs/INTEGRATION_ACCEPTANCE.md`〈交回清單〉。各 PR 上已有 Jerry／Codex 第二輪提示詞與 J-003-r5 留言（2026-09-27），本節只列摘要。

**Engineer A**：#39 補可追溯的已驗證座標（目前 0／30）；缺 Service Area 的類別另列證據缺口。

**Engineer B**（依序）：
1. #36 B-008：審核內容指紋與原子核准；版本成員回填；`/knowledge/status` 讀版本成員；migration 改 `0012_knowledge_version_traceability.sql`。
2. #40 B-005：未取整距離排序；Run＋Items 原子寫入；與 #33 的型別衝突；migration 改 `0013_recommendation.sql`；推送前先 pull J-003 的路由 commit `e867dbb`。
3. #37 B-009：原始快照保存；同一表示法比較；migration 改 `0014_crawler_runs.sql`、`0015_crawler_hash_traceability.sql`。
4. #33 B-010（#36 合併後）：快照改讀 `knowledge_version_records`；更新 4 個 publishVersion 測試。

**Engineer C**：#34 C-005-r2：先 pull J-003 的 staging 同步 commit `599e0a2`；新增兩題選填；移植 e3a065a 的 6 項。

**Jerry（J-003）**：merge 順序依 migration 編號（#33 → #36 → #40 → #37）；唯讀確認 staging 已套用的 migration（`tests/db/detect-applied-migrations.sql`）；B-008 驗證通過後才提出首次知識發布執行步驟。

---

# Milestones（建議目標日期，非已完成承諾）

| 日期 | 目標 |
|---|---|
| 9/26 | B-008-r2 合併 → 首次知識發布（整合環境可用時；D-02、D-03 已於 9/24 核准）；D-04 決定 |
| 9/30 | B-011a 合併；地方知識 KP-2026-09-24-002 審核（9/24 已送審） |
| 10/3 | B-010 合併 → 階段 1 真實初評 E2E；A-003-r2、A-005 合併 |
| 10/7 | B-005 合併 → 階段 2 推薦 E2E；C-005 合併 |
| 10/10 | B-006 合併 → 階段 3 媒合 E2E；D-06 接件人演練 |
| 10/12 | B-009、B-011b 合併；D-05 同意版本 ACTIVE → 階段 4、5 |
| 10/13–10/18 | 完整 E2E（release 模式）、安全、手機驗收與缺陷修復 |
| 10/19 | 功能凍結 |
| 10/20–10/21 | 備份還原、發布演練與 smoke |
| 10/22 | Kareo MVP 交付 |

阻塞時在 PR／Issue 寫出缺少的輸入、責任人及對日期的影響；不得把 Fake／Mock／未發布知識視為正式完成。

---

# Handoff

```text
Engineer A：Provider Data / Research / QA
        ↓ clean / validated data
Engineer B：Backend / Database / Business Logic
        ↓ API Contract
Engineer C：Frontend / UX
```

所有跨模組 Integration 由 Jerry 在 `staging` 完成。Feature PR Merge 到 staging 只能稱為 Module Complete。只有通過 A＋B＋C＋Supabase＋Netlify＋Integration／E2E（release 模式）後，才能稱為 Integrated。

「MVP 完成」必須同時有：正式知識（PUBLISHED）與每日 00:10 自動更新（B-009）、真實評估（含可能適用的制度與補助說明）、可追溯 Provider 資料、依位置精度的確定性推薦（精確位置、行政區、無位置）、可保存並由負責人接件的 Lead、隱私／權限驗收、部署後 E2E、可操作的回復方案。
