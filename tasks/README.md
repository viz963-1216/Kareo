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

**產品範圍依據**：`docs/PRODUCT_SPEC.md` 原始 MVP＋Jerry 已核准變更（`docs/MVP_DECISIONS.md` 中 `SPEC-APPROVED` 項目）。本頁的排序、提案或資料缺口都不會縮減原始 MVP。需求對應見 `docs/MVP_TRACEABILITY.md`。

---

# Task Board（2026-09-23，J-002-r3 依 GitHub PR 與遠端分支核對）

狀態用語：

| 用語 | 意義 |
|---|---|
| `MERGED` | PR 已合併 staging，只代表 Module Complete，不代表 Integrated |
| `IN REVIEW` | PR 開啟中，等待 Jerry review |
| `CHANGES REQUESTED` | PR 開啟中，review 要求修正 |
| `未見提交` | 遠端沒有對應分支或 PR。**不代表工程師沒有在本機開發**，只代表 repo 上看不到 |
| `QUEUED` | 前置條件尚未滿足 |

## Engineer A

| Task | 狀態 | 證據 | 下一步 |
|---|---|---|---|
| A-001 Provider Data Foundation | MERGED | PR #2 | — |
| A-002 Official Provider Dataset v1 | MERGED（隨 A-003 進入 staging） | commit `329842c` | 補 `provider-services.json` 的 `id`／`active`（見修正要求 A-1） |
| A-002 舊 PR | 開啟中，已被取代 | PR #8：base 不是 staging，內容已在 staging | A 確認後關閉為 superseded |
| A-003 Geocoding + Service Area QA | MERGED；**座標補充驗收未開始** | PR #13：30／30 無已驗證座標 | 補充驗收 A-003-r2（已驗證座標，D-07 資料缺口）；若 Jerry 核准 D-08 可延後 |
| A-004 Provider Validation Gate | CHANGES REQUESTED | PR #18 review 2026-09-23 | ▶ ACTIVE：補 ProviderService `id`／`active`／唯一性驗證與反例 |
| A-005 Provider QA Acceptance Cases | QUEUED（依賴 A-004）；未見提交 | — | 案例需含精確位置、行政區、無位置、缺座標 |

## Engineer B

建議順序（B 維持單一 Active Task）：**B-004 → B-008 → B-011a → B-005 → B-006 → B-010 → B-009 → B-011b**。B-007 已合併。

| Task | 狀態 | 證據 | 下一步 |
|---|---|---|---|
| B-001、B-002 | MERGED | PR #3、#5 | — |
| B-003 Assessment API + AI Adapter Foundation | MERGED | PR #12；線上仍組裝 Fake Adapter＋Null resolver → 一律 `KNOWLEDGE_UNAVAILABLE` | 由 B-008／B-010 替換 |
| B-004 Provider Domain + Import API | IN REVIEW（`B-004-r2`） | PR #16：P2 已驗證；P1 依 D-10 改單一交易，2026-09-23 05:19 重新送審 | Jerry review r2；staging Supabase 回滾測試由 J-003 執行；合併時補 `providerDetail` 路由 |
| B-007 Kareocar External Service API | MERGED | PR #14；路由由 J-003 補上（PR #20） | — |
| B-008 Knowledge Foundation + Publish Gate | IN REVIEW（`B-008-r1`） | PR #26 | **合併前需 Jerry 核准 D-03 格式**；發布／撤回函式沿用 D-10 需另行核准 |
| B-011a Session／權限基礎 | QUEUED；未見提交 | 規格 API_CONTRACT v0.2 §3（D-04 PROPOSED） | B-008 後、B-005 前；B-005／B-006／B-010 共用 |
| B-005 Recommendation Engine + API | QUEUED（依賴 B-004、B-011a）；未見提交 | — | **DISTANCE 與 DISTRICT_ROTATION 都要實作**（見 TASK-B-005 2026-09-23 補充） |
| B-006 Lead API | QUEUED（依賴 B-004、B-011a）；未見提交 | — | 依 API_CONTRACT v0.2 §12、LEAD_OPERATIONS、內部查件指令 |
| B-010 Production Assessment Engine（規則引擎） | QUEUED（依賴 B-008；規則表 D-01a 待確認）；未見提交 | D-01 SPEC-APPROVED | 補助說明模板待 D-12 |
| B-009 Knowledge Crawler | QUEUED（依賴 B-008）；未見提交 | **原始 MVP 必要**（PRODUCT_SPEC §42） | 延後提案 D-11 未核准前，列入 MVP 驗收 |
| B-011b 完整安全驗收 | QUEUED（依賴 B-005／B-006／B-010） | — | 限流、RLS、log、清理、安全矩陣 |

