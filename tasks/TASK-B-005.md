# TASK-B-005 — Recommendation Engine + API

Owner: Engineer B — Backend  
Type: Backend / Recommendation  
Status: QUEUED — DO NOT START UNTIL B-004 MERGED

---

# Goal / 目標

實作 Recommendation Engine 與 `POST /api/v1/recommendations`，嚴格遵守 Service Match → Service Area → Distance / Stable Rotation → Top 3。

---

# Prerequisite / 前置條件

B-004 已 Merge，Provider DB 可查詢。

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

- Service Type Match
- Service Area Match
- GPS → distance ranking
- DISTRICT → deterministic Stable Rotation
- Seed 概念：sessionId + district + date
- RecommendationRun / RecommendationItem persistence
- Explainable reasons
- 0 家回成功空陣列，不得 Error
- API + tests

---

# Acceptance Criteria

- [ ] AI 不直接選 Provider
- [ ] GPS 與 DISTRICT 邏輯分開
- [ ] Stable Rotation 非純 Random
- [ ] 最多 3 家
- [ ] 0 / 1 / 2 / 3 家案例通過
- [ ] reasons 可解釋
- [ ] Response 符合 Contract

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

## 2026-09-19 MVP 補充驗收與依賴

正式驗收使用通過 A-004 的資料與 A-005 cases；Assessment/session 歸屬依 J-002 核准規格檢查。地點不足、無座標、不足三家及 0 家皆按既有 contract 處理，不補假 Provider。跨模組真實鏈路由 J-003 驗收。

此補充不授權改寫高順位規格；所需規格更新由 TASK-J-002 先合併。

---

## 2026-09-23 補充：距離與行政區兩個分支都屬 MVP（J-002-r3）

- 依 PRODUCT_SPEC §21–24 實作 `DISTANCE` 與 `DISTRICT_ROTATION`，**兩者都是 MVP 必要**。上一版「依 D-07 只做 DISTRICT_ROTATION」已撤回。
- 分支選擇：使用者提供精確位置（`EXACT`／`GPS`）且候選 Provider 有已驗證座標 → `DISTANCE`；其餘 → `DISTRICT_ROTATION`。
- 精確位置但部分 Provider 缺座標：不得以地址或行政區中心點推估距離。處理方式（例如整體改用行政區輪替並在 notice 說明）若 contract 未定義，先交 Jerry 決定，不自行發明。
- 只有縣市／沒有位置：依 D-13 決議；核准前回空結果＋提醒提供縣市／行政區，不得出現「附近」「最近」。
- 測試：合成座標單元測試（Haversine、排序、同距離次序穩定、`distanceKm` 與「距離約 X 公里」只在 DISTANCE 出現）；真實資料 smoke 目前只會走 DISTRICT_ROTATION（座標為資料缺口），需在 PR 註明。
- Session：依 API_CONTRACT v0.2 §3.1（D-04 PROPOSED）驗證 token 與 assessment 歸屬，屬 B-011a 的共用元件，開發時就使用。

此補充不擴增產品範圍，只把 PRODUCT_SPEC 原始 MVP 已有的要求指到承接任務；所需規格更新由 TASK-J-002 先合併。
