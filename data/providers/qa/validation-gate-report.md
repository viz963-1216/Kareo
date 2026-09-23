# A-004 Provider Validation Gate Report

## Submission

- Task: A-004 Provider Validation Gate
- Submission Version: A-004-r2
- Owner: Engineer A
- Branch: feat/a-004-provider-validation-gate

## Changes in A-004-r2

A-004-r1 validated ProviderService with `providerId` / `serviceType` only. All 30 formal
ProviderService records were missing `id` and `active`, yet the gate reported PASS while the
B-004 import rejected 30/30. A-004-r2 fixes the gate and the data:

- ProviderService now requires `id` (non-empty string, no whitespace, unique within
  `provider-services.json`) and `active` (boolean; `false` is valid).
- `Provider.type` and `ProviderService.serviceType` use separate allowlists
  (DATA_MODEL §17 / §18). `Provider.type=OTHER` is accepted; `serviceType=OTHER` is rejected.
- `Provider.verified` must be boolean (same rule as B-004).
- ProviderService / ProviderServiceArea must reference a Provider that exists **and** passed
  validation (same rule as B-004).
- Every error names the file, record index, record id / providerId and field.
- Unreadable or non-array input fails with exit 1.
- The gate also accepts a dataset directory: `node validate-providers.mjs <dir>`.

## Validation Coverage

Provider (`providers.json`, DATA_MODEL §17):

- `id`, `name`, `address`, `city`, `district`: non-empty string; `id` has no whitespace
- `type`: `HOME_CARE` / `HOME_MEDICAL_NURSING` / `ASSISTIVE_DEVICE` / `OTHER`
- `status`: `ACTIVE` / `INACTIVE` / `UNKNOWN`
- `verified`: boolean
- `lat` -90..90, `lng` -180..180 (or null)
- `website`, `googleMapsUrl`: http(s) URL (or null)
- `phone`: basic phone format (or null)
- address contains `city` and `district`
- `id` unique within providers.json

ProviderService (`provider-services.json`, DATA_MODEL §18):

- `id`: non-empty string, no whitespace, unique within provider-services.json
- `providerId`: references a valid Provider
- `serviceType`: `HOME_CARE` / `HOME_MEDICAL_NURSING` / `ASSISTIVE_DEVICE`
- `active`: boolean (`true` or `false`)
- `providerId` + `serviceType` pair unique

ProviderServiceArea (`provider-service-areas.json`, DATA_MODEL §19):

- `id`: non-empty string, no whitespace, unique within provider-service-areas.json
- `providerId`: references a valid Provider
- `city`, `district`: non-empty string
- `active`: boolean

ID uniqueness is scoped per table, matching the primary keys in B-004 migration `0004_provider.sql`.

## ProviderService ID Rule

Formal ProviderService IDs are derived deterministically as:

`PSV-{providerId}-{serviceType}`

Example: `PSV-TP-HC-001-HOME_CARE`. `PSV-` is the DATA_MODEL §32 prefix. Because
`providerId` + `serviceType` is unique, the ID is stable across re-runs and re-imports.

## ProviderService `active` Evidence

`active` is set only where an official source was checked. See
`qa/provider-service-active-evidence.md` for the details on each record.

- 30 records: `active=true`, each confirmed in a current official list
  (NTPC-HC ×5 via the SRC-002 1150916 list from 新北市高齡長期照顧處)

## Formal Dataset Validation

Command:

`node data/providers/qa/validate-providers.mjs`

Result:

- Providers: 30
- Provider Services: 30
- Provider Service Areas: 81
- Errors: 0
- Result: PASS
- Exit Code: 0

## B-004 Parity

B-004 `importProviderDataset` was run in `dry-run` mode with a stub repository (no database
connection) on the same datasets:

| Dataset | B-004 | A-004 |
|---|---|---|
| Formal staging, before r2 data fix | REJECT (services 0 valid / 30 rejected) | FAIL (60 errors) |
| Formal staging, A-004-r2 | ACCEPT (providers 30, services 30, service areas 81) | PASS |
| Valid minimal dataset | ACCEPT | PASS |
| Service `active=false` | ACCEPT | PASS |
| Service missing `id` / missing `active` / `active="true"` | REJECT | FAIL |
| Service unknown `providerId` / `serviceType=OTHER` | REJECT | FAIL |
| Provider `type=OTHER` | ACCEPT | PASS |
| Provider `type=TRANSPORTATION` / missing `verified` | REJECT | FAIL |
| ServiceArea missing `active` | REJECT | FAIL |

## Regression Tests

Command:

`node --test data/providers/qa/tests/validate-providers.test.mjs`

Result: 18 tests, 18 pass. Tests use temporary directories only and never touch a database.

Covered: missing / empty / whitespace / non-string / duplicate ProviderService `id`; per-table
id scope; missing and non-boolean `active`; `active=false` passes; unknown and invalid-Provider
`providerId`; invalid `serviceType` (including `OTHER`, `TRANSPORTATION`); duplicate pair;
Provider `type=OTHER` passes; `type=TRANSPORTATION` fails; `verified` boolean; ServiceArea
`active`; unreadable input; formal service IDs follow the documented rule.

## Invalid Fixture Validation

Command:

`node data/providers/qa/validate-providers.mjs data/providers/qa/fixtures/providers-invalid.json`

Result: 13 errors, FAIL, exit 1. The errors are the 9 Provider field errors from r1, plus the
fixture service missing `id` / `active`, and the service and service area referencing a
Provider that failed validation.

## CI / Import Readiness

- Exit Code `0`: validation passes
- Exit Code `1`: any validation error or unreadable input

`scripts/check-provider-data.mjs` (CI "Provider data gate") runs this script by path.

## Scope Check

- Backend changes: No
- Schema changes: No
- API changes: No
- UI changes: No
- Modified outside `/data/providers/**`: Yes, `apps/api/tests/providerImport.test.ts` only
  (B-004 test that asserted the old defective data state; changed with Jerry's approval)

## Known Issues

- NTPC-HC-003 `phone` differs from the SRC-002 1150916 list. See
  `qa/provider-service-active-evidence.md`; the phone was not changed here.
