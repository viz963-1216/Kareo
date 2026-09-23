# TASK-C-001 — Frontend Foundation Plan

Owner: Engineer C  
Type: Frontend / UX Architecture Preparation  
Status: MERGED（PR #4）— 模組完成，不代表整合完成或正式環境驗收（2026-09-23 J-002-r4 核對）  

---

# Goal / 目標

依既有 Spec 建立 Frontend 第一階段的頁面、流程、Component 與狀態規劃，確保之後可以完全依 API Contract 使用 Mock Data 開發，不需要等待 Backend。

此 Task 先不要自行決定整個專案技術棧，也不要修改 Root Config。

如果 Repository 尚未有 Jerry 核准的 Frontend Framework，本 Task 先建立實作計畫，不自行安裝 Framework。

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

# Branch / PR Rule

從最新 `staging` 建立：

```text
feat/c-001-frontend-foundation
```

完成後建立 PR，Base Branch 必須選：

```text
staging
```

不得直接 Push `staging` 或 `main`。

---

# Allowed Paths / 可修改範圍

```text
/apps/web/**
```

# Forbidden Paths / 禁止修改

```text
/apps/api/**
/services/**
/data/providers/**
/docs/**
/contracts/**
/tasks/**
/.github/**
```

以及 root package config、root lock file、root deploy config，除非 Jerry 另外核准。

---

# Input / 輸入

以 `PRODUCT_SPEC.md`、`API_CONTRACT.md`、`ARCHITECTURE.md` 為唯一規格來源。

MVP 主要畫面：Homepage、Consent / Disclaimer、Assessment、Assessment Result、Service Recommendation、Provider Top 3、Provider Detail、Lead Form、Google Maps CTA、Kareocar CTA。

---

# Output / 輸出

建立：

```text
/apps/web/IMPLEMENTATION_PLAN.md
```

內容至少包含：

1. Sitemap / Page Map
2. User Flow
3. 每個頁面的責任
4. Component Map
5. 前端狀態管理
6. Loading / Success / Empty / Error State
7. Mock Data 使用方式
8. API Contract 對應方式
9. Disclaimer / Preliminary Result 呈現位置
10. Google Maps / Kareocar 外部導流方式
11. RWD 策略
12. Accessibility 基本考量
13. 建議 Frontend 技術棧與理由
14. 哪些技術決策需 Jerry 核准
15. 未來在 staging 與 Real API 整合時的注意事項

---

# User Flow

```text
Homepage
↓
開始免費評估
↓
Consent / Disclaimer
↓
Assessment
↓
Care Need Profile / 初步結果
↓
Service Recommendation
↓
Provider Top 3
↓
Provider Detail / 我要媒合 / Google Maps
```

TRANSPORTATION：

```text
Care Need Profile
↓
TRANSPORTATION
↓
外部 CTA
↓
Kareocar（New Tab）
↓
https://kareocar.netlify.app/
```

---

# Disclaimer Rule

至少標示：

- Assessment 前：完整 Consent
- Assessment Result：「初步預估」
- 補助資訊：「可能符合 / 預估」
- Provider Result：依目前資料推薦
- Footer：正式資格仍由 1966 / 長照管理中心評估

不得使用「正式核定」語氣。

---

# Mock Rule

Frontend 必須依 `API_CONTRACT.md` 格式使用 Mock Data。

C 不需要等待 B 的 Real API，也不修改 `/contracts/**`。需要新增 Mock Contract 時建立 Issue 交 Jerry。

---

# State Rule

所有主要 API 畫面必須規劃：

```text
LOADING
SUCCESS
EMPTY
ERROR
```

---

# Tech Stack Rule

如果目前沒有已核准技術棧，可以提出最多 2 個方案，比較 Vibe Coding 友善程度、RWD、Routing、State Management、API Integration、Deployment、維護成本。

不得自行修改 Root Config 或安裝 Framework，最後提出推薦方案給 Jerry 決定。

---

# Acceptance Criteria

- [ ] 完成 Frontend Implementation Plan
- [ ] 所有 MVP 頁面都有責任定義
- [ ] User Flow 與 Product Spec 一致
- [ ] Loading / Success / Empty / Error 都有規劃
- [ ] Mock Data 與 API Contract 對應方式清楚
- [ ] Disclaimer 呈現位置清楚
- [ ] Kareocar 為 External Link，不內嵌
- [ ] Kareocar URL 使用 `https://kareocar.netlify.app/`
- [ ] 提出技術棧建議，但沒有擅自修改 Root Config
- [ ] 沒有修改 Backend
- [ ] 沒有修改 Spec / Contract
- [ ] 沒有修改 Allowed Paths 以外檔案
- [ ] PR Base 是 `staging`

---

# Completion Report

```text
1. 完成哪些檔案
2. 頁面如何拆分
3. Component 如何拆分
4. 推薦的 Frontend 技術棧
5. 為什麼推薦
6. 哪些決策需要 Jerry 核准
7. 是否修改 Allowed Paths 以外檔案
8. Known Issues
```

完成後建立：

```text
[C-001] Frontend Foundation Plan
Feature Branch → staging
```


## 歷史交付封存（2026-09-19）

本任務已合併。原交付路徑列於上方作為歷史紀錄；規劃原文現集中於 [FOUNDATION_PLANS.md](../docs/archive/FOUNDATION_PLANS.md)，不需重建舊檔。後續工作依目前任務總表與正式規格。
