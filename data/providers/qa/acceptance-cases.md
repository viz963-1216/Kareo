# A-005 Provider QA Acceptance Cases

Submission Version: A-005-r2

## Purpose

本文件定義 Provider / Recommendation 的 QA 驗收案例，
供 Jerry 於 staging 執行 Integration / E2E 驗收。

Engineer A 僅負責 Provider QA Dataset 與 Acceptance Cases，
不負責 Recommendation Engine、Backend Implementation、
Frontend Automation 或全站 E2E 執行。

## Data Sources

本驗收案例依據以下 Provider 資料：

- `data/providers/staging/providers.json`
- `data/providers/staging/provider-services.json`
- `data/providers/staging/provider-service-areas.json`

Provider 是否符合服務區域，應依 `ProviderServiceArea` 判斷，
不得由 Provider 地址推測服務範圍。

正式 staging Provider 目前可能缺少已驗證的 `lat` / `lng`；
GPS 精確位置案例若無已驗證正式資料，必須使用 QA fixture，
不得自行猜測正式 Provider 座標。

## Acceptance Case Matrix

| Case | Scenario | Input | Expected Result |
|---|---|---|---|
| AC-001 | 0 家符合 Provider | 指定 serviceType 與位置條件，但沒有任何 ACTIVE Provider 同時符合服務類型與 Service Area | `success: true`；`providers: []`；依 API Contract §9 回傳既有 no-provider notice，不得以 `NO_PROVIDER_FOUND` 錯誤回應 |
| AC-002 | 1 家符合 Provider | 指定 serviceType 與位置條件，QA fixture 僅有 1 家 ACTIVE Provider 符合 | `providers` 僅包含該 1 家符合 Provider；不得補足至 3 家 |
| AC-003 | 2 家符合 Provider | 指定 serviceType 與位置條件，QA fixture 僅有 2 家 ACTIVE Provider 符合 | `providers` 僅包含該 2 家符合 Provider；不得補入不符合條件的 Provider |
| AC-004 | 3 家符合 Provider | 指定 serviceType 與位置條件，QA fixture 有 3 家 ACTIVE Provider 符合 | `providers` 包含 3 家符合 Provider；排序方式依既有 Recommendation Contract 決定 |
| AC-005 | 臺北市 Provider | `serviceType=HOME_CARE`，位置為臺北市萬華區；使用現有 ACTIVE Provider / ProviderService / ProviderServiceArea 資料 | 僅篩選具有 ACTIVE `HOME_CARE` 且 Service Area 包含臺北市萬華區的 Provider；不得以 Provider 地址代替 Service Area 判斷 |
| AC-006 | 新北市 Provider | `serviceType=HOME_CARE`，位置為新北市板橋區；現有 Service Area 包含 `NTPC-HC-002`、`NTPC-HC-004`、`NTPC-HC-005` 等符合資料 | 僅回傳具有 ACTIVE `HOME_CARE` 且 Service Area 包含新北市板橋區的 Provider；排序依既有 Recommendation Contract；不得因 Provider 地址位於其他行政區而排除其有效 Service Area |
| AC-007 | GPS 精確位置 | 使用者提供精確位置；Provider 座標使用 Recommendation 測試所提供的 synthetic / verified-coordinate test data，不修改或猜測正式 staging Provider 座標 | 當測試前提具備可用的已驗證 Provider 座標時，依既有 Contract 使用 `DISTANCE` 排序；`locationPrecision=GPS`；最多回傳 3 家；可回傳 `distanceKm`。不得使用正式資料中未驗證或缺失的座標計算距離。**A-005-r2：A-003-r2 尚未交付已驗證座標與覆蓋率報告，本案例目前 BLOCKED；不得自行產生座標或 `distanceKm`。** |
| AC-008 | District-only | `serviceType=HOME_CARE`，僅提供 city / district，沒有 GPS 精確位置 | 使用 `DISTRICT_ROTATION`；`locationPrecision=DISTRICT`；依 ACTIVE ProviderService 與 ProviderServiceArea 篩選；`distanceKm=null`；不得宣稱「最近」 |
| AC-009 | 無位置（r1 歷史案例） | Recommendation 輸入沒有 GPS、district 等可用位置資訊 | r1 原文：行為仍待 MVP_DECISIONS D-13 決議；A-005 不自行定義 Expected Result。此 r1 預期已由 A-005-r2 的 D13-B（2026-09-24 核准）取代；目前請依 D13-B 驗收。 |
| AC-010 | Service Area 不符合 | Provider 與 ProviderService 均為 ACTIVE，serviceType 符合，但 ProviderServiceArea 不包含使用者指定的 city / district | 該 Provider 不得列入推薦結果；不得使用 Provider 的 address / district 推測其服務範圍 |
| AC-011 | 缺少 lat/lng | 使用者具有精確位置，但候選 Provider 的 `lat` / `lng` 為 `null` 或不是已驗證座標 | 不得使用該 Provider 的未驗證／缺失座標進行 `DISTANCE` 計算，也不得產生虛構 `distanceKm` 或宣稱「最近」；正式資料目前屬 D-07 座標缺口 |
| AC-012 | Inactive Provider | Provider `status=INACTIVE`，即使 ProviderService 與 ProviderServiceArea 符合需求 | 該 Provider 不得被推薦；依 DATA_MODEL Provider Status 規則，只有 `ACTIVE` Provider 可被推薦 |
| AC-013 | Unknown Provider | Provider `status=UNKNOWN`，即使 ProviderService 與 ProviderServiceArea 符合需求 | 該 Provider 不得被推薦；`UNKNOWN` 不等同 `ACTIVE`，不得自行視為可推薦 Provider |
| AC-014 | Duplicate data | QA fixture 包含重複 Provider `id`、重複 ProviderService `id`、重複 `providerId + serviceType`，或重複 ProviderServiceArea `id` | Provider Validation Gate 必須判定 FAIL，回報對應 duplicate validation error，Exit Code 為 `1`；不得將重複資料視為有效 Provider Dataset |
| AC-015 | Invalid data | QA fixture 包含 A-004 Validation Gate 已定義的 invalid 欄位，例如缺少必要 `id`、`active` 非 boolean、未知 `providerId`、非法 `serviceType`、Provider `verified` 非 boolean，或非法 `lat/lng` | Provider Validation Gate 必須判定 FAIL，指出 file、record index、record id / providerId 與 field；Exit Code 為 `1`；invalid record 不得進入有效 Provider Dataset |

