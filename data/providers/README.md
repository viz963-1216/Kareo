# Kareo Provider Data

本目錄存放 Kareo MVP 使用的 Provider 測試資料與資料整理格式。

目前資料僅供開發、測試與後續匯入使用，不代表正式長照服務單位名單，也不代表政府認證或推薦。

---

## 1. Provider

Provider 代表一個服務單位。

基本欄位：

| Field | Description |
|---|---|
| id | Provider 唯一識別碼 |
| name | 服務單位名稱 |
| type | Provider 類型 |
| address | Provider 實際地址 |
| city | Provider 所在縣市 |
| district | Provider 所在行政區 |
| lat | 緯度，可為空 |
| lng | 經度，可為空 |
| phone | 聯絡電話 |
| website | 官方網站，可為空 |
| googleMapsUrl | Google Maps URL，可為空 |
| status | Provider 狀態 |
| verified | 是否已確認基本資料 |
| createdAt | 建立時間，ISO 8601 |
| updatedAt | 更新時間，ISO 8601 |

### Provider Type

只能使用：

- `HOME_CARE`
- `HOME_MEDICAL_NURSING`
- `ASSISTIVE_DEVICE`
- `OTHER`

`TRANSPORTATION` 不建立 Provider 資料，MVP 直接連結 Kareocar 外部服務。

### Provider Status

只能使用：

- `ACTIVE`
- `INACTIVE`
- `UNKNOWN`

只有 `ACTIVE` Provider 可供後續推薦流程使用。

### verified

`verified` 必須使用 Boolean：

- `true`
- `false`

`verified=true` 只代表平台已確認基本資料，不代表政府認證或正式資格核定。

---

## 2. ProviderService

ProviderService 用來描述 Provider 提供哪些服務。

欄位：

| Field | Description |
|---|---|
| id | ProviderService 唯一識別碼 |
| providerId | 對應 Provider ID |
| serviceType | 服務類型 |
| active | 此服務是否啟用 |

Service Type：

- `HOME_CARE`
- `HOME_MEDICAL_NURSING`
- `ASSISTIVE_DEVICE`

---

## 3. ProviderServiceArea

ProviderServiceArea 用來描述 Provider 實際提供服務的行政區域。

欄位：

| Field | Description |
|---|---|
| id | ProviderServiceArea 唯一識別碼 |
| providerId | 對應 Provider ID |
| city | 服務縣市 |
| district | 服務行政區 |
| active | 此服務範圍是否啟用 |

---

## 4. Provider 地址與 Service Area

Provider 的 `address`、`city`、`district` 表示服務單位本身所在的位置。

ProviderServiceArea 表示該服務單位實際提供服務的區域。

兩者必須分開，不得直接將 Provider 地址視為服務範圍。

例如：

```text
Provider 地址：
新北市三重區

Provider Service Area：
新北市三重區
新北市蘆洲區

---

## 5. 座標、服務範圍與 QA（TASK-A-003）

- `lat`／`lng` 只填**有完整證據**的 WGS84 座標；證據在 `qa/a-003-evidence.json`（官方名單核對名稱／地址＋官方門牌點原始紀錄＋座標轉換）。無法驗證者保持 `null`。
- 「非 null」不等於「已驗證」；缺證據的非 null 座標會讓檢查失敗。
- 不得使用 Google Maps 搜尋結果、行政區中心或推估座標，也不得由地址推測服務範圍；唯一例外是 Jerry 已於 DEC-A003-07 核准的 NTPC-AD-004 商家座標，必須保留在 `unofficialCoordinates` 且不得標為官方門牌點。
- 簽約縣市、機構地址或醫院本體服務區域都不是行政區服務能力。沒有逐區證據時，記錄在 `conditionalServiceRegions` 與 `pending`，不得建立 active ProviderServiceArea 或推薦候選。
- 目前統計、覆蓋率與待補清單：`qa/verified-coordinates-report.md`、`qa/pending-verification.md`。這些檔案標示 `A003:BEGIN／END` 的區塊由程式產生。

檢查指令：

```bash
node data/providers/qa/validate-providers.mjs
node data/providers/qa/verify-coordinates.mjs
node --test 'data/providers/qa/tests/*.test.mjs'
```

修改資料或證據後，先執行 `node data/providers/qa/verify-coordinates.mjs --write` 重新產生報告區塊，再執行檢查。證據檢查失敗時，程式不會寫入報告。
