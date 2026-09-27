# J-003 integration aids (not E2E)

Files here do not run in CI and never count as E2E results (`tests/e2e/`). They need modules that are not on
`staging` yet, so they are meant to be copied into `apps/api/tests/` of a checkout that has them (a trial
combination or the module's own branch). Names end in `.ts` / `.repro.ts` so the root `tests/**/*.test.*`
glob and `apps/api` Vitest do not pick them up here.

| File | For | Today (trial: staging `fd4154a` + #32 #33 #36 #37 #35 #30 #34) |
|---|---|---|
| `repro/b008-approval-binding.repro.ts` | B-008-r3 (hand-back H-3) | FAIL — a corrected text re-imported under the same `(packId, recordId)` is skipped silently and the old text is approved |
| `repro/b009-hash-dedupe.repro.ts` | B-009-r2 (H-5) | 2 FAIL — unchanged PDF creates a change; the same change is created again the next day |
| `first-publish-dryrun.ts` | J-003 first publication pre-flight | PASS — 5 packs, 21/21 records published as `KB-2026-09-24-001`; Taipei／New Taipei local lines do not cross |

```bash
cp tests/integration/repro/b008-approval-binding.repro.ts apps/api/tests/b008-approval-binding.test.ts
cd apps/api && npx vitest run tests/b008-approval-binding.test.ts
```

Database-level checks (migrations, RLS, Provider import rollback, knowledge publish／withdraw) are in
`tests/db/verify-db.mjs`; they run against an in-process PostgreSQL and work on `staging` as it is.
