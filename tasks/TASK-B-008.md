# TASK-B-008 — Knowledge Foundation + Publish Gate

Owner: Engineer B — Backend  
Type: Backend / Knowledge  
Status: r1 MERGED（PR #26）— 模組完成，非整合完成；D-03、D-10 延伸使用 2026-09-24 核准；**r2 READY**（修正發布版號與失效紀錄，首次知識發布前必須完成）  

---

# Goal / 目標

建立 Knowledge DB 基礎、Publish Gate 與 `GET /api/v1/knowledge/status`。Crawler 由 B-009 承接（原始 MVP）；本任務須提供 B-009 需要的 KnowledgeChange／CrawlerRun 寫入點。正式 Assessment 不得使用未 Published Knowledge。

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

---

---

## 核准狀態

- r1 已合併（PR #26，2026-09-23）。D-03 內容包格式與 D-10 延伸使用（發布／撤回函式）於 2026-09-24 由 Jerry 核准：[PR #31 comment 2026-09-24](https://github.com/viz963-1216/Kareo/pull/31#issuecomment-5806617991)。
  - 接受的例外：`publish_knowledge_version` 在函式內檢查紀錄必須為 APPROVED。
  - MVP 暫行做法：發布／撤回權限只依 service_role 金鑰，`approvedBy`／`createdBy` 由指令參數填寫。
- 首批內容包 9 筆已於 2026-09-24 內容核准（D-02），目標版本 `KB-2026-09-24-001`；匯入資料庫後仍為 `NEEDS_REVIEW`，需經 approve → publish 才成為 PUBLISHED。
- 線上 `assessment` function 尚未使用 B-008 的 PUBLISHED resolver；接線由 B-010 負責。

---

# B-008-r2 — 發布版號與失效紀錄修正

## Goal / 目標

讓首次知識發布完全符合已核准的 D-03（`contracts/knowledge/README.md` §4）：發布出來的正式版號等於 Jerry 核准的 `intendedKnowledgeVersion`，且已失效的紀錄不會被發布。

## Prerequisite / 前置條件

- r1 已合併（完成）；D-03、D-10 延伸使用已核准（完成）。
- 不需要其他任務。**B 的下一個 Active Task**（排在 B-011a 之前；範圍小，且卡住首次知識發布）。

## Branch / PR Rule

從最新 `staging` 建立 `fix/b-008-r2-publish-version`，PR → `staging`。Submission Version `B-008-r2`。
PR Title：`[B-008] Publish uses intended knowledge version`

## Allowed Paths

```text
/apps/api/**
```

## Deliverables

1. **版號來自內容包**：`publishKnowledgeVersion` 讀取內容包的 `intendedKnowledgeVersion` 作為 KnowledgeVersion id，傳給 `publish_knowledge_version`。
   - 內容包 `status` 不是 `APPROVED`，或 `intendedKnowledgeVersion` 為 null／不符 `KB-YYYY-MM-DD-NNN` → 拒絕發布，不呼叫 rpc，非零結束。
   - 該版號已存在於 `knowledge_versions`（任何狀態）→ 拒絕發布，不覆寫、不改用其他號碼。
   - 發布流程不再使用 `generateKnowledgeVersionId()` 產生版號。
2. **排除已失效紀錄**：以 Asia/Taipei 的發布日判斷，`effectiveTo` 早於發布日的紀錄不納入 `recordIds`，並在輸出列出被排除的 recordId；全部被排除 → 拒絕發布，不呼叫 rpc。`effectiveFrom` 晚於發布日的紀錄**可以**納入（README §4）。
3. 驗證都放在 Node Service 層（ARCHITECTURE §22 第 1 點）；不修改內容包格式。
5. **一個版本包含全部有效紀錄（D-03-v2，2026-09-24 核准）**：
   - 發布指令可接受多個內容包檔案；所有內容包必須是 `APPROVED` 且 `intendedKnowledgeVersion` 相同，否則拒絕。首批：`KP-2026-09-23-001`＋`KP-2026-09-24-002` → `KB-2026-09-24-001`。
   - 發布新版本時，前一個 PUBLISHED 版本中**未被新內容取代**（同 `jurisdiction + ruleData.type + title` 沒有新紀錄）且仍有效的紀錄，一併帶入新版本；被取代或已失效者 → SUPERSEDED。
   - 若需要調整 `publish_knowledge_version`（例如讓紀錄可屬於多個版本），先交 Jerry 決定 schema 變更，不自行修改。
6. **接受 Jerry 指定資料夾來源（D-15，2026-09-24 核准）**：匯入驗證的 `AUTHORITIES` 加入 `KAREO_DRIVE`；`authority = KAREO_DRIVE` 時 URL 須符合 `https://drive.google.com/file/d/<fileId>/…`，且 sourceId 已登錄於 Source Registry（其他來源維持 gov.tw／gov.taipei 規則）。
4. 更新操作說明（指令用法、輸出範例、失敗訊息）。

## Acceptance Criteria

- [ ] 以 `KP-2026-09-23-001` 的測試資料發布，建立的版本 id 等於 `KB-2026-09-24-001`
- [ ] 001＋002 一起發布：版本內有 15 筆 PUBLISHED；再發布一個只含 1 筆更新的內容包時，其餘 14 筆仍為 PUBLISHED；`intendedKnowledgeVersion` 不一致的多個內容包被拒絕
- [ ] `intendedKnowledgeVersion` 缺漏、格式錯、內容包非 APPROVED → 失敗且 rpc 未被呼叫（測試證明）
- [ ] 版號已存在 → 失敗且 rpc 未被呼叫，既有版本不變
- [ ] `effectiveTo` 早於發布日的紀錄被排除並列出；全部失效 → 失敗且 rpc 未被呼叫
- [ ] `effectiveFrom` 晚於發布日的紀錄仍會納入
- [ ] `KAREO_DRIVE` 來源：已登錄且 URL 正確 → 可匯入；未登錄或非 Drive 檔案網址 → 拒絕
- [ ] 既有 B-008 測試全部通過；`npm run typecheck`、`npm test`（apps/api）通過
- [ ] 不連正式或 staging 資料庫做測試；實際首次發布由 J-003 執行

## Not In Scope

資料表或函式變更、內容包格式變更、授權操作者機制（InternalOperator）、Admin UI、首次發布本身。

## 變更紀錄

- 2026-09-24 J-002-r4：D-03 與 B-008 實作比對發現 2 處差異（版號、失效紀錄），依 Jerry 核准開立 r2。
- 2026-09-24：發現規格缺口（發布會讓其他內容包的紀錄失效），新增第 5 點；D-03-v2、D-15 核准，新增第 6 點。
