# J-003-r30 — Real deployment foundations and cloud Provider rollback

**Integrated: NO.** On 2026-10-09, the designated existing Kareo acceptance deployment is `https://kareo-tw.netlify.app`, SHA `56500c835df2869ad7e4540f6f0730cb31ccbbcd`, release deploy `6ac7631c4b91470008fb7960`. This round accepts **6 of 49 required deployed cases**, with **43 PENDING and 0 FAIL** in that case set. The entire release gate is **121 PASS / 0 FAIL / 43 PENDING**, so it still fails. The 121 includes non-E2E checks and must never be described as 121 deployed cases.

Repository base: staging `97e275cd9f2db6f3d8a7560d42f7ddc93f268c38` after PR #117. This submission's tool/docs commit is not a new Netlify deployment. No Netlify build/deploy was triggered; production branch remains `release`. All results are tied to the actual existing public deployment and existing Kareo acceptance DB `ojawadobnaxduxybqolk`. Kareocar's project, credentials and data were not modified.

## Actual deployed cases

| Case | Result | Actual evidence |
|---|---|---|
| E2E-01 | PASS | Real empty Session returns possession token and future expiry; no token or Session ID in the receipt. |
| E2E-03 | PASS | A real unconsented Session sends only its ID to assessments; HTTP 403 / CONSENT_REQUIRED, before input parsing. No health/location/contact payload. |
| E2E-12 | PASS | Actual public card/detail/API fields agree; nonexistent resource shows Not Found; exact stored Maps link opens a new tab and Google Maps loads. |
| E2E-16 | PASS | Actual transportation GET returns exact Kareocar URL and NEW_TAB; homepage CTA and navigation each open a separate tab; both target pages load, with no iframe, login or reservation. |
| E2E-21 | PASS | Actual unknown API returns JSON 404 / NOT_FOUND. |
| E2E-27 | PASS | Current validated full Provider dataset matches cloud business fields; actual cloud import RPC rollback negative cases and positive control pass without retaining any fixture. |

Generated receipts: [foundation](../../tests/e2e/results/foundation-2026-10-09.json), [Provider detail](../../tests/e2e/results/provider-detail-2026-10-09.json), [transportation](../../tests/e2e/results/transportation-2026-10-09.json), [Provider import](../../tests/e2e/results/provider-import-2026-10-09.json). The foundation runner reads deployment markers before and after execution. The transportation actual GET was bracketed by matching markers at 07:58:10Z; its manual recorder also verifies the marker immediately after UI verification. Provider detail/card/API fields match for the actual 安毅 query; the Maps href is the exact stored URL and its actual new tab loads an address search, not a verified business place ID. The nonexistent resource API returns 404 / NOT_FOUND and UI displays 找不到這項資源. No other SHA/URL's evidence is imported.

## Empty Session cleanup

New narrow runner: `node tests/e2e/run-foundation-e2e.mjs --base-url=https://kareo-tw.netlify.app --commit=<exact SHA> --allow-empty-session-writes --out=<receipt>`. It is confined to the designated acceptance URL and exact marker. It creates one empty disposable Session, exercises the consent-denial path with an ID-only payload, and requests deletion in finally even if the negative request fails. It never submits consent, health, GPS, contact, recommendations or Lead data. The full main-flow runner's ACTIVE prerequisite is unchanged.

The deployed check ran 07:30:52–07:31:06Z. DELETE accepted a deadline within seven days; repeated use of its token was rejected. This alone is not physical deletion and not full E2E-37. Forged-token rejection also does not complete the genuine-expiry case E2E-17.

