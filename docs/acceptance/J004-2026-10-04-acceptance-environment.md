# J-004-r4 — Existing acceptance environment and recovery preparation

2026-10-04. Scope: existing Kareo acceptance environment only; Integrated remains NO and release gate CLOSED.

## Confirmed environment decision

Jerry designated existing Kareo `ojawadobnaxduxybqolk` (Tokyo) as acceptance. After an estimated US$10/month quote for another project, Jerry explicitly deferred creation. No new project or subscription was purchased. Kareocar was not changed. Production isolation remains a release prerequisite.

## Modules merged

Central PR #71 is merged into staging at `9b3fc3036745052d2a16196c2ca4019de1440262`. Its source head is `4253d8accd26fa79cd4dc182df7c99eb490a6f3f`. Seven engineering CI jobs passed; the Netlify preview succeeded. Source PRs #48 / #55 / #57 / #67 / #58 / #70 are also merged because their commits are retained as ancestors. Local module tests and CI are recorded in `J003-2026-10-04-central-integration.md`; none substitutes for real E2E.

## Actual cloud changes and verification

Applied existing reviewed migrations in order, through the Supabase migration API:

| Repository file | Cloud history version | Cloud name |
|---|---|---|
| 0019_admin_knowledge_review.sql | 20261004100524 | kareo_0019_admin_knowledge_review |
| 0020_content_pack_persistence.sql | 20261004100548 | kareo_0020_content_pack_persistence |
| 0021_security_acceptance.sql | 20261004100554 | kareo_0021_security_acceptance |
| 0022_resource_lookup.sql | 20261004100556 | kareo_0022_resource_lookup |

Existing base migrations 0001/0002 predate the recorded migration history; repository schema numbering and the history's 20 rows are not interchangeable counts. Catalog checks confirmed the existing application objects and additions. All 28 application tables have RLS; anon/authenticated table grants are zero. Security advisors returned only 28 INFO `rls_enabled_no_policy` findings, consistent with this backend-only data model. Do not add anonymous policies to silence the notices; see [Supabase's explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

Provider import first executed the actual `importProviderDataset` validator and `toImportPayload` mapper locally. The captured validated payload then went through the actual protected `public.import_provider_dataset` cloud RPC in one transaction via the Supabase connector. No custom per-table insertion replaced that RPC. This is a connector-executed import, not an HTTP/SDK CLI or deployed-API E2E claim.

| Cloud data | Before | After |
|---|---:|---:|
| Providers/resources | 30 | 35 |
| Recommendation service records | 30 | 30 |
| Confirmed service-area records | 86 | 98 |
| Contract-region records | 0 | 19 |
| Assistive-device centers | 0 | 5 |
| Centers assigned recommendation services | 0 | 0 |
| Published knowledge records / version members | 21 / 21 | 21 / 21 |

Post-import queries compared all original 30 providers, 30 services and 86 areas by ID and business fields: zero missing/changed rows. `updated_at` follows the existing upsert operation; original creation times remain unchanged. New `resource_category` defaults distinguish service providers from centers. No existing coverage was removed, no unverified New Taipei center coverage invented, no knowledge version republished.

Content-pack backfill and individual-operator provisioning have not yet run. Administrative business E2E remains pending.

## Application logical restore — executed, limited scope

Before 0019, captured all 21 public application tables. Exact capture time was not retained; it was before migration 0019 at 10:05:24 UTC. The snapshot is an application-table export, not a transaction-consistent `pg_dump` or the platform's physical backup. It is kept locally outside Git with 0600 access, not claimed to satisfy the encrypted off-device backup policy.

