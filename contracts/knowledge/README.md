# Knowledge Content Pack Contract

Owner: Jerry
Format version: 1.0（`content-pack.schema.json`）
Downstream: TASK-B-008（匯入／狀態機／發布工具）、TASK-J-003（實際發布與留證）、TASK-B-010（規則引擎使用 PUBLISHED 知識）

本資料夾是「人工整理並待審核的官方知識」進入 Knowledge DB 的唯一入口。MVP 不依賴 Crawler（B-009 可延後）。

---

## 1. 檔案位置

```text
contracts/knowledge/
├── README.md                     本文件
├── content-pack.schema.json      內容包 JSON Schema
└── packs/
    └── KP-YYYY-MM-DD-NNN.json    每批內容一個檔案，不覆寫舊批次
```

- 已提交的內容包**不得改寫**；修正以新批次（新的 `packId`）提交，並在 `records[].review.notes` 註明取代關係。
- 唯一例外：Jerry 審核時更新同一檔案的 `status`／`review`／`intendedKnowledgeVersion` 欄位，且必須經 PR 合併，PR 即為審核證據。

## 2. 三個不同的狀態（不可混用）

| 層級 | 欄位 | 誰改 | 代表什麼 |
|---|---|---|---|
| 內容審核 | 內容包 `status`、`records[].status` | Jerry（PR） | 內容是否被核准，**不代表已上線** |
| 資料庫紀錄 | `KnowledgeRecord.status`（DATA_MODEL §24） | B-008 工具 | `NEEDS_REVIEW → APPROVED → PUBLISHED`，另有 `REJECTED／SUPERSEDED／CONFLICT／FETCH_FAILED` |
| 版本 | `KnowledgeVersion.status`（DATA_MODEL §26） | B-008 發布指令（由 J-003 執行） | `DRAFT → PUBLISHED → ARCHIVED`；Assessment 只讀 `PUBLISHED` |

## 3. 匯入（B-008 實作）

匯入指令只讀一個內容包檔案，並且：

1. 以 `content-pack.schema.json` 驗證；任一欄位不合格，**整批拒絕，不寫入任何資料**，以非零狀態結束。
2. 驗證每個 `source.sourceId` 存在於 `docs/knowledge/source-registry.md` 且 `active = true`，URL 網域屬於白名單。
3. 同一包內 `recordId` 不得重複；同一 `jurisdiction + category + title` 若與已 PUBLISHED 紀錄內容不同，標記 `CONFLICT`，不得自動覆蓋。
4. 匯入後的資料庫紀錄狀態一律為 `NEEDS_REVIEW`，**匯入不代表核准**，即使內容包本身已是 `APPROVED`。
5. 以 `(packId, recordId)` 冪等：重複匯入同一包不產生重複紀錄。
6. 支援 `--dry-run`，只輸出驗證結果與將寫入的筆數。

## 4. 核准與發布（B-008 提供工具，J-003 執行）

```text
內容包 status = APPROVED（Jerry PR 合併）
↓
B-008 import（紀錄為 NEEDS_REVIEW）
↓
B-008 approve：只接受內容包中 decision = APPROVED 的紀錄 → APPROVED
↓
B-008 publish：建立 KnowledgeVersion（intendedKnowledgeVersion），
               該版本內所有紀錄 → PUBLISHED，版本 → PUBLISHED，
               前一個 PUBLISHED 版本 → ARCHIVED（其紀錄 → SUPERSEDED）
↓
GET /api/v1/knowledge/status 回傳新版本
```

規則：

- 發布必須由授權操作者執行（受保護的內部指令，不提供公開 API），並記錄 `approvedBy`、`publishedAt`、`createdBy`。
- 同一時間只能有一個 `PUBLISHED` 的 `KnowledgeVersion`。
- 發布前，`effectiveTo` 早於發布日的紀錄不得納入。
- `effectiveFrom` 晚於發布日的紀錄可以納入，但 Assessment 使用時必須依 `effectiveFrom` 判斷當下是否適用。
- 內容包中 `REJECTED`／`CONFLICT` 的紀錄永遠不得發布。

## 5. 撤回（Withdraw）

當已發布內容被發現錯誤或官方變更：

1. **不刪除資料**。以新的內容包修正，或由 B-008 撤回指令將目前版本 → `ARCHIVED`、並重新發布上一個正確版本（若存在）。
2. 若沒有可用的上一版，撤回後系統處於「無 PUBLISHED 版本」，Assessment 依 contract 回 `KNOWLEDGE_UNAVAILABLE`。**不得以未審核資料頂替。**
3. 撤回需記錄原因、操作者與時間。

## 6. Assessment 使用規則（B-010）

- 每次 Assessment 記錄當下的 `knowledgeVersion`。
- 規則引擎只能引用當下 PUBLISHED 版本中、與使用者縣市相符（`TAIWAN` 或該縣市）的紀錄（ASSESSMENT_RULES §6）。
- 回應中若提到制度，只能使用已核准模板並維持「初步預估」語氣；MVP 不顯示給付金額。

## 7. 審核清單（給 Jerry）

逐筆核准前請確認：

- [ ] 打開 `source.url`，原文仍可存取，內容與 `excerpt` 一致（表格類紀錄逐格核對數字）
- [ ] `effectiveFrom`／`effectiveTo`／`publishedAt` 與官方公告一致
- [ ] `jurisdiction` 正確
- [ ] `summary` 沒有超出原文的推論，沒有宣稱正式資格或核定
- [ ] 若涉及 2025-10-03 勘誤（附表三、四、五與第 14 條），確認為勘誤後版本
- [ ] 在 `review` 填入真實審核人與時間；無法確認者標 `REJECTED` 或保持 `NEEDS_REVIEW`
