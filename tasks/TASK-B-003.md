# TASK-B-003 — Assessment API + AI Adapter Foundation

Owner: Engineer B — Backend  
Type: Backend / Assessment / AI Adapter  
Status: READY

---

# Goal / 目標

實作 Kareo MVP 的第三支核心 API：

```text
POST /api/v1/assessments
```

本 Task 必須完成：

```text
Valid Session
↓
Valid Consent Gate
↓
Assessment Input Validation
↓
Knowledge Version Resolver
↓
AI Adapter
↓
CareNeedProfile
↓
Assessment Persist
↓
API Contract Response
```

本 Task 的目的不是決定正式 AI Provider，而是先建立可替換的 AI Adapter Boundary。

即使 OpenAI / Claude / Gemini 尚未拍板，也必須能透過 Fake / Deterministic Adapter 完成測試。

---

# 開始前必讀

```text
AGENTS.md
docs/PRODUCT_SPEC.md
docs/ARCHITECTURE.md
docs/DATA_MODEL.md
docs/API_CONTRACT.md
docs/GIT_RULES.md
tasks/TASK-B-002.md
```

---

# Branch / PR Rule

從最新 `staging` 建立：

```text
feat/b-003-assessment-ai-adapter
```

完成後：

```text
PR → staging
```

不得直接 Push `staging` 或 `main`。

首次提交版次：

```text
B-003-r1
```

若 Jerry 退回後重新提交，依序使用：

```text
B-003-r2
B-003-r3
```

---

# Allowed Paths / 可修改範圍

```text
/apps/api/**
```

可在 `/apps/api/**` 內新增：

- Assessment Handler
- Assessment Service
- Assessment Repository
- CareNeedProfile types
- AI Adapter Interface
- Fake / Deterministic AI Adapter
- Knowledge Version Resolver Interface
- Supabase Assessment Repository
- Migration
- Tests

---

# Forbidden Paths / 禁止修改

```text
/apps/web/**
/services/**
/data/providers/**
/docs/**
/contracts/**
/tasks/**
/.github/**
```

以及 Repository Root Config。

不得自行修改：

- API Contract
- Product Spec
- Data Model
- Provider Ranking Rule
- Knowledge Publish Rule
- Netlify Root Config

若規格不足，停止並回報 Jerry。

---

# Required API

依 `docs/API_CONTRACT.md` 實作：

```text
POST /api/v1/assessments
```

Request / Response 欄位必須完全符合既有 Contract。

不得自行新增正式 API 欄位。

---

# Consent Gate

Assessment 執行前必須確認：

1. sessionId 存在
2. Session 有效
3. 已存在有效 Consent
4. Consent 必須為 accepted=true

如果沒有有效 Consent：

```text
CONSENT_REQUIRED
```

不得繼續產生 Assessment。

---

# Assessment Validation

至少驗證：

- sessionId
- ageRange
- location.city
- location.district
- location.precision
- livingSituation
- caregiverSituation
- mobilityLevel
- dailyLivingLevel
- needs.homeCare
- needs.medicalNursing
- needs.assistiveDevice
- needs.transportation
- freeText

未知 / 可選欄位依 Contract / Data Model 處理。

不得因為 AI 比較方便就把欄位格式改掉。

---

# AI Adapter Rule

必須建立 Adapter Boundary，例如概念上：

```text
AssessmentService
↓
CareAssessmentAIAdapter
├── FakeAssessmentAIAdapter
└── Real Provider Adapter（future）
```

本 Task **不綁死 OpenAI / Claude / Gemini**。

測試必須使用 Fake / Deterministic Adapter，不依賴外部 Token。

AI Adapter 只可以：

- 理解使用者資料
- 產生 CareNeedProfile
- 排定 careNeeds / priority
- 產生 summary

AI Adapter 不可以：

- 選 Provider
- 排 Provider
- 回正式 CMS Level
- 回正式 Eligibility
- 回 approvedBenefit
- 做醫療診斷

---

# CareNeedProfile

輸出至少包含：

```text
id
careNeeds
priority
summary
warnings
```

Care Need Enum 只能使用：

