# Kareo — AI Development Rules

本檔案是 Kareo 專案所有 AI 與開發者的共同開發守則。

任何 AI 在修改程式碼之前，必須先閱讀本檔案，以及 Task 指定的相關 Spec。

---

# 1. Source of Truth / 規格優先順序

如果文件之間出現衝突，優先順序如下：

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

高順位規格優先。無法判斷時，停止修改並建立 Issue，交由 Jerry 決定。

---

# 2. 開始 Coding 前必須先讀

至少閱讀：

```text
AGENTS.md
```

以及 Task 指定的：

```text
docs/PRODUCT_SPEC.md
docs/ARCHITECTURE.md
docs/DATA_MODEL.md
docs/API_CONTRACT.md
docs/GIT_RULES.md
tasks/TASK-XXX.md
```

---

# 3. 開始修改前先回報理解

第一次執行 Task 時先不要修改程式，先回答：

```text
1. 我的任務是什麼
2. Allowed Paths 是什麼
3. Forbidden Paths 是什麼
4. Input 是什麼
5. Output 是什麼
6. Acceptance Criteria 是什麼
7. 預計修改哪些檔案
```

確認後才開始 Coding。

---

# 4. 中心整合制

本專案採：

**Independent Development + Central Integration**

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

A / B / C 不直接整合彼此程式。所有跨模組整合由 Jerry 在 `staging` 完成。

---

# 5. Branch Roles / 分支角色

## main

正式穩定分支，代表可部署 Production 的版本。

A / B / C 禁止直接 Push 或 Merge `main`。

## staging

Jerry 的整合與驗收分支。

A / B / C 的 Feature PR 一律以 `staging` 為 Base。

A / B / C 禁止直接 Push `staging`。

## Feature Branch

每個 Task 從最新 `staging` 建立自己的 Branch，例如：

```text
feat/a-001-provider-data
feat/b-003-recommendation
feat/c-004-provider-result-ui
```

---

# 6. Ownership / 負責範圍

## Jerry

主要負責：

```text
/docs/**
/contracts/**
/tasks/**
/.github/**
```

中文：

- Product Spec / 產品規格
- Architecture / 系統架構
- Data Model / 資料模型
- API Contract / API 規格
- Git Rules / Git 規則
- Task 分配
- PR Review
- staging Integration
- staging → main Release
- Deploy

## Engineer A

主要負責：

```text
/data/providers/**
```

中文：Provider 原始資料、商家資料整理、地址、電話、服務類別、服務範圍、Google Maps URL、資料清洗、資料驗證、Mock Provider Data、QA 測試。

## Engineer B

主要負責：

```text
/apps/api/**
/services/**
```

中文：Backend API、Database、Provider Backend、Recommendation Engine、Ranking、Lead Backend、Knowledge Database、Knowledge Crawler、Knowledge Version。

## Engineer C

主要負責：

```text
/apps/web/**
```

中文：Homepage、Consent UI、Assessment UI、Assessment Result、Provider Top 3 UI、Provider Detail、Google Maps CTA、Kareocar CTA、Lead Form、Loading / Empty / Error State、RWD。

---

# 7. 不得修改別人的 Ownership

原則：A 不改 B/C，B 不改 A/C，C 不改 A/B。

如果 Task 需要跨 Ownership，停止修改，建立 Issue，交 Jerry 決定。

---

# 8. Allowed Paths / Forbidden Paths

每個 Task 必須定義 `Allowed Paths` 與 `Forbidden Paths`。

AI 只能修改 Allowed Paths。若需要碰 Forbidden Paths，停止修改並建立 Issue。

---

# 9. Spec / Contract 不得自行修改

A / B / C 與 AI 不得自行修改：

```text
/docs/**
/contracts/**
```

除非 Task 明確由 Jerry 授權。

也不得自行新增或修改核心欄位、enum、API Response、Database Schema、Recommendation 規則或 Product Flow。

---

# 10. 不得自行擴大 Task

Task 沒寫就不要做。禁止 AI 順便重構、改命名、升級套件、改架構、修其他 Bug 或加入新功能。

額外建議請建立 Issue。

---

# 11. Frontend / Backend 分離

Engineer C 使用 Mock Data 完成 Frontend，不需要等待 Engineer B。

Engineer B 只需讓 API 符合 `docs/API_CONTRACT.md`，不需要接 Frontend。

最後由 Jerry 在 `staging`：

```text
Mock API
↓
Real API
↓
Integration Test
```

---

# 12. AI 不直接挑 Provider

正確：

```text
Assessment
↓
CareNeedProfile
↓
Recommendation Engine
↓
Provider Database
↓
Top 3
```

禁止 LLM 自己決定三家 Provider。

---

# 13. Kareocar

`TRANSPORTATION` 在 MVP 只做外部連結：

```text
CareNeedProfile
↓
TRANSPORTATION
↓
Frontend CTA
↓
Kareocar
```

Kareocar URL：`https://kareocar.netlify.app/`

禁止 iframe、Backend Integration、Database Integration、Authentication Integration。

---

# 14. Knowledge Database

長照制度、法規、補助不得直接寫死在 AI Prompt。Assessment 應優先使用 `PUBLISHED Knowledge Version`。

Crawler 發現官方資料改變時：

```text
Detect Change
↓
KnowledgeChange
↓
NEEDS_REVIEW
↓
Jerry / Admin Review
↓
APPROVED
↓
PUBLISHED
```

只有 `PUBLISHED` 版本可以供正式 Assessment 使用。

---

# 15. 長照結果必須使用「預估」

平台不得宣稱正式長照資格、正式 CMS 等級或正式補助核定。

必須使用「初步預估」、「可能符合」、「依目前資料推估」等語句，並提醒：

```text
實際資格、長照等級、服務內容及補助，
仍應由 1966 或所在地長期照顧管理中心正式評估確認。
```

---

# 16. Secret Rule

禁止 Commit API Key、Database Password、Token、Private Key 或其他 Secret。

Secret 只能放 Environment Variables，Frontend 不得包含 AI API Key。

---

# 17. Git Rule

禁止直接 Push：

```text
main
staging
```

所有一般 Task：

```text
更新 staging
↓
從 staging 建 Feature Branch
↓
Code
↓
Test
↓
PR → staging
↓
Jerry Review
↓
Merge staging
↓
Jerry Integration / E2E Test
```

正式發布：

```text
staging
↓
Release PR → main
↓
Jerry Review
↓
Production
```

---

# 18. 完成標準

AI 完成 Task 後必須回報：

```text
1. 完成哪些功能
2. 修改哪些檔案
3. 是否超出 Allowed Paths
4. 測試結果
5. Acceptance Criteria 是否全部通過
6. 是否有 Known Issues
```

Feature PR 合併到 `staging` 只代表模組通過初步驗收，不代表 Production Complete。

---

# 19. 最重要的規則

- 不確定：不要猜。
- 需要跨模組：不要改。
- 需要改 Spec：不要改。
- Task 沒要求：不要做。
- Feature PR 一律進 `staging`。
- `main` 只由 Jerry 發布。
