# J-003-r20: Actual backfill closeout and protected cloud journal verification

Date: 2026-10-07 Asia/Taipei. Base: staging bedb151e4d507128eafe90272c2c476f065eeab3.

## Completed cloud backfill

Jerry personally saved `KAREO_OPERATOR_KEY` in GitHub environment staging. PR [#89](https://github.com/viz963-1216/Kareo/pull/89), head 57b48a956b0a389beecffd61930036539238740f, passed all eight CI jobs and merged into the baseline. The actual [manual backfill run 37566525005](https://github.com/viz963-1216/Kareo/actions/runs/37566525005) succeeded against Kareo acceptance, using the personal operator and official CLI/repositories/Supabase client.

Five content packs and 21 historical review events were registered. A second official invocation produced no duplicate metadata. Independent SQL counts confirm 5/21. Full-row count and digest checks preserved the 21 knowledge records, one knowledge version and 21 version memberships. It did not approve newly crawled changes or publish new policy.

| Dataset | Before and after SHA-256 |
|---|---|
| knowledge_records, 21 | e3e82847dffcb58165bfc851e832333bfb0e759f2203b3351c50fc28f3ae451f |
| knowledge_versions, 1 | 3dfe9b89307e98d93a3f3426e6bef40771bb0a1d4ce931a8ec5bedb5f9e9cbf3 |
| knowledge_version_records, 21 | 258b0bd846d331d1ea78838dcba77f1e71fc5cbfb79ca36a5f500f192c408fa6 |

Current executor attribution is Codex under Jerry delegation, not a new personal content review. The earlier r19 report's pending-backfill statement is historical and superseded by this run.

## Protected cloud operations entry: prepared, not yet passed

The manual-only workflow `Acceptance cloud deletion journal verification` defaults to confirm=false, requires exact staging ref/environment, shares the cleanup concurrency lock and uses contents:read. It never runs on PR code. Target guards lock the Supabase project, Netlify site and personal operator before cloud imports. Netlify API site identity is also checked.

The script requires zero health/lead/consent records and no existing cleanup candidates, authenticates DATA_STEWARD, then creates one disposable no-health Session via the actual service. It calls the named DELETE Function handler locally with real Supabase and Netlify Blobs, verifies strong receipt readback and original deadline, rejects the invalidated visitor token, checks authenticated dry-run has no audit write, injects a journal-read failure and requires cleanup to stop. Protected commit must clean only the owned fixture and preserve the full digest of every preexisting Session.

It restores only that new no-health row, exercises the SQL operator recheck with an invalid proof, then invokes the official cleanup CLI again. The real independent receipt must drive replay and cleanup in the same DB transaction. Two SUCCESS audits must be attributable to the personal operator. Safe evidence contains counts, timestamps, synthetic Session ID and digests, never tokens, operator key, token hashes or private row contents. A failure is STOPPED, never PASS. An incomplete run's synthetic ID identifies the fixture for investigation rather than silently bypassing the journal.

This proves cloud SDK/DB operations if the run succeeds. It does **not** prove an actual deployed default Function's platform context, Supabase physical backup recovery, rights-request identity verification, real health/contact erasure or the separate 49 deployment E2E cases. The actual deployed disposable DELETE checkpoint remains required before enabling nightly cleanup. No test result is written under tests/e2e/results; D-05 remains DRAFT and Integrated remains false.

## Credential boundary and diagnostic correction

Existing local Netlify CLI login successfully reads Kareo site/environment metadata. However, Netlify marks SUPABASE_SERVICE_ROLE_KEY as a Secret. The [official API contract](https://github.com/netlify/open-api/blob/master/swagger.yml) says secret values outside the dev context are readable only on Netlify systems. A local trial using the API-returned representation received INVALID_API_KEY before any write. This is **not evidence that the actual deployed credential is invalid**. No Session or deletion-run row was created by either stopped local trial; acceptance still had eight Sessions.

The protected workflow will use GitHub's known-working database secret. NETLIFY_AUTH_TOKEN must be explicitly delegated to staging by the owner. The existing CLI token grants account access and is not a narrowly scoped per-store credential; script site checks do not narrow the token itself. It must not be exposed to PR jobs, frontend, repository, chat or artifacts. GitHub's staging environment already restricts deployment branches to staging. The owner must personally complete the prepared Add secret form; Codex does not enter the credential through browser UI.

No nightly retention enablement, production purchase, public deployment or protection removal is included here. Actual results and run link must be appended after execution. Existing crawler network/timing failures remain on [#88](https://github.com/viz963-1216/Kareo/issues/88).

## Verification at submission

Four target/digest regressions PASS; script syntax and diff check PASS; workflow YAML verified manual default-off, staging-only, same cleanup lock and seven-day sanitized artifact retention. Exact submitted-head CI remains authoritative. Business API/schema/consent registry are unchanged.
