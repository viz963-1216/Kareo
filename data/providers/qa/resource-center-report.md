# A-007 Assistive Device Resource Centers Data Report

- Task: TASK-A-007 — Assistive Device Resource Centers Data
- Submission version: A-007-r1
- Scope: Taipei City / New Taipei City
- Updated: 2026-10-03

## Result

Five public assistive-device resource centres have been added as query-only resources.

- Taipei City: 3 centres
- New Taipei City: 2 centres
- Provider type: `OTHER`
- Resource category: `ASSISTIVE_DEVICE_CENTER`
- `ProviderService`: none
- Recommendation / matching eligibility: excluded

`verified: true` means the centre identity details were checked against the stated official source. It does not mean that the coordinate has been verified.

## Official sources

| Source ID | Official source | Use |
|---|---|---|
| SRC-011 | 臺北市輔具服務－輔具中心（臺北市政府社會局） | Taipei centre identity details and officially published district service areas |
| SRC-012 | 新北市輔具中心及各分站據點服務項目列表（新北市輔具資源中心／新北市政府社會局） | New Taipei centre identity details and service information |

## Resource centres

| Provider ID | Name | City / District | Phone | Official source | Coordinate status |
|---|---|---|---|---|---|
| TP-ARC-001 | 臺北市合宜輔具中心（財團法人第一社會福利基金會承辦） | 臺北市／中山區 | 02-7713-7760 | SRC-011 | PENDING (`lat` / `lng` are `null`) |
| TP-ARC-002 | 臺北市西區輔具中心（財團法人伊甸社會福利基金會承辦） | 臺北市／中山區 | 02-2523-7902 | SRC-011 | PENDING (`lat` / `lng` are `null`) |
| TP-ARC-003 | 臺北市南區輔具中心（財團法人第一社會福利基金會承辦） | 臺北市／信義區 | 02-2720-7364 | SRC-011 | PENDING (`lat` / `lng` are `null`) |
| NTPC-ARC-001 | 新北市輔具資源中心（蘆洲） | 新北市／蘆洲區 | 02-8286-7045 | SRC-012 | PENDING (`lat` / `lng` are `null`) |
| NTPC-ARC-002 | 新北市輔具資源中心（新店） | 新北市／新店區 | 02-2912-1911 | SRC-012 | PENDING (`lat` / `lng` are `null`) |

## Official district service areas

Only districts explicitly published by an official source were added as `ProviderServiceArea` records.

| Provider ID | Official district service areas | Evidence |
|---|---|---|
| TP-ARC-001 | 北投區、士林區、中山區、大同區 | SRC-011 |
| TP-ARC-002 | 中正區、萬華區、大安區、松山區 | SRC-011 |
| TP-ARC-003 | 信義區、內湖區、南港區、文山區 | SRC-011 |
| NTPC-ARC-001 | None recorded | SRC-012 does not provide an explicit district coverage list |
| NTPC-ARC-002 | None recorded | SRC-012 does not provide an explicit district coverage list |

## Coordinate status and limitation

All five centres remain coordinate-pending. No coordinate is inferred from a Google Maps link or from the registered address.

Future coordinate work must use the same reproducible official address-point method as A-003:

- Taipei City: `SRC-COORD-TPE-001` with the EPSG:3826 conversion evidence.
- New Taipei City: `SRC-COORD-NTPC-001` with an exact house-number match and the EPSG:3826 conversion evidence.

Until that evidence is recorded, these centres must not be treated as distance-sortable.

## QA result

The following checks pass after this update:

```text
node data/providers/qa/validate-providers.mjs
node data/providers/qa/verify-coordinates.mjs --write
node --test data/providers/qa/tests/validate-providers.test.mjs
node --test data/providers/qa/tests/verify-coordinates.test.mjs