# Mock Contracts

本資料夾由 Jerry / Spec Owner 管理。

用途：提供 Engineer C 可直接使用的固定 Mock API Response，讓 Frontend 不需要等待 Backend。

目前已建立：

```text
session-response.json
consent-response.json
assessment-response.json
recommendation-response.json
provider-response.json
lead-response.json
transportation-response.json
```

規則：

1. Mock 格式必須與 `docs/API_CONTRACT.md` 完全一致。
2. Engineer B / C 不得因為實作方便自行修改 Mock Contract。
3. 需要新增或修改欄位時，先建立 Issue，交 Jerry Review。
4. Mock 只代表 API 格式，不代表正式 Provider 或政策資料。
5. 正式整合時由 Jerry 將 Mock Data 替換為 Real API。
6. `KB-MOCK-001`、`PROV-MOCK-001` 等只允許作為 Mock / Test ID，不得當成正式 Production Data。

---

## Provider Detail／推薦 fixtures（2026-09-23 新增）

C-004 回報：C-003 的三種服務推薦共用 `PROV-MOCK-001～003`，但只有 `PROV-MOCK-001` 有詳細資料，醫護與輔具卡片會連到居家照顧詳細頁。以下 fixtures 讓「推薦卡片 → 同一服務單位詳細頁」一對一對應。

### 檔案

```text
contracts/mock/
├── providers/
│   ├── PROV-MOCK-001.json   GET /api/v1/providers/PROV-MOCK-001 的完整回應
│   ├── …                    （檔名 = providerId）
│   └── PROV-MOCK-203.json
├── recommendations/
│   ├── HOME_CARE.json              POST /api/v1/recommendations（serviceType=HOME_CARE）
│   ├── HOME_MEDICAL_NURSING.json
│   └── ASSISTIVE_DEVICE.json
└── errors/
    └── provider-not-found-response.json   找不到服務單位（NOT_FOUND）
```

| 服務類別 | recommendationId | rank 1 | rank 2 | rank 3 |
|---|---|---|---|---|
| HOME_CARE | REC-MOCK-HC-001 | PROV-MOCK-001 | PROV-MOCK-002 | PROV-MOCK-003 |
| HOME_MEDICAL_NURSING | REC-MOCK-HMN-001 | PROV-MOCK-101 | PROV-MOCK-102 | PROV-MOCK-103 |
| ASSISTIVE_DEVICE | REC-MOCK-AD-001 | PROV-MOCK-201 | PROV-MOCK-202 | PROV-MOCK-203 |

`provider-response.json` 與 `recommendation-response.json` 保留相容，內容分別等於 `providers/PROV-MOCK-001.json` 與 `recommendations/HOME_CARE.json` 的第 1 筆。

### 一致性規則（已用腳本逐欄驗證）

1. 每張推薦卡片的 `id` 都有同名的 `providers/<id>.json`；同一個 ID 不會出現在兩種服務。
2. 卡片與詳細頁的 `id`、`name`、`type`、`address`、`district`、`phone`、`website`、`googleMapsUrl`、`verified` 完全相同。
3. 詳細頁的 `services` 一定包含該推薦清單的服務類別（`PROV-MOCK-102` 同時提供醫護與居家照顧，用來測試多服務顯示）。
4. **地址與服務範圍分開提供**：`address`／`city`／`district` 是單位所在地；`serviceAreas` 是可服務範圍，可以跨縣市（例如 `PROV-MOCK-102` 位於臺北市大同區，但服務範圍包含新北市三重區）。前端不得由地址推測服務範圍。
5. 所有推薦的 `reasons` 寫「服務範圍包含三重區」，對應的 `serviceAreas` 都確實包含新北市三重區。
6. `googleMapsUrl` 每家不同，可用來驗證連結來自資料而非前端組成。
7. 各服務的主 fixtures 為 `DISTRICT_ROTATION`、`distanceKm = null`。距離排序（PRODUCT_SPEC §21，原始 MVP）另提供 `recommendations/ranking-variants/HOME_CARE-DISTANCE.json`（`DISTANCE`、`locationPrecision = GPS`、`distanceKm` 與「距離約 X 公里」原因），前端 Mock 驗收需涵蓋兩種畫面。距離數值為測試資料。

### 前端使用方式（C，`/apps/web/**`）

