# J-003-r31 — Genuine expired-token rejection and public query verification

**Integrated: NO.** Required deployed cases now total **7 PASS / 0 FAIL / 42 PENDING**: E2E-01, 03, 12, 16, **17**, 21 and 27. Full release gate: **122 PASS / 0 FAIL / 42 PENDING**, exit failure. The 122 includes development checks, not 122 E2E cases. The actual existing target is `https://kareo-tw.netlify.app`, release SHA `56500c835df2869ad7e4540f6f0730cb31ccbbcd`, deploy `6ac7631c4b91470008fb7960`.

Repository base: staging `55591764cbed6514f4b1ceed3a3cc1bca65e614e` after PR #118. This tool/docs submission does not change the deployment or business logic. No new Netlify deployment, new Supabase project or formal-consent activation occurred.

## Actual E2E-17

[Generated deployment receipt](../../tests/e2e/results/token-expiry-2026-10-09.json), actual execution **08:54:59.963–08:56:26.296Z** (16:54–16:56 Asia/Taipei). Both deployment markers equal the exact target above.

| Actual request/control | HTTP | Code |
|---|---:|---|
| Missing possession token | 401 | SESSION_INVALID |
| Malformed token | 401 | SESSION_INVALID |
| Forged correctly shaped token | 401 | SESSION_INVALID |
| The newly created real empty Session's valid token, before expiry | 403 | CONSENT_REQUIRED |
| That same token, after its actual database expiry is made past | 401 | SESSION_INVALID |

Only the exact recent owned empty acceptance fixture's `expires_at` was changed through guarded Supabase connector SQL, then restored briefly so its actual DELETE could request cleanup. SQL locks the ACTIVE row and checks ID, hashed token, exact creation time, age under 30 minutes and absence of consent/assessment/Lead data; the plaintext token never enters SQL or committed evidence. Assessment probes send only Session ID, no health/location/contact payload. The repeated DELETE is rejected, confirming invalidation.

This verifies the deployed token rejection behavior against a genuinely expired database record, with a valid-token control. It does **not** demonstrate waiting through seven days of inactivity or a 30-day absolute lifetime. Neither the DRAFT consent nor the full personal-data write runner was bypassed. An interrupted coordination step attempts restore and cleanup; abrupt process termination still requires the documented connector recovery procedure.

## Normal cleanup follow-up

The existing protected cleanup workflow was **manually rerun**, [run 37846636139, attempt 3](https://github.com/viz963-1216/Kareo/actions/runs/37846636139), job `113746384850`, checked-out SHA `c3d12f3313a95f25162a1503be624f3b0617f8c0`. Actual **08:57:02Z** output: `Mode: commit`, `Status: SUCCESS`, Sessions deleted **1**, Lead contact fields cleared **0**, Leads deleted **0**, Consents deleted **0**.

Subsequent read-only cloud aggregates confirm **6 ACTIVE / 0 DELETION_REQUESTED / 6 DELETED Session tombstones**, **0 Consents / 0 Assessments / 0 Leads**. Before this fixture the DELETED count was 5. The original receipt's at-time `physicalDeletionVerified: false` is retained; this follow-up records subsequent actual clearing. Tombstones persist by design. Do not describe a manual rerun as a new autonomous scheduled execution, or empty-Session cleanup as health/Lead deletion or backup erasure. E2E-37 remains PENDING.

## Public GET component checks

[Final matrix receipt](evidence/J003-2026-10-09-public-query-matrix.json): **27 PASS / 0 FAIL**, 2026-10-09T09:06:59.345Z to 2026-10-09T09:08:21.598Z, both markers match the target. This is GET-only evidence, kept **outside** `tests/e2e/results/` with `releaseAcceptance: false`. Formal Provider files, services, verified areas, contracts and public-info sidecar are SHA-256 fingerprinted and used as independent data expectations. Active totals: **1,117 resources**, including **516 HOME_CARE / 3 HOME_MEDICAL_NURSING / 581 ASSISTIVE_DEVICE / 17 centers**. Collection total remains 1,118, including one inactive entry.

Checks cover first/second page and duplicate IDs, service/category totals, both contract cities, PURCHASE/SMART_TECH classifications, actual An-Yi name/city/district search, unknown service-area exclusion and explicit inclusion, empty and out-of-range pages, rejected unsupported city/district/distance-sort/center-service combinations, and public knowledge minimal fields/effective dates/official sources/jurisdiction filters/empty and invalid inputs. The API exposes only permitted public fields; internal coordinates, rank, status and knowledge rule/review fields are excluded.

The [initial receipt](evidence/J003-2026-10-09-public-query-initial-assertions.json) retains 21 passes and six failed **test assumptions**. These were traced to an empty-result notice expectation and an overly narrow government-domain expectation, not changed backend behavior: API_CONTRACT §10a allows the 1966 empty notice, and official Taipei sources in the registry use `gov.taipei`. The checker was corrected accordingly and the full matrix rerun. Responses were not rewritten or replaced by Mock data.

Actual Chrome operations on the same public deployment confirmed: center category returns **17** entries and disables service/assistive-program filters; submitting “其他縣市” shows the dual-city limit and 1966 reminder; clearing conditions resets the form; SMART_TECH returns **4** actual merchants with official sources and the warning that a contract does not establish home service. This is partial UI evidence. Changing the city selection alone retains previous results until submitting; the limit is verified **after submission**. The actual `/info` page was also filtered to 新北市／喘息服務: empty results retained `KB-2026-09-24-001`, suggested changing filters or calling 1966, and did not display a fabricated record.

Complete E2E-44/45/47/48 remain PENDING. Browser request capture proving no Session calls, actual network failure/retry, no-published-version UI and the applicable recommendation/Lead boundaries are not inferred from successful GETs. No publication was withdrawn to manufacture a no-version state; no rate limit was deliberately exhausted. No consent/health/contact/Lead/admin request was submitted by the matrix.

## Validation and remaining work

- Root scripts/adapter/safety tests: **117 PASS / 0 FAIL**, including token leak/injection guards, the known-bad expired-token acceptance counterexample and restore/cleanup after coordination failure.
- Exact-target release gate: **122 PASS / 0 FAIL / 42 PENDING**, expected failure; all 49 required cases retained.
- PR CI must pass at the exact head before merging. It does not count as deployed E2E.
- D-05 remains OWNER_APPROVED_CONDITIONAL, activationAllowed=false, formal consent DRAFT. No health/GPS/contact/Lead writes.
- Actual independent physical-backup restore/deletion replay remains deferred by Jerry's decision not to add the paid restore project; no substitute local logical restore is counted.
- Two official careyou sources still time out from cloud/Tokyo; the regional helper remains dormant and issue #88 open. No new blind crawler retry or deployment is counted here.

Continue with complete public-query browser request/failure evidence and the remaining version-specific cases. Full J-003 requires the retained privacy/restore/environment conditions and actual main-flow/lifecycle acceptance; no percentage of overall development is inferred from 7/49.
