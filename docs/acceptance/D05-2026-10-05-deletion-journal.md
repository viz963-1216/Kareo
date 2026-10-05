# B-016 independent deletion journal verification

Submission Version: B-016-r1 / Jerry central integration
Date: 2026-10-05 Asia/Taipei
Base: staging e5c13c95a2ceb20887b3d1f38e6655e8ab475ad7 (merged B-015).

Authenticated visitor DELETE/withdrawal and verified lost-token STOP/DELETE now persist minimal intent to a private, site-wide Netlify Blobs store before mutation. The namespace is bound to the exact Supabase origin and explicitly uses us-east-1. Receipts contain only schema version, project reference, session ID, action and first accepted timestamp. Conditional inserts plus strong readback preserve the original deadline; invalid visitor/operator, failed store or failed read cannot report successful deletion. A used rights reference fails before writing another intent. A later database failure may leave a valid intent for protected replay: this is deliberately not described as a cross-service transaction.

Netlify Functions use the official withLambda adapter as their default export, providing the modern platform's uncached Blobs context. Legacy context without strong-read support fails closed. Outside Functions, the protected cleanup CLI requires explicitly delegated Netlify access as well as its database and personal DATA_STEWARD credentials. No token arguments, frontend key, shared system operator or new public route.

Migration 0028 rechecks the active personal DATA_STEWARD and role inside the SQL transaction. It validates every receipt before changes, locks target sessions in stable order, reapplies the existing stop/delete business RPCs and retains the earliest deletion timestamp. Replay, erasure and successful cleanup audit commit together. Audit failure rolls back all database changes. Missing or corrupt external records stop the operation; missing target sessions are counted, never created.

Local evidence: [report](evidence/D05-2026-10-05-deletion-journal-local.json). Actual PostgreSQL 17, official PostgREST, bundled modern Function default exports, supabase-js, protected real privacy/cleanup CLIs and the official Netlify SDK filesystem server: **49/49 LOCAL PASS**. The external journal directory survives the application snapshot restore. The restored health/contact negative controls become present; replay removes them while preserving unrelated records and consent evidence. Wrong identity, wrong project, failed journal, failed read and failed audit are exercised. Backend typecheck and 748 tests PASS; isolated fresh DB 24 PASS (19 behaviour / 5 schema); staging cleanup safety tests 4 PASS. CI on the submitted head remains authoritative.

These are 49 LOCAL checks, not the separate 49 deployed release E2E cases. The filesystem server and PGlite application restore do not prove deployed Blobs durability or a Supabase physical backup restore. Cloud migration, exact-head Deploy Preview, personal operator setup and actual daily execution need separate evidence. No individual identity has been certified and no private export mailed. D-05 remains DRAFT and Integrated remains false.

## Retention and restore checkpoint

The receipt is personal operational data even though it has no health/contact values. Do not give it the consent-evidence three-year rule or retain it forever without review. Retain it only while an approved, inventoried recoverable backup can restore the affected data or a request remains unresolved. Review that inventory with the backup/log configuration before activation. Purging requires a verified current erasure and documented retirement of every affected backup, including manual/offline copies; an elapsed number of days alone is insufficient. There is no automatic receipt purge in this revision. A protected, evidenced purge procedure and actual vendor retirement checkpoint are release conditions; this revision does not prove vendor copies are gone.

Never clear or recreate a missing store to make cleanup green. A manifest is first created by an authenticated, verified deletion request. Establish a new acceptance namespace with a disposable no-health Session and its actual deployed DELETE; verify its strong readback before scheduling cleanup. If a previously initialized namespace is missing, treat it as incident/restore blockage, recover its records and revalidate. The 10,000-record limit fails closed and needs explicit capacity review before reaching it.

After any restore, keep visitor entry closed, authenticate the data steward, read the independent journal, then execute protected replay and recorded cleanup. Confirm cleared health/contact data, stopped outreach, unrelated data preserved and successful audit before reopening. A replay-only schema check is insufficient. Existing application snapshots containing real data must remain in the restricted backup location, never GitHub/artifacts.

## Scheduling setup, not executed evidence

GitHub environment staging: secrets SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, KAREO_OPERATOR_KEY and NETLIFY_AUTH_TOKEN; variables KAREO_OPERATOR_ID and NETLIFY_SITE_ID. The PAT's access is a separate account delegation, not supplied automatically by the Netlify deployment context. Store neither token in a command nor in a PR. The deployed Functions need no PAT: their platform context is used directly.

The operator must be an active, personally attributable DATA_STEWARD in the acceptance database. Repository variable KAREO_RETENTION_ENABLED must be explicitly enabled after an authenticated dry-run, controlled commit and failure/retry check. The daily schedule is 00:30 Asia/Taipei; crawler is 00:10. GitHub schedules run from the default branch; main currently lacks these workflows. A default-branch change to staging needs the owner decision already requested. Missing setup is BLOCKED, not PASS. There is no pull_request cleanup trigger and no service-role fallback for failed personal verification.

References: [Netlify Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/), [official Function compatibility adapter](https://docs.netlify.com/build/functions/api/).