- 推薦：依 `serviceType` 讀取對應的 `recommendations/<serviceType>.json`；測試 0～3 家時取 `providers.slice(0, n)`，不要改動卡片內容或 ID。
- 詳細頁：以卡片的 `id` 讀取 `providers/<id>.json`；找不到檔案時回傳 `errors/provider-not-found-response.json`，畫面顯示找不到，不得改用其他單位的資料。
- 所有名稱、電話、網址都是測試資料（`example.com`、虛構電話），不代表真實單位。

---

## 位置情境與補助說明 fixtures（2026-09-23，J-002-r4）

供 C-005 做 Mock 模組驗收。格式依 API_CONTRACT v0.2.2 §8–§9。D-13a–c 與 D-01a 已於 2026-09-24 核准。

| 檔案 | 情境 | rankingType／locationPrecision | 狀態 |
|---|---|---|---|
| `recommendations/<serviceType>.json` | 只有行政區 | `DISTRICT_ROTATION`／`DISTRICT` | 原始 MVP |
| `recommendations/ranking-variants/HOME_CARE-DISTANCE.json` | 精確位置，候選都有已驗證座標 | `DISTANCE`／`GPS` | 原始 MVP |
| `recommendations/ranking-variants/HOME_CARE-DISTANCE-MISSING-COORDINATES.json` | 精確位置，但候選缺座標 → 改行政區輪替 | `DISTRICT_ROTATION`／`GPS` | 已核准 D-13c |
| `recommendations/ranking-variants/HOME_CARE-CITY_ROTATION.json` | 只有縣市 | `CITY_ROTATION`／`CITY` | 已核准 D-13a |
| `recommendations/ranking-variants/HOME_CARE-NO_LOCATION.json` | 沒有位置（前端正常情況不呼叫；防呆用） | `NO_LOCATION`／`NONE`，0 家 | 已核准 D-13b |
| `assessments/WITH-SUBSIDY-NEW_TAIPEI.json` | 結果頁含可能適用的補助說明（`summary` 以 `\n` 分段，ASSESSMENT_RULES §6） | — | 模板已核准（D-01a） |

注意：

1. `WITH-SUBSIDY-NEW_TAIPEI.json` 的金額、比率與來源文字取自 `KP-2026-09-23-001`，該內容包已於 2026-09-24 內容核准但**尚未發布**；Mock 使用 `KB-MOCK-001`，只示範格式與排版，不代表已發布的知識，也不得被正式環境使用。
2. 前端只負責逐行顯示 `summary` 與 `knowledgeVersion`，不得解析句子、不得自行計算或補上任何金額。
3. 所有 `distanceKm` 只在 `DISTANCE` 為數值；其餘 fixture 一律為 `null`。


---

## Admin Knowledge fixtures（2026-09-24 D-16；2026-09-29 v0.4 D-16a 補齊）

供 C-006 管理頁面 Mock 驗收，格式依 API_CONTRACT §26（v0.4）。全部位於 `contracts/mock/admin/`；`requests/` 為前端應送出的 request 範例，`errors/` 為錯誤回應（沿用 §5 envelope）。所有內容為測試資料（`*-MOCK-*`），不代表真實版本、制度或操作者。

### 情境主線（前後數字一致）

```text
KB-MOCK-001 已發布（15 筆）
→ 待審 KREC-MOCK-001（KP-MOCK-003／KR-MOCK-016）核准
→ 預覽 KB-MOCK-002：新增 1＋沿用 15＝總數 16
→ 發布 KB-MOCK-002（數字與預覽相同）
→ 撤回 KB-MOCK-002、恢復 KB-MOCK-001
另一條：只有 KB-MOCK-001、沒有可恢復版本 → 撤回且不恢復 → 沒有已發布版本
```

### 操作對照