`scripts/restore-app-snapshot.mjs` restores into an in-memory PGlite only; it cannot accept a cloud database URL. It applies migrations 0001–0018, requires all application tables including empty ones, inserts in one transaction, and compares typed rows in both directions. FK constraints remain enabled; deferring their checks permits the crawler's circular references, then their original modes are restored. A dangling FK rejects the complete transaction. This follows PostgreSQL's [constraint timing](https://www.postgresql.org/docs/current/sql-set-constraints.html) and [ALTER CONSTRAINT](https://www.postgresql.org/docs/current/sql-altertable.html) semantics, only in the disposable local target.

Actual result: **21/21 tables PASS**, six sessions, 30 providers, 30 services, 86 areas, 18 knowledge sources, 21 records, one version and 21 members restored. RLS-disabled tables: zero; public-role grants: zero; missing published members: zero. Detailed counts, snapshot SHA256, UTC execution timestamp and measured local duration are in `J004-2026-10-04-app-restore.json`. The measured duration excludes export/provisioning/platform recovery; it is not an RTO promise. No RPO/RTO approval is fabricated.

Six negative-control tests detect changed content despite equal counts, missing/extra rows, timezone representation differences, cyclic references, transactional FK failure and identifier injection. This does not verify Supabase Auth/Storage/configuration, physical restoration, remote multi-connection locking, restore-after-deletion replay or deployment rollback. R-06 remains only partially evidenced.

## Daily retention workflow — prepared, not enabled

`retention-cleanup.yml` targets only staging in this repository at 00:30 Asia/Taipei. It reuses B-011b's authenticated cleanup CLI with the actual individual's DATA_STEWARD role, including dry-run authentication. It does not create a shared system account, bypass personal authentication or introduce a public endpoint. Scheduled execution remains disabled until repository variable `KAREO_RETENTION_ENABLED=true` is deliberately set; secrets alone do not enable it.

Manual workflow defaults to dry-run; commit is explicit. Concurrency prevents overlapping runs, a failed job stays failed and produces a sanitized notice. Jerry checks Actions/DeletionRun and reruns the idempotent CLI promptly within the seven-day deadline. No automatic retry or alert subscription is claimed. Logs omit raw exceptions and personal data. Local wrapper tests (3 PASS) verify wrong-project rejection before loading any DB client, reuse of the authenticated CLI for both modes, and redaction/failure propagation. Existing smoke tests: 3 PASS; restore tests: 6 PASS; total J-004 script tests: 12 PASS.

Setup still needed: approved credential destinations, individual operator/key and explicit delegated cleanup permission, GitHub staging secrets (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `KAREO_OPERATOR_KEY`) and **repository** variables `KAREO_OPERATOR_ID` / `KAREO_RETENTION_ENABLED`. Both configuration variables use repository scope so they are available while the job is being evaluated; [GitHub documents that environment-level variables become available only after a job starts](https://docs.github.com/en/actions/reference/workflows-and-actions/variables#configuration-variable-precedence). No credentials were committed or displayed.

[GitHub scheduled workflows use the default branch](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule). Default remains main until Jerry decides whether to temporarily use staging; no main code was changed and no schedule trigger is claimed. Production will need a separately reviewed target and credentials after the deferred isolation decision.

## Preview and remaining blockers

Preview #71: `https://deploy-preview-71--kareo-tw.netlify.app` (Netlify deploy `6ac2246f3c329800083a2afc`). Frontend runs real API mode. Team protection returns 401 to unauthenticated shell health checks; signed-in Chrome reaches the homepage normally. Protection was preserved. Resource lookup renders its real error state because Preview Functions do not yet have the acceptance service credential. This is not a successful resource/API E2E.

Netlify reports exhausted production-deployment credits; existing published staging site remains at `8f509c0`. No upgrade was bought, no access protection removed. The preview can be used for authenticated browser acceptance once server credentials are approved/configured; its runtime still uses available credits.

D-05 stays DRAFT. Full 49-case deployment E2E, content-pack backfill, actual crawler/cleanup triggers, rights/lead/recovery drills, individual access handoff and eventual production release remain unfinished. This submission delivers recovery tooling, guarded schedule preparation and exact environment evidence, not full MVP acceptance.
