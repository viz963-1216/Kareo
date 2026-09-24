# TASK-B-001 — Backend Foundation Plan

Owner: Engineer B  
Type: Backend / Architecture Preparation  
Status: MERGED（PR #3）— 模組完成，不代表整合完成或正式環境驗收（2026-09-23 J-002-r4 核對）  

---

# Goal / 目標

依既有 Spec 建立 Backend 第一階段實作計畫與模組骨架規劃，確認 Provider、Recommendation、Lead、Knowledge、Crawler 如何落地。

此 Task 先不要自行決定整個專案技術棧，也不要修改 Root Config。

如果 Repository 尚未有 Jerry 核准的 Backend Framework，本 Task 只建立實作計畫與資料夾規劃，不自行安裝 Framework。

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
feat/b-001-backend-foundation
```

完成後建立 PR，Base Branch 必須選：

```text
staging
```

不得直接 Push `staging` 或 `main`。

---

# Allowed Paths / 可修改範圍

```text
/apps/api/**
/services/recommendation/**
/services/knowledge/**
/services/crawler/**
```

# Forbidden Paths / 禁止修改

```text
/apps/web/**
/data/providers/**
/docs/**
/contracts/**
/tasks/**
/.github/**
```

以及 root package config、root lock file、root deploy config、Database production config，除非 Jerry 另外核准。

---

# Input / 輸入

以 `DATA_MODEL.md`、`API_CONTRACT.md`、`ARCHITECTURE.md` 為唯一規格來源。

Backend 主要模組：Session、Consent、Assessment、Provider、Recommendation、Lead、Knowledge、Crawler、ExternalService。

---

# Output / 輸出

建立：

```text
/apps/api/IMPLEMENTATION_PLAN.md
/services/recommendation/README.md
/services/knowledge/README.md
/services/crawler/README.md
```

內容至少說明：

1. 每個模組責任
2. 資料流
3. API Contract 對應
4. Recommendation 處理順序
5. Knowledge Crawler 更新流程
6. Error Handling
7. Test Strategy
8. 建議 Backend 技術棧與理由
9. 哪些技術決策需 Jerry 核准
10. 未來在 staging 的整合與測試需求

---

# Recommendation Rules

精確位置：

```text
Eligible Provider
→ Service Match
→ Service Area Match
→ Distance
→ Top 3
```

只有行政區：

```text
Eligible Provider
→ Service Match
→ Service Area Match
→ Stable Rotation
→ Top 3
```

禁止 LLM 直接挑 Provider。

---

# Knowledge Rules

```text
Official Source
→ Crawler
→ Snapshot
→ Hash Compare
→ KnowledgeChange
→ NEEDS_REVIEW
→ Admin Review
→ APPROVED
→ PUBLISHED
```

Crawler 不得直接修改正式 Assessment Rule。

---

# Tech Stack Rule

如果目前沒有已核准技術棧，可以提出最多 2 個方案，比較開發難度、Vibe Coding 友善程度、Deployment、Database 支援、Type Safety、維護成本。

不得自行安裝或修改 Root Config，最後提出推薦方案給 Jerry 決定。

---

# Acceptance Criteria

- [ ] 完成 Backend Implementation Plan
- [ ] Provider / Recommendation / Lead / Knowledge / Crawler 都有模組規劃
- [ ] API Contract 對應清楚
- [ ] Recommendation 不由 LLM 直接選商家
- [ ] Knowledge 有 Review / Publish Gate
- [ ] 提出技術棧建議，但沒有擅自修改 Root Config
- [ ] 沒有修改 Frontend
- [ ] 沒有修改 Spec / Contract
- [ ] 沒有修改 Allowed Paths 之外檔案
- [ ] PR Base 是 `staging`

---

# Completion Report

```text
1. 完成哪些檔案
2. Backend 模組如何拆分
3. 推薦的技術棧
4. 為什麼推薦
5. 哪些決策仍需要 Jerry 核准
6. 是否修改 Allowed Paths 之外檔案
7. Known Issues
```

完成後建立：

```text
[B-001] Backend Foundation Plan
Feature Branch → staging
```


## 歷史交付封存（2026-09-19）

本任務已合併。原交付路徑列於上方作為歷史紀錄；規劃原文現集中於 [FOUNDATION_PLANS.md](../docs/archive/FOUNDATION_PLANS.md)，不需重建舊檔。後續工作依目前任務總表與正式規格。
