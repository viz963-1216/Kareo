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

# Task Board（2026-09-23，J-002-r4 依 staging `8c59a99`、GitHub PR 與遠端分支核對）

GitHub 核對結果：沒有開啟中的 PR。2026-09-23 合併：A-004（#18）、B-004（#16）、B-008（#26）、C-004（#27）、J-002-r3（#28）、J-003-r3（#29）。C-004 的 API 入口衝突與距離 Mock 已在合併前修正（PR #27 留言）。Issue #25（C-004 Mock fixtures）仍為 open，內容已由 PR #24／#27 處理，待 Jerry 關閉。目前**沒有任何任務達到 INTEGRATED 或 PROD-ACCEPTED**。

## Engineer A

| Task | 模組 | 整合 | 前置 | 下一步 |
|---|---|---|---|---|
| A-001、A-002 | MERGED（#2；A-002 隨 #13） | 未確認 | — | — |
| A-003 r1 | MERGED（#13） | — | — | — |
| **A-003-r2 已驗證座標** | READY；未見提交 | — | A-004 ✅ | ▶ 補可追溯座標＋覆蓋率報告（精確位置距離排序的資料前置） |
| A-004 Validation Gate | MERGED（#18，r2；服務 id／active 已補齊） | — | — | 供 B-004 正式匯入（J-003） |
| **A-005 QA Cases** | READY；未見提交 | — | A-004 ✅ | 依 API_CONTRACT §9 補位置與家數案例 |

## Engineer B（維持單一 Active Task）

| Task | 模組 | 整合 | 前置 | 下一步 |
|---|---|---|---|---|
| B-001、B-002 | MERGED（#3；B-002 分支已併入） | 未確認 | — | — |
| B-003 Assessment API 基礎 | MERGED（#12） | **否**：線上仍為 Fake Adapter＋Null resolver，一律 `KNOWLEDGE_UNAVAILABLE` | — | 由 B-010 替換 |
| B-004 Provider Domain + Import | MERGED（#16） | 未確認：正式匯入與 staging 回滾測試未執行（J-003） | — | — |
| B-007 Kareocar API | MERGED（#14） | 未確認：Kareocar 站因 Netlify 額度暫停（D-09） | — | — |
| B-008 Knowledge Foundation | MERGED（#26）；D-03、D-10 延伸使用已核准（9/24） | 未確認：尚無 PUBLISHED 版本 | — | — |
| **B-008-r2 發布版號＋失效紀錄修正** | READY；未見提交 | — | — | ▶ **下一個 Active Task**（卡住首次知識發布） |
| **B-011a Session／歸屬保護** | READY；未見提交 | — | B-004 ✅、B-008 ✅ | B-008-r2 之後 |
| B-010 規則引擎＋正式知識接線（含補助說明、location 驗證） | IN REVIEW（PR #33，需確認是否依 B-011a） | — | B-011a | 規則表 D-01a r2 確認後才算正式驗收 |
| B-005 Recommendation（全部 rankingType） | QUEUED；未見提交 | — | B-011a | 距離真實案例需 A-003-r2 |
| B-006 Lead API＋內部查件 | QUEUED；未見提交 | — | B-011a、B-005 | 真人接件需 D-06 |
| B-009 每日知識更新（00:10） | READY（B-008 ✅）；未見提交 | — | B-008 ✅ | 原始 MVP 必要；排在 B-006 之後 |
| B-011b 完整安全驗收 | QUEUED | — | B-005、B-006、B-010 | — |
| B-012 Admin Knowledge API（D-16） | QUEUED；未見提交 | — | B-008-r2、B-009、B-011a | 管理頁面發布知識 |

## Engineer C

| Task | 模組 | 整合 | 前置 | 下一步 |
|---|---|---|---|---|
| C-001、C-002 | MERGED（#4、#11，Mock） | 未確認 | — | — |
| C-003 Top 3 UI | MERGED（#17，Mock） | 未確認：推薦 API 尚不存在 | — | 真實驗收由 J-003 |
| C-004 Provider Detail＋Maps | MERGED（#27，Mock） | 未確認：尚無正式 Provider 匯入 | — | 真實驗收由 J-003 |
| **C-005 補助說明顯示＋位置三情境＋Lead＋UX** | IN REVIEW（PR #34） | — | C-004 ✅ | Jerry review |
| C-006 知識審核與發布頁（D-16） | QUEUED；未見提交 | — | Mock（J-002 提供）；真實接線依 B-012 | C-005 之後 |

**C 的驗收分層**：C-003／C-004／C-005 都是 **Mock 模組驗收**（`VITE_KAREO_API_MODE=mock`，fixtures 來自 `contracts/mock/`）。真實 API 串接與 E2E 屬 J-003，記錄在 `docs/INTEGRATION_ACCEPTANCE.md`。兩者不得互相代替。

## Jerry

| Task | 狀態 | 下一步 |
|---|---|---|
| J-001 Netlify + Supabase staging | MERGED（#6） | 部署因額度暫停（D-09） |
| J-002 規格／知識／隱私／Lead／位置 | r1–r3 DOC-MERGED（#19、#28）；**r4 送審中（PR #31）**；D-02 知識 9 筆已核准（2026-09-24），尚未發布 | 見「待 Jerry 決定」 |
| J-003 CI + Integration | r1–r3 MERGED（#20、#29）；**Integrated：否**；release gate FAIL（PENDING 未清） | 首次知識發布（待 D-02）；依開發順序逐段 E2E |
| J-004 Release readiness | 準備文件 MERGED（#22）；gate CLOSED；未演練 | — |

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

# 修正要求（依最新 staging）

**Engineer A**

1. A-003-r2：已驗證座標與覆蓋率報告（TASK-A-003）。
2. A-005：依 API_CONTRACT v0.2.2 §9 的位置與家數案例（TASK-A-005）。
3. PR #8（A-002 舊 PR）已關閉，無需處理。

**Engineer B**

1. 下一個 Active Task：**B-008-r2**（TASK-B-008 末段：發布版號用 `intendedKnowledgeVersion`、排除已失效紀錄）；接著 B-011a（TASK-B-011）。`generateId()` 的 `Math.random()` 不得用於 token。
2. B-010：規則引擎＋PUBLISHED resolver 接線、補助說明模板、location precision 驗證（`NONE`／`CITY` 可完成評估）；政策數值不得寫死（哨兵測試 T20）。
3. B-005：全部 rankingType 分支與回應欄位一律出現（API_CONTRACT §9）。

**Engineer C**

1. C-005 可立即開工（Mock）：結果頁逐行顯示補助說明與 `knowledgeVersion`、位置三情境與 GPS 備援、各 rankingType 畫面、Lead Flow。
2. 前端送出的 consent 版本讀取部署設定，不寫死；session token、`Idempotency-Key` 由 API adapter 處理。

**Jerry（J-003）**

1. 更新 `tests/e2e/acceptance-cases.json` 的前置與新增案例（TASK-J-003「後續維護」）。
2. D-02、D-03 已核准：B-008-r2 合併後，在整合環境執行首次知識發布（目標 `KB-2026-09-24-001`）並留證。

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