| 操作 | Request | 成功 | 空清單／其他狀態 | 錯誤 |
|---|---|---|---|---|
| 登入 `POST /admin/session` | `requests/session-request.json` | `session-response.json` | — | `errors/session-invalid-response.json`、`errors/forbidden-response.json` |
| 狀態 `GET …/status` | — | `knowledge-status-response.json`（發布前）、`knowledge-status-after-publish-response.json` | `knowledge-status-no-published-response.json` | `errors/session-invalid-response.json` |
| 變更 `GET …/changes` | — | `knowledge-changes-response.json` | `knowledge-changes-empty-response.json` | `errors/session-invalid-response.json`、`errors/forbidden-response.json` |
| 待審紀錄 `GET …/records` | — | `knowledge-records-response.json` | `knowledge-records-empty-response.json`（核准後） | 同上 |
| 核准 `POST …/records/{id}/decision` | `requests/record-decision-approved-request.json` | `knowledge-record-approved-response.json` | — | `errors/validation-reason-required-response.json`、`errors/validation-confirm-required-response.json`、`errors/record-content-changed-response.json`、`errors/record-already-decided-response.json`、`errors/not-found-response.json` |
| 退回（同上路徑） | `requests/record-decision-rejected-request.json` | `knowledge-record-rejected-response.json` | — | 同核准 |
| 忽略變更 `POST …/changes/{id}/dismiss` | `requests/change-dismiss-request.json` | `knowledge-change-dismissed-response.json` | — | `errors/validation-reason-required-response.json`、`errors/record-already-decided-response.json`、`errors/not-found-response.json` |
| 發布預覽 `GET …/publish-preview` | — | `knowledge-publish-preview-response.json` | `knowledge-publish-preview-no-approved-response.json`、`knowledge-publish-preview-version-exists-response.json`（`canPublish: false`） | `errors/session-invalid-response.json` |
| 發布 `POST …/publish` | `requests/publish-request.json` | `knowledge-publish-response.json` | — | `errors/publish-preview-stale-response.json`（預覽後資料改變）、`errors/publish-conditions-not-met-response.json`（發布條件不符）、`errors/validation-confirm-required-response.json` |
| 可恢復版本 `GET …/restorable-versions` | — | `knowledge-restorable-versions-response.json` | `knowledge-restorable-versions-empty-response.json`、`knowledge-restorable-versions-no-current-response.json` | `errors/session-invalid-response.json` |
| 撤回並恢復 `POST …/withdraw` | `requests/withdraw-republish-request.json` | `knowledge-withdraw-response.json` | — | `errors/republish-version-unavailable-response.json`（恢復版本不可用）、`errors/validation-republish-same-version-response.json`、`errors/withdraw-version-changed-response.json`、`errors/validation-reason-required-response.json` |
| 撤回不恢復（同上路徑） | `requests/withdraw-no-republish-request.json` | `knowledge-withdraw-no-republish-response.json` | 之後狀態：`knowledge-status-no-published-response.json` | 同上 |

HTTP status：`SESSION_INVALID` 401、`FORBIDDEN` 403、`VALIDATION_ERROR` 400、`NOT_FOUND` 404、`INVALID_STATUS_TRANSITION` 409、`KNOWLEDGE_STATE_CHANGED` 409（API_CONTRACT §3.2）。Mock 回應時請一併使用對應 status。

### 一致性規則（已用腳本驗證）

1. 預覽與發布：`versionId`＝`targetVersionId`，`previewToken` 相同；新增／沿用／總數／取代／排除五個數字相同；`totalRecordCount = publishedRecordCount + carriedForwardCount`。
2. 預覽 `newRecords` 與核准的紀錄是同一筆（id、packId、recordId、title）；`publishedRecordCount = newRecords.length`。
3. `canPublish: false` 時 `previewToken` 為 `null`、`blockers` 非空；`canPublish: true` 時 `blockers` 為空。
4. 可恢復版本不含 `currentVersion`；`KB-MOCK-001.recordCount`（15）＝發布前總數，`KB-MOCK-002.recordCount`（16）＝發布總數。
5. 撤回 request 的 `withdrawVersionId`＝可恢復清單的 `currentVersion.versionId`；`republishVersionId` 取自 `versions[]` 或明確為 `null`，且不等於 `withdrawVersionId`。
6. decision request 的 `expectedContentFingerprint`＝待審紀錄的 `contentFingerprint`。
7. 所有寫入 request 有 `confirm: true`；decision／dismiss／withdraw 有非空 `reason`，且與成功回應的 `review.reason`／`reason` 相同。
8. 錯誤碼只使用 API_CONTRACT §5 定義的代碼。

### 身心障礙福利補助 fixture（2026-09-24，D-17）

`assessments/WITH-DISABILITY-NEW_TAIPEI.json`：使用者勾選領有身心障礙證明（`disabilityCertificate = YES`）時的 summary 範例（ASSESSMENT_RULES §6.5）。金額取自 KR-2026-018（待審核）與 KR-2026-016，只示範格式。第 3 行為省略標記，不是實際輸出。

### 個人自付估算 fixture（2026-09-24，D-17a）

`assessments/WITH-ESTIMATE-GENERAL-NEW_TAIPEI.json`：使用者選「一般戶」、勾選領有身心障礙證明時的 summary 範例（ASSESSMENT_RULES §6.6）。括號「……略……」行為省略標記。金額依已核准知識計算，只示範格式。

