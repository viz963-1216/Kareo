# Kareo / 長照一點通 — System Architecture

Version: v0.3  
Status: LOCKED FOR MVP  
Owner: Jerry

---

# 1. 架構目標

本專案採：

**Independent Development + Central Integration / 獨立開發 + Jerry 中心整合**

```text
Engineer A / B / C
        ↓
各自 Feature Branch
        ↓
PR → staging
        ↓
Jerry 整合與驗收
        ↓
staging → main
        ↓
Production
```

核心原則：

- A / B / C 可以同時工作
- A / B / C 不直接整合彼此程式
- 不修改其他人的 Ownership
- 所有人遵守同一份 Spec
- 跨模組整合只在 `staging` 進行
- `main` 只保存正式可部署版本

---

# 2. 整體系統

```text
使用者
  │
  ▼
Frontend Web（Engineer C）
  │
  │ API Contract
  ▼
Backend API（Engineer B）
  │
  ├───────────────┐
  │               │
  ▼               ▼
Provider DB    Knowledge DB
  │               │
  │               ▼
  │          Knowledge Crawler
  │
  ▼
Recommendation Engine
  │
  ▼
Top 3 Provider
```

交通需求另外走：

```text
TRANSPORTATION
↓
External Link
↓
Kareocar
```

Kareocar 正式網址：`https://kareocar.netlify.app/`

Kareocar 不內嵌、不共用 Backend、不共用 Database。

---

# 3. Repository Structure

```text
/
├── AGENTS.md
├── docs/
│   ├── PRODUCT_SPEC.md
│   ├── ARCHITECTURE.md
│   ├── DATA_MODEL.md
│   ├── API_CONTRACT.md
│   └── GIT_RULES.md
├── contracts/
│   ├── schemas/
│   └── mock/
├── tasks/
├── apps/
│   ├── web/
│   └── api/
├── services/
│   ├── recommendation/
│   ├── knowledge/
│   └── crawler/
├── data/
│   └── providers/
├── tests/
└── .github/
```

---

# 4. Branch Architecture / 分支架構

## main

正式穩定分支。

用途：Production Release。

只有 Jerry 將通過 staging 驗收的版本合併進 main。

## staging

固定整合分支。

用途：

- 接收 A / B / C 的 Feature PR
- Frontend / Backend 真實整合
- Provider Data 匯入驗證
- Integration Test
- E2E Test
- Release Candidate 驗收

A / B / C 不直接 Push staging。

## Feature Branch

每個 Task 從最新 staging 建立：

```text
staging
├── feat/a-xxx
├── feat/b-xxx
└── feat/c-xxx
```

完成後 PR 回 staging。

---

# 5. Ownership

## Jerry

主要負責：

```text
/docs/**
/contracts/**
/tasks/**
/.github/**
```

以及：PR Review、staging Integration、Release PR、Deploy。

## Engineer A / 工程師 A

```text
/data/providers/**
```

負責 Provider 原始資料、名稱/地址/電話、服務類別、服務範圍、Google Maps URL、資料清理、Mock Provider Data、基本 QA。

資料流程：

```text
原始 Provider 資料
↓
Engineer A 清洗
↓
Feature Branch
↓
PR → staging
↓
Jerry Review
↓
Engineer B 後續匯入正式 Provider DB
```

A 不直接操作正式 Database。

## Engineer B / 工程師 B

```text
/apps/api/**
/services/recommendation/**
/services/knowledge/**
/services/crawler/**
```

負責後端 API、Database、Provider Backend、Recommendation、Ranking、Lead、Knowledge、Crawler。

B 不修改前端 UI。

## Engineer C / 工程師 C

```text
/apps/web/**
```

負責首頁、Consent、Assessment、Result、Provider UI、Google Maps CTA、Kareocar CTA、Lead Form、Loading / Empty / Error、RWD。

C 不修改 Backend Schema 或 Recommendation Logic。

---

# 6. Frontend 與 Backend 分離

C 使用 `/contracts/mock/**` 的 Mock Data 完成 UI，不等待 B。

B 只依 `docs/API_CONTRACT.md` 完成正式 API，不等待 C。

最後由 Jerry 在 staging：

```text
C Mock Frontend
+
B Real API
↓
Integration
↓
E2E Test
```

---

# 7. Recommendation Architecture

```text
Assessment
↓
CareNeedProfile
↓
Service Type
↓
Provider Filter
↓
Service Area Match
├─ 精確位置 → Distance Ranking
└─ 行政區   → Stable Rotation
↓
Top 3
```

AI 不直接選 Provider。

---

# 8. AI Architecture

```text
使用者資訊
↓
Assessment Service
↓
AI Adapter
↓
CareNeedProfile
↓
Recommendation Engine
↓
Provider DB
```

AI Provider 必須透過 Adapter 隔離。

---

