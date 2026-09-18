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
