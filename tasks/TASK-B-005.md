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
