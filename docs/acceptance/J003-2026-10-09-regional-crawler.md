# J-003-r29 — Regional official-source transport preparation

Base staging: `454930d51fa088b0e5bea42e9bc28e70d2958e1c`. Full J-003 remains incomplete; 49 deployed cases are not accepted by this preparation.

## Scope and understanding

Jerry requested complete J-003 and previously delegated cross-module implementation/integration. This change addresses issue #88's two unreachable careyou sources using the existing Kareo acceptance project's regional execution. It does not change a source, source ID, source content, public API, assessment/recommendation logic, database schema, legal approval or release gate. New `supabase/functions/crawler-official-source/**` and its function configuration are deployment transport infrastructure in J's scope; `apps/api/src/services/regionalCrawlerFetcher.ts` is its server-side adapter. Tests, documentation and a manually dispatched diagnostic workflow complete the scope. No secrets, private database rows or caller-supplied URL enter the source request or report.

Input: one of two existing approved source IDs and a project-managed server credential, supplied by the protected staging workflow. Output: actual fresh official HTML bytes, exact source URL, fetch time, Tokyo execution region, byte length and SHA-256. Acceptance for routing requires actual protected-cloud connectivity, then all 18 operational crawler results with snapshot/hash/last-publication checks. Unit test success alone does not activate this transport in the daily crawler.

## Authentication and transport

Only `SRC-NTPC-CAREYOU-BRANCH` and `SRC-NTPC-CAREYOU-LTCTS` are allowed, resolving to the unchanged URLs in the source registry. The function denies unknown/extra fields, query strings, oversized input, wrong project, wrong region, redirects, non-HTML/error/challenge content and oversized responses. It sends a public GET with ordinary TLS verification, no caller credentials/cookies, no query injection, no generic proxy and no database client. Its only response is source bytes and safe provenance; failures are sanitized.

The handler checks the existing project-managed `SUPABASE_SERVICE_ROLE_KEY` or the managed default `SUPABASE_SECRET_KEYS` value. It never accepts a publishable key or user/anon JWT. `verify_jwt=false` permits the handler to authenticate new API keys that are not JWTs; this does **not** make the handler anonymous. See [official authorization documentation](https://supabase.com/docs/guides/functions/auth-headers) and [API key migration](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys). No new credential is created, exported into the repo or copied to an outside provider. Only the existing protected server caller is authorized.

The caller pins the own-project HTTPS endpoint and `x-region=ap-northeast-1`, refuses redirects, verifies the actual `x-sb-edge-region`, exact source ID/URL, freshly fetched timestamp, bounded canonical base64, byte count and recomputed hash before yielding `FetchResult`. All other sources keep the existing direct fetcher. [Supabase regional invocation](https://supabase.com/docs/guides/functions/regional-invocation) supports Tokyo and exposes the actual region in that header. It uses existing Edge Functions usage, with no new project or plan purchase; [Pro includes 2 million monthly invocations](https://supabase.com/docs/guides/functions/pricing), but organization usage/egress can affect actual billing.

The protected diagnostic is manual, staging-only, takes no user-defined URL or credential, reads only these two public pages, tests anonymous rejection and emits safe metadata. It neither writes the DB nor approves/publishes knowledge. The existing daily workflow is unchanged until real connectivity is demonstrated.

## D-05 restore decision

On 2026-10-09, the authenticated Kareo Restore to new project page displayed a clone of the latest physical backup (`2026-10-08 20:54:22Z`), Tokyo and the same organization, additional monthly compute **US$9.68**, additional disk **US$0**. The button opened a review dialog only; Continue was not pressed. Jerry explicitly chose **not to create it**, and to complete other acceptance first. No existing database is overwritten; Kareocar is not a restore destination. [Official clone documentation](https://supabase.com/docs/guides/platform/clone-project) states clones cost extra and database extension jobs can run immediately; inspect source jobs and keep restored entry closed before any future approved restore.

The dashboard now lists seven physical backup timestamps: Oct 8 20:54:22Z, Oct 7 20:54:08Z, Oct 6 20:55:22Z, Oct 5 20:56:14Z, Oct 4 20:54:26Z, Oct 3 20:57:14Z and Oct 2 21:08:28Z. This updates the visible inventory only, not a certification that all historical/vendor/manual copies retired. Physical isolated restore and backup deletion replay remain pending. Owner approval stays conditional; formal consent stays DRAFT.

## Verification

Local direct reads on Oct 9 returned HTTP 200 and normal HTML for both unchanged sources, with their expected page titles (183,854 and 192,884 UTF-8 bytes at that observation). These are local connectivity observations, not scheduled-run evidence. Transport tests exercise credential rejection, source/URL injection, preservation of real bytes, provenance/hash/freshness rejection and secret redaction. Cloud diagnostic/operational results will be added only after execution.
