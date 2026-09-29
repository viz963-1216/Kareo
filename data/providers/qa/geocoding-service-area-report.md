# A-003 Provider Geocoding + Service Area QA Report

> **Status (A-003-r6, 2026-09-29):** Sections 1, 3 (Taipei) and 4 are the r1 QA and still apply.
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
- ProviderServiceArea 筆數：84
- lat/lng 非 null：13
- 有完整驗證證據的座標：13（名稱／地址核對＋官方門牌點＋可重現轉換，見 `qa/a-003-evidence.json`）
- 非 null 但缺證據：0
- 尚待驗證座標：17
- 缺 ProviderServiceArea 的 ACTIVE Provider：15
- 服務類型 × 行政區組合：24；DISTANCE READY：12（HOME_CARE × 新北市三重區、HOME_CARE × 新北市土城區、HOME_CARE × 新北市中和區、HOME_CARE × 新北市五股區、HOME_CARE × 新北市永和區、HOME_CARE × 新北市板橋區、HOME_CARE × 新北市林口區、HOME_CARE × 新北市泰山區、HOME_CARE × 新北市新店區、HOME_CARE × 新北市新莊區、HOME_CARE × 新北市樹林區、HOME_CARE × 新北市蘆洲區）
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
EPSG:3826) matched to the Provider's official address, never from Google Maps, district centres
or inference. The method is in `qa/verified-coordinates-report.md`.

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

### HOME_MEDICAL_NURSING

No district-level Provider Service Area records were created because the available official source does not provide Provider-specific district-level coverage.

### ASSISTIVE_DEVICE

No Provider Service Area records were created for assistive-device Providers when the official source did not provide Provider-specific district-level coverage.

Provider physical addresses were not used to infer service coverage.

Both gaps are listed per Provider in `qa/pending-verification.md`.

## 4. Google Maps URL QA

- Providers checked: 30
- Providers with Google Maps URL: 30
- Missing Google Maps URL: 0
- URL format: Google Maps Search URL
- Result: PASS

Google Maps search URLs were generated from each Provider's existing address using the same URL pattern already used by the Provider sample dataset.

A manual usability check was performed for `TP-HC-001`, and the generated URL successfully opened the corresponding address in Google Maps.

No Provider coordinates were inferred from Google Maps search results.
