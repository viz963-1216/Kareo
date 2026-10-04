# J-003-r11 — Central module integration (not full MVP acceptance)

Jerry authorized takeover of current A/B/C/J tasks on 2026-10-04. Work stays on `integration/kareo-complete-oct04`; no direct staging/main push. No real user assessments or leads, no purchase, no formal consent activation.

## Exact inputs

| Task | PR | Included source head |
|---|---|---|
| A-007-r1 | #70 | a9ab40695bcabd74021f170a4656c902c2e4c7bb |
| B-012-r7 | #48 | cab4d3f8919d569f137a3450b511392db486c7ee |
| B-011b-r5 | #55 | b1ba906410ef3895ca3526f2d056afd8e5aba373 |
| B-013-r3 | #57 | 5a9f929ab1d5ebd7ae8efe770cd6db0eb3e1b117 |
| B-014-r3 | #67 | f9f361f1e70df3c3b3e41586d9c7e7ec89e2d404 |
| C-007-r3 | #58 | fc957eab7a7835014cb84682143ddae76b9793ab |

Each input is retained as a merge ancestor. Repository conflicts preserve both ContentPack/admin methods and public Knowledge lookup methods; headers retain both admin tokens and client-IP parsing.

## Changes / submission revisions

- A-007-r2: five official building address points, reproducible EPSG:3826 conversion, source response hashes, generated report, immutable original 30 providers / 30 services / 86 areas / 19 contract-region records. Existing source snapshots are preserved; Taipei uses previously verified CRS metadata because ArcGIS DNS was unavailable this round. New Taipei official district service coverage is still unknown.
- B-012-r8: 16 KB UTF-8 limit before JSON parsing, persistent login/IP/operator quotas across all ten admin endpoints. Failed valid-JSON logins count. Excess traffic returns 429 with Retry-After and no-store before business mutation. Switching tokens cannot reset operator quotas. Import/backfill consistency fixes from r7 remain.
- B-011b-r6: central shared-security integration; security migration renamed 0021 before cloud application. Existing seven-day deletion deadline and retention tests preserved.
- B-013-r4: persistent 120/hour/IP-hash quota; cheap query validation precedes I/O; resource migration renamed 0022; import tests accept the real 35-resource inventory while preserving the original recommendable count and explicit resource categories.
- B-014-r4: persistent 120/hour/IP-hash quota, repository interface coexistence, withdrawal metadata test fixtures synchronized.
- C-007-r3: original UI/code/78 tests retained, no central UI behaviour changes.
- J-003-r11: ARCHITECTURE/API quota definitions synchronized under delegated technical authority, data evidence/integrity checks added to CI. No tests weakened to treat missing real E2E as success.

## Local evidence (exact combined branch)

| Check | Result |
|---|---|
| API source typecheck | PASS |
| API tests | 698 PASS, 0 FAIL |
| API strict source and test typecheck | PASS after synchronizing two cross-module fixtures |
| Web typecheck / tests | PASS / 78 PASS |
| Real web build | PASS |
| Fresh isolated DB | 24 PASS (19 behaviour / 5 schema), 0 FAIL |
| Upgrade from 0018 isolated DB | 28 PASS (23 behaviour / 5 schema), 0 FAIL |
| Static route / contract coverage | 25 PASS, 0 PENDING, 0 FAIL |
| Bundled functions ESM and CJS | 86 PASS, 0 PENDING, 0 FAIL |
| Root adapter/script tests / release smoke unit tests | 62 PASS / 3 PASS |
| Dev gate | 115 PASS, 0 FAIL, 49 PENDING; historical E2E ignored |

Security regression tests: 22 new tests, including each admin write blocked by operator quota, all admin endpoints blocked before authentication by IP quota, login attempt 21, public request 121, UTF-8 body before parsing, separate IP/operator/window. Original route tests isolate rate-limit persistence; the new handler tests exercise actual counters and middleware.

A-007 original-data regression tests: deletion of an old coverage row, changed old provider coordinates, center accidentally given a service, and stale generated report all fail. Coordinate/data tests will be rerun after the five new points are written.

## Deployment and operation limits

As of 2026-10-04, cloud has migrations through 0018, 30 providers/30 services/86 areas, 21 published KnowledgeRecord members; no operators, assessments, consents or leads. Existing project `ojawadobnaxduxybqolk` is now designated staging/acceptance by Jerry. Supabase scheduled backup shown: 2026-10-03 20:57:14 UTC. New production project deferred after quoting estimated US$10/month.

Netlify dashboard says production deploys paused for exhausted credits while existing published sites remain live. Source currently published is `8f509c0`. Preview deployment is unverified until the central PR runs. No credits purchased.

Integrated remains NO. D-05 remains DRAFT. Actual cloud migration/backfill/import, crawler/cleanup schedule, public/admin/browser E2E, consent final approval, rights/lead/recovery drill and eventual isolated production release remain required. Local tests above cannot be copied into the 49 deployment E2E cases.
