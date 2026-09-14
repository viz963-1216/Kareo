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

高順位規格優先。

如果無法判斷：

**停止修改並建立 Issue，交由 Jerry 決定。**

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

第一次執行 Task 時：

先不要修改任何程式。

先回答：

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

也就是：

```text
Engineer A
Engineer B
Engineer C
    ↓
各自獨立開發
    ↓
Jerry 最終整合
```

A / B / C 不直接整合彼此程式。

---

# 5. Ownership / 負責範圍

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
- Integration
- Merge
- Deploy

---

## Engineer A

主要負責：

```text
/data/providers/**
```

中文：

- Provider 原始資料
- 商家資料整理
- 地址
- 電話
- 服務類別
- 服務範圍
- Google Maps URL
- 資料清洗
- 資料驗證
- Mock Provider Data
- QA 測試

---

## Engineer B

主要負責：

```text
/apps/api/**
/services/**
```

中文：

- Backend API / 後端 API
- Database / 資料庫
- Provider Backend / 服務單位後端
- Recommendation Engine / 推薦引擎
- Ranking / 排序
- Lead Backend / 媒合後端
- Knowledge Database / 長照知識庫
- Knowledge Crawler / 長照政策爬蟲
- Knowledge Version / 政策版本管理

---

## Engineer C

主要負責：

```text
/apps/web/**
```

中文：

- Homepage / 首頁
- Consent UI / 免責與同意畫面
- Assessment UI / 長照初評
- Assessment Result / 初評結果
- Provider Top 3 UI / 前三家推薦
- Provider Detail / 商家詳細頁
- Google Maps CTA
- taiwanjcare CTA
- Lead Form / 我要媒合
- Loading / Empty / Error State
- RWD

---

# 6. 不得修改別人的 Ownership

原則：

```text
A 不改 B
A 不改 C

B 不改 A
B 不改 C

C 不改 A
C 不改 B
```

如果 Task 需要跨 Ownership：

**停止修改。**

建立 Issue。

交 Jerry 決定。

---

# 7. Allowed Paths

每個 Task 必須定義：

```text
Allowed Paths
```

AI 只能修改這些路徑。

例如：

```text
Allowed Paths:

/services/recommendation/**
/apps/api/recommendations/**
/tests/recommendation/**
```

---

# 8. Forbidden Paths

每個 Task 必須定義：

```text
Forbidden Paths
```

如果需要修改 Forbidden Path：

不要修改。

建立 Issue。

---

# 9. Spec 不得自行修改

A / B / C 與 AI 不得自行修改：

```text
/docs/**
/contracts/**
```

除非 Task 明確由 Jerry 授權。

---

# 10. 不得自行修改核心資料結構

禁止自行：

- 新增核心欄位
- 改欄位名稱
- 刪除欄位
- 改 enum
- 修改 API Response
- 修改 Database Schema
- 修改 Recommendation 規則
- 修改 Product Flow

如果需要：

建立 Issue。

---

# 11. 不得自行擴大 Task

AI 不得因為：

「這樣比較漂亮」

或：

「Best Practice」

而自行加入 Task 沒要求的功能。

例如禁止：

- 順便重構
- 順便升級套件
- 順便改架構
- 順便修其他 Bug
- 順便改命名
- 順便加入新功能

Task 沒寫：

就不要做。

---

# 12. Frontend / Backend 分離

Engineer C：

使用 Mock Data 完成 Frontend。

不需要等待 Engineer B。

---

Engineer B：

只需要讓 API 符合：

```text
docs/API_CONTRACT.md
```

不需要接 Frontend。

---

最後由：

```text
Jerry
```

負責：

```text
Mock API
↓
Real API
```

整合。

---

# 13. AI 不直接挑 Provider

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

禁止：

```text
User
↓
LLM
↓
AI 自己決定三家 Provider
```

---

# 14. taiwanjcare

`TRANSPORTATION` 在 MVP：

只做外部連結。

流程：

```text
CareNeedProfile
↓
TRANSPORTATION
↓
Frontend CTA
↓
taiwanjcare
```

禁止：

- iframe
- Backend Integration
- Database Integration
- Authentication Integration

---

# 15. Knowledge Database

長照制度、法規、補助：

不得直接寫死在 AI Prompt。

Assessment 應優先使用：

```text
PUBLISHED Knowledge Version
```

---

# 16. Knowledge Update

Crawler 發現官方資料改變時：

禁止直接修改正式規則。

必須：

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

只有：

```text
PUBLISHED
```

版本可以供正式 Assessment 使用。

---

# 17. 長照結果必須使用「預估」

平台不得宣稱：

- 正式長照資格
- 正式 CMS 等級
- 正式補助核定

必須使用：

- 初步預估
- 可能符合
- 依目前資料推估

並提醒：

```text
實際資格、長照等級、服務內容及補助，
仍應由 1966 或所在地長期照顧管理中心正式評估確認。
```

---

# 18. Secret Rule

禁止把以下內容 Commit 進 Git：

```text
API Key
Database Password
Token
Private Key
Secret
```

Secret 必須放：

```text
Environment Variables
```

Frontend 不得包含 AI API Key。

---

# 19. Git Rule

禁止直接 Push：

```text
main
```

所有正式修改：

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

# 20. 完成標準

AI 不可以只說：

```text
Done
```

完成 Task 後必須回報：

```text
1. 完成哪些功能
2. 修改哪些檔案
3. 是否超出 Allowed Paths
4. 測試結果
5. Acceptance Criteria 是否全部通過
6. 是否有 Known Issues
```

---

# 21. 最重要的規則

如果不確定：

**不要猜。**

如果需要跨模組：

**不要改。**

如果需要改 Spec：

**不要改。**

如果 Task 沒要求：

**不要做。**

把問題交給：

**Jerry**