AC-007（GPS DISTANCE）r2 狀態：A-003-r2 尚未交付已驗證座標與覆蓋率報告，所以目前標示 BLOCKED；不得自行產生座標或 `distanceKm`。解阻後才可依 DISTANCE Expected 驗收。

---

## A-005-r2 Additions — D-13 Approved Cases（2026-09-24）

本節依 D-13（2026-09-24 核准）補齊 Expected。不自行新增 API Contract。

| Case | Decision Basis | Input | Expected | Must Not |
|---|---|---|---|---|
| D13-A | D-13（2026-09-24 核准） | 指定 `serviceType`（例如 `HOME_CARE`）；只有 `city`；沒有 `district`、沒有 GPS / lat / lng。`locationPrecision=CITY` | `rankingType=CITY_ROTATION`；`locationPrecision=CITY`；Provider 家數 0–3（ACTIVE Provider + `ProviderService.active=true` + Service Area 涵蓋該 city；不足 3 家不補足）；`distanceKm=null`（不可為數值）；notice 須說明**並非依實際距離排序**，並建議補行政區。只有 `DISTANCE` 才能顯示距離或宣稱依距離排序。同 session、同日排序穩定 | 不得使用 `DISTANCE` / `DISTRICT_ROTATION` / `NO_LOCATION`；不得宣稱「附近」「最近」或依距離排序；不得計算或顯示 `distanceKm`；不得以 Provider 地址代替 Service Area；不得因缺 district 回 Error；禁止純 Random |
| D13-B | D-13（2026-09-24 核准） | 沒有 GPS、沒有 city、沒有 district。`locationPrecision=NONE` | 前端不呼叫 Recommendation API；仍可完成 Assessment / 服務建議，並提醒提供縣市／行政區後可取得推薦。若 API 被直接呼叫：`rankingType=NO_LOCATION`；`locationPrecision=NONE`；Provider 家數 **0**；`distanceKm` 不可為數值；notice 須提醒提供縣市／行政區，並說明**並非依實際距離排序**；不得宣稱附近商家。只有 `DISTANCE` 才能顯示距離或宣稱依距離排序 | 前端不得在無位置時呼叫推薦 API；API 被直呼時不得回 1–3 家、不得用 `DISTANCE` / `CITY_ROTATION` / `DISTRICT_ROTATION`、不得以 `NO_PROVIDER_FOUND` 或 Error 取代空結果、不得顯示「附近」「最近」或依距離排序 |
| D13-C | D-13（2026-09-24 核准） | 使用者有 GPS / 精確位置（`locationPrecision=GPS` 或 `EXACT`）；候選 Provider **部分或全部**缺少已驗證 `lat`/`lng`（`null` 或未驗證）。使用正式資料或既有 QA fixture 的缺座標狀態，不捏造座標 | `rankingType=DISTRICT_ROTATION`；`locationPrecision` 維持使用者精度（`GPS` / `EXACT`）；Provider 家數 0–3（依 ACTIVE + 服務 active + Service Area）；全部 `distanceKm=null`；notice 須說明**並非依實際距離排序**，不得暗示已依 GPS 距離排序。只有 `DISTANCE` 才能顯示距離或宣稱依距離排序 | 不得使用 `DISTANCE`；不得計算、填入或顯示 `distanceKm`；不得顯示「距離約 X 公里」或「最近」；不得用地址／行政區中心點／未驗證座標推估距離；即使僅部分候選缺座標，也不得對其餘 Provider 顯示數值距離 |

