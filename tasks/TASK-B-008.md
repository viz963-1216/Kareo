# TASK-B-008 — Knowledge Foundation + Publish Gate

Owner: Engineer B — Backend  
Type: Backend / Knowledge  
Status: QUEUED — DO NOT START UNTIL B-003 MERGED AND JERRY SOURCE REGISTRY READY

---

# Goal / 目標

建立 Knowledge DB 基礎、Publish Gate 與 `GET /api/v1/knowledge/status`。Crawler 可延後，但正式 Assessment 不得使用未 Published Knowledge。

---

# Prerequisite / 前置條件

B-003 已 Merge；Jerry 已提供官方 Knowledge Source Registry。官方白名單仍以 PRODUCT_SPEC / ARCHITECTURE 為準。

---

# Branch / PR Rule

從最新 `staging` 建立：

```text
feat/b-008-knowledge-foundation-publish-gate
```

完成後：

```text
PR → staging
```

首次提交版次：

```text
B-008-r1
```

若退回修改，revision 依序遞增。

不得直接 Push `staging` 或 `main`。

---

# 開始前必讀

```text
AGENTS.md
docs/PRODUCT_SPEC.md
docs/ARCHITECTURE.md
docs/DATA_MODEL.md
docs/API_CONTRACT.md
docs/GIT_RULES.md
```

---

# Allowed Paths / 可修改範圍

```text
/apps/api/**
/services/knowledge/**
```

不得跨 Ownership。若必須修改其他模組，停止並回報 Jerry。

---

# Required Deliverables / 必交付

- KnowledgeSource / Record / Version / Change migration
- 狀態機：DISCOVERED → NEEDS_REVIEW → APPROVED → PUBLISHED
- CONFLICT / REJECTED / SUPERSEDED / FETCH_FAILED 支援
- Current Published Version resolver
- `GET /api/v1/knowledge/status`
- 最小人工 publish script / internal command（MVP 可無 Admin UI）
- Tests

---

# Acceptance Criteria

- [ ] 只有 PUBLISHED 可供 Assessment 使用
- [ ] publishedAt / effectiveFrom 分離
- [ ] Jurisdiction 支援 TAIWAN / TAIPEI / NEW_TAIPEI
- [ ] 無 Published Version 時回 KNOWLEDGE_UNAVAILABLE
- [ ] 不自動上線未審核資料
- [ ] Tests 通過

---

# Not In Scope

每日 Crawler、完整 Admin UI、非官方來源。

---

# Completion Report

PR 必須回報：

```text
Submission Version:
Added:
Changed:
Fixed:
Tests / QA:
Known Issues:
是否修改 Allowed Paths 以外檔案:
```

PR Title：

```text
[B-008] Knowledge Foundation + Publish Gate
```

---

## 2026-09-19 MVP 補充驗收與依賴

排程提前為 B-003 後的優先任務。J-002 分批提供 source registry/內容格式與核准內容。補交可重複執行的首批內容匯入、驗證及人工發布工具；匯入使用既有狀態機的未發布狀態，不自動核准。測試無發布、有效期間、衝突、替換版本與非授權發布；J-003 負責依核准內容在整合環境實際發布並留證，B-010 才能完成真實 smoke。

此補充不授權改寫高順位規格；所需規格更新由 TASK-J-002 先合併。
