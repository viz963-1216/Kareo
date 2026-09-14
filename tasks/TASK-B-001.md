# TASK-B-001 — Backend Foundation Plan

Owner: Engineer B  
Type: Backend / Architecture Preparation  
Status: READY

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

# Allowed Paths / 可修改範圍

```text
/apps/api/**
/services/recommendation/**
/services/knowledge/**
/services/crawler/**
```

---

# Forbidden Paths / 禁止修改

```text
/apps/web/**
/data/providers/**
/docs/**
/contracts/**
/tasks/**
/.github/**
```

以及：

```text
root package config
root lock file
root deploy config
Database production config
```

除非 Jerry 另外核准。

---

# Input / 輸入

以以下文件為唯一規格來源：

```text
DATA_MODEL.md
API_CONTRACT.md
ARCHITECTURE.md
```

Backend 必須支援的主要模組：

```text
Session
Consent
Assessment
Provider
Recommendation
Lead
Knowledge
Crawler
ExternalService
```

---

# Output / 輸出

在自己的 Ownership 中建立：

```text
/apps/api/IMPLEMENTATION_PLAN.md
/services/recommendation/README.md
/services/knowledge/README.md
/services/crawler/README.md
```

內容至少說明：

1. 每個模組的責任
2. 預計的資料流
3. API Contract 對應關係
4. Recommendation 的處理順序
5. Knowledge Crawler 的更新流程
6. Error Handling
7. Test Strategy
8. 建議 Backend 技術棧，以及理由
9. 哪些技術決策需要 Jerry 核准後才能開始實作

---

# Recommendation Rules / 推薦規則

計畫必須明確包含：

```text
有精確位置：
Eligible Provider
→ Service Match
→ Service Area Match
→ Distance
→ Top 3
```

```text
只有行政區：
Eligible Provider
→ Service Match
→ Service Area Match
→ Stable Rotation
→ Top 3
```

禁止 LLM 直接挑 Provider。

---

# Knowledge Rules / 知識庫規則

計畫必須包含：

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

# Tech Stack Rule / 技術棧規則

如果目前沒有已核准技術棧：

可以提出最多 2 個方案並比較：

- 開發難度
- Vibe Coding 友善程度
- Deployment
- Database 支援
- Type Safety
- 後續維護

但不得自行安裝或修改 Root Config。

最後提出一個推薦方案給 Jerry 決定。

---

# Acceptance Criteria / 驗收標準

- [ ] 完成 Backend Implementation Plan
- [ ] Provider / Recommendation / Lead / Knowledge / Crawler 都有模組規劃
- [ ] API Contract 對應清楚
- [ ] Recommendation 不由 LLM 直接選商家
- [ ] Knowledge 有 Review / Publish Gate
- [ ] 提出技術棧建議，但沒有擅自修改 Root Config
- [ ] 沒有修改 Frontend
- [ ] 沒有修改 Spec / Contract
- [ ] 沒有修改 Allowed Paths 之外檔案

---

# Completion Report / 完成後回報

```text
1. 完成哪些檔案
2. Backend 模組如何拆分
3. 推薦的技術棧
4. 為什麼推薦
5. 哪些決策仍需要 Jerry 核准
6. 是否修改 Allowed Paths 之外檔案
7. Known Issues
```

完成後建立 PR：

```text
[B-001] Backend Foundation Plan
```
