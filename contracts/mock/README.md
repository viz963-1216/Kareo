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

## Admin Knowledge fixtures（2026-09-24，D-16）

供 C-006 管理頁面 Mock 驗收，格式依 API_CONTRACT §26。`contracts/mock/admin/`：`session-response`、`knowledge-status-response`、`knowledge-changes-response`、`knowledge-records-response`、`knowledge-publish-response`。所有內容為測試資料（`*-MOCK-*`），不代表真實版本或制度。錯誤情境沿用 API_CONTRACT §5 通用錯誤格式。

### 身心障礙福利補助 fixture（2026-09-24，D-17）

`assessments/WITH-DISABILITY-NEW_TAIPEI.json`：使用者勾選領有身心障礙證明（`disabilityCertificate = YES`）時的 summary 範例（ASSESSMENT_RULES §6.5）。金額取自 KR-2026-018（待審核）與 KR-2026-016，只示範格式。第 3 行為省略標記，不是實際輸出。

### 個人自付估算 fixture（2026-09-24，D-17a）

`assessments/WITH-ESTIMATE-GENERAL-NEW_TAIPEI.json`：使用者選「一般戶」、勾選領有身心障礙證明時的 summary 範例（ASSESSMENT_RULES §6.6）。括號「……略……」行為省略標記。金額依已核准知識計算，只示範格式。
