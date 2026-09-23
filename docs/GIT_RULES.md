# Kareo / 長照一點通 — Git Collaboration Rules

Version: v0.3  
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
- staging 作為唯一整合區
- main 永遠保持正式可部署
- Jerry 負責最後整合與發布
- 每次提交都有可追蹤的版次與更新紀錄

---

# 2. 團隊角色

## Jerry

角色：Product Owner / Spec Owner / Integration Owner / Release Owner。

負責建立 Task、Review PR、修改 Spec / Contract、整合 staging、Release 到 main、Deploy，以及管理 Kareo 全站 Release Version。

## Engineer A / 工程師 A

Ownership：

```text
/data/providers/**
```

負責 Provider 資料、Google Maps URL、Service Area、Mock Provider Data、資料驗證、基本 QA。

## Engineer B / 工程師 B

Ownership：

```text
/apps/api/**
/services/**
```

負責後端 API、Database、Provider Backend、Recommendation Engine、Lead、Knowledge DB、Crawler。

## Engineer C / 工程師 C

Ownership：

```text
/apps/web/**
```

負責首頁、Assessment、Result、Provider UI、Lead Form、RWD、Loading / Empty / Error。

---

# 3. Branch Model / 分支模型

```text
main
└── staging
    ├── feat/a-xxx
    ├── feat/b-xxx
    └── feat/c-xxx
```

## main

正式穩定分支，對應 Production。

A / B / C 禁止直接 Push、Merge 或 Force Push。

只有 Jerry 可透過 `staging → main` Release PR 發布。

## staging

固定整合分支，對應 Staging 環境。

用途：

- 接收所有 Feature PR
- Frontend / Backend / Data 整合
- Integration Test
- E2E Test
- Release Candidate 驗收

A / B / C 禁止直接 Push staging。

## Feature Branch

所有 Task 必須從最新 `staging` 建立。

一個 Task 一條 Branch。

---

# 4. 標準開發流程

```text
更新 staging
↓
從 staging 建 Feature Branch
↓
Code
↓
Test
↓
整理 Submission Version + Changelog
↓
Push Feature Branch
↓
PR → staging
↓
Jerry Review
↓
Squash Merge → staging
↓
Jerry Integration / E2E Test
↓
Release PR: staging → main
↓
Production
```

一般工程師不得直接建立 Feature PR 到 main。

---

# 5. Branch Naming / 分支命名

格式：

```text
類型/負責人-task編號-簡短名稱
```

例如：

```text
feat/a-001-provider-data
feat/b-003-recommendation
feat/c-004-provider-result-ui
fix/b-008-empty-provider
fix/c-010-mobile-layout
```

`refactor/*` 只有 Jerry 核准才可使用。

---

# 6. 一個 Task 一條 Branch

禁止使用：

```text
feat/b-all-backend
feat/c-all-frontend
```

完成一張 Task → PR → Merge → 刪 Branch，再開下一張。

---

# 7. Allowed Paths / Forbidden Paths

每個 Task 必須定義：

```text
Allowed Paths
Forbidden Paths
```

AI 只能修改 Allowed Paths。

如果必須修改 Forbidden Paths：停止、不修改、建立 Issue。

---

# 8. Ownership Rule

```text
/data/providers/** → Engineer A
/apps/api/**       → Engineer B
/services/**       → Engineer B
/apps/web/**       → Engineer C
/docs/**           → Jerry
/contracts/**      → Jerry
/tasks/**          → Jerry
/.github/**        → Jerry
```

禁止跨 Ownership 修改，除非 Task 明確授權。

---

# 9. Shared Critical Files

以下不可自行修改：

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

需要修改時先建立 Issue，由 Jerry 決定。

---

# 10. Spec / Contract Rule

以下只由 Jerry 維護：

```text
/docs/**
/contracts/**
```

A / B / C 不自行修改 Product Spec、Architecture、Data Model、API Contract、核心 Database Schema。

---

# 11. 開始 Coding 前

AI 必須先閱讀 `AGENTS.md` 與 Task 指定 Spec，並先回答：

```text
1. 我的任務
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

Commit 要小且可理解，例如：

```text
feat(B-005): add provider recommendation filter
fix(C-003): handle empty provider result
data(A-002): add provider records
```

禁止 `Update stuff` 這類不清楚的訊息，也禁止一個 Commit 混入無關功能。

---

# 14. Version Rule / 版次規則

每個 Feature PR 必須填寫 `Submission Version`。

## Task Submission Version

格式：

```text
<Engineer>-<Task Number>-r<Revision>
```

例如：

```text
A-001-r1
B-003-r1
C-004-r1
```

同一張 Task 若經 Jerry Review 後退回修改，再提交時 revision 必須增加：

```text
B-003-r1 → B-003-r2 → B-003-r3
```

不得使用相同 Submission Version 代表不同內容。

## Kareo Release Version

全站版本例如：

```text
v0.1.0
v0.2.0
v1.0.0
```

A / B / C 不得自行修改或決定 Kareo 全站 Release Version。

只有 Jerry 可以在整合與 Release 階段指定、調整與發布 Release Version。

---

# 15. Changelog Rule / 更新內容規則

每一個 Feature PR 都必須提交本版更新內容。

至少包含：

```text
Submission Version: B-003-r1

