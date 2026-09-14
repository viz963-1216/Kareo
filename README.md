# Kareo / 長照一點通

Kareo 是一個提供給可能有長照需求之本人與家屬使用的免費長照需求初評與服務媒合平台。

平台提供的是**初步預估、資訊整理與服務導引**，不代表政府正式長照資格、CMS 等級或補助核定結果。正式資格與服務內容仍應由 1966 或所在地長期照顧管理中心評估確認。

---

## 目前開發模式

本專案採：

**Independent Development + Central Integration / 獨立開發 + Jerry 中心整合**

```text
                    Jerry
          Product / Spec / Integration
                     │
        ┌────────────┼────────────┐
        │            │            │
 Engineer A      Engineer B    Engineer C
 Data & QA        Backend       Frontend
```

A / B / C 原則上不互相修改程式。

所有跨模組整合由 Jerry 負責。

---

## 團隊分工

### Jerry — Product / Spec / Integration

負責：

- Product Spec / 產品規格
- Architecture / 系統架構
- Data Model / 資料模型
- API Contract / API 規格
- Task 分配
- PR Review
- Integration
- Merge / Deploy

主要 Ownership：

```text
/docs/**
/contracts/**
/tasks/**
/.github/**
```

### Engineer A — Data & QA / 資料與測試

負責：

- Provider 資料整理
- 地址、電話、服務類別
- Provider Service Area / 服務範圍
- Google Maps URL
- 資料清洗與驗證
- Mock Provider Data
- 基本 QA

主要 Ownership：

```text
/data/providers/**
```

### Engineer B — Backend / 後端

負責：

- Backend API
- Database
- Provider Backend
- Recommendation Engine
- Ranking
- Lead Backend
- Knowledge Database
- Knowledge Crawler
- Knowledge Version

主要 Ownership：

```text
/apps/api/**
/services/**
```

### Engineer C — Frontend / 前端

負責：

- Homepage
- Consent / Disclaimer UI
- Assessment UI
- Assessment Result
- Provider Top 3
- Provider Detail
- Google Maps CTA
- taiwanjcare CTA
- Lead Form
- Loading / Empty / Error
- RWD

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

**不要只看 Task 就直接開始寫 Code。**

---

# 每次工作的標準流程

## Step 1 — 收到 Task

例如：

```text
TASK-B-001
```

先打開：

```text
tasks/TASK-B-001.md
```

確認：

- Goal
- Allowed Paths
- Forbidden Paths
- Input
- Output
- Acceptance Criteria

---

## Step 2 — 建立自己的 Branch

一個 Task 一條 Branch。

例如：

```text
feat/a-001-provider-data
feat/b-001-backend-foundation
feat/c-001-frontend-foundation
```

禁止直接在 `main` 開發。

---

## Step 3 — 把 Task 交給自己的 AI

建議直接使用以下 Prompt：

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

確認 AI 理解正確後，再叫它開始實作。

---

## Step 4 — 只能修改自己的 Scope

如果 AI 想修改其他人的資料夾：

**停止。不要改。**

建立 Issue 或通知 Jerry。

不要因為 AI 說「這是 Best Practice」就擴大修改範圍。

---

## Step 5 — 完成測試

Task 完成前至少確認：

- Acceptance Criteria 是否全部通過
- 是否修改 Forbidden Paths
- 是否自行改了 Spec / Contract
- 是否新增 Task 未要求的功能
- 是否有 Known Issues

---

## Step 6 — Push 自己的 Branch

只能 Push 自己的 Feature Branch。

禁止：

```text
git push origin main
```

---

## Step 7 — 建立 Pull Request

PR Title 範例：

```text
[A-001] Provider Data Foundation
[B-001] Backend Foundation
[C-001] Frontend Foundation
```

PR 內容請使用 Repository 的 Pull Request Template。

---

## Step 8 — Jerry Review

Jerry 會確認：

- Task 是否完成
- 是否超出 Scope
- 是否改到其他人的模組
- 是否偷偷改 Spec / API / Schema
- Test 是否通過

確認後再 Merge。

---

# 重要規則

請記住五件事：

1. **不要直接改 main。**
2. **只改自己 Task 的 Allowed Paths。**
3. **一個 Task 一條 Branch。**
4. **Spec / Contract / Database Schema 不可以自行修改。**
5. **跨模組整合全部交給 Jerry。**

---

# Frontend / Backend 如何同時開發？

Engineer B 與 Engineer C 不需要互等。

B 依：

```text
docs/API_CONTRACT.md
```

完成 Real API。

C 依同一份 Contract 使用 Mock Data 完成 UI。

最後由 Jerry：

```text
Mock Data
↓
Real API
↓
Integration Test
```

因此 B / C 不需要直接修改彼此的程式。

---

# taiwanjcare

長照交通服務目前採外部導流。

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

# Source of Truth

如果文件或 AI 建議互相衝突，以以下順序為準：

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

如果仍無法判斷：

**停止修改，交由 Jerry 決定。**
