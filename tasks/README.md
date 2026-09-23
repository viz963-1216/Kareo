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

每次 PR 必須提供：

- Submission Version
- Added
- Changed
- Fixed
- Known Issues
- Test / QA Result
- Scope Check

全站 Release Version 只由 Jerry 管理。

---

# Verified Task Board（2026-09-23，J-002-r1 以程式碼與 PR 核實）

狀態用語：`MERGED`＝PR 已合併 staging（只代表 Module Complete）；`CHANGES REQUESTED`＝PR 開啟中、需修正；`NOT STARTED`＝無分支、無 PR。

## Engineer A

| Task | 狀態 | 證據 | 下一步 |
|---|---|---|---|
| A-001 Provider Data Foundation | MERGED | PR #2 | — |
| A-002 Official Provider Dataset v1 | MERGED（隨 A-003 進入 staging） | commit `329842c` | 見下方 A 修正要求 1 |
| A-002 舊 PR | **SUPERSEDED** | PR #8 base 為 `feat/a-001-provider-data`；內容已在 staging，且比 staging 少 A-003 更新 | 建議 A 關閉 #8，勿合併 |
| A-003 Geocoding + Service Area QA | MERGED | PR #13；30/30 Provider 無已驗證座標 | 依 D-07，MVP 不做距離排序 |
| A-004 Provider Validation Gate | **CHANGES REQUESTED** | PR #18 review：ProviderService 未驗 `id`／`active`／ID 唯一，會假通過 | ▶ ACTIVE：依 review 修正 |
| A-005 Provider QA Acceptance Cases | NOT STARTED | — | A-004 合併後 |

## Engineer B

| Task | 狀態 | 證據 | 下一步 |
|---|---|---|---|
| B-001、B-002 | MERGED | PR #3、#5 | — |
| B-003 Assessment API + AI Adapter | MERGED | PR #12；線上組裝 Fake Adapter＋NullKnowledgeVersionResolver → 一律 `KNOWLEDGE_UNAVAILABLE` | 由 B-008／B-010 替換 |
| B-004 Provider Domain + Import API | **CHANGES REQUESTED** | PR #16：P2 已修正（Jerry 實測）；P1 依 D-10 方案 A 實作中 | ▶ ACTIVE；合併時 Jerry 需同時補 `providerDetail` 路由 |
| B-007 Kareocar External Service API | MERGED | PR #14；**netlify.toml 缺路由**，由 J-003 補 | — |
| B-008 Knowledge Foundation + Publish Gate | NOT STARTED → **可開工** | J-002 已合併（`contracts/knowledge/`） | 已於 PR #16 通知 B 可開工 |
| B-005 Recommendation Engine + API | NOT STARTED | 依賴 B-004 | 依 D-07 只做 `DISTRICT_ROTATION`；依 API_CONTRACT v0.2 §3.1 驗 session |
| B-006 Lead API | NOT STARTED | 依賴 B-004 | 依 API_CONTRACT v0.2 §12、LEAD_OPERATIONS、DATA_MODEL §22／§36–38 |
| B-010 Production Assessment Engine（規則引擎） | NOT STARTED | 依賴 B-008；D-01 已決定不用 AI | 依 `docs/ASSESSMENT_RULES.md` 實作 |
| B-011 Session / Privacy / API Controls | NOT STARTED | 規格：ARCHITECTURE §20、PRIVACY_AND_RETENTION | 規格合併後即可開始 session token 部分 |
| B-009 Knowledge Crawler | NOT STARTED（MVP 後） | — | — |

## Engineer C

| Task | 狀態 | 證據 | 下一步 |
|---|---|---|---|
| C-001、C-002 | MERGED | PR #4、#11 | — |
| C-003 Recommendation + Top 3 UI | MERGED | PR #17（使用 Mock） | — |
| C-004 Provider Detail + Google Maps | NOT STARTED → **可開工** | C-003 已合併 | ▶ ACTIVE |
| C-005 Lead Flow + Final MVP UX QA | NOT STARTED | 依賴 C-004 | 需依 API_CONTRACT v0.2 §12 加入聯絡同意勾選、Idempotency-Key 由 adapter 處理 |

## Jerry

| Task | 狀態 | 證據 |
|---|---|---|
| J-001 Netlify + Supabase staging | MERGED | PR #6 |
| J-002 MVP Decisions / Knowledge / Privacy / Lead specs | 規格 MERGED（PR #19）；內容待核准 | 決策、知識包逐筆審核、接件人、客服信箱仍待 Jerry |
| J-003 CI + Integration | 第一階段 MERGED（PR #20）；E2E 未開始 | 等 B-004～B-011、C-004／C-005 與部署環境 |
| J-004 Release readiness | 準備文件 MERGED（PR #22）；gate CLOSED | 未演練 |

## J-002 產生的修正要求

**Engineer A**

