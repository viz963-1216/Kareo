# TASK-B-016 — Independent deletion journal and guarded replay

Owner: Jerry central integration, authorized D-05 implementation 2026-10-05
Submission Version: B-016-r1

Allowed: apps/api journal adapter/service, session/withdraw handlers/services, privacy and cleanup CLIs, forward migration and tests; tests/local; scripts/cleanup-staging.mjs and its safety tests; .github/workflows/retention-cleanup.yml; docs/tasks; API dependency lockfile. No new visitor route, paid project, frontend token, production consent activation or main release.

Persist authenticated deletion/withdrawal intent before changing the database, to a private Netlify site-wide Blobs namespace bound to the actual Supabase project. Minimal receipt: schema, project reference, session ID, action and timestamp; no health/contact/token/key. Conditional insert + strong read verifies durable acceptance. Failure cannot report success. All journal access happens after visitor or personal DATA_STEWARD verification. CLI uses Netlify environment context or an environment-only PAT, never a token argument or log.

Protected replay must reauthenticate the personal DATA_STEWARD in the SQL transaction, reject foreign/invalid records, preserve earliest request time, stop outreach and apply existing business RPCs. An unreadable/incomplete journal blocks cleanup and restore reopening. Failed DB mutation leaves a legitimate recorded intent for retry; the two services do not have a distributed transaction.

No automatic journal deletion based only on age. Pruning requires a data steward's documented backup-retirement checkpoint and verified current erasure; no restored environment may reopen until replay completes. The purge checkpoint is an operations release condition, not proof that vendor copies are gone.

Acceptance: actual SDK with official local filesystem server outside the PG snapshot, immutable concurrent insert/retry, invalid identity causes no journal write, journal/readback failure causes no DB success, protected replay denial/rollback, restore revives data then external journal replay removes it, unrelated data preserved. Cloud Blobs and physical vendor restore remain separately verified before D-05 activation.
