# A-003 Provider Geocoding + Service Area QA Report

> **Status (A-003-r10, 2026-09-29):** Sections 1, 3 (Taipei) and 4 are the r1 QA and still apply.
> The r1 geocoding result ("0 verified coordinates, all lat/lng null") and the r1 New Taipei
> Service Area result ("PENDING", "NTPC-HC-003 has no district-level source") are **superseded**
> and kept below only as history, marked *(r1, superseded)*. Current figures are generated from
> the data and evidence by `qa/verify-coordinates.mjs`:
>
> - Coordinates and coverage: `qa/verified-coordinates-report.md`
> - Missing data, sources checked, reasons, next steps: `qa/pending-verification.md`
> - Machine-readable evidence: `qa/a-003-evidence.json`

## Current Figures (generated)

<!-- A003:BEGIN summary -->
- Provider 總數：30
- ProviderServiceArea 筆數：516
- lat/lng 非 null：29
- 有完整驗證證據的座標：29（名稱／地址核對＋官方門牌點＋可重現轉換，見 `qa/a-003-evidence.json`）
- 非 null 但缺證據：0
- 尚待驗證座標：1
- 缺 ProviderServiceArea 的 ACTIVE Provider：0
- 依指示建立的平台設定服務範圍（非官方證實）：430 筆（DEC-A003-01、DEC-A003-02）
- 服務類型 × 行政區組合：77；DISTANCE READY：36（HOME_CARE × 新北市三重區、HOME_CARE × 新北市土城區、HOME_CARE × 新北市中和區、HOME_CARE × 新北市五股區、HOME_CARE × 新北市永和區、HOME_CARE × 新北市板橋區、HOME_CARE × 新北市林口區、HOME_CARE × 新北市泰山區、HOME_CARE × 新北市新店區、HOME_CARE × 新北市新莊區、HOME_CARE × 新北市樹林區、HOME_CARE × 新北市蘆洲區、HOME_CARE × 臺北市士林區、HOME_CARE × 臺北市大同區、HOME_CARE × 臺北市大安區、HOME_CARE × 臺北市中山區、HOME_CARE × 臺北市中正區、HOME_CARE × 臺北市內湖區、HOME_CARE × 臺北市文山區、HOME_CARE × 臺北市北投區、HOME_CARE × 臺北市松山區、HOME_CARE × 臺北市信義區、HOME_CARE × 臺北市南港區、HOME_CARE × 臺北市萬華區、HOME_MEDICAL_NURSING × 臺北市士林區、HOME_MEDICAL_NURSING × 臺北市大同區、HOME_MEDICAL_NURSING × 臺北市大安區、HOME_MEDICAL_NURSING × 臺北市中山區、HOME_MEDICAL_NURSING × 臺北市中正區、HOME_MEDICAL_NURSING × 臺北市內湖區、HOME_MEDICAL_NURSING × 臺北市文山區、HOME_MEDICAL_NURSING × 臺北市北投區、HOME_MEDICAL_NURSING × 臺北市松山區、HOME_MEDICAL_NURSING × 臺北市信義區、HOME_MEDICAL_NURSING × 臺北市南港區、HOME_MEDICAL_NURSING × 臺北市萬華區）
<!-- A003:END summary -->

## Overview

This report documents the QA for the A-002 Provider Dataset.

Scope:

- Provider geocoding verification
- Provider address / city / district consistency
- Provider Service Area verification
- Google Maps URL usability
- Unverifiable data tracking

## 1. Address Consistency QA

- Providers checked: 30
- Address / City / District mismatch: 0
- Result: PASS

All 30 Provider records have addresses consistent with their `city` and `district` fields.

## 2. Geocoding QA *(r1, superseded)*

r1 recorded 0 verified coordinates and all `lat`／`lng` as `null`. That is no longer true; see
"Current Figures" above. r1 did not establish a verified address-to-coordinate workflow. From r4
onwards, coordinates come only from official address-point records (新北市門牌位置數值資料,
EPSG:3826; 臺北市門牌位置數值資料, EPSG:3826 confirmed by the 民政局 house-number map layer in r7)
matched to the Provider's official address, never from Google Maps, district centres or inference. The method is in `qa/verified-coordinates-report.md`.

## 3. Service Area QA

### Referential Integrity

- Every ProviderServiceArea references an existing Provider (enforced by `qa/validate-providers.mjs`).
- Result: PASS

### Taipei HOME_CARE Verification (r1, still applies)

