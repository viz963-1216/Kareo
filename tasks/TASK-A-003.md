# TASK-A-003 — Provider Geocoding + Service Area QA

Owner: Engineer A — Data / QA / Research  
Type: Data QA  
Status: QUEUED — DO NOT START UNTIL A-002 MERGED

---

# Goal / 目標

針對 A-002 正式 Provider Dataset 做第二輪品質補強：補可驗證的經緯度、檢查地址可解析性、整理 Provider Address 與 Service Area，並清楚標記仍無法確認的資料。

---

# Prerequisite / 前置條件

A-002 已 Merge 到 `staging`。只能使用可追溯來源；不知道的資料保留 null / UNKNOWN，不可猜測。

---

# Branch / PR Rule

從最新 `staging` 建立：

```text
feat/a-003-provider-geocoding-service-area-qa
```

完成後：

```text
PR → staging
```

首次提交版次：

```text
A-003-r1
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
/data/providers/**
```

不得跨 Ownership。若必須修改其他模組，停止並回報 Jerry。

---

# Required Deliverables / 必交付

至少完成：
- 更新 Provider lat/lng（只有可驗證者）
- 地址與行政區一致性檢查
- Service Area 來源核對
- Google Maps URL 可用性檢查
- `/data/providers/qa/geocoding-service-area-report.md`

---

# Acceptance Criteria

- [ ] 已檢查 A-002 全部 Provider
- [ ] 可驗證的 lat/lng 已補齊
- [ ] 無法驗證者保留 null 並在報告列出
- [ ] 不把實體地址推測成服務範圍
- [ ] Service Area 每筆都有來源或明確 UNKNOWN
- [ ] 沒有修改 /data/providers/** 以外檔案

---

# Not In Scope

Backend、Supabase、Recommendation、Frontend、正式 E2E。

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
[A-003] Provider Geocoding + Service Area QA
```

---

## 2026-09-23 補充驗收：已驗證座標（J-002-r3）

PRODUCT_SPEC §21 要求有精確位置時依距離排序。A-003 報告 30／30 筆 Provider 沒有可追溯的已驗證座標，這是**資料缺口**（MVP_DECISIONS D-07），不是產品決策。

- [ ] 為 Provider 取得可追溯的已驗證座標；每筆記錄來源、驗證方式與日期。
- [ ] 無法驗證者保持 `null` 並列入報告，不從地址或行政區中心點推估。
- [ ] 報告座標覆蓋率（依服務類型、縣市、行政區），讓 B-005／J-003 知道距離排序可測範圍。
- [ ] 通過 A-004 座標範圍驗證。

若使用付費 geocoding 或第三方服務，先交 Jerry 決定（費用與授權）。若 Jerry 核准 D-08（MVP 不收 GPS），本補充可延後。

分支：從最新 `staging` 建 `feat/a-003-verified-coordinates`，Submission Version `A-003-r2`。

此補充不擴增產品範圍，只把 PRODUCT_SPEC 原始 MVP 已有的要求指到承接任務；所需規格更新由 TASK-J-002 先合併。
