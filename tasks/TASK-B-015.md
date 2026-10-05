# TASK-B-015 — Protected privacy rights operations

Owner: Jerry central integration (authorized to implement B/C/J gaps, 2026-10-05)
Submission Version: B-015-r1
Status: Implementation and local verification complete; PR CI/cloud application pending; no production activation

## Scope and authorization
User requested completing D-05 implementation and verification. Allowed: apps/api/src/{scripts,services,repositories}/ privacy-rights files, forward SQL migration, relevant API/local/DB tests, docs/contracts/tasks; J connects tests and deployment. No public privacy-administration API, no new paid project, no secret or real personal data in GitHub, no production release.

## Inputs and behavior
DATA_STEWARD personal key via environment; private request file with controlled request reference, received/verified timestamps, ORIGINAL_CONTACT_CONFIRMED or AUTHORIZED_PROXY_CONFIRMED and separate proxy authority reference. Knowing a Lead/session identifier is never proof. Operator must complete the human verification in PRIVACY_REQUEST_RUNBOOK before attesting. Exact target only; no name/telephone enumeration.

EXPORT writes an exclusive private 0600 JSON file, not stdout; exclude tokens/key hashes/other users. CORRECT_CONTACT changes only the verified Lead's name/phone. CORRECT_ASSESSMENT accepts a full corrected input through the existing validator and rule engine, binds current row timestamp and PUBLISHED knowledge, replaces its profile and removes stale recommendations; stop unresolved outreach based on that assessment using DATA_CORRECTED. STOP/DELETE invalidate the session and contacts with existing withdraw/delete RPCs. All successful operations and read access have a minimal transactional audit, unique request id, no original values or mail body. Conflicting reuse fails; no silently replayed correction.

Privacy operation audit: retain only controlled references, IDs, action/time/verification classification and result counts; retention 1 year after execution, reviewed for early erasure when no longer needed, never assume anonymous. This follows the existing operational-case planning ceiling, not a statutory mandate. Exact request/identity documents stay in the restricted case record; do not copy them into the database audit.

## Verification
Wrong key/role/revoked operator, missing verification, forged target, stale correction, wrong published version, conflicting request id, audit failure rollback, exact export scope/no token leak, corrected real engine output and stale recommendation removal, stop/delete with lost token, cleanup and retry. Actual PostgreSQL/PostgREST+CLI verification; local result is not deployed E2E. D-05 ACTIVE waits for remaining vendor/journal/deployment conditions.

Local results: 46/46 actual HTTP+CLI, 10 SQL regressions; full backend suite 740 PASS; isolated fresh database 24 PASS (19 behaviour / 5 schema), final submitted head also verified by PR CI. See docs/acceptance/D05-2026-10-05-privacy-rights.md.
