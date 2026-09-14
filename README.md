# Kareo / 長照一點通

Kareo 是一個提供給可能有長照需求之本人與家屬使用的免費長照需求初評與服務媒合平台。

平台提供的是**初步預估、資訊整理與服務導引**，不代表政府正式長照資格、CMS 等級或補助核定結果。正式資格與服務內容仍應由 1966 或所在地長期照顧管理中心評估確認。

---

## 開發模式

本專案採：

**Independent Development + Central Integration / 獨立開發 + Jerry 中心整合**

```text
Engineer A / B / C
        ↓
各自 Feature Branch
        ↓
PR → staging
        ↓
Jerry Review + Integration Test
        ↓
staging → main
        ↓
Production
```

A / B / C 原則上不互相修改程式，所有跨模組整合由 Jerry 在 `staging` 完成。

---

## 分支用途

### `main`

正式穩定分支。代表可以部署到 Production 的版本。

- A / B / C 不直接 Push
- A / B / C 不自行 Merge
- 只有 Jerry 負責 `staging → main`

### `staging`

整合與驗收分支。

- 所有 Feature PR 先進 `staging`
- Jerry 在此串接 Frontend / Backend / Provider Data
- 執行 Integration / E2E Test
- 通過後才建立 Release PR 到 `main`

### Feature Branch

一個 Task 一條 Branch，而且必須從最新 `staging` 建立，例如：

```text
feat/a-001-provider-data
feat/b-001-backend-foundation
feat/c-001-frontend-foundation
```

---

## 團隊分工

### Jerry — Product / Spec / Integration

負責：Product Spec、Architecture、Data Model、API Contract、Task 分配、PR Review、staging Integration、Release、Deploy。

主要 Ownership：

```text
/docs/**
/contracts/**
/tasks/**
/.github/**
```

### Engineer A — Data & QA / 資料與測試

負責：Provider 資料、服務範圍、Google Maps URL、資料清洗、Mock Provider Data、基本 QA。

主要 Ownership：

```text
/data/providers/**
```

### Engineer B — Backend / 後端

負責：Backend API、Database、Provider Backend、Recommendation Engine、Lead、Knowledge Database、Crawler。

主要 Ownership：

```text
/apps/api/**
/services/**
```

### Engineer C — Frontend / 前端

負責：Homepage、Consent、Assessment、Result、Provider Top 3、Provider Detail、Google Maps CTA、taiwanjcare CTA、Lead Form、RWD、Loading / Empty / Error。

主要 Ownership：

```text
/apps/web/**
```

---

# 團員第一次開始前

請先閱讀：

1. `AGENTS.md`
2. `docs/PRODUCT_SPEC.md`
3. `docs/ARCHITECTURE.md`
4. `docs/DATA_MODEL.md`
5. `docs/API_CONTRACT.md`
6. `docs/GIT_RULES.md`
7. Jerry 指派給你的 `tasks/TASK-XXX.md`

不要只看 Task 就直接開始寫 Code。

---

# 每次工作的標準流程

## Step 1 — 更新 staging

開始新 Task 前，先確認自己的本地端是最新 `staging`。

概念：

```text
staging
↓
建立自己的 Feature Branch
```

不要從舊 Feature Branch 繼續做下一個 Task。

## Step 2 — 建立自己的 Feature Branch

例如：

```text
feat/b-003-recommendation
```

禁止直接在 `main` 或 `staging` 開發。

## Step 3 — 把 Task 交給自己的 AI

建議 Prompt：

```text
請執行 tasks/TASK-XXX.md。

開始前請先閱讀 AGENTS.md，以及 Task 指定的所有 Spec。

先不要修改任何程式。

請先回答：
1. 你理解的任務
2. Allowed Paths
3. Forbidden Paths
4. Input
5. Output
6. Acceptance Criteria
7. 預計修改哪些檔案

不得修改 Allowed Paths 之外的檔案。
不得自行修改 Spec、API Contract 或 Database Schema。
如果發現需要跨模組修改，請停止並告訴我原因。
```

確認理解正確後再開始實作。

## Step 4 — 只能修改自己的 Scope

如果 AI 想修改其他人的資料夾、Spec、Contract 或 Root Config，停止並通知 Jerry。

## Step 5 — 完成測試

至少確認：

- Acceptance Criteria 全部通過
- 沒有修改 Forbidden Paths
- 沒有自行改 Spec / Contract / Schema
- 沒有新增 Task 未要求的功能
- 已列出 Known Issues

## Step 6 — Push 自己的 Branch

只能 Push Feature Branch。

禁止直接 Push：

```text
main
staging
```

## Step 7 — 建立 Pull Request

**一般工程 Task 的 PR Base 一律選 `staging`。**

PR Title 範例：

```text
[A-001] Provider Data Foundation
[B-001] Backend Foundation Plan
[C-001] Frontend Foundation Plan
```

使用 Repository 的 Pull Request Template。

## Step 8 — Jerry Review

Jerry 會確認 Task、Scope、Spec、Contract、Schema 與 Test。

通過後 Merge 到 `staging`。

## Step 9 — staging Integration

Jerry 在 `staging`：

```text
A Provider Data
+
B Backend
+
C Frontend
↓
Integration / E2E Test
```

Feature PR 被合併到 staging，只代表 **Module Complete**，不代表正式上線。

## Step 10 — Release to main

只有 Jerry 建立：

```text
staging → main
```

Release PR。

通過後才進 Production。

---

# Frontend / Backend 如何同時開發？

B 依 `docs/API_CONTRACT.md` 完成 Real API。

C 依同一份 Contract 使用 Mock Data 完成 UI。

兩人不需要互等，也不需要修改彼此程式。

最後由 Jerry 在 `staging` 將 Mock 換成 Real API 並做整合測試。

---

# taiwanjcare

長照交通服務目前採外部導流：

```text
Kareo
↓
TRANSPORTATION
↓
外部連結
taiwanjcare
```

MVP 不做 iframe、Backend Integration、Database Integration 或共用登入。

---

# 重要規則

1. 不直接改 `main`。
2. 不直接改 `staging`。
3. Feature Branch 從最新 `staging` 建立。
4. Feature PR 一律進 `staging`。
5. Spec / Contract / Database Schema 不自行修改。
6. 跨模組整合全部交給 Jerry。
7. 只有 Jerry 將 `staging` 發布到 `main`。

---

# Source of Truth

```text
PRODUCT_SPEC.md
↓
ARCHITECTURE.md
↓
DATA_MODEL.md
↓
API_CONTRACT.md
↓
GIT_RULES.md
↓
TASK
↓
Code
```

如果仍無法判斷，停止修改並交由 Jerry 決定。