Added:
- 本版新增內容

Changed:
- 本版調整內容

Fixed:
- 本版修正內容

Known Issues:
- 已知問題
```

沒有內容的分類填 `None`。

禁止只寫：

```text
Done
Update
Fixed stuff
完成
```

更新內容必須具體到 Jerry 可以不讀完整 Diff 就理解這個版本改了什麼。

---

# 16. Pull Request Rule

一般 Task 完成後一定建立 PR。

**Base Branch 必須是 `staging`。**

每個 Feature PR 必須包含：

- Task ID
- Submission Version
- Added / Changed / Fixed
- Known Issues
- 修改範圍
- Test 結果
- Acceptance Criteria

PR Title：

```text
[A-001] Provider Data Foundation
[B-003] Assessment API + AI Adapter Foundation
[C-004] Provider Detail + Google Maps
```

只有 Jerry 的 Release PR 可以：

```text
staging → main
```

---

# 17. Jerry Review Checklist

Jerry 至少確認：

1. PR Base 是否為 staging
2. Task 是否完成
3. Submission Version 是否正確
4. Changelog 是否清楚且與實際修改一致
5. 是否修改 Forbidden Paths
6. 是否改到其他 Ownership
7. 是否偷偷改 Spec / API Contract / Schema
8. 測試是否通過
9. 是否加入 Task 未要求的新功能
10. 是否有 Known Issues

---

# 18. Vibe Coding 特別規則

AI 不得自行：

- 順便重構
- 順便改命名
- 順便升級套件
- 順便改架構
- 順便修其他 Bug
- 順便新增功能

Task 沒寫，就不要做。

---

# 19. Merge Strategy

Feature PR：

```text
Feature Branch → staging
```

統一使用 Squash Merge，由 Jerry Merge。

Release PR：

```text
staging → main
```

由 Jerry 建立、檢查與 Merge。

---

# 20. Branch Protection 建議

## main

建議開：

```text
Require Pull Request
Require 1 Approval
Require Code Owner Review
Require Status Checks
Block Force Push
Block Deletion
```

## staging

建議開：

```text
Require Pull Request
Require 1 Approval
Require Status Checks
Block Force Push
Block Deletion
```

A / B / C 不應直接 Push main 或 staging。

---

# 21. Collaborator 權限

團員只需要能：

- Clone / Pull
- 建 Feature Branch
- Push 自己的 Feature Branch
- 建 Pull Request

不需要 Admin / Repository Settings / Secrets / Collaborator 管理權。

若使用個人 Repository，新增為 Collaborator 即可；main 與 staging 的安全由 Branch Protection 控制。

---

# 22. Preview / Staging / Production

```text
LOCAL       → 個人開發
PREVIEW     → 單一 PR 測試
STAGING     → 多模組整合測試
PRODUCTION  → 正式環境
```

Feature PR 可建立 Preview。

Jerry 在 staging 做跨模組 Integration / E2E Test。

main 才能部署 Production。

---

# 23. Conflict Rule

若 Merge Conflict 涉及其他人的 Ownership，停止並交 Jerry。

不要隨便選 Accept Current / Incoming / Both。

---

# 24. Bug Rule

發現其他人的 Bug：

```text
建立 Issue
↓
Jerry 分配
↓
對應 Owner 修正
```

不得直接跨模組修正。

---

# 25. Secret Rule

禁止 Commit API Key、Database Password、Token、Private Key。

`.env` 不進 GitHub，只提供不含 Secret 的 `.env.example`。

---

# 26. Dependency Upgrade

AI 建議升級 React / Node / Database Library 等依賴時，不得自行執行，先交 Jerry 決定。

---

# 27. Completion Report Rule

完成 Task 時，A / B / C 與其 AI 必須回報：

```text
1. Task ID
2. Submission Version
3. Added
4. Changed
5. Fixed
6. 修改檔案
7. Test 結果
8. Acceptance Criteria
9. Known Issues
10. 是否修改 Allowed Paths 之外檔案
```

缺少 Submission Version 或 Changelog，不視為可 Review 的完整提交。

---

# 28. Definition of Done

## Module Complete

```text
功能完成
+
Submission Version 已提交
+
Changelog 已提交
+
Acceptance Criteria 通過
+
Test 通過
+
沒有修改 Forbidden Paths
+
PR 建立並通過 Jerry Review
+
Merge 到 staging
```

## Integrated

```text
Module Complete
+
staging Integration Test
+
E2E Test
```

## Production Complete

```text
Integrated
+
Jerry 指定 Release Version
+
Release PR staging → main
+
Production Deploy
+
Production Verification
```

---

# 29. 最重要的九條規則

1. 不直接改 main。
2. 不直接改 staging。
3. Feature Branch 從 staging 建。
4. Feature PR 回 staging。
5. 只改自己的 Allowed Paths。
6. Spec / Contract 不自行改。
7. 每次 PR 都提交 Submission Version。
8. 每次 PR 都提交 Changelog。
9. 最後整合、Release Version 與發布交給 Jerry。

---

# 30. Source of Truth

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
