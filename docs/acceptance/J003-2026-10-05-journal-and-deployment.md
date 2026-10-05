# J-003-r15 actual environment verification

Date: 2026-10-05 Asia/Taipei; operator: Codex AI central implementation, not human sign-off.
Integrated: **false**. Deployed release cases counted in this round: **0/49**.

## Completed and independently verified

- [PR #81](https://github.com/viz963-1216/Kareo/pull/81): B-015 privacy rights CLI and transactional audit; head d4cc79da0dff0ea18a8103040931978fd6fc3aa9, nine CI jobs PASS, merge e5c13c95a2ceb20887b3d1f38e6655e8ab475ad7.
- [PR #82](https://github.com/viz963-1216/Kareo/pull/82): B-016 independent deletion journal and protected replay; head 002ce9b55dc0c7ca76f33603fd66306e3515bef4, nine CI jobs PASS, merge afdf01bb24fdddd03d0eae834916d0171f7bcddc.
- #82 [CI run](https://github.com/viz963-1216/Kareo/actions/runs/37275656086): 748 API tests / 53 files, typecheck, built Functions 86 PASS; real-mode frontend, routes/contracts/data, scripts/gate, fresh/upgrade DB and PG concurrency jobs all successful.
- #82 [Local HTTP run](https://github.com/viz963-1216/Kareo/actions/runs/37275656082): actual PG17/PostgREST/supabase-js/default Function exports/private CLIs/official Blobs SDK filesystem server, LOCAL-47/48/49 and restore LOCAL-39/40 all PASS. This is local isolated integration, not deployment acceptance.
- Cloud forward migrations 0027 and 0028 successfully applied only to Kareo acceptance project ojawadobnaxduxybqolk. Read-only checks: anon/authenticated replay EXECUTE false, service_role true, anon rights preflight false; assessments and leads zero. No cloud rights request or cleanup executed. Security advisor: INFO for 29 intentionally server-only RLS tables with no visitor policy; no WARN/ERROR reported. Do not add visitor policies merely to remove the INFO notice.

## Netlify deployment and observed access

Dashboard confirms PR #82 deploy 6ac34be1269dfa0008dc778c completed for exact head 002ce9b55dc0c7ca76f33603fd66306e3515bef4, 21 Functions and 23 redirects. Permanent preview: https://6ac34be1269dfa0008dc778c--kareo-tw.netlify.app/ . Team login protection is enabled. Chrome's authorized normal login opened homepage and consent page, showing the DRAFT notice. This checks delivered UI and build metadata, not full commit-bound E2E or durable cloud journal behavior.

Actual API runner at 2026-10-05T07:12Z: marker HTTP 401, commit unreadable, zero cases executed; [raw run](../../tests/e2e/results/api-2026-10-05-preview82-access-blocked.json). HTTP rejection is checked before parsing HTML so it reports protected access, not a missing JSON build. It does not copy the target commit into observed evidence and does not store the login body.

Actual public read-only runner: https://kareo-tw.netlify.app/kareo-version.json HTTP 200 with commit **8f509c0567436392b9421bfb2e906d565c6f9438**, deploy 6ac0d01145b99700084c2c48, built 2026-10-03T09:51:33.396Z; target afdf01bb24fdddd03d0eae834916d0171f7bcddc differs, zero cases executed; [raw run](../../tests/e2e/results/public-2026-10-05-current-staging-mismatch.json). The dashboard states production deployments are paused for credits and latest staging deployment was skipped. No purchase or publish performed.

No deployed delete/withdraw request, external cloud receipt strong-read proof, health assessment or Lead was claimed in this round. The independent filesystem journal is not substituted for cloud Blobs proof. Existing earlier deployment results cannot be carried forward to this commit. Full release gate still fails.

## Actual remaining prerequisites and next actions

1. Protected Actions access: staging environment DB URL/key, active personal DATA_STEWARD ID/key, and explicitly delegated Netlify Blobs PAT/site ID for outside-Functions cleanup. Read-only cloud count at 2026-10-05T07:05Z: active data stewards, crawler runs, deletion runs and privacy operations all zero. No fake/shared operator created. The owner-facing secret form was prepared; no value entered by Codex.
2. Schedule trigger: default branch is main while workflows/code are on staging. A reversible default branch change was prepared but not applied pending the specific owner answer. Schedule-only retention also needs KAREO_RETENTION_ENABLED explicitly enabled after protected dry-run/commit/failure-retry evidence. Missing setup remains BLOCKED.
3. Protected preview access for automated version-bound testing, or later an authorized exact-commit acceptance deployment. Do not remove protection or expose credentials without owner authorization. A Netlify PAT used for Blobs is not assumed to bypass site team login. Browser login visibility alone is not version-marker proof.
4. Verify cloud journal with a disposable no-health acceptance Session/delete, then protected external read/replay and cleanup. Inventory actual recoverable backups/log copies; document retirement and bounded receipt purging; isolate any vendor physical restore. Existing vendor backups are not safe to restore over the live acceptance database just to make a test green.
5. Reconcile actual approved disclosure with implemented data flow and complete formal consent evidence/presentation before ACTIVE. Candidate r1 remains immutable; material disclosure changes require a new candidate version. Current owner approval is conditional, not external legal certification. Human identity/case handling remains a human rehearsal.
6. Gemini runs the updated [UI/deploy prompt](../handoffs/GEMINI-J003-UI-AND-DEPLOY-2026-10-05.md), initially public information and DRAFT blocks. Full health/Lead/GPS flow remains PENDING until valid deployment and consent prerequisites. Collect 49 required deployment cases only after their actual conditions pass.

No main release, paid production database, cloud health/contact seed, message to an individual or legal sign-off was performed. B-015/B-016 implementation is delivered; D-05 activation, daily operational proof, J-003 Integrated and J-004 full physical recovery remain separate incomplete gates.