# 9. Knowledge Architecture

```text
Official Source
↓
Crawler
↓
Raw Snapshot
↓
Content Hash
↓
Compare
↓
KnowledgeChange
↓
AI Summary
↓
NEEDS_REVIEW
↓
Jerry / Admin Review
↓
APPROVED
↓
KnowledgeVersion
↓
PUBLISHED
```

只有 `PUBLISHED` 版本可供正式 Assessment 使用。

排程：`Asia/Taipei` 每日 `00:10`。

白名單來源：衛生福利部、1966 / 長照專區、全國法規資料庫、臺北市政府、新北市政府。

Crawler 抓取失敗時繼續使用 Last Published Knowledge Version。

---

# 10. Kareocar Architecture

```text
CareNeedProfile
↓
TRANSPORTATION
↓
Frontend CTA
↓
Open New Tab
↓
Kareocar
```

Kareocar URL：`https://kareocar.netlify.app/`

MVP 禁止 iframe、Backend Integration、Database Integration、Authentication Integration。

---

# 11. Consent Architecture

正式 Assessment 前必須存在有效 Consent：

```text
Session
↓
Consent
├─ disclaimerVersion
├─ privacyVersion
└─ termsVersion
```

沒有 Consent 時 Backend 回 `CONSENT_REQUIRED`。

---

# 12. Provider DB 與 Knowledge DB 分離

Provider DB 回答「可以找誰？」。

Knowledge DB 回答「目前制度怎麼規定？」。

兩者資料模型與責任分開。

---

# 13. Environment

正式分為四層：

```text
LOCAL
PREVIEW
STAGING
PRODUCTION
```

## LOCAL

各工程師自己的開發環境。

## PREVIEW

單一 Feature PR 的預覽與模組測試環境。

## STAGING

Jerry 的整合環境，對應 `staging` branch。

用於 A+B+C 整合、Real API 串接、Integration / E2E Test。

## PRODUCTION

正式環境，對應 `main` branch。

只有 Jerry 負責 Production Release / Deploy。

---

# 14. Secret Rule

禁止 Commit API Key、Database Secret、Token、Private Key。

只能放 Environment Variables，Frontend 不得包含 AI API Key。

STAGING 與 PRODUCTION 必須使用不同環境設定與 Secrets。

---

# 15. Cross-module Rule

需要修改其他模組時：

```text
建立 Issue
↓
Jerry 判斷
↓
建立新 Task
↓
對應 Owner 修改
```

不得直接跨 Ownership 修改。

---

# 16. Testing Boundary

Engineer A：Provider Data / 基本 QA  
Engineer B：API / Recommendation / Knowledge / Crawler  
Engineer C：UI / Flow / RWD / Loading / Empty / Error  
Jerry：staging Integration / End-to-End / Release / Production

---

# 17. Definition of Integration

只有當：

```text
A Provider Data
+
B Backend
+
C Frontend
+
Knowledge
+
API Contract
+
staging Integration Test
```

全部通過後，才叫 `Integrated`。

Feature PR 合併到 staging 只能稱為 `Module Complete`。

`Production Complete` 必須再完成 staging → main Release 與 Production 驗證。

---

# 18. Source of Truth

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

若衝突，停止修改並交由 Jerry 決定。


---

# 19. Approved MVP Technology Stack / 已核准技術棧

MVP 技術棧已由 Jerry 核准如下：

## Frontend

```text
React
Vite
TypeScript
React Router
```

Frontend application 維持於：

```text
/apps/web/**
```

Engineer C 可在 `/apps/web/**` 內建立該 App 自己的 package / TypeScript / Vite configuration。

Repository Root Config 仍由 Jerry 管理。

## Backend

```text
Node.js
TypeScript
Netlify Functions / Serverless API
```

Backend application 維持於：

```text
/apps/api/**
```

## Database / Auth

```text
Supabase
├── PostgreSQL
└── Auth
```

Supabase 主要作為 Database / Auth / Server-side persistence layer。

核心 Business Logic 不直接交給 Supabase Auto API。

正式資料流：

```text
React Frontend
↓
Kareo /api/v1 Backend
↓
Service / Business Logic
↓
Repository / Adapter
↓
Supabase PostgreSQL
```

## Deployment

```text
Netlify
├── Frontend
└── Netlify Functions
```

Branch / Environment：

```text
Feature Branch → PREVIEW
staging        → STAGING
main           → PRODUCTION
```

STAGING 與 PRODUCTION 必須使用不同 Environment Variables / Secrets。

## AI Provider

AI Provider 尚未鎖定。

所有 AI 能力必須透過 Adapter Boundary，禁止直接把 OpenAI / Claude / Gemini SDK 散落在 Business Logic 中。

在 AI Provider 正式選型前，Backend 必須能使用 Fake / Deterministic Adapter 完成測試。

