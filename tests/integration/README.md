# J-003 integration aids (not E2E)

Files here do not run in CI and never count as E2E results (`tests/e2e/`). They need modules that are not on
`staging` yet, so they are meant to be copied into `apps/api/tests/` of a checkout that has them (a trial
combination or the module's own branch). Names end in `.ts` / `.repro.ts` so the root `tests/**/*.test.*`
glob and `apps/api` Vitest do not pick them up here.

Results are per commit; older results stay in `docs/INTEGRATION_ACCEPTANCE.md` run records.

| File | For | Result (2026-09-27, J-003-r5) |
|---|---|---|
| `repro/b008-approval-binding.repro.ts` | B-008 H-3 (first round) | PASS on #36 `7b77e9c` (resolved; was FAIL on `1c73987`) |
| `repro/b008-content-fingerprint.repro.ts` | B-008 H-3 (second round, Codex cases A／B／D／F) | A, B, D FAIL; F PASS on `7b77e9c` |
| `repro/b009-hash-dedupe.repro.ts` | B-009 H-5 (PDF hash, de-duplication) | PASS 2/2 on #37 `467cb14` (resolved; was FAIL on `80bd5fc`) |
| `repro/b009-baseline.repro.ts` | B-009: unchanged HTML vs raw-HTML baseline | FAIL on `467cb14` |
| `repro/b005-distance-and-write.repro.ts` | B-005: ranking by rounded distance; orphan run on items failure | 2 FAIL on #40 `1a12c62` (`e867dbb` only adds the J-003 route) |
| `first-publish-dryrun.ts` | J-003 first publication pre-flight | PASS (21/21) on the trial staging `d7d5107` + #33 + #36 + #40 + #37 |

```bash
cp tests/integration/repro/b008-approval-binding.repro.ts apps/api/tests/b008-approval-binding.test.ts
cd apps/api && npx vitest run tests/b008-approval-binding.test.ts
```

Database-level checks (migrations, RLS, Provider import rollback, knowledge publish／withdraw) are in
`tests/db/verify-db.mjs`; they run against an in-process PostgreSQL and work on `staging` as it is.
`--upgrade-from=0008` checks the upgrade path (existing published knowledge, then the new migrations).
`tests/db/detect-applied-migrations.sql` is a read-only catalog query that shows which migrations a real
database already has.
