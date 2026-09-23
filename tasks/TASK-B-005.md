# TASK-B-005 — Recommendation Engine + API

Owner: Engineer B — Backend  
Type: Backend / Recommendation  
Status: QUEUED — 依賴 B-011a（B-004 已合併）；未見提交  

---

# Goal / 目標

實作 Recommendation Engine 與 `POST /api/v1/recommendations`，讓使用者依位置精度取得真實 Provider 推薦（PRODUCT_SPEC §17–27）：

```text
ACTIVE Provider → Service Type Match → Service Area Match
→ DISTANCE（精確位置＋候選都有已驗證座標）
  或 DISTRICT_ROTATION／CITY_ROTATION（穩定輪替）
  或 NO_LOCATION（不推薦）
→ Top 3（0–3 家）
```

`DISTANCE` 與 `DISTRICT_ROTATION` 都是原始 MVP 必要功能；`CITY_ROTATION`、`NO_LOCATION` 與缺座標時的處理依 D-13a–c 建議實作（PROPOSED，可逆）。

---

# Prerequisite / 前置條件

- B-004 已合併（完成，PR #16）：Provider DB 可查詢。
- **B-011a 已合併**：session token 驗證、assessment 歸屬檢查、錯誤碼（本任務直接使用，不自行實作）。
- B-010 對 `location` 的 precision 驗證（API_CONTRACT §8）可平行；本任務讀取 Assessment 已保存的 location，不另外驗證輸入。
- 真實資料 smoke 使用通過 A-004 的資料；距離排序的真實資料案例需要 A-003-r2 座標（未交付前以合成座標測試，並在 PR 註明）。

---

# Branch / PR Rule

從最新 `staging` 建立：

```text
feat/b-005-recommendation-engine-api
```

完成後：

```text
PR → staging
```

首次提交版次：

```text
B-005-r1
```

若退回修改，revision 依序遞增。

不得直接 Push `staging` 或 `main`。

---

# 開始前必讀

```text
AGENTS.md
docs/PRODUCT_SPEC.md
docs/ARCHITECTURE.md
docs/DATA_MODEL.md
docs/API_CONTRACT.md
docs/GIT_RULES.md
```

---

# Allowed Paths / 可修改範圍

```text
/apps/api/**
/services/recommendation/**
```

不得跨 Ownership。若必須修改其他模組，停止並回報 Jerry。

---

# Required Deliverables / 必交付

依 API_CONTRACT v0.2.2 §9「位置與排序」：

- Service Type Match（ProviderService.active）、Service Area Match（ProviderServiceArea.active；與地址分開）、只推薦 `status = ACTIVE`
- `DISTANCE`：Assessment 為 `GPS`／`EXACT` 且所有候選都有已驗證座標；Haversine；同距離依 providerId；`distanceKm` 小數 1 位；reasons 含「距離約 X 公里」
- 候選部分／全部缺座標：整批 `DISTRICT_ROTATION`，`locationPrecision` 維持 `GPS`／`EXACT`，notice 說明（D-13c）
- `DISTRICT_ROTATION`：穩定輪替 `sha256(sessionId|city|district|date|providerId)`，date 為 Asia/Taipei（D-13f）
- `CITY_ROTATION`：服務範圍含該縣市任一行政區，seed 不含 district（D-13a）
- `NO_LOCATION`：回 `providers = []` 與提醒 notice（D-13b）
- 回應欄位一律出現：`rankingType`、`locationPrecision`、`providers`、每筆 `distanceKm`（非 DISTANCE 為 null）、`notice`
- RecommendationRun／RecommendationItem 保存（DATA_MODEL §20–21）
- Session：`X-Kareo-Session-Token`、assessment 必須屬於同一 session（B-011a 元件）
- `netlify.toml` 路由由 J-003 補（本任務只提供 function）
- API＋單元測試＋一次真實資料 smoke

---

# Acceptance Criteria

- [ ] AI／LLM 不參與選擇 Provider；排序結果可由規則重現
- [ ] 0／1／2／3 家都通過；0 家為 `success: true`＋空陣列，不是 Error
- [ ] 合成座標測試：距離排序正確、同距離次序穩定、`distanceKm` 與「距離約 X 公里」只在 DISTANCE 出現
- [ ] 缺座標（部分、全部）→ DISTRICT_ROTATION 且 notice 正確；不以地址或行政區中心點推估距離
- [ ] 穩定輪替：同 session 同日兩次結果相同；換日可不同；非純 Random
- [ ] 只有縣市 → CITY_ROTATION；沒有位置 → NO_LOCATION；任何情況 notice 不含「最近」「附近」
- [ ] 跨 session 的 assessmentId → `NOT_FOUND`；無 token／錯誤 token → `SESSION_INVALID`
- [ ] Response 與 `contracts/mock/recommendations/**`（含 ranking-variants）欄位一致
- [ ] PR 註明真實資料 smoke 的座標覆蓋情況（A-003-r2 前只會走行政區輪替）

---

# Not In Scope

Sponsored Ranking、Google Distance Matrix、Frontend UI。MVP 距離可使用 Haversine。

---

# Completion Report

PR 必須回報：

```text
Submission Version:
Added:
Changed:
Fixed:
Tests / QA:
Known Issues:
是否修改 Allowed Paths 以外檔案:
```

PR Title：

```text
[B-005] Recommendation Engine + API
```

---

---

# 變更紀錄

- 2026-09-19：正式驗收使用 A-004 資料與 A-005 案例；session 歸屬依 J-002 規格。
- 2026-09-23 J-002-r3：恢復 DISTANCE 與 DISTRICT_ROTATION 都是 MVP 必要。
- 2026-09-23 J-002-r4：補充整併進主文；依 API_CONTRACT v0.2.2 §9 定義全部 rankingType、缺座標、只有縣市、沒有位置與回應欄位；前置改為 B-011a（B-004 已合併）。