### Admin fixtures 可重現檢查

執行 `node contracts/mock/admin/validate-fixtures.mjs`，檢查 JSON envelope、發布預覽與成功回應的數量／版號，以及核准與撤回 request／response 對應。這不是後端交易或真實 API 驗收。

---

## 資源查詢 fixtures（2026-10-01，J-002-r6，D-18）

供 C-007 查詢頁 Mock 驗收，格式依 API_CONTRACT v0.5 §10a（`GET /api/v1/providers`）與 §10（詳細頁新增 `serviceAreaStatus`）。D-18 產品規則已核准；§10a 細節 D-18a–e 待 Jerry 審核本版，若有修改會同步這些檔案。

### 檔案

```text
contracts/reference/service-districts.json     雙北行政區清單與排序順序（前後端共用）
contracts/mock/providers/
├── PROV-MOCK-001～203.json      既有詳細頁，新增 serviceAreaStatus = VERIFIED
├── PROV-MOCK-204.json           新增：位於新北市三重區、服務範圍待確認（UNCONFIRMED，serviceAreas = []）
└── lookup/
    ├── <情境>-response.json     列表回應
    ├── requests/<情境>-request.json   對應的 query 參數
    ├── errors/<錯誤>-response.json    VALIDATION_ERROR
    └── validate-fixtures.mjs    一致性檢查
```

### 情境對照

| 情境 | Request（query） | Response | 重點 |
|---|---|---|---|
| 不加條件第一頁 | （無） | `list-all-first-page-response.json` | 10 家，依縣市 → 行政區 → id 排序；`areaMatch`、`unconfirmedCount` 為 `null` |
| 依所在地 | `serviceType=ASSISTIVE_DEVICE&city=新北市&district=三重區&areaFilter=LOCATED_IN` | `list-located-in-response.json` | 201、204（204 範圍待確認也會出現） |
| 依服務範圍（只列已確認） | 同上，`areaFilter=SERVICE_AREA` | `list-service-area-verified-only-response.json` | 202、201、203；`unconfirmedCount = 1` |
| 依服務範圍＋待確認 | 同上，加 `includeUnconfirmed=true` | `list-service-area-include-unconfirmed-response.json` | 204 列在最後，`areaMatch = UNCONFIRMED` |
| 名稱關鍵字 | `q=輔具` | `list-keyword-response.json` | 名稱包含「輔具」的 4 家 |
| 空結果 | `serviceType=HOME_MEDICAL_NURSING&city=新北市&district=烏來區&areaFilter=LOCATED_IN` | `list-empty-response.json` | `items = []`、建議洽 1966 |
| 超出頁數 | `serviceType=ASSISTIVE_DEVICE&city=新北市&areaFilter=LOCATED_IN&page=2&pageSize=20` | `list-page-out-of-range-response.json` | `items = []`、`totalCount = 3` |

錯誤（皆 `VALIDATION_ERROR`，HTTP 400）：`errors/unsupported-city`（桃園市）、`district-mismatch`（臺北市＋三重區）、`district-without-city`、`include-unconfirmed-without-service-area`、`invalid-page-size`（100）、`unknown-parameter`（`sort=distance`）。找不到單一服務單位沿用 `errors/provider-not-found-response.json`。

### 一致性規則（`node contracts/mock/providers/lookup/validate-fixtures.mjs`）

1. 列表項目只有 §10a 的 13 個欄位，與 `providers/<id>.json` 同名欄位值完全相同；沒有座標、狀態、時間戳、排名、距離或推薦原因。
2. `serviceAreaStatus` 與 `serviceAreas` 一致（有範圍 → `VERIFIED`）。
3. `appliedFilters` 等於 request 補上預設值後的結果；`unconfirmedCount` 只在 `SERVICE_AREA` 為數字。
4. `LOCATED_IN` 項目的所在地符合條件；`SERVICE_AREA` 的 `VERIFIED` 項目確實有涵蓋該地區的範圍，`UNCONFIRMED` 只在 `includeUnconfirmed=true` 時出現且排在最後；同組內依縣市 → 行政區 → id 排序。
5. `notice` 不含「最近」「附近」「適合您」「一定可」。
6. **同機構對照**：`PROV-MOCK-204` 在依所在地查詢中可見，但不在 `recommendations/ASSISTIVE_DEVICE.json`（三重區）的推薦中。

所有名稱、電話、網址皆為測試資料，不代表真實單位。這不是後端或真實 API 驗收。