The normal protected cleanup workflow was then **manually rerun**: [run 37846636139, attempt 2](https://github.com/viz963-1216/Kareo/actions/runs/37846636139), job `113721799277`, checked-out commit `c3d12f3313a95f25162a1503be624f3b0617f8c0`. Its actual 07:42:37Z output: commit / SUCCESS; Sessions deleted 1; Lead contact clear 0; Leads deleted 0; Consents deleted 0. Do not present this manual rerun as a new autonomous scheduled execution.

A subsequent read-only DB aggregate confirmed: ACTIVE Sessions 6; DELETION_REQUESTED 0; DELETED tombstones 5; Consents 0; Assessments 0; Leads 0. Before this diagnostic, DELETED tombstones were 4; the single disposable empty Session is now cleared through the normal workflow. Session tombstones persist by design. The original foundation receipt remains unchanged; its at-time physicalDeletionVerified=false is correct. This follow-up does not prove deletion of persisted health/GPS/Lead records or removal from backups.

## Provider cloud integrity and rollback

A-004 gate: 1,118 Providers, 1,101 services, 2,517 service areas and 588 contract regions, zero errors. Official catalog and NTPC 366-entry source reconciliation pass. There are 1,117 ACTIVE Providers; the inactive suspended provider remains collected but is not recommended.

The exact validated dataset's four sorted scalar business-field MD5 digests match the cloud:

| Table | Count | Business-field digest |
|---|---:|---|
| providers | 1118 | 273ad92023d17148c85dacaef24f7d4b |
| provider_services | 1101 | 5166181f9e25965c75feae89f4ca4644 |
| provider_service_areas | 2517 | 2d6c0c1d273f611538585253a6f87a82 |
| provider_contract_regions | 588 | e6b4a85517ce9165df2e9c2b3659bf3c |

These dataset-to-cloud digests cover the compared scalar business fields, not timestamps/public_info or every metadata field. Separately, the rollback query compares **all full rows**, including metadata, before and after its operations within one short transaction.

Reproducible [cloud query](../../tests/db/verify-cloud-provider-rollback.sql), actually executed through the Supabase connector as service_role, with 3-second lock timeout and 10-second statement timeout, no DDL/grant/new RPC:

1. An invalid service FK after Provider insertion must roll back the Provider.
2. An invalid area FK after Provider and service insertion must roll back both earlier stages.
3. A valid 1-Provider / 1-service / 1-area positive control must actually write all three and return the counts; then an explicit disposable subtransaction exception rolls back the control.
4. Full-row digests of all four existing resource tables must be identical before/after; retained test Providers/services/areas must all be zero.

Actual result: verified_role=service_role, verification=ASSERTIONS_COMPLETED, counts 1118/1101/2517/588, retained test rows 0/0/0. This is a real cloud RPC verification through the connector, not a deployed importer HTTP call, and not a physical backup restore.

## Regional crawler and remaining conditions

See [Tokyo diagnosis](J003-2026-10-09-regional-crawler.md) and its original receipt. Backend-key compatibility was fixed without new grants or exposing keys: a rotated server credential must pass a zero-record HEAD at the own-project authority; JWT claims alone are insufficient. Anonymous/forged/foreign/user keys fail closed. Credentials are never forwarded to the two public government sites.

Actual protected Tokyo diagnosis: both unchanged careyou sources time out, HTTP 502 / OFFICIAL_SOURCE_TIMEOUT; actual region ap-northeast-1; anonymous HTTP 401. The dormant helper is not connected to daily operation. The real daily crawler still records 16 successes / 2 failures and 7 changes waiting for review; failed sources and publication boundaries are preserved. Issue #88 remains open.

Jerry explicitly declined creating the additional paid isolated physical-restore project on Oct 9, and requested other acceptance first. The purchase confirmation was canceled; no new project or existing DB overwrite occurred. The actual physical backup has not been restored in an independent environment and deletion replay has not been verified. This condition is retained, not replaced by a local logical snapshot or the empty-Session cleanup above.

D-05 remains OWNER_APPROVED_CONDITIONAL, activationAllowed=false, formal consent DRAFT. No health/Lead write or main-flow PASS is claimed. Full J-003 still requires the missing physical restore/deletion replay, the unresolved operational official sources, and each of the other 43 deployment cases, including the ACTIVE-consent main flow, failure/lifecycle cases and complete UI/device/keyboard operation. Local/backend success does not complete those cases.

## Verification of this submission

- Root scripts/adapter/safety tests: 113 PASS / 0 FAIL, including foundation cleanup-on-error and regional credential/timeout tests.
- Backend typecheck PASS; backend tests 774 PASS / 0 FAIL, including five regional-client tests (before the final documentation/comment-only changes).
- Real cloud Provider RPC negative/positive controls PASS; no retained fixture.
- Real deployment foundations, Provider card/detail/Not Found, transportation API and actual browser new-tab operations PASS for the cases listed above.
- Release gate: 121 PASS / 0 FAIL / 43 PENDING, exit failure expected. All 49 cases retained; current 6/49 accepted, Integrated NO.
- PR CI must also pass at the exact submitted head before merging. It does not count as deployed E2E or activate D-05.
