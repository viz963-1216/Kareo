# J-003 local HTTP integration

This is LOCAL evidence, not deployed E2E or release approval. It starts actual bundled Netlify Functions, uses supabase-js against **official PostgREST**, and writes only a fresh disposable PostgreSQL 17 database. No cloud Supabase credentials or GitHub secrets are needed.

## What it verifies

50 checks cover public resources and knowledge, session tokens and consent, rule-based assessment, recommendation and location fallback, Lead idempotency and protected operator CLI, admin review/publish/withdraw, safe HTTP errors, privacy rights, the independent deletion journal, and protected retention cleanup with rollback/retry. The frontend is built in real API mode and its HTML is served; this does **not** verify browser interaction, keyboard navigation or RWD.

Actual dataset imports use the existing protected CLIs: the full source catalogue (803 resources, 786 services, 1,123 active service areas; contract counts reconciled against source JSON) and 5 approved packs / 21 published knowledge records. Mutated candidate sets, failure triggers, additional knowledge and contact details are synthetic fixtures inside the disposable database. Original data files stay unchanged.

The temporary Function bundles add an explicitly synthetic `LOCAL-TEST-2026-10-05` consent combination while retaining the original DRAFT combinations and testing that they are rejected. The repository consent contract is hashed before/after and must remain unchanged. This does not approve D-05. Local HTML displays a test banner.

LOCAL-50 builds the frontend with an approved **synthetic-only** archive in a temporary directory, using the same full-text validator as the real build. It verifies all three versions, exact downloaded SHA-256 and unchanged real DRAFT registry. The local Vite build supplies this fixture explicitly with configFile=false; the normal Vite config always uses the real registry and never accepts a fixture override. Local reporting requires every unique LOCAL-01–50; these are distinct from the 49 deployed E2E cases.

## Run in CI

The workflow `.github/workflows/local-integration.yml` runs on relevant PRs to staging/main and supports manual dispatch. It creates a PostgreSQL 17 service, downloads official PostgREST 16.4 with SHA-256 verification, and runs the guard plus HTTP checks. Artifact: `local-http-integration-not-release-acceptance`. The report includes source commit, working-tree state and `releaseAcceptance: false`.

The CI job failing makes the workflow fail. Enforcing it as a required merge check is a separate GitHub branch-protection setting; this change does not alter those settings.

## Run locally

Requires Node 22+, an official PostgREST 16.4 executable for your platform and an **empty disposable PostgreSQL 17 cluster**. Never point this at an existing Supabase project or tunnel a remote database to loopback. The runner creates roles and application tables; use a fresh cluster for every run. It refuses nonempty application tables and does not drop existing tables to reset them.

Install repo dependencies:

```sh
npm ci --prefix apps/api
npm ci --prefix apps/web
npm ci --prefix tests/db
```

One way to provision a local disposable database (requires Docker already installed):

```sh
docker run --rm --name kareo-local-integration \
  -e POSTGRES_USER=kareo_test \
  -e POSTGRES_PASSWORD=synthetic-local-only \
  -e POSTGRES_DB=kareo_local_integration_test \
  -p 127.0.0.1:55432:5432 -d postgres:17
```

Wait for `docker exec kareo-local-integration pg_isready -U kareo_test -d kareo_local_integration_test` to succeed. Set the path of the official executable explicitly:

```sh
export KAREO_LOCAL_PG_URL='postgresql://kareo_test:synthetic-local-only@127.0.0.1:55432/kareo_local_integration_test'
export KAREO_LOCAL_DISPOSABLE=1
export KAREO_LOCAL_POSTGREST='/absolute/path/to/postgrest'
node --test tests/scripts/local-stack-guards.test.mjs
node tests/local/run.mjs --out=/tmp/kareo-local-http.json
docker stop kareo-local-integration
```

Stop the disposable container even if verification fails. The Node runner closes its gateway, PostgREST and SQL client, deletes its temporary bundles and restores process environment. It does not stop the external PostgreSQL service. The standard runner exits after verification; it is not a persistent preview server.

Download PostgREST from its [official 16.4 release](https://github.com/PostgREST/postgrest/releases/tag/v16.4), select your platform, and compare the release asset SHA-256 before extraction. The workflow pins Linux static x86-64 to `b47ecc82fce1dcebbbc4183d839e52f07f7630c9d7ad0f54db753d1939299354`. macOS arm64 is `5720fbde4a19ade9fb189791615c84beb9f0e58201b1b6d17fe3b698faf60776`; its binary also requires compatible libpq/OpenSSL libraries (follow vendor runtime requirements). No global package installation is performed by the runner.

## Evidence boundaries

- Only exact `127.0.0.1`, explicit port, database `kareo_local_integration_test`, user `kareo_test`, no query/hash overrides, and `KAREO_LOCAL_DISPOSABLE=1` are accepted before any connection.
- Tokens, operator keys and synthetic contact responses are used only in memory; reports contain case descriptions/status, not those values. Error output can contain local fixture details; do not substitute real personal data.
- Generated JSON is deliberately rejected under `tests/e2e/results/`. It cannot be used to claim any of the 49 deployed acceptance cases passed.
- Official PostgREST verifies database/JWT roles; this environment does not reproduce Netlify edge/CDN behavior, managed Supabase backup/Auth/Gateway settings, production deployment, daily scheduled triggers or operational handling by a person.
- A frontend build and HTML response are HTTP evidence only. Manual browser/mobile/accessibility testing still needs separate evidence.

## Synthetic restore and deletion replay

LOCAL-39 and LOCAL-40 capture earlier application snapshots inside the guarded disposable stack, before actual HTTP withdrawal or Session deletion. They restore every table into a new in-memory PGlite database, first prove that restore alone revives the old health/contact data, then replay the synthetic request receipt through the actual SQL functions and recorded cleanup. Health rows disappear, contacts stay cleared, necessary consent evidence remains, unrelated active assessments and published knowledge remain, and retry deletes zero. Raw snapshots and receipts stay in memory; reports contain counts only.

This is application-level restore evidence, not a Supabase physical backup exercise. The receipt is synthetic and kept separately in memory during the test; a durable production deletion ledger independent of the restored backup still needs implementation and operational verification. No cloud data or formal consent version is changed.

LOCAL-41 verifies the frontend HTTP archive returns the exact proposed text bytes and SHA-256, explicitly marks it non-active, and excludes private approval metadata from the public index. Both frontend dev/build prepare these generated assets; this does not activate any consent version.

LOCAL-42–46 execute the protected privacy CLI through actual supabase-js/PostgREST: wrong-key and verification rejection, exact private export, real published-rule correction, stale recommendation invalidation, and lost-token stop/delete. No real mail or identity verification is claimed; requests are synthetic operator attestations. All 27 migrations apply.
