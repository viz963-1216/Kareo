# TASK-B-009 — Knowledge Crawler

Owner: Engineer B — Backend  
Type: Backend / Crawler  
Status: READY — **原始 MVP 必要項目**（PRODUCT_SPEC §42）；B-008 已合併（PR #26）；未見提交  

---

# Goal / 目標

每天 00:10（Asia/Taipei）自動檢查 Source Registry 的官方來源：抓取 → Snapshot → Content Hash → 比對 → KnowledgeChange（`NEEDS_REVIEW`）→ 人工審核 → 發布（PRODUCT_SPEC §42–43、§49）。**Crawler 永遠不自動核准或發布。**

---

# Prerequisite / 前置條件

- B-008 已合併（完成，PR #26）：Knowledge 表、KnowledgeChange、CrawlerRun、Publish Gate。
- 來源清單以 `docs/knowledge/source-registry.md` 為準（D-02a PROPOSED），不自行加入來源；新北市來源擷取失敗的項目照實記錄 `FETCH_FAILED`。
- 排程部署方式若會增加 Netlify／Supabase 用量或費用，先交 Jerry 決定（D-09），不自行購買。

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

- 00:10 Asia/Taipei 排程（設定＋實際觸發紀錄）
- Raw Snapshot、Content Hash、Diff、KnowledgeChange（`NEEDS_REVIEW`）、CrawlerRun
- 抓取失敗／逾時／格式改變 → `FETCH_FAILED`，保留 Last Published，不清空、不寫半套
- 審核人操作說明：去哪裡看每日變更、如何轉成新內容包（contracts/knowledge/README）
- Tests／failure simulation

---

# Acceptance Criteria

- [ ] 以 Source Registry active 來源完整執行一次：產生 CrawlerRun、Snapshot、contentHash；未變更時不產生 KnowledgeChange
- [ ] 模擬內容改變 → KnowledgeChange 為 `NEEDS_REVIEW`，PUBLISHED 版本不變
- [ ] 模擬失敗／逾時／格式改變 → `FETCH_FAILED`，Assessment 繼續使用 Last Published
- [ ] Timezone 正確（00:10 Asia/Taipei），附排程設定與觸發紀錄
- [ ] Content Hash／Diff 可追溯；Tests 通過
- [ ] 部署後的每日紀錄由 J-003 驗收（E2E-26），J-004 列為 release 必要項

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

---

# 變更紀錄

- 2026-09-23 J-002-r3：更正「POST-MVP ALLOWED」→ 原始 MVP 必要。
- 2026-09-23 J-002-r4：補充驗收整併進主文；B-008 已合併 → READY；D-11（crawler 延後）未核准、已擱置，不再作為本任務的前提或替代方案。
