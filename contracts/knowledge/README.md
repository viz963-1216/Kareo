# Knowledge Content Pack Contract

Owner: Jerry
Format version: 1.0（`content-pack.schema.json`）
Downstream: TASK-B-008（匯入／狀態機／發布工具）、TASK-J-003（實際發布與留證）、TASK-B-010（規則引擎使用 PUBLISHED 知識）

本資料夾是「人工整理並待審核的官方知識」進入 Knowledge DB 的唯一入口。每日自動更新（B-009 Crawler，每天 00:10 Asia/Taipei）屬原始 MVP（PRODUCT_SPEC §42），目前依原始範圍開發。crawler 上線後發現的變更同樣經本資料夾的審核與發布規則，內容包不會被 crawler 自動核准。

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
- 唯一例外：Jerry 審核時更新同一檔案的 `status`／`review`／`intendedKnowledgeVersion` 欄位。審核證據是**逐筆填寫的 `review`（審核人、日期、決定）加上 Jerry 在該 PR 留下的 review／comment 連結**；只合併 PR 而紀錄仍是 `NEEDS_REVIEW`，不構成核准，也不得由其他人或工具在合併時批次改成 `APPROVED`。

## 2. 三個不同的狀態（不可混用）

| 層級 | 欄位 | 誰改 | 代表什麼 |
|---|---|---|---|
| 內容審核 | 內容包 `status`、`records[].status` | Jerry（PR） | 內容是否被核准，**不代表已上線** |
| 資料庫紀錄 | `KnowledgeRecord.status`（DATA_MODEL §24） | B-008 工具 | `NEEDS_REVIEW → APPROVED → PUBLISHED`，另有 `REJECTED／SUPERSEDED／CONFLICT／FETCH_FAILED` |
| 版本 | `KnowledgeVersion.status`（DATA_MODEL §26） | B-008 發布指令（由 J-003 執行） | `DRAFT → PUBLISHED → ARCHIVED`；Assessment 只讀 `PUBLISHED` |

## 3. 匯入（B-008 實作）

匯入指令只讀一個內容包檔案，並且：

1. 以 `content-pack.schema.json` 驗證；任一欄位不合格，**整批拒絕，不寫入任何資料**，以非零狀態結束。
2. 驗證每個 `source.sourceId` 存在於 `docs/knowledge/source-registry.md` 且 `active = true`，URL 網域屬於白名單（gov.tw／gov.taipei）；`authority = KAREO_DRIVE` 時，URL 必須是 `https://drive.google.com/file/d/<fileId>/…` 且該 fileId 已登錄於 Source Registry 的 Jerry 指定資料夾區段（D-15）。
3. 同一包內 `recordId` 不得重複；同一 `jurisdiction + category + title` 若與已 PUBLISHED 紀錄內容不同，標記 `CONFLICT`，不得自動覆蓋。
4. 匯入後的資料庫紀錄狀態一律為 `NEEDS_REVIEW`，**匯入不代表核准**，即使內容包本身已是 `APPROVED`。
5. 以 `(packId, recordId)` 冪等：重複匯入同一包不產生重複紀錄。
6. 支援 `--dry-run`，只輸出驗證結果與將寫入的筆數。

## 4. 核准與發布（B-008 提供工具，J-003 執行）

```text
內容包紀錄 decision = APPROVED（Jerry 逐筆審核，PR 內有審核紀錄）
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
- 回應中的制度與補助說明只能使用 ASSESSMENT_RULES §6 的模板，維持「初步預估」語氣。金額、比率、分區等數值**只能**讀取 PUBLISHED 紀錄的 `ruleData`，以官方規則說明呈現，不計算個人核定額度（ASSESSMENT_RULES §6.3）。
- 規則引擎依 `ruleData.type`＋jurisdiction 查找紀錄（對應表見 ASSESSMENT_RULES §6.4）；新增或修改 `ruleData.type` 需同步更新該對應表與 B-010 測試。
- 臺北市、新北市的地方紀錄分開管理；缺少某縣市的地方紀錄時，不得以另一縣市或中央紀錄代替。

## 7. 審核清單（給 Jerry）

逐筆核准前請確認：

- [ ] 打開 `source.url`，原文仍可存取，內容與 `excerpt` 一致（表格類紀錄逐格核對數字）
- [ ] `effectiveFrom`／`effectiveTo`／`publishedAt` 與官方公告一致
- [ ] `jurisdiction` 正確
- [ ] `summary` 沒有超出原文的推論，沒有宣稱正式資格或核定
- [ ] 若涉及 2025-10-03 勘誤（附表三、四、五與第 14 條），確認為勘誤後版本
- [ ] 在 `review` 填入真實審核人與時間；無法確認者標 `REJECTED` 或保持 `NEEDS_REVIEW`