---

## A-005-r2 Additional QA Case（非 D-13）

| Case | Decision Basis | Input | Expected | Must Not |
|---|---|---|---|---|
| AC-016 | 既有 Recommendation 篩選規則（非 D-13）；對應 r1 AC-012 為 Provider `status=INACTIVE`，本列為 Service 停用 | Provider `status=ACTIVE`；`ProviderServiceArea` 符合使用者位置；該 `serviceType` 的 `ProviderService.active=false`。建議用 district-only，避免綁到 BLOCKED 的 DISTANCE。使用 QA fixture，不改正式 Provider 資料 | 該 Provider 不得被推薦（結果中不得出現該 `providerId`）。`rankingType` / `locationPrecision` 依當次位置（district-only 時為 `DISTRICT_ROTATION` / `DISTRICT`）；該 Provider 計入家數為 0；其他 `active=true` 的符合 Provider 仍可出現（總數 0–3）；district-only 時 `distanceKm=null`；0 家時用既有 empty notice 語意 | 不得因 Provider 與 ServiceArea 都符合就推薦；不得把 `ProviderService.active=false` 當成可推薦；不得為湊滿 3 家而放行停用服務；不得修改正式 Provider 資料來製造此案例 |

---

## Notes

- 不自行定義新的 API Contract。
- 不修改 Backend / Frontend implementation。
- 不使用 Provider 地址推測 ProviderServiceArea。
- 不為正式 Provider 猜測 `lat` / `lng`。
- 真正 Integration / E2E 由 Jerry 執行。
- AC-007 GPS DISTANCE 目前 BLOCKED，待 A-003-r2 交付已驗證座標與覆蓋率報告。
- r1 AC-009 保留為歷史案例；此 r1 預期已由 D13-B 取代，目前請依 D13-B 驗收。
