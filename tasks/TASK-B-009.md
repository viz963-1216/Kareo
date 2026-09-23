# TASK-B-009 — Knowledge Crawler

Owner: Engineer B — Backend  
Type: Backend / Crawler  
Status: QUEUED — **原始 MVP 必要項目**（PRODUCT_SPEC §42）；DO NOT START UNTIL B-008 MERGED

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

---

## 2026-09-23 範圍更正（J-002-r3）

- 上一版標示「POST-MVP ALLOWED」與 PRODUCT_SPEC §42 不一致，已更正：B-009 屬原始 MVP，列入 J-003 完整驗收與 J-004 release gate 的必要項目。
- 「MVP 先人工每日檢查、crawler 延後」是待核准的範圍變更提案（MVP_DECISIONS D-11）。**Jerry 核准前，本任務維持 MVP 必要**；核准後由 J-002 修訂 PRODUCT_SPEC 與本任務。
- 前置：B-008 合併（Knowledge 表、KnowledgeChange、Publish Gate）；Source Registry（D-02a）核准。來源清單以 `docs/knowledge/source-registry.md` 為準，不自行加入來源。
- 補充驗收：
  - [ ] 以 Source Registry 的 active 來源執行一次完整抓取，產生 CrawlerRun、Snapshot、contentHash；未變更時不產生 KnowledgeChange。
  - [ ] 模擬來源內容改變 → KnowledgeChange 進 `NEEDS_REVIEW`，PUBLISHED 版本不變。
  - [ ] 模擬抓取失敗／逾時／格式改變 → `FETCH_FAILED`，保留 Last Published，不清空、不寫半套。
  - [ ] 排程時間 00:10 Asia/Taipei 的設定與實際觸發紀錄（部署方式與費用影響先交 Jerry，D-09）。
  - [ ] 提供操作說明，讓審核人知道去哪裡看每日變更。

此補充不擴增產品範圍，只把 PRODUCT_SPEC 原始 MVP 已有的要求指到承接任務；所需規格更新由 TASK-J-002 先合併。
