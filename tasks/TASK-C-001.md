# TASK-C-001 — Frontend Foundation Plan

Owner: Engineer C  
Type: Frontend / UX Architecture Preparation  
Status: READY

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

# Allowed Paths / 可修改範圍

```text
/apps/web/**
```

---

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

以及：

```text
root package config
root lock file
root deploy config
```

除非 Jerry 另外核准。

---

# Input / 輸入

以以下文件為唯一規格來源：

```text
PRODUCT_SPEC.md
API_CONTRACT.md
ARCHITECTURE.md
```

MVP 主要畫面：

```text
Homepage
Consent / Disclaimer
Assessment
Assessment Result
Service Recommendation
Provider Top 3
Provider Detail
Lead Form
Google Maps CTA
taiwanjcare CTA
```

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
5. 前端狀態管理方式
6. Loading / Success / Empty / Error State
7. Mock Data 使用方式
8. API Contract 對應方式
9. Disclaimer / Preliminary Result 呈現位置
10. Google Maps / taiwanjcare 外部導流方式
11. RWD 策略
12. Accessibility 基本考量
13. 建議 Frontend 技術棧，以及理由
14. 哪些技術決策需要 Jerry 核准後才能開始實作

---

# User Flow / 必須遵守流程

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
taiwanjcare（New Tab）
```

---

# Disclaimer Rule / 免責呈現規則

規劃中至少要標示：

- Assessment 前：完整 Consent
- Assessment Result：顯示「初步預估」
- 補助資訊：使用「可能符合 / 預估」語氣
- Provider Result：顯示依目前資料推薦
- Footer：固定提醒正式資格仍由 1966 / 長照管理中心評估

不得使用「正式核定」語氣。

---

# Mock Rule / 假資料規則

Frontend 之後必須依 `API_CONTRACT.md` 的格式使用 Mock Data。

C 不需要等待 B 的 Real API。

本 Task 不修改 `/contracts/**`；如果需要新增 Mock Contract，建立 Issue 交 Jerry 處理。

---

# State Rule / 狀態規則

所有主要 API 畫面必須規劃：

```text
LOADING
SUCCESS
EMPTY
ERROR
```

不能只規劃成功畫面。

---

# Tech Stack Rule / 技術棧規則

如果目前沒有已核准技術棧：

可以提出最多 2 個方案並比較：

- Vibe Coding 友善程度
- RWD
- Routing
- State Management
- API Integration
- Deployment
- 維護成本

最後提出一個推薦方案給 Jerry 決定。

不得自行修改 Root Config 或直接安裝 Framework。

---

# Acceptance Criteria / 驗收標準

- [ ] 完成 Frontend Implementation Plan
- [ ] 所有 MVP 頁面都有責任定義
- [ ] User Flow 與 Product Spec 一致
- [ ] Loading / Success / Empty / Error 都有規劃
- [ ] Mock Data 與 API Contract 對應方式清楚
- [ ] Disclaimer 呈現位置清楚
- [ ] taiwanjcare 為 External Link，不內嵌
- [ ] 提出技術棧建議，但沒有擅自修改 Root Config
- [ ] 沒有修改 Backend
- [ ] 沒有修改 Spec / Contract
- [ ] 沒有修改 Allowed Paths 以外檔案

---

# Completion Report / 完成後回報

```text
1. 完成哪些檔案
2. 頁面如何拆分
3. Component 如何拆分
4. 推薦的 Frontend 技術棧
5. 為什麼推薦
6. 哪些決策需要 Jerry 核准
7. 是否修改 Allowed Paths 之外檔案
8. Known Issues
```

完成後建立 PR：

```text
[C-001] Frontend Foundation Plan
```
