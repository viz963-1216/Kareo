# J-003-r19: Personal acceptance operator and protected historical backfill

Date: 2026-10-07 Asia/Taipei. Baseline staging b7ecb602ad3dfd7102d1e10263dff48a7eb5592a.

Jerry authorized creating the personal operator and continuing the outstanding ABCJ closeout. This submission only adds an acceptance-only protected maintenance entry and records actual operator provisioning. It does not complete J-003 or activate D-05.

## Actually completed

At 2026-10-07 11:17:53 Asia/Taipei, the Supabase connector provisioned `OP-SU-ZIJIE-ACCEPTANCE` for 蘇子傑 in Kareo acceptance project `ojawadobnaxduxybqolk`. Roles are the existing `LEAD_OPERATOR`, `DATA_STEWARD`, `KNOWLEDGE_PUBLISHER`; active true, revoked_at null. The three roles correspond to Jerry's previously assigned lead, privacy and knowledge responsibilities. No Kareocar/production database or visitor grants were changed.

The database contains only a SHA-256 hash of a 32-byte random personal key. A read-only comparison confirmed the stored hash matches the generated private key. The local delivery copy has file mode 0600 in a 0700 directory outside the Git checkout. Neither plaintext nor hash is committed in this report. This verifies provisioning, not the cloud management API or a human login.

## Protected backfill entry

`Acceptance historical knowledge backfill` is workflow_dispatch only, defaults to confirm=false, requires the staging environment and exact staging ref. It uses the existing DB secrets and Jerry's `KAREO_OPERATOR_KEY`, with the exact acceptance project/operator guarded before client loading. Only the approved staging workflow can access the environment.

`scripts/backfill-acceptance.mjs` authenticates before reading snapshots, then calls the existing official `runBackfillCli` and repositories using the real Supabase client. It compares every byte-represented field of all 21 knowledge rows, the version, and all 21 version memberships before/after; registers the five previously approved packs and 21 historical decisions; repeats the official entry and checks metadata remains identical. It does not newly approve or publish policy, alter knowledge status/content, or misattribute the historical reviewer/time. Current import attribution is the personal operator under explicit Codex delegation; the run is not a new human review.

Failures remain nonzero, with safe diagnostics. Partial metadata writes are not relabeled success and may be inspected/retried through the same idempotent entry. Snapshot reads are capped and rejected if incomplete. Logs contain counts/digests, not credentials or private case contents.

## Verification and pending cloud evidence

- Three regression checks passed: wrong project/person/config rejected, same-count content/version/membership corruption detected, digest ordering behavior.
- Existing knowledge pack format validation: five approved packs, PASS. This is not a new policy approval.
- Static integration routes/contracts: 25 PASS, zero FAIL.
- Backend build PASS; workflow YAML and default-off/manual/staging configuration PASS; diff check PASS.
- Cloud read-only baseline: 21 knowledge rows, none missing content_fingerprint.
- The individual key must be entered and saved by Jerry in the prepared GitHub form under browser credential-handoff requirements. It was not entered or saved by Codex. Backfill has not run yet.
- No cloud cleanup, withdrawal/delete, or private rights case was executed; no DRAFT changed to ACTIVE; no 49-case deployment result added.

## New schedule observation

The first actual scheduled crawler run [37530400956](https://github.com/viz963-1216/Kareo/actions/runs/37530400956) started 2026-10-07 04:57 Asia/Taipei (configured 00:10). All 18 sources attempted: 15 SUCCESS, 3 FAILED. Both New Taipei CAREYOU sources failed again; SRC-LAW-L0070059 also reported fetch failed. The schedule is observed, but timing and complete success are not accepted. [Issue #88](https://github.com/viz963-1216/Kareo/issues/88) has this actual evidence; do not call it 18/18 success.

The retention workflow's [scheduled run 37531431253](https://github.com/viz963-1216/Kareo/actions/runs/37531431253) was skipped because the protected enablement is not configured. It does not prove cleanup. Remaining setup includes Netlify independent-journal access, protected dry-run/commit/failure-retry, cloud receipt/replay and human rights/lead rehearsal. Account credentials and authorization are not fabricated to pass the gate.

Public version marker was checked on 2026-10-07 and remains 8f509c0567436392b9421bfb2e906d565c6f9438, different from current staging b7ecb60. Full version-bound deployment E2E remain pending.

## Scope

Scripts, workflow, tests, docs and task status only. No business API/response/schema/rules/source registry changes. No paid purchase, production release, protection removal, real health/contact write or fabricated human sign-off.
