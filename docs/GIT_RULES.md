# Kareo / 長照一點通 — Git Collaboration Rules

Version: v0.1  
Status: LOCKED FOR MVP  
Owner: Jerry

---

# 1. 目的

本文件定義四人協作時的 GitHub 規則。

目標：

- A / B / C 可以同時開發
- 不互相修改程式
- 降低 Merge Conflict
- AI 不可擅自跨模組修改
- main 永遠保持可運作
- Jerry 負責最後整合

---

# 2. 團隊角色

## Jerry

中文：

- Product Owner / 產品負責人
- Spec Owner / 規格負責人
- Integration Owner / 整合負責人
- Main Branch Owner / 主分支負責人

Jerry 負責建立 Task、Review PR、修改 Spec / Contract、最終整合、Merge main、Deploy。

## Engineer A / 工程師 A

主要負責：

```text
/data/providers/**
```

中文：

- Provider 資料
- Google Maps URL
- Service Area
- Mock Provider Data
- 資料驗證
- 基本 QA

## Engineer B / 工程師 B

主要負責：

```text
/apps/api/**
/services/**
```

中文：

- 後端 API
- Database
- Provider Backend
- Recommendation Engine
- Lead Backend
- Knowledge DB
- Crawler

## Engineer C / 工程師 C

主要負責：

```text
/apps/web/**
```

中文：

- 首頁
- Assessment UI
- 初評結果
- Top 3
- Provider UI
- Lead Form
- RWD
- Loading / Empty / Error

---

# 3. main Branch

`main` 永遠保持可執行。

A / B / C 禁止直接 Push `main`。

所有正式修改都必須：

```text
Task
↓
Branch
↓
Code
↓
Test
↓
Pull Request
↓
Jerry Review
↓
Merge
```

---

# 4. 一個 Task 一條 Branch

禁止一條 Branch 同時做很多功能。

範例：

```text
TASK-B-003
↓
feat/b-003-provider-recommendation
```

完成後 PR → Merge → 刪除 Branch。

---

# 5. Branch Naming / 分支命名

格式：

```text
類型/負責人-task編號-簡短名稱
```

範例：

```text
feat/a-001-provider-data
feat/b-003-recommendation
feat/c-004-provider-result-ui
fix/b-008-empty-provider
fix/c-010-mobile-layout
```

`refactor/*` 只有 Jerry 核准才可使用。

---

# 6. Allowed Paths / 可修改範圍

每個 Task 必須定義 `Allowed Paths`。

AI 只能修改 Task 指定的路徑。

---

# 7. Forbidden Paths / 禁止修改範圍

每個 Task 必須定義 `Forbidden Paths`。

如果 AI 認為一定要修改 Forbidden Path：

**停止，不要修改，建立 Issue。**

---

# 8. Ownership Rule

預設：

```text
/data/providers/**
→ Engineer A

/apps/api/**
/ services/**
→ Engineer B

/apps/web/**
→ Engineer C

/docs/**
/contracts/**
/tasks/**
/.github/**
→ Jerry
```

禁止 A 改 B、B 改 C、C 改 B，除非 Task 明確授權。

---

# 9. Shared Critical Files / 共用重要檔案

以下檔案不可自行修改：

```text
package.json
lock files
.env*
Dockerfile
database config
deployment config
root config
schema migration
```

如果 Task 需要修改，先建立 Issue，由 Jerry 決定。

---

# 10. Spec / Contract Rule

以下只由 Jerry 維護：

```text
/docs/**
/contracts/**
```

A / B / C 只能提出 Issue，不自行改 Spec 或 Contract。

---

# 11. 開始 Coding 前

每次 AI 開始工作前，先閱讀：

```text
AGENTS.md
```

以及 Task 指定的 Spec。

開始修改前，AI 必須先回答：

```text
1. 我的任務是什麼
2. Allowed Paths
3. Forbidden Paths
4. Input
5. Output
6. Acceptance Criteria
7. 預計修改哪些檔案
```

確認後才開始 Coding。

---

# 12. 固定 AI Prompt

