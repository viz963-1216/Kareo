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

# Task Board（2026-09-27，J-003-r5 依 staging `d7d5107`、GitHub PR 與遠端分支核對）

「模組」欄只代表 PR 狀態；「整合」欄只在 J-003 有對應證據時才寫。逐項證據與交回清單見 `docs/INTEGRATION_ACCEPTANCE.md`〈整合狀態表（2026-09-27）〉。

## Engineer A

| Task | 模組 | 整合 | 前置 | 下一步 |
|---|---|---|---|---|
| A-001、A-002 | MERGED（#2；A-002 隨 #13） | 未確認 | — | — |
| A-003 r1 | MERGED（#13） | — | — | — |
| **A-003-r3 已驗證座標** | IN REVIEW（#39 `3e44e27`）：報告可讀；**30／30 座標仍為 null／PENDING** | 否：DISTANCE 無法真實驗收 | A-004 ✅ | 依 #39 Jerry 2026-09-27 留言補可追溯座標；座標任務**未完成** |
| A-004 Validation Gate | MERGED（#18） | 未確認：正式匯入未執行 | — | 供 B-004 正式匯入（J-003） |
| A-005 QA Cases | MERGED（#30 `ffc0796`，位置案例已依 D-13 更新） | — | — | 供 B-005／J-003 推薦驗收 |

## Engineer B（修正順序：#36 B-008 → #40 B-005 → #37 B-009；#33 由 Jerry 合併）

| Task | 模組 | 整合 | 前置 | 下一步 |
|---|---|---|---|---|
| B-001、B-002 | MERGED | 未確認 | — | — |
| B-003 Assessment API 基礎 | MERGED（#12） | 否：staging 線上仍為 Fake Adapter | — | 由 B-010 替換 |
| B-004 Provider Domain + Import | MERGED（#16） | 未確認：正式匯入與 staging 回滾未執行 | — | — |
| B-007 Kareocar API | MERGED（#14） | 否：Kareocar 站 503（D-09） | — | — |
| B-008 r1 | MERGED（#26） | 否：無 PUBLISHED 版本 | — | — |
| **B-008-r2／r3** | IN REVIEW（#36 `7b77e9c`） | 否 | — | 內容指紋綁定（repro A／B／D FAIL）；`knowledge_version_records` 回填（U2／U3）；`/knowledge/status` 讀版本成員（K10）；migration 0013→0012 |
| B-011a Session／歸屬保護 | MERGED（#32） | 否（部署暫停） | — | — |
| **B-010 規則引擎** | IN REVIEW（#33 `98e933f`）：前輪修正已通過（222/222、r7） | 否 | B-011a ✅ | 合併候選；#36 合併後快照改讀版本成員（K10）並更新 4 個 publishVersion 測試 |
| **B-005 Recommendation** | IN REVIEW（#40 `e867dbb`，路由由 J-003 補上） | 否 | B-011a ✅ | 距離先取整、寫入非原子（repro FAIL）；與 #33 的 6 個型別錯誤；migration 0009→0013 |
| B-006 Lead API＋內部查件 | 未見提交 | — | B-005 | — |
| **B-009 每日知識更新** | IN REVIEW（#37 `467cb14`） | 否 | — | PDF 雜湊與去重已解決；原始快照、HTML 比較基準仍 FAIL；migration 0012／0013→0014／0015 |
| B-011b 完整安全驗收 | 未見提交 | — | B-005、B-006、B-010 | — |
| B-012 Admin Knowledge API（D-16） | 未見提交 | — | B-008、B-009 | — |

## Engineer C

| Task | 模組 | 整合 | 前置 | 下一步 |
|---|---|---|---|---|
| C-001〜C-004 | MERGED（Mock） | 未確認 | — | 真實驗收由 J-003 |
| **C-005** | IN REVIEW（#34 `599e0a2`：J-003 已同步 staging，diff 只剩 apps/web） | 否 | — | C-005-r2：`disabilityCertificate`／`incomeCategory`；移植 e3a065a 的 6 項補強（見 #34 留言） |
| C-006 知識審核與發布頁（D-16） | 未見提交 | — | B-012 | — |

## Jerry

| Task | 狀態 | 下一步 |
|---|---|---|
| J-001 Netlify + Supabase staging | MERGED（#6） | 部署仍 503 `usage_exceeded`（2026-09-27 重新查證，D-09） |
| J-002 規格／知識 | r1–r5 DOC-MERGED（#19、#28、#31、#35）；5 包 21 筆核准、1 筆退回，**尚未發布** | — |
| J-003 CI + Integration | r1–r4 MERGED（#20、#29、#38）；r5 IN REVIEW；**Integrated：否** | 見 INTEGRATION_ACCEPTANCE |
| J-004 Release readiness | 準備文件 MERGED（#22）；gate CLOSED | — |


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
