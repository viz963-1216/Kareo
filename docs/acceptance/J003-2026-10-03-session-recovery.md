# J-003 Session recovery — 2026-10-03 Asia/Taipei

## Environment and cloud changes

Jerry authorized continuing the Kareo recovery after upgrading Supabase.
Target: Kareo `ojawadobnaxduxybqolk`, staging site `https://kareo-tw.netlify.app`.
KareoCar was not modified.

- Supabase project restored from INACTIVE to ACTIVE_HEALTHY.
- Catalog showed only sessions/consents, with original columns and no Session token fields.
- Both tables had RLS enabled; service_role INSERT allowed; anon/authenticated SELECT denied.
- sessions had 0 rows before verification.
- Applied the committed `0008_session_token.sql` without changes through Supabase migration `kareo_0008_session_token`.
- Verified token_hash/expires_at/withdrawn_at and unique index exist; access restrictions unchanged.
- Created one synthetic anonymous Session through deployed POST /api/v1/session: HTTP 200; id/token/expiry present. Token never recorded in evidence.
- Marked this synthetic Session DELETED after the probe, retaining its audit row; no real-user data was changed.

## Newly reproduced deployment defect

Site commit `926cdb4622691f69bc83e7d0fb245da47c57037d`.
POST /api/v1/consent returned HTTP 502 during module load, before token/consent validation:
`createRequire(import.meta.url)` receives undefined in Netlify CommonJS output.
The previous runtime check bundled only ESM, so it missed the production format.

## Fix and local evidence

- Static JSON import with Node import attributes bundles the version contract into both formats.
- TypeScript module target ESNext supports import attributes while retaining ES2022 language target.
- Runtime gate now executes both ESM and CommonJS outputs.
- API typecheck/build PASS; compiled Node consent handler PATCH returns 400.
- API tests: 374 PASS.
- Bundled Functions: 32 PASS, 2 PENDING (DELETE session in each format), 0 FAIL.

Formal consent contract remains DRAFT. No legal approval was added, no knowledge published,
and no full MVP acceptance is claimed. Deployment verification will be appended after merge.