## Engineer C

| Task | 狀態 | 證據 | 下一步 |
|---|---|---|---|
| C-001、C-002 | MERGED | PR #4、#11 | — |
| C-003 Recommendation + Top 3 UI | MERGED（Mock 模組驗收） | PR #17 | 真實 API 驗收由 J-003 執行 |
| C-004 Provider Detail + Google Maps | IN REVIEW（`C-004-r1`） | PR #27 | Jerry review；需 rebase J-003-r2 的 adapter 變更（`realAdapter.ts` 衝突小） |
| C-005 Lead Flow + Final MVP UX QA | QUEUED（依賴 C-004）；未見提交 | — | 含位置三情境與 DISTANCE 畫面（見 TASK-C-005 2026-09-23 補充） |

**C 的驗收分層**：C-003／C-004／C-005 的驗收都是 **Mock 模組驗收**（`VITE_KAREO_API_MODE=mock`，fixtures 來自 `contracts/mock/`）。真實 API 串接與 E2E 屬 J-003，記錄在 `docs/INTEGRATION_ACCEPTANCE.md`。兩者不得互相代替。

## Jerry

| Task | 狀態 | 證據 | 下一步 |
|---|---|---|---|
| J-001 Netlify + Supabase staging | MERGED | PR #6 | — |
| J-002 MVP Decisions / Knowledge / Privacy / Lead specs | r1／r2 已合併（PR #19）、r3 送審中；**大部分決策仍 PROPOSED**；知識 0 筆核准 | `docs/MVP_DECISIONS.md` 交付物核准矩陣 | 見下方「需要 Jerry 決定」 |
| J-003 CI + Integration | r1 已合併（PR #20）、r2 送審中；**未 Integrated** | `docs/INTEGRATION_ACCEPTANCE.md` | 真實 E2E 等 B／C 模組與部署環境 |
| J-004 Release readiness | 準備文件已合併（PR #22）；gate CLOSED；未演練 | — | — |

---

# 需要 Jerry 決定（集中）

依影響排序；每項的完整方案見 `docs/MVP_DECISIONS.md`。

1. **D-04 Session 安全 contract**：建議先核准，讓 B-011a／B-005／B-006 依定案開發。
2. **D-03 知識內容包格式**：B-008（PR #26）合併前需核准；另決定 B-008 發布／撤回是否沿用 D-10 函式模式。
3. **D-02 首批知識逐筆審核**（9 筆）。沒有核准內容就沒有 PUBLISHED 版本，真實 Assessment 無法驗收。
4. **D-08 是否縮減 GPS／精確位置**（範圍變更）。不核准：A 補座標、C 做位置取得、隱私文案加入精確位置。核准：修訂 PRODUCT_SPEC §21。
5. **D-11 是否以人工每日檢查代替 crawler**（範圍變更）。不核准：B-009 列入 MVP 排程。
6. **D-12 補助說明是否顯示金額**（方案 A 原始 MVP／方案 B 縮減）。
7. **D-13 沒有位置／只有縣市的推薦回應**。
8. D-01a 規則表逐條確認；D-05 法務與客服信箱；D-06 接件人；D-09 Netlify 額度。

---

