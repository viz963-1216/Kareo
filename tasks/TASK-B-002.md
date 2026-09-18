# TASK-B-002 — Backend API Foundation

Owner: Engineer B — Backend  
Type: Backend / API / Database Foundation  
Status: READY AFTER B-001-r2 APPROVAL

---

# Goal / 目標

依 Jerry 已拍板的技術方向，建立 Kareo Backend 第一版可持續擴充的基礎。

技術方向：

```text
Node.js
TypeScript
Netlify Functions / Serverless API
Supabase PostgreSQL + Auth
```

架構原則：

```text
Frontend
↓
Kareo 自訂 Backend API
↓
Business Logic
↓
Supabase
```

Supabase 主要負責 PostgreSQL Database + Auth。

**核心業務邏輯不得直接交給 Supabase 自動 API。**

Recommendation、Knowledge PUBLISHED 判斷、Consent 等邏輯必須由 Kareo Backend 控制。

本 Task 先完成 API Foundation、Session、Consent 與 Supabase Adapter；不要一次做完整 Recommendation / Knowledge / Crawler。

---

# Prerequisite / 開始條件

開始 Coding 前必須：

1. B-001-r2 已由 Jerry Review 通過
2. 已閱讀最新 staging Spec
3. Jerry 已確認 Node.js + TypeScript + Supabase 方向
4. 若需要連正式 Supabase Dev Project，Jerry 已私下提供必要 Environment Variables

Secret 不得放進 GitHub。

---

# 開始前必讀

```text
AGENTS.md
docs/PRODUCT_SPEC.md
docs/ARCHITECTURE.md
docs/DATA_MODEL.md
docs/API_CONTRACT.md
docs/GIT_RULES.md
tasks/TASK-B-001.md
```

---

# Branch / PR Rule

從最新 `staging` 建立：

```text
feat/b-002-backend-api-foundation
```

完成後：

```text
PR → staging
```

不得直接 Push `staging` 或 `main`。

首次提交版次：

```text
B-002-r1
```

---

# Allowed Paths / 可修改範圍

```text
/apps/api/**
```

本 Task 明確允許在 `/apps/api/**` 內建立：

- package.json
- tsconfig.json
- source code
- test
- Supabase migration / SQL
- .env.example

不得 Commit 真實 `.env` 或 Secret。

---

# Forbidden Paths / 禁止修改

```text
/apps/web/**
/data/providers/**
/docs/**
/contracts/**
/tasks/**
/.github/**
/services/**
```

以及 Repository Root 的：

```text
package.json
lock files
netlify.toml
Dockerfile
root .env
root deployment config
```

如果部署需要 root `netlify.toml`，建立 Issue，交 Jerry 處理。

---

# Required Architecture

Backend 不使用 Python / FastAPI 作為本專案主要 API Server。

本 Task 採：

```text
Node.js + TypeScript
↓
API Handler
↓
Service / Business Logic
↓
Repository / Supabase Adapter
↓
Supabase PostgreSQL
```

避免把所有邏輯直接塞進單一 Function。

---

# Supabase Rule

Supabase 用途：

- PostgreSQL Database
- Auth
- Server-side data access

禁止：

- Frontend 直接繞過 Kareo API 執行核心業務邏輯
- 把 Recommendation Engine 完全做成 Supabase Auto API
- 把核心 Business Logic 全塞進 Postgres Function
- 為了方便自行改 API Contract

若 Service Role Key 必須使用，只能存在 Server-side Environment Variable。

---

# First Endpoints

依 `docs/API_CONTRACT.md` 實作：

## POST /api/v1/session

建立匿名 Session。

## POST /api/v1/consent

寫入 Consent：

```text
sessionId
disclaimerVersion
privacyVersion
termsVersion
acceptedAt
```

`accepted=false` 不得視為有效 Consent。

Response / Error Shape 必須符合 API Contract。

---

# Suggested Structure

可依實作需要微調，但不可跨 Allowed Paths：

```text
/apps/api/
├── package.json
├── tsconfig.json
├── .env.example
├── src/
│   ├── functions/
│   ├── services/
│   ├── repositories/
│   ├── lib/
│   ├── types/
│   └── errors/
├── supabase/
│   └── migrations/
└── tests/
```

---

# Data / Migration

本 Task 只建立 Session / Consent 所需最小資料結構。

不得順便建立完整 Recommendation、Knowledge、Lead Schema。

如果 `DATA_MODEL.md` 與實作需求衝突：

**停止，不要自行改 Schema，回報 Jerry。**

---

# Environment Variables

可以提供：

```text
/apps/api/.env.example
```

只放 placeholder，例如：

```text
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

不得放真實值。

---

# Error Handling

至少支援 API Contract 需要的：

```text
INVALID_REQUEST
VALIDATION_ERROR
CONSENT_REQUIRED
INTERNAL_ERROR
```

不得把原始 Database Error / Secret 回傳給 Frontend。

---

# Testing

至少測試：

1. Create Session 成功
2. Session Response 格式
3. Consent accepted=true
4. Consent accepted=false
5. 缺少 sessionId
6. Invalid request
7. DB / Adapter error 被轉成安全 Error Response
8. 沒有 Secret 被 commit

---

# Not In Scope

本 Task 不做：

- Assessment AI
- Provider Import
- Recommendation Engine
- Lead
- Knowledge Database
- Crawler
- Frontend
- Production Deploy
- Root Netlify Config

---

# Acceptance Criteria

- [ ] Node.js + TypeScript Backend Foundation 建立
- [ ] Supabase Adapter / Repository Boundary 建立
- [ ] Session API 符合 Contract
- [ ] Consent API 符合 Contract
- [ ] Session / Consent 最小 migration 建立
- [ ] `.env.example` 無真實 Secret
- [ ] Tests 通過
- [ ] 沒有修改 API Contract
- [ ] 沒有自行擴大 Database Schema
- [ ] 沒有修改 Allowed Paths 以外檔案
- [ ] PR Base 為 `staging`
- [ ] PR 有 Submission Version 與 Changelog

---

# Completion Report

```text
Submission Version:
Implemented Endpoints:
Database / Migration:
Environment Variables:
Tests:
Added:
Changed:
Fixed:
Known Issues:
需要 Jerry 處理的 Root / Netlify 設定:
是否修改 Allowed Paths 以外檔案:
```

PR Title：

```text
[B-002] Backend API Foundation
```