```text
請執行 tasks/TASK-XXX.md。

開始前先閱讀 AGENTS.md 與 Task 指定的所有 Spec。

先不要修改任何程式，先回答：
1. 你理解的任務
2. Allowed Paths
3. Forbidden Paths
4. Input
5. Output
6. Acceptance Criteria
7. 預計修改哪些檔案

不得修改 Allowed Paths 之外的檔案。
不得自行修改 Spec、API Contract 或 Database Schema。
如果需要跨模組修改，請停止並告訴我原因。
```

---

# 13. Commit Rule

Commit 要小且可理解。

建議：

```text
feat(B-003): add provider recommendation filter
fix(C-006): handle empty provider result
data(A-002): add new taipei providers
```

禁止：

```text
Update stuff
```

也禁止一個 Commit 混入無關功能。

---

# 14. Pull Request / PR

Task 完成後一定要建立 PR。

PR Title：

```text
[B-003] Provider Recommendation
[A-001] Provider Data Cleanup
[C-004] Top 3 Provider UI
```

---

# 15. Contract / Database Change

任何 Contract 或 Database 核心 Schema 修改都不能直接做。

流程：

```text
Issue
↓
Jerry Review
↓
更新 Spec / Contract
↓
新 Task
↓
實作
```

---

# 16. Jerry Review Checklist

Jerry 至少確認：

1. Task 是否完成
2. 是否修改 Forbidden Paths
3. 是否偷偷改 Spec
4. 是否偷偷改 API Contract
5. 是否偷偷改 Database Schema
6. 測試是否通過
7. 是否加入 Task 未要求的新功能
8. 是否修改其他人的模組

---

# 17. Vibe Coding 特別規則

AI 不得自行：

- 順便重構
- 順便改命名
- 順便升級套件
- 順便改架構
- 順便修其他 Bug
- 順便新增功能

Task 沒寫，就不要做。

額外建議請建立 Issue。

---

# 18. Merge Strategy

統一使用：

```text
Squash Merge
```

MVP 階段由 Jerry 負責 Merge main。

Merge 前必須：

```text
Task 完成
+
Acceptance Criteria 通過
+
Tests 通過
+
沒有 Forbidden Path 修改
+
沒有未核准 Contract Change
```

---

# 19. Branch Protection 建議

main 建議開啟：

```text
Require Pull Request
Require Approval
Require Status Checks
Block Force Push
Block Direct Push
```

---

# 20. Integration Branch

Jerry 如需先測多模組，可使用：

```text
integration/xxx
```

A / B / C 不自行建立 Integration Branch。

---

# 21. Conflict Rule

遇到 Merge Conflict 時，如果衝突涉及其他人的 Ownership：

**停止並交給 Jerry。**

不要隨便使用：

```text
Accept Current
Accept Incoming
Accept Both
```

---

# 22. Bug Rule

如果發現別人的 Bug：

```text
建立 Issue
↓
Jerry 分配
↓
對應 Owner 修正
```

不得直接修改其他人的模組。

---

# 23. Secret Rule

禁止 Commit：

- API Key
- Database Password
- Token
- Private Key

`.env` 不進 GitHub，只提供 `.env.example` 且不可包含真正 Secret。

---

# 24. AI 修改檔案過多

如果一個簡單 Task 突然修改大量檔案，先停止並要求 AI 解釋。

超出 Scope 時 Rollback，不直接 Commit。

---

# 25. Dependency Upgrade

AI 建議升級 React / Node / Database Library 等依賴時，不得自行執行。

先建立 Issue，由 Jerry 決定。

---

# 26. Completion Rule

工程師完成 Task 時應回報：

```text
TASK-XXX Module Complete
```

只有 Jerry 完成 Integration 後才能稱為：

```text
Production Complete
```

---

# 27. Definition of Done

Module Complete：

```text
功能完成
+
Acceptance Criteria 通過
+
Test 通過
+
沒有修改 Forbidden Paths
+
PR 建立
```

Production Complete：

```text
Module Complete
+
Jerry Integration
+
Integration Test
+
Preview Test
+
main Merge
```

---

# 28. 最重要的五條規則

1. 不要直接改 main。
2. 只改自己的資料夾。
3. 一個 Task 一條 Branch。
4. Spec / Contract 不可以自己改。
5. 最後整合全部交給 Jerry。

---

# 29. Source of Truth

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

如果 AI 建議與 Spec 衝突，Spec 優先。
