# Knowledge Service — Plan

Task: TASK-B-001
Owner: Engineer B
Status: DRAFT — 待 Jerry 核准

本文件規劃 `services/knowledge/**`，依 `docs/DATA_MODEL.md` 第 23–27 節、`docs/PRODUCT_SPEC.md` 第 38–52 節、`docs/ARCHITECTURE.md` 第 9 節。

---

## 1. 責任

Knowledge Service 負責管理長照制度 / 法規 / 補助的官方資料，回答「目前制度怎麼規定？」，與 Provider DB（回答「可以找誰？」）明確分離，不共用資料表邏輯。

管理對象：`KnowledgeSource`、`KnowledgeRecord`、`KnowledgeVersion`、`KnowledgeChange`。

**本模組不負責**：抓取官方網站的實際爬蟲執行（由 `services/crawler` 負責，Knowledge Service 只消費 Crawler 產生的結果）。

---

## 2. 資料流

```text
services/crawler 偵測到變化
  ↓
建立 / 更新 KnowledgeRecord（status 初始為 DISCOVERED 或 NEEDS_REVIEW）
  ↓
建立 KnowledgeChange（oldContentHash / newContentHash / aiSummary，status = NEEDS_REVIEW）
  ↓
Jerry / Admin Review（Approve or Reject）
  ↓
APPROVED → 併入新的 / 更新既有 KnowledgeVersion
  ↓
PUBLISHED（唯一可供正式 Assessment 使用的狀態）
```

Assessment Service 呼叫 Knowledge Service 取得目前 `PUBLISHED` 的 `KnowledgeVersion`，並將版本號記錄於該筆 Assessment（對應 `DATA_MODEL.md` 第 7 節 `knowledgeVersion` 欄位）。

---

## 3. 狀態機（不可自行新增/修改）

`KnowledgeRecord.status`：

```text
DISCOVERED → NEEDS_REVIEW → APPROVED → PUBLISHED
                    ↓             ↓
                REJECTED      SUPERSEDED
                    ↓
                CONFLICT
FETCH_FAILED（爬取失敗，不影響既有 PUBLISHED 資料）
```

`KnowledgeVersion.status`：`DRAFT → PUBLISHED → ARCHIVED`

規則：

- 只有 `PUBLISHED` 版本可供正式 Assessment 使用。
- 不同官方來源資料衝突 → 標記 `CONFLICT`，**AI 不得自行判斷**，交由 Jerry/Admin。
- `publishedAt`（官方公告日）與 `effectiveFrom`（生效日）分開記錄；生效日未到不得視為目前有效制度。
- Crawler 抓取失敗（`FETCH_FAILED`）→ 不清空、不刪除舊資料，系統繼續使用 Last Published Knowledge Version。

---

## 4. Jurisdiction / 適用地區

`TAIWAN` / `TAIPEI` / `NEW_TAIPEI`（依 `DATA_MODEL.md` 第 23 節）。地方補助不得跨區套用（例如台北市補助不能用於新北市使用者）。

---

## 5. 官方白名單（不可擴增，需 Jerry 核准才能新增來源）

- 中央：衛生福利部、1966 / 長照專區、全國法規資料庫
- 地方：臺北市政府、新北市政府

禁止把部落格、社群媒體、新聞、SEO 文章當作正式 Assessment Knowledge。

---

## 6. API 對應

`GET /api/v1/knowledge/status`（依 `API_CONTRACT.md` 第 13 節）：回傳目前 `PUBLISHED` 版本號、`publishedAt`、`lastVerifiedAt`、提醒文字。Frontend 原則上不直接讀整個 Knowledge DB，只透過此輕量端點取得狀態。

---

## 7. Error Handling

- 找不到任何 `PUBLISHED` 版本（例如系統剛啟動、尚未有人 Approve）→ `KNOWLEDGE_UNAVAILABLE`，Assessment 不得用 LLM 記憶硬猜。
- Knowledge 內容不足以回答使用者制度問題 → 依 `PRODUCT_SPEC.md` 第 51 節，回覆固定文案：「目前平台資料不足以做出可靠預估，建議聯絡 1966 或所在地長期照顧管理中心確認。」

---

## 8. Test Strategy

- Unit Test：狀態機轉換合法性（例如禁止 `DISCOVERED` 直接跳 `PUBLISHED`）、Jurisdiction 篩選正確性（台北市 Knowledge 不會誤用於新北市使用者）。
- Integration Test：`GET /knowledge/status` 在「有 PUBLISHED 版本」與「無 PUBLISHED 版本」兩種情境下的回應正確性。
- Regression：確認 Crawler FETCH_FAILED 情境下，舊 PUBLISHED 版本仍可正常被 Assessment 讀取。

---

## 9. 需 Jerry 核准的決策

- [ ] Admin Review 介面（本 Task 只規劃資料狀態機，實際 Review UI/流程需另立 Task）
- [ ] `ruleData`（結構化規則 JSON）的實際 schema 設計，需先經 Jerry 確認後才能落地（`DATA_MODEL.md` 第 25 節：AI 不得自行改變既有 ruleData schema）
- [ ] AI Summary（KnowledgeChange.aiSummary）使用的 LLM 供應商與 Prompt 規範

---

## Source of Truth

```text
PRODUCT_SPEC.md → ARCHITECTURE.md → DATA_MODEL.md → API_CONTRACT.md → GIT_RULES.md → TASK → Code
```