# 修正要求（依最新 PR）

**Engineer A**

1. `data/providers/staging/provider-services.json` 30 筆缺 `id`、`active`：依來源補齊，不得由 B 猜值；補齊後須通過修正版 A-004。
2. PR #18：補 `id` 非空／唯一、`active` boolean 驗證與反例；區分 `Provider.type`（允許 `OTHER`）與 `ProviderService.serviceType`。
3. PR #8：確認後關閉為 superseded。
4. A-003-r2：已驗證座標補充驗收（見 TASK-A-003）。

**Engineer B**

1. B-011a 的 session token、歸屬檢查與錯誤碼先做成共用元件，B-005／B-006／B-010 直接使用；D-04 核准前屬可逆實作。`AppError` 依 API_CONTRACT §3.2 擴充錯誤碼。
2. `generateId()` 使用 `Math.random()`；session token 必須改用密碼學隨機值（B-011a）。
3. B-005 兩種排序分支都要實作與測試；B-009 列入排程（D-11 未核准）。

**Engineer C**

1. PR #27（C-004）review 後需 rebase J-003-r2 的 adapter 變更；`getProvider` 依新的 `request` 錯誤處理（HTTP 非 2xx、`NOT_FOUND` → `null`）。
2. Mock fixture 保留 DISTANCE 情境（`contracts/mock/recommendations/ranking-variants/HOME_CARE-DISTANCE.json`）；C-004 目前忽略 `mockRanking`，C-005 前需恢復 DISTANCE 畫面的 Mock 驗收。
3. 前端送出的 consent 版本讀取部署設定（PRIVACY_AND_RETENTION §3.2），不寫死；session token、`Idempotency-Key` 由 API adapter 處理，UI 不直接處理 token。

---

# Dependency Flow

```text
A-002 → A-003 → A-004 → A-005
  │       └─→ A-003-r2（已驗證座標）──────────┐
  └─→ B-004 ─────────────┐                    │
                          ├─→ B-005（DISTANCE＋DISTRICT_ROTATION）
B-011a（session 基礎）────┤
                          └─→ B-006（Lead＋內部查件）
B-003 ─→ B-008 ─┬─→ B-010（規則引擎）
                └─→ B-009（每日 crawler）
B-005／B-006／B-010 ─→ B-011b（完整安全驗收）

C-002 → C-003 → C-004 → C-005        （Mock 模組驗收）

J-002 核准（D-02 內容、D-03、D-04…）─→ B-008 合併 ─→ J-003 首次知識發布
全部必要模組 ─→ J-003 真實 E2E（release 模式）─→ J-004 release
```

關卡：

- J-002 source registry／格式（D-02a、D-03）→ B-008 合併；J-002 核准內容（D-02）＋B-008 → J-003 首次人工發布。
- B-003＋B-008＋規則表確認（D-01a）→ B-010；真實 smoke 需前述發布完成。
- A-002 → B-004 試匯入；A-003 → A-004 → B-004 正式資料匯入驗收。
- J-002 安全／隱私／營運 contract → B-011a、B-006 新增操作、C 的正式文案驗收。
- A-005＋B-004…B-011＋C-005 → J-003 最終 E2E → J-004 release。
- J-003 可分階段進行；首次知識發布不等待最終 E2E，避免與 B-010 循環依賴。

---

# Milestones（目標日期，非已完成承諾）

| 日期 | 目標 |
|---|---|
| 9/26 | D-03／D-04 決議、首批知識審核、B-004／B-008 合併 |
| 10/12 | A／B／C 必要功能（含 B-009 或 D-11 決議）與真實 API 接線 |
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

「MVP 完成」必須同時有：正式知識（PUBLISHED）與每日更新機制（B-009 或已核准的 D-11 替代）、真實評估、可追溯 Provider 資料、依位置精度的確定性推薦、可保存並由負責人接件的 Lead、隱私／權限驗收、部署後 E2E、可操作的回復方案。
