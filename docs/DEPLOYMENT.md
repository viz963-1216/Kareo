# Kareo deployment — staging

Submission Version: J-001-r1

## Scope

Jerry-authorized deployment setup for GitHub staging → Netlify → Supabase.
Netlify project name: Kareo (URL slug may be lower-case). Supabase project name: Kareo.
Use a new isolated Supabase project. Do not reuse Kareocar's database.

## Netlify

Connect viz963-1216/Kareo, deployment branch `staging`, repository base directory `.`.
The committed netlify.toml defines build command, publish directory `dist`, and
Functions directory `apps/api/src/functions`. Runtime: Node 22.
The Netlify site's primary deploy is the application's staging environment;
this does not make GitHub staging a production release.

Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY through the Netlify UI, scoped to
Functions if the plan permits, for this staging site only. Never place either
credential in a VITE_ variable, source code, build logs, or netlify.toml.
The backend currently expects the legacy service-role environment variable.
A future move to the new Supabase secret key should be tested with its adapter.

Initially deploy/staging is a noninteractive placeholder. When C supplies
apps/web/package.json plus package-lock.json, the build installs and builds it,
then publishes apps/web/dist. A failing frontend build fails deployment rather
than silently replacing it with the placeholder. No frontend business logic
or core API contracts are changed here.

## Supabase

Enable Data API for the current supabase-js repository implementation.
Disable automatic grants for new tables; enable automatic RLS if offered.
Apply these files in order to the new Kareo database:

1. apps/api/supabase/migrations/0001_session_consent.sql
2. apps/api/supabase/migrations/0002_session_consent_access.sql

The second migration enables RLS, removes anon/authenticated access, and grants
the trusted backend service_role the required table access. There are no public
policies. Database structure is unchanged. Backend credentials bypass RLS;
validation and future user authorization remain backend responsibilities.

## Verification

- npm run typecheck --prefix apps/api
- npm test --prefix apps/api
- node scripts/build-site.mjs
- Run `node scripts/smoke-staging.mjs https://YOUR-STAGING-SITE` against this test
  environment only. It creates one anonymous Session and one synthetic Consent
  using version `deployment-smoke-test`, not an actual user's legal acceptance.
- Verify those IDs exist in Supabase and rejected consent creates no extra row.
- Confirm anon/publishable access cannot read either table.
- Missing API routes must return JSON 404, not the frontend index page.

The smoke script intentionally leaves its clearly tagged test record for audit.

## Later release

A and C's remaining deliverables, Assessment/Recommendation/Lead endpoints and
full end-to-end tests are still required. Use separate production Supabase
credentials and a main release when ready. Remove the staging noindex header
for the production configuration. Do not enable billing auto-recharge as part
of this setup.

---

## J-003-r1 additions (2026-09-23)

### Migrations currently on staging

Apply in order to the staging Supabase project only:

1. `apps/api/supabase/migrations/0001_session_consent.sql`
2. `apps/api/supabase/migrations/0002_session_consent_access.sql`
3. `apps/api/supabase/migrations/0003_assessment.sql`

Record the date and operator in `docs/INTEGRATION_ACCEPTANCE.md` when applied.

### API routes

`netlify.toml` must route every function under `apps/api/src/functions`.
`node scripts/check-integration.mjs` fails CI when a function has no route or a route has no function
(this is how the missing B-007 transportation route was found).

### Frontend API mode

| Netlify context | `VITE_KAREO_API_MODE` | Behaviour |
|---|---|---|
| Deploy Preview | `mock` (set in netlify.toml) | UI review with fixtures |
| Branch / production (staging site) | unset → `real` | Calls `/api/v1`; never falls back to mock |
| Any non-preview context with `mock` | — | **Build fails** (`scripts/lib/frontend-env.mjs`); at runtime `apps/web/src/api/mode.ts` would also ignore it and use the real API |
| `main` branch (public release) | must be `real` | Build also requires `VITE_KAREO_REQUIRE_SESSION_TOKEN=true` and all three `VITE_CONSENT_*` versions |

`VITE_KAREO_REQUIRE_SESSION_TOKEN=true` makes the adapter reject a session without `sessionToken` and refuse protected calls without one (API_CONTRACT §3.1). Leave it unset on staging until B-011a is deployed; the adapter then logs that requests are not session-protected (it never pretends they are).

Consent versions are build-time variables. Set them in the Netlify UI **per site/context**:

```text
VITE_CONSENT_DISCLAIMER_VERSION
VITE_CONSENT_PRIVACY_VERSION
VITE_CONSENT_TERMS_VERSION
```

- Staging integration testing may use the labelled drafts `2026-10-01-r1-draft`.
- Production must use versions marked `ACTIVE` in `contracts/legal/consent-versions.json`.
- If unset, the real-mode frontend refuses to record consent (users see a message to call 1966) rather than storing a placeholder.
- These are public build variables; never put a secret in any `VITE_` variable.

### Deploy credits

On 2026-09-23 the Netlify team had exhausted its credits: `kareo-tw` and `kareocar` were paused.
68 production deploys consumed 1,020 of 1,038.8 credits, because `staging` is the production branch and every merge deploys.

- `scripts/netlify-ignore.mjs` (the `[build] ignore` command) skips a build only when **every** changed file
  (1) is under `docs/`, `tasks/`, `contracts/`, `data/`, `.github/` or is a root `*.md`, **and**
  (2) is not referenced by anything the build uses: its path, or a folder containing it, must not appear in
  code (comments ignored) under `apps/**` (including backend tests, which the build runs), `scripts/build-site.mjs`,
  `scripts/lib/` or `netlify.toml`.
  Example: `apps/web` imports `contracts/mock/…json`, so any change under `contracts/mock/` builds;
  `docs/*.md`, `tasks/**` and `contracts/knowledge/**` changes are skipped. Missing refs or errors always build.
  Tested in `tests/scripts/netlify-ignore.test.mjs` (docs-only commit → skip; imported contract → build).
- Batch merges to `staging`; each deploy costs credits.
- Staging smoke runs only via the manual `Staging smoke (manual)` workflow or locally:
  `node scripts/smoke-staging.mjs https://<staging-site>` (add `--with-assessment` only when intended).
- Buying credits, cancelling the scheduled downgrade or enabling auto-recharge are Jerry's decisions.

## J-003-r3 additions (2026-09-23)

- `GET /api/v1/providers/{providerId}` is routed to `providerDetail` (B-004 merged the function without a route;
  `check-integration.mjs` caught it).
- Every build writes `dist/kareo-version.json` (public, `Cache-Control: no-store`): `commit` from Netlify's
  `COMMIT_REF`, plus `branch`, `context`, `deployId`, `builtAt`. No secrets. The E2E runner and the release gate
  use it as evidence of which commit is actually deployed (docs/INTEGRATION_ACCEPTANCE.md). A docs-only commit
  skipped by `netlify-ignore.mjs` leaves the previous commit in the marker; that is the version that is live.
