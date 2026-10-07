# J-004-r7 — Read-only erasure evidence before receipt retirement

> 2026-10-07 最新決定（J-004-r9）：Jerry 取消額外真人客服／權利演練 HPR-01～03，狀態為 CANCELLED_BY_OWNER，不再列為驗收阻擋。實際申請核對、刪除請求信箱及原 MVP Lead 接件責任保留；D-05 仍 DRAFT、完整 J-003／J-004 未完成。見 [決定紀錄](D05-2026-10-07-owner-rehearsal-cancellation.md)。

Base: staging `6e4945d3b4c629742b97b6e00b28f5dc65ce22ec`. Jerry has authorized central completion of ABCJ. Scope: internal scripts, tests, workflow and operational documentation only; no business module, schema, visitor API, immutable consent text, paid resource or main release changes.

## What the tool actually checks

`node scripts/check-erasure-readiness.mjs` takes **no arguments**. It accepts only the existing Kareo acceptance project/site and personal operator, from existing server-side environment secrets. It authenticates the active personal DATA_STEWARD before reading any journal, verifies Netlify site identity, validates the full project-bound journal, then reads exact HEAD counts through the actual supabase-js client. It rechecks authorization, repeats the counts and reads the journal again. Foreign/duplicate/malformed receipt, null count, provider error, changed counts/journal or revoked access stops with sanitized output. No keys, Session IDs, hashes of those IDs, health/contact values or receipt timestamps enter the output.

Four global health-table counts must be zero. For receipt-linked Sessions, any existing row must be DELETED; there may be no open Lead or non-null contact field. Retained terminal cases and consent records are counted separately and are **not** claimed fully erased. Missing Session rows are compatible with erasure; an empty journal yields NO_RECEIPTS_TO_CHECK, not successful receipt validation.

This first operational check is deliberately conservative: unrelated valid health records also produce NOT_ESTABLISHED. It never fetches health answers to distinguish them. Counts are two separate nontransactional observations, **not a locked snapshot**; equality detects some changes, not all possible intervening writes. Output is a timestamped observation, never a future purge capability. Valid completion/exit 0 means only that the read completed, not that erasure, D-05, backups or release passed.

## Retirement stays blocked

Every output retains `receiptPurgeAllowed=false`, `activationAllowed=false`, `physicalRestoreVerified=false`. Six independent requirements remain PENDING: actual physical restore; vendor recoverable copies; manual/offline copies; incident exports/logs; journal/vendor support copies; human retirement checkpoint. The tool does not accept an operator-written inventory as proof, cannot delete receipts and cannot mark the immutable owner-review conditions satisfied.

The [Oct 7 actual physical backup inventory](D05-2026-10-07-backup-inventory.md) remains separate. No age-based seven-day purge, shared DB restore, credential-scope expansion or paid isolated project is introduced.

## Execution

The manual GitHub Actions workflow **Acceptance read-only erasure readiness** runs only on this repository's staging ref, in the existing staging environment. It shares the retention workflow's concurrency group and uses Ubuntu 24.04 / Node 22. It builds the API dependencies, executes this read-only script, and saves the sanitized report for seven days. There is no schedule, input to enable writes or PR secret access. It uses the previously delegated credentials without displaying them.

Local safety regressions: 11 PASS, covering actual receipt validation, wrong target/auth-before-I/O, transport corruption, current-data leftovers, retained evidence, empty journal, invalid counts, changed observations/revocation, HEAD-only filters and bounded batches. Actual cloud execution is **PENDING until an Actions run and its report are inspected**; no deployment E2E result is added.

Documentation sources checked October 7: [Supabase exact counts](https://supabase.com/docs/reference/javascript/select), [backup coverage/restore](https://supabase.com/docs/guides/platform/backups), [Netlify Blobs consistency](https://docs.netlify.com/build/data-and-storage/netlify-blobs/). Changelog checked before implementation; no new tables, grants, library upgrade, ltree indexes or legacy-cipher changes are required for these read-only existing-table queries.

D-05 remains OWNER_APPROVED_CONDITIONAL, registry DRAFT; J-003 Integrated and J-004 release remain incomplete.

## Actual cloud execution, J-004-r8

The implementation PR [#100](https://github.com/viz963-1216/Kareo/pull/100) head `2765e6f3bb7fada6ce3dfaf48fda28dfd7a8918a` passed all eight CI jobs ([run 37635458790](https://github.com/viz963-1216/Kareo/actions/runs/37635458790)) and Netlify Preview. It was squash merged as `52e28ee9a8aa9a7ae2e384d957ceeeaa157ffa25`.

The new manual workflow was actually dispatched on that staging commit: [run 37635755368](https://github.com/viz963-1216/Kareo/actions/runs/37635755368), job `112841421543`, SUCCESS. Its real observation ran **2026-10-07 14:20:02.294–14:20:13.335 UTC** (22:20 Asia/Taipei). The [raw sanitized report](evidence/J004-2026-10-07-cloud-erasure-readiness.json) is extracted from its actual JSON log line without altering values. Artifact `11488941190` is acceptance-erasure-readiness, 957 bytes, ZIP SHA-256 `cac958db16c4ff16a3518572e25e17d5ff334b4771be0e0b2f71a3ac8bdfa31a`; original retention expires October 14.

- Complete project-bound journal: **2 receipts / 2 distinct Sessions**, both existing Sessions DELETED.
- Assessments / profiles / recommendation runs / items: **0 / 0 / 0 / 0**.
- Receipt-linked open Lead / non-null contact / retained case / retained consent: **0 / 0 / 0 / 0**.
- Repeated journal and count observations: unchanged. Outcome `OBSERVED_HEALTH_AND_OUTREACH_ERASURE`; this is limited to current erasure observations.
- All six backup requirements remain PENDING; purge, ACTIVE and physical-restore verification remain false.

An [independent SQL observation](evidence/J004-2026-10-07-cloud-erasure-no-write.json) at UTC 14:18:06.414091 and 14:21:53.988677 matched: all 10 Session rows' aggregate digest, assessments/leads/consents 0, deletion_runs 4, privacy_operations 0. This corroborates no observed Session change or new cleanup/rights audit. It is not proof against every possible intervening transaction, and it does not attribute all four DELETED Sessions to these two receipts.

No Session created/deleted, health/contact data written, receipt purged, backup restored, permission expanded, owner decision forged or E2E result added. The green workflow means successful observation only. Current D-05 and release conditions remain unchanged.
