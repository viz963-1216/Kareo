# D-05 — Owner cancellation of extra customer-support rehearsal

Submission Version: J-004-r9. Date: 2026-10-07 (Asia/Taipei).
GitHub baseline: staging `bb1899257cac6e6b821c662e51787418d953c3d3`.

## Owner instruction and scope

Jerry instructed: 「真人客服這個幫我取消掉好了，你再去查看github上面的檔案，再幫我執行」. The immediate preceding handoff requested the additional human privacy-request rehearsal prepared in J-004-r8. That additional acceptance procedure, HPR-01–03, is **CANCELLED_BY_OWNER** and no longer blocks D-05 or J-004. No extra email, phone call or human training report is required. Cancellation is not a PASS or evidence that an identity was verified.

The existing synthetic HTTP/CLI/SQL suite supplies technical verification. Any fresh execution must record its exact source commit, actual result and isolated scope separately; it must not enter deployed E2E results or assert actual human processing.

## Operational duties that still apply

The existing request mailbox `viz963@gmail.com`, named DATA_STEWARD responsibility, minimal original-contact/authorized-proxy checks for actual no-token requests, private exports, authorization, transactional audit, withdrawal, deletion, cleanup and backup replay remain. The original MVP's D-06 Lead handoff is a separate operation and is not removed by cancellation of this extra customer-support exercise.

The immutable Oct 5 candidate notice and review JSON are unchanged. No new legal opinion, actual identity check, reply or approval-condition completion is asserted. `activationAllowed=false` and the formal consent registry remains DRAFT. Remaining physical-backup/copy-retirement, consent and deployment checks still require their own evidence. The human backup-retirement checkpoint before any receipt purge is separate from HPR-01–03 and is not cancelled.

## GitHub review and next execution

Latest staging was fetched before this change; there were no open PRs. Issues #88 (two New Taipei source network timeouts), #49 (resource integration acceptance) and #25 (historical fixture tracking) remained open. Their acceptance conditions are not satisfied merely by this document.

This change does not create a paid project, restore the shared acceptance DB, purge receipts, send external mail, enable formal consent, publish production or reduce the 49 deployed E2E cases.

## Actual technical verification after cancellation

GitHub Actions [Local HTTP integration run 37640198303](https://github.com/viz963-1216/Kareo/actions/runs/37640198303), manually dispatched on staging `bb1899257cac6e6b821c662e51787418d953c3d3`, completed SUCCESS. The source checkout was clean. Actual suite time: 2026-10-07 14:51:54.435–14:52:04.540 UTC (22:51:54–22:52:04 Asia/Taipei). **50 unique LOCAL cases PASS, 0 FAIL**; raw artifact report preserved unchanged in [evidence](evidence/J004-2026-10-07-local-http-integration.json). Artifact 11491249975 ZIP SHA-256: `6bc2d3d8cb2e415c5f9c6050200585da9f087e1f128ce59c75f358fce2f37f38`, matched before extraction.

The workflow used disposable PostgreSQL 17.11, checksum-verified official PostgREST 16.4, actual supabase-js, bundled Functions and the protected CLI. All 28 migrations applied. LOCAL-42–46 verify refusal of missing/incorrect authorization, private case export, correction, stop and delete with synthetic verification attestations. LOCAL-47–49 verify journal failure handling; LOCAL-35–37 verify cleanup rollback/retry; LOCAL-39–40 verify synthetic application restore and deletion replay.

`scope=LOCAL-INTEGRATION-ONLY`, `releaseAcceptance=false`, `cloudWrites=0`. The real consent contract stayed DRAFT. This is technical proof from an isolated GitHub runner, not actual human identity confirmation, a browser operation review, Supabase physical restore, daily scheduler evidence or a deployed 49-case E2E result. The documentation-only cancellation change does not modify the application code exercised at the recorded source commit.
