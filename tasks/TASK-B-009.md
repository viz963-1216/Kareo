# TASK-B-009 — Knowledge Crawler

Owner: Engineer B — Backend  
Type: Backend / Crawler  
Status: QUEUED — POST-MVP ALLOWED; DO NOT START UNTIL B-008 MERGED

---

# Goal / 目標

建立官方 Knowledge 自動更新 Crawler：每日 00:10 Asia/Taipei 抓取、Snapshot、Hash、Diff、Change Queue，但不得自動 Publish。

---

# Prerequisite / 前置條件

B-008 已 Merge；官方 Source Registry 已可用。

---

# Branch / PR Rule

從最新 `staging` 建立：

```text
feat/b-009-knowledge-crawler
```

完成後：

```text
PR → staging
```

首次提交版次：

```text
B-009-r1
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
/services/crawler/**
/services/knowledge/**
```

不得跨 Ownership。若必須修改其他模組，停止並回報 Jerry。

---

# Required Deliverables / 必交付

- Scheduled crawler
- Raw Snapshot
- Content Hash
- Diff
- KnowledgeChange
- CrawlerRun
- FETCH_FAILED 保留 Last Published
- 00:10 Asia/Taipei schedule
- Tests / failure simulation

---

# Acceptance Criteria

- [ ] 抓取失敗不清空 Knowledge
- [ ] Change 進 NEEDS_REVIEW
- [ ] 不自動 Publish
- [ ] Content Hash / Diff 可追溯
- [ ] Timezone 正確
- [ ] Tests 通過

---

# Not In Scope

自動核准政策、非官方來源、Frontend Admin UI。

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
[B-009] Knowledge Crawler
```