- Providers checked: 10
- Service Area records checked: 61
- Source: SRC-001
- Official source field: 特約服務區域
- Address-derived Service Areas: 0
- Result: PASS

The 61 Service Area records for the 10 Taipei HOME_CARE Providers were checked against the official Taipei source.

The number and districts of the Service Area records matched the official `特約服務區域` information.

Provider physical addresses were not used to infer Service Areas.

### New Taipei HOME_CARE (r6)

- Source: SRC-002, `114~116年新北市長照特約單位名單1150924(居家服務、居家喘息、短照服務).pdf`, field `可提供服務區域` (retrieved 2026-09-29)
- Providers checked: 5 (NTPC-HC-001 … 005)
- Result: PASS. All 23 Service Area records match the official list district by district. This is checked automatically against `qa/a-003-evidence.json`.
- r6 added `NTPC-HC-003` 新莊區、三重區、林口區 from the same list (序號 291).
- *(r1, superseded)* r1 marked these records PENDING and said NTPC-HC-003 had only city-level coverage. The city-level value came from the 名冊 (SRC-006); the contract list gives district-level areas.

### HOME_MEDICAL_NURSING (r8)

- `TP-HMN-002` 臺北市立聯合醫院附設陽明居家護理所: 士林區、北投區, from SRC-007 (臺北市衛生局「長照專業服務-特約服務單位一覽表」序號 49; name and address match).
- `TP-HMN-001` and `TP-HMN-003`: SRC-007 lists the parent hospitals (馬偕紀念醫院「全區」, 臺大北護分院「萬華區、大同區、中正區」). Per the instruction recorded as DEC-A003-02 (2026-09-29), those areas are applied to the affiliated home-nursing agencies as a **platform setting**. The official source confirms the hospitals' areas, not the agencies'.

### ASSISTIVE_DEVICE (r8)

None of the official sources (SRC-004, SRC-005) has vendor-level service districts: residents may buy or rent from any contracted vendor. Per the instruction recorded as DEC-A003-01 (2026-09-29), each vendor's service areas are set to every district of each city it is contracted with. This is a **platform setting**, not an officially confirmed service capability:

- 臺北市 contracts come from SRC-004 (12 districts).
- 新北市 contracts come from SRC-005 (29 districts).
- Vendors contracted with both cities get both.

Addresses were not used to infer service areas.

Every instruction is recorded in `qa/a-003-evidence.json` (`decisions`), with the verbatim excerpt, the session ID and a scope check. The conversation cannot confirm whether the instructing user is Jerry; Jerry should confirm in PR review.

### Service-area basis (generated)

<!-- A003:BEGIN service-area-basis -->
| Provider 類型 | 官方來源直接證實（本檔證據） | 官方來源（A-003-r1 人工核對 SRC-001，未列入本檔證據） | 依指示建立的平台設定（非官方證實） | 合計 |
| --- | --- | --- | --- | --- |
| HOME_CARE | 23 | 61 | 0 | 84 |
| HOME_MEDICAL_NURSING | 2 | 0 | 15 | 17 |
| ASSISTIVE_DEVICE | 0 | 0 | 415 | 415 |

- DEC-A003-01（415 筆；TP-AD-001、TP-AD-002、TP-AD-003、NTPC-AD-001、NTPC-AD-002、NTPC-AD-003、NTPC-AD-004、NTPC-AD-005、NTPC-AD-006、NTPC-AD-007、NTPC-AD-008、NTPC-AD-009）：ASSISTIVE_DEVICE 的 ProviderServiceArea 以特約簽約縣市的全部行政區建立：與臺北市簽約者納入臺北市 12 區，與新北市簽約者納入新北市 29 區，兩市都簽約者兩市都納入。
- DEC-A003-02（15 筆；TP-HMN-001、TP-HMN-003）：TP-HMN-001、TP-HMN-003 套用其醫院本體在 SRC-007 的服務區域：馬偕紀念醫院「全區」→ 臺北市 12 區；臺大北護分院「萬華區、大同區、中正區」。
<!-- A003:END service-area-basis -->

## 4. Google Maps URL QA

- Providers checked: 30
- Providers with Google Maps URL: 30
- Missing Google Maps URL: 0
- URL format: Google Maps Search URL
- Result: PASS

Google Maps search URLs were generated from each Provider's existing address using the same URL pattern already used by the Provider sample dataset.

A manual usability check was performed for `TP-HC-001`, and the generated URL successfully opened the corresponding address in Google Maps.

No Provider coordinates were inferred from Google Maps search results.
