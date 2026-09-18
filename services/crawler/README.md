# Crawler Service — Plan

Task: TASK-B-001
Owner: Engineer B
Status: DRAFT — 待 Jerry 核准

本文件規劃 `services/crawler/**`，依 `docs/DATA_MODEL.md` 第 28 節、`docs/PRODUCT_SPEC.md` 第 42–49 節、`docs/ARCHITECTURE.md` 第 9 節。

---

## 1. 責任

Crawler Service 負責定期抓取官方白名單來源，偵測內容變化，產生 `KnowledgeChange` 供 Knowledge Service / Jerry 審核。**Crawler 本身不得直接修改正式 Assessment 使用的 Knowledge，只能提出變更請求。**

管理對象：`CrawlerRun`（每次執行紀錄）。

---

## 2. 排程

- 頻率：每日一次
- 時間：`00:10`
- Timezone：`Asia/Taipei`

（實際排程執行環境——Serverless Cron / 獨立 Worker / CI Scheduled Job——屬技術棧決策，需 Jerry 核准，見第 6 節。）

---

## 3. 處理流程

```text
1. 讀取 KnowledgeSource（官方白名單，active = true）清單
2. 對每個來源建立 CrawlerRun（status = RUNNING, startedAt）
3. 抓取官方頁面內容（Raw Snapshot）
4. 計算 Content Hash
5. 與該 KnowledgeRecord 目前的 contentHash 比對：
   a. 相同 → 更新 lastVerifiedAt，不建立 KnowledgeChange
   b. 不同 → 建立 / 更新 KnowledgeRecord（status 視情況設為 DISCOVERED 或直接進 NEEDS_REVIEW）
      並建立 KnowledgeChange（oldContentHash / newContentHash / oldContent / newContent，
      status = NEEDS_REVIEW，可附 aiSummary 協助 Jerry 快速理解差異）
6. 更新 CrawlerRun（status = SUCCESS / PARTIAL / FAILED, finishedAt, itemsChecked, changesDetected）
```

---

## 4. 失敗處理（Crawler Failure）

依 `PRODUCT_SPEC.md` 第 49 節與 `DATA_MODEL.md` 第 28 節：

- 單一來源抓取失敗 → 該來源對應 `CrawlerRun.status = FAILED`，記錄 `errorMessage`。
- 部分來源成功、部分失敗 → 整體視為 `PARTIAL`。
- **絕對禁止**：因抓取失敗而清空 Knowledge、刪除舊資料，或用「半套」新資料覆蓋既有 `PUBLISHED` 內容。系統必須繼續使用 Last Published Knowledge Version 對外服務。

---

## 5. 與 Knowledge Service 的分工

```text
Crawler：Official Source → Snapshot → Hash Compare → KnowledgeChange（NEEDS_REVIEW）
Knowledge Service：管理 Review / Approve / Publish 之後的狀態與正式版本
```

Crawler 不持有「審核通過」的權限，只負責「發現變化並提出」。

---

## 6. Error Handling

- 官方網站結構改版導致解析失敗 → 記錄 `FAILED` + `errorMessage`，不中斷其他來源的抓取。
- 網路逾時 → 重試策略與次數由後續實作階段決定（本 Task 只規劃行為原則：失敗不影響既有 Published 資料）。

---

## 7. Test Strategy

- Unit Test：Content Hash 計算一致性（同內容 → 同 hash）、Hash 比對邏輯（有變化才觸發 KnowledgeChange）。
- Integration Test：模擬單一來源抓取失敗時，其餘來源與既有 Published Knowledge 不受影響。
- 手動測試：以固定官方頁面 Snapshot 驗證解析正確性（不在 CI 中對正式官網做高頻率請求，避免造成負擔或被封鎖）。

---

## 8. 技術決策（需 Jerry 核准）

- [ ] Crawler 執行環境（Serverless Scheduled Function / 獨立 Worker Process / CI Cron Job）
- [ ] HTML 解析方式（是否需要 Headless Browser，或純 HTTP + HTML Parser 即可）
- [ ] `aiSummary` 是否在 Crawler 階段即生成，或延後到 Review 階段才呼叫 AI（涉及成本與即時性權衡）
- [ ] 重試 / 逾時策略的具體參數

---

## Source of Truth

```text
PRODUCT_SPEC.md → ARCHITECTURE.md → DATA_MODEL.md → API_CONTRACT.md → GIT_RULES.md → TASK → Code
```
