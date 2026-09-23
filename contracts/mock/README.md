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
7. 依 MVP_DECISIONS D-07，fixtures 只提供 `DISTRICT_ROTATION`、`distanceKm = null`。

### 前端使用方式（C，`/apps/web/**`）

- 推薦：依 `serviceType` 讀取對應的 `recommendations/<serviceType>.json`；測試 0～3 家時取 `providers.slice(0, n)`，不要改動卡片內容或 ID。
- 詳細頁：以卡片的 `id` 讀取 `providers/<id>.json`；找不到檔案時回傳 `errors/provider-not-found-response.json`，畫面顯示找不到，不得改用其他單位的資料。
- 所有名稱、電話、網址都是測試資料（`example.com`、虛構電話），不代表真實單位。