1. `data/providers/staging/provider-services.json` 30 筆全部缺 `id`、`active`（已驗證）。請依來源補齊，不得由 B 猜值；補齊後須通過修正版 A-004。
2. PR #18：補 `id` 非空／唯一、`active` boolean 驗證與反例；區分 `Provider.type`（允許 `OTHER`）與 `ProviderService.serviceType`。
3. PR #8：確認後關閉為 superseded。

**Engineer B**

1. PR #16：提出整批一致性方案（例如單一資料庫交易的 RPC／staging table 後切換），補第二、三階段失敗測試；任何拒收時正式匯入不寫入並以非零狀態結束。若方案需要新 schema，先交 Jerry。
2. 之後各 API 依 API_CONTRACT v0.2 實作 session token 驗證與新錯誤碼；`AppError` 的 code 清單需依 §3.2 擴充（屬 contract 已核准範圍）。
3. `generateId()` 目前使用 `Math.random()`；B-011 需改用密碼學隨機值，至少用於 session token。

**Engineer C**

1. C-004 可開工。
2. 前端送出的 consent 版本改為讀取核准清單（PRIVACY_AND_RETENTION §3.2），不寫死。
3. session token、`Idempotency-Key` 由 API adapter 處理（J-003 接線），UI 不直接處理 token。

---

# Dependency Flow

```text
A-002
├─→ A-003 → A-004 → A-005
└─→ B-004 → B-005
             └─→ Recommendation Real API

B-003
├─→ B-004
├─→ B-007
└─→ B-008 → B-009

C-002 → C-003 → C-004 → C-005
```

B 維持單一 Active Task。建議順序：B-003 → B-008 → B-004 → B-005 → B-006 → B-007 → B-010 → B-011。B-008 若缺 J-002 輸入，先回報阻塞；可先執行前置已完成的 B-004 或 B-007，不以未發布知識繞過。B-009 可延後至 MVP 後。

---

# Handoff

```text
Engineer A
Provider Data / Research / QA
        ↓
clean / validated data
        ↓
Engineer B
Backend / Database / Business Logic
        ↓
API Contract
        ↓
Engineer C
Frontend / UX
```

所有跨模組 Integration 由 Jerry 在 `staging` 完成。

Feature PR Merge 到 staging 只能稱為 Module Complete。

只有通過 A+B+C + Supabase + Netlify + Integration / E2E 後，才能稱為 Integrated。


# 2026-10-22 MVP 執行與交付計畫（2026-09-19 修訂）

目前狀態保留為工作安排，不表示尚未驗收的任務已完成。A-002 已提交內容仍需 review / 修正並合併 staging；所有工程 PR 的 base 一律 staging，不以其他 feature branch 代替。

| 新增 Task | Owner | 開工條件 / 交付 |
|---|---|---|
| [J-002](TASK-J-002.md) | Jerry | 現在開始；AI/安全/隱私/接件規格、官方來源與首批核准知識 |
| [B-010](TASK-B-010.md) | B | 規則引擎 Assessment（不使用 AI）；詳見任務依賴 |
| [B-011](TASK-B-011.md) | B | session 歸屬、限流、冪等、RLS、刪除/保存驗收 |
| [J-003](TASK-J-003.md) | Jerry | CI 現在開始；模組完成後接真實 API 與 E2E |
| [J-004](TASK-J-004.md) | Jerry | release、接件交接、額度、備份還原與回滾 |

## Dependencies / 不得跳過的關卡

- J-002 source registry/格式 → B-008；J-002 核准內容 + B-008 → J-003 首次人工發布。
- B-003 + B-008 + ASSESSMENT_RULES 確認 → B-010；真實 smoke 需前述發布完成。
- A-002 → B-004 試匯入；A-003 → A-004 → B-004 正式資料匯入驗收。
- J-002 安全/隱私/營運 contract → B-006 新增操作、B-011、C 的正式文案驗收。
- A-005 + B-003…B-008 + B-010/B-011 + C-005 → J-003 最終 E2E → J-004 release。
- J-003 可分階段開始，首次知識發布不等待最終 E2E，避免與 B-010 循環依賴。

## Milestones（目標日期，非已完成承諾）

| 日期 | 目標 |
|---|---|
| 9/23 | J-002 AI/安全/隱私/Lead 操作規格 |
| 9/26 | J-002 核准內容包、J-003 CI 骨架 |
| 10/12 | A/B/C 必要功能與真實 API 接線完成 |
| 10/13–10/18 | 完整 E2E、安全、手機驗收與缺陷修復 |
| 10/19 | 功能凍結 |
| 10/20–10/21 | 備份還原、發布演練與 smoke |
| 10/22 | Kareo MVP 交付 |

阻塞時在 PR/Issue 寫出缺少的輸入、責任人及對日期的影響；不得把 Fake/Mock/未發布知識視為正式完成。不新增會員、付款、完整 CRM；B-009 crawler 可後補。

「完成」必須同時有：正式知識、真實評估、可追溯 Provider 資料、確定性推薦、可保存並由負責人接件的 Lead、隱私/權限驗收、部署後 E2E、可操作的回復方案。
