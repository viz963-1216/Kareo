# J-004-r7 — Read-only erasure evidence before receipt retirement

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
