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

## J-003-r21 actual execution update

PR #90 head b2c2514c0f39d2a52f740940588b2213084774c8 passed all eight [CI jobs](https://github.com/viz963-1216/Kareo/actions/runs/37567485758), then merged into staging de9ded38a84c09d3a43f6b1b893eb61c26bfbb68. Jerry explicitly agreed to delegate the existing Netlify CLI account token to the protected staging workflow and personally saved NETLIFY_AUTH_TOKEN. Codex saved the two non-secret identifiers KAREO_OPERATOR_ID and NETLIFY_SITE_ID. The original staging-only environment branch restriction was preserved.

At 2026-10-07 11:38 Asia/Taipei, [cloud verification run 37567651498](https://github.com/viz963-1216/Kareo/actions/runs/37567651498) completed SUCCESS in 40 seconds. **13/13 operational checkpoints PASS**. These now supersede the prepared/unexecuted status above; [sanitized permanent evidence](evidence/J003-2026-10-07-cloud-retention.json) is derived from the actual job log, with artifact ID and zip digest.

Real Netlify Blobs saved and strongly read back the minimal five-field receipt; retry preserved the original timestamp and seven-day deadline. The real DB rejected a deleted visitor token, wrong personal key before journal I/O and wrong SQL operator proof after the owned synthetic row was restored. The protected CLI dry-run did not write an audit. An injected read failure stopped cleanup without erasure/audit. Actual cleanup and post-restore replay/cleanup each recorded SUCCESS for the personal operator. All eight preexisting Sessions retained identical full-row digest 57d0153f690479a2b87826e2f4cc924d6a9f7ca94dd411fa185071851fe0e8dc.

Independent SQL confirmed six ACTIVE and three DELETED Sessions; the additional DELETED row is this disposable fixture. Two SUCCESS deletion_runs each count one cleanup of that same fixture, not two distinct visitors. Assessments, leads and consents remain zero. The minimal receipt remains in the private cloud journal for replay evidence; no public/private health export was created.

The actual existing retention workflow entry was also run [manually in dry-run mode](https://github.com/viz963-1216/Kareo/actions/runs/37567995498), using the environment's credentials and identifier variables, SUCCESS in 22 seconds. It validated one cloud receipt and counted zero remaining cleanup targets. This proves configuration and the manual entry, not a nightly schedule execution. KAREO_RETENTION_ENABLED remains unset until the actual deployed DELETE/platform-context checkpoint and controlled entry commit are verified.

No evidence was put into tests/e2e/results. Named handler execution in Actions, no-health row restoration and an injected dependency failure keep the limitations above. D-05 DRAFT and Integrated false are unchanged. The former local INVALID_API_KEY trial remains a diagnostic limitation, not a production credential finding.

## Existing private branch deployment and next checkpoint

The prior approved credential context is exactly `fix/j-003-staging-smoke-safety-oct06`. Its branch was updated by an ordinary merge (no force push). Two task-document conflicts kept the current staging text. The resulting commit 256cce1b8fc60d8c514b5519ddfac5e44dd6e2be has exactly the same file tree as reviewed staging de9ded3. No credential scope was added, copied or made available to generic PR previews.

Using the official Netlify API and existing CLI login, Codex requested a branch-deploy (not production) for that exact branch. Deploy 6ac5c090f07e9382d3b54d1d became ready. Signed-in Chrome opened its permanent private URL; /resources displayed 35 actual resource records with two pages. The unrelated #90 preview, which lacks the approved branch credential context, had correctly shown a safe error. These observations distinguish deployment setup from a backend defect. Public production is unchanged and its credit-exceeded skip is still observed.

To finish the real deployed DELETE checkpoint without accepting a DRAFT agreement or submitting health data, this revision adds `__acceptance-session-check.html` and its client **only** when build context is branch-deploy, branch equals the existing approved context and COMMIT_REF is a valid full SHA. Production, general PR previews, local and other branch builds never emit either asset. The page is absent from product navigation. It requires exact before/after version markers, creates one no-health Session, checks token shape/future expiry, calls the actual deployed DELETE and verifies the used token is rejected. Token stays in transient browser memory, never DOM/storage/logs. The only embedded deployment value is the public SHA.

The output guard regression passed. Actual execution of this new deployed checkpoint is pending this submitted head's CI and its private branch deploy. It is not yet a PASS or a substitute for the 49-case release gate. No ACTIVE consent is fabricated.