```text
HOME_CARE
HOME_MEDICAL_NURSING
ASSISTIVE_DEVICE
TRANSPORTATION
```

warnings 至少必須包含：

```text
本結果僅為初步預估。
實際資格、長照等級與補助仍需由正式長照評估確認。
```

---

# Knowledge Version Rule

每一筆 Assessment 必須記錄：

```text
knowledgeVersion
```

但本 Task 不實作完整 Knowledge DB。

請建立可替換的 Resolver Boundary，例如：

```text
PublishedKnowledgeVersionResolver
```

正式行為：

- 有 Current Published Knowledge Version → 回傳版本
- 沒有 Published Version → 回 `KNOWLEDGE_UNAVAILABLE`
- 不得在 Production Code 假造 `KB-xxxx`

Tests 可以使用 Fake Resolver，例如：

```text
KB-TEST-001
```

這只是測試資料，不是正式 Knowledge。

---

# Persistence / Migration

依既有 `DATA_MODEL.md` 建立 Assessment / CareNeedProfile 所需最小 migration。

不得順便建立：

- Provider
- Recommendation
- Lead
- Knowledge
- Crawler

如果既有 Data Model 不足，停止並回報 Jerry。

---

# Supabase

若 Jerry 的 Supabase Staging 尚未完成：

- 不阻塞本 Task
- 使用 Repository Interface + In-memory Repository 完成測試
- Supabase Repository 可先實作
- Real Connection Verification 列入 Known Issues

不得提交任何真實 Secret。

---

# Error Handling

至少處理：

```text
INVALID_REQUEST
VALIDATION_ERROR
CONSENT_REQUIRED
KNOWLEDGE_UNAVAILABLE
INTERNAL_ERROR
```

不得把：

- Stack Trace
- Database Error
- API Key
- Secret
- Raw AI Provider Error

直接回傳給 Frontend。

---

# Testing

至少測試：

1. Valid Session + Consent → Assessment 成功
2. 無 Consent → CONSENT_REQUIRED
3. accepted=false 不得通過
4. Invalid Input → VALIDATION_ERROR
5. Fake AI Adapter 正常產生 CareNeedProfile
6. AI Adapter 不產生 Provider
7. careNeeds 只能使用合法 Enum
8. warnings 必須存在
9. Published Knowledge Version 有值時可建立 Assessment
10. 沒有 Published Knowledge Version → KNOWLEDGE_UNAVAILABLE
11. Repository Error → 安全 INTERNAL_ERROR
12. Response 完全符合 API Contract
13. TypeScript type check 通過
14. 無 Secret 被 commit

---

# Not In Scope

本 Task 不做：

- Provider Import
- Provider Detail API
- Recommendation Engine
- Top 3
- Lead
- Knowledge DB
- Knowledge Crawler
- Frontend
- Netlify Root Config
- Production Deploy
- AI Provider 最終選型

---

# Acceptance Criteria

- [ ] POST /api/v1/assessments 可執行
- [ ] Consent Gate 正確
- [ ] Request Validation 正確
- [ ] AI Adapter Boundary 建立
- [ ] Fake / Deterministic Adapter 可測試
- [ ] 沒有把 AI Provider 寫死
- [ ] CareNeedProfile 符合 Contract
- [ ] warnings 正確
- [ ] knowledgeVersion 必填
- [ ] Knowledge 不可用時回 KNOWLEDGE_UNAVAILABLE
- [ ] Assessment / CareNeedProfile 最小 persistence 完成
- [ ] Tests 通過
- [ ] TypeScript type check 通過
- [ ] 無真實 Secret
- [ ] 沒有修改 Allowed Paths 之外檔案
- [ ] PR Base 為 staging
- [ ] PR 有 Submission Version + Changelog

---

# Completion Report

完成後回報：

```text
Submission Version:
Implemented Endpoint:
Consent Gate:
Assessment Validation:
AI Adapter:
Knowledge Resolver:
Database / Migration:
Tests:
Added:
Changed:
Fixed:
Known Issues:
Real Supabase Connection Verified: YES / NO
是否修改 Allowed Paths 以外檔案:
```

PR Title：

```text
[B-003] Assessment API + AI Adapter Foundation
```
