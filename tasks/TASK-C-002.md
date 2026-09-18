# TASK-C-002 — Frontend MVP Foundation

Owner: Engineer C — Frontend  
Type: Frontend / MVP Implementation  
Status: READY

---

# Goal / 目標

開始實作 Kareo 第一段真正可操作的 Frontend User Flow。

第一階段完成：

```text
Homepage
↓
Consent / Disclaimer
↓
Assessment
↓
Preliminary Result Shell
```

此 Task 使用 Mock Data / API Adapter，不等待 Engineer B 的 Real API。

之後由 Jerry 在 staging 把 Mock 切換為 Real API。

---

# Technical Direction

前端以 JavaScript / TypeScript 生態為主。

Deployment Target：

```text
Netlify
```

Jerry 已正式核准：

```text
React
Vite
TypeScript
React Router
```

Engineer C 可在 `/apps/web/**` 內建立該 App 自己的 package / Vite / TypeScript configuration。

不得修改 Repository Root Config；若部署需要 Root Config，回報 Jerry。

---

# 開始前必讀

```text
AGENTS.md
docs/PRODUCT_SPEC.md
docs/ARCHITECTURE.md
docs/DATA_MODEL.md
docs/API_CONTRACT.md
docs/GIT_RULES.md
tasks/TASK-C-001.md
```

---

# Branch / PR Rule

從最新 `staging` 建立：

```text
feat/c-002-frontend-mvp-foundation
```

完成後：

```text
PR → staging
```

不得直接 Push `staging` 或 `main`。

首次提交版次：

```text
C-002-r1
```

---

# Allowed Paths / 可修改範圍

```text
/apps/web/**
```

如果 Jerry 已正式核准 Frontend Framework，可在 `/apps/web/**` 內建立該 app 自己的 package / config。

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

以及 Repository Root Config，除非 Jerry 另行授權。

---

# Core Rule

Frontend 不得：

- 直接實作 Recommendation Ranking
- 自己判斷 Provider Top 3
- 自己實作 Knowledge PUBLISHED Rule
- 直接把 Supabase 當成核心 Business API
- 放 AI API Key
- 修改 API Response 格式

Frontend 只透過：

```text
API Adapter
↓
Mock / Real API
```

交換資料。

---

# Required Screens

## 1. Homepage

至少：

- Kareo 產品定位
- 「開始免費長照評估」CTA
- 初步預估提醒
- 非政府正式核定提醒

## 2. Consent / Disclaimer

開始 Assessment 前必須：

- 顯示 Disclaimer
- 顯示 Privacy Notice 入口 / 區塊
- Checkbox Clickwrap
- 未同意不可進 Assessment

## 3. Assessment

依 API Contract / Data Model 建立 MVP 問卷 UI。

至少涵蓋：

- ageRange
- city
- district
- livingSituation
- caregiverSituation
- mobilityLevel
- dailyLivingLevel
- homeCareNeed
- medicalNursingNeed
- assistiveDeviceNeed
- transportationNeed
- freeText

不得自行新增需要修改 Database Schema 的欄位。

## 4. Preliminary Result Shell

使用 Mock Response 顯示：

- Care Need
- Priority
- Summary
- Warnings
- 「初步預估」標示
- 1966 / 長照管理中心正式評估提醒

本 Task 不做真正 Provider Top 3。

---

# State Handling

主要畫面至少支援：

```text
LOADING
SUCCESS
EMPTY
ERROR
```

Assessment Error 不得自行生成假的 AI 結果。

---

# API Adapter

Frontend 應把資料取得封裝，不要在每個 Component 各自 hardcode Mock。

概念：

```text
UI
↓
API Client / Adapter
├── Mock
└── Real API（後續）
```

Jerry 後續應能以小範圍修改切換到 B 的 Real API。

---

# Kareocar

如果此階段 UI 出現 Transportation 說明，名稱統一：

```text
Kareocar
```

正式 URL：

```text
https://kareocar.netlify.app/
```

只能 External Link / New Tab。

不得 iframe 或內嵌。

---

# RWD / Accessibility

至少：

- Mobile First
- 手機可完整完成 Assessment
- Button / Input 有清楚 Label
- Keyboard 可操作
- Error 不只靠顏色表示
- 基本文字對比與可讀性
- 不把所有程式碼塞進單一大型 index 檔

請保持 Component / Module 拆分，避免重現單檔數千行問題。

---

# Not In Scope

本 Task 不做：

- Real Supabase
- Backend
- Recommendation Engine
- Provider Ranking
- Knowledge Crawler
- Provider Detail 正式資料
- Lead Backend
- Production Deploy

---

# Acceptance Criteria

- [ ] Homepage 可操作
- [ ] Consent 未同意不能進 Assessment
- [ ] Assessment 欄位符合既有 Contract / Data Model
- [ ] 可以使用 Mock 完成 Assessment Flow
- [ ] Preliminary Result 顯示 summary / warnings
- [ ] LOADING / SUCCESS / EMPTY / ERROR 有處理
- [ ] API Client / Mock 有隔離
- [ ] 沒有直接連核心 Supabase Business Logic
- [ ] 沒有 AI Key
- [ ] RWD 可用
- [ ] 沒有單一超大型 index 檔
- [ ] 沒有修改 Allowed Paths 之外檔案
- [ ] PR Base 為 `staging`
- [ ] PR 有 Submission Version 與 Changelog

---

# Completion Report

```text
Submission Version:
完成頁面:
主要 Components:
Mock / API Adapter:
RWD:
Tests / Manual Checks:
Added:
Changed:
Fixed:
Known Issues:
是否修改 Allowed Paths 以外檔案:
```

PR Title：

```text
[C-002] Frontend MVP Foundation
```

---

## 2026-09-19 MVP 補充驗收與依賴

隱私頁面/同意文案與版本使用 J-002 核准內容；未交付前可做明確標記的 Mock 版，不能標記正式文案驗收通過。保留 Real API adapter 邊界，逾時/錯誤不得顯示成功。正式接線由 J-003。

此補充不授權改寫高順位規格；所需規格更新由 TASK-J-002 先合併。
