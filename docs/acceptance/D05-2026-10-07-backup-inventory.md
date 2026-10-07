# D-05 / J-004 — Actual backup inventory, 2026-10-07

Source: authenticated read-only Supabase [Kareo scheduled backups](https://supabase.com/dashboard/project/ojawadobnaxduxybqolk/database/backups/scheduled), observed 2026-10-07 about 12:12 Asia/Taipei. Project `ojawadobnaxduxybqolk`, organization viz963-1216's Org (Pro). This remains the user-designated acceptance project; dashboard branch label “main Production” is not a release decision.

## Observed recoverable snapshots

| UTC backup time | Asia/Taipei |
|---|---|
| 2026-10-06 20:55:22 | 2026-10-07 04:55:22 |
| 2026-10-05 20:56:14 | 2026-10-06 04:56:14 |
| 2026-10-04 20:54:26 | 2026-10-05 04:54:26 |
| 2026-10-03 20:57:14 | 2026-10-04 04:57:14 |
| 2026-10-02 21:08:28 | 2026-10-03 05:08:28 |
| 2026-09-30 20:04:54 | 2026-10-01 04:04:54 |

Six rows are visible, all Physical, each with Restore and no Download control. Do not infer seven current copies or continuous daily coverage; no October 1 UTC row is displayed. [Official Supabase backup documentation](https://supabase.com/docs/guides/platform/backups) distinguishes physical restore from manual logical dumps and notes Storage objects are excluded. The page itself also displays that exclusion. Storage metadata in a DB backup is not a file backup.

The latest listed backup predates the two disposable no-health Sessions used in the Oct 7 cloud/deployment probes. Those probes therefore do not show erasure replay against any of these actual physical copies. The single-row replay already performed and local application restores stay separate evidence.

## Restore checkpoint prepared, not executed

No Restore was clicked, no copy downloaded, no new project purchased and no current database overwritten. In-place restore would interrupt this shared acceptance project and replace its current state. Jerry declined creating a second paid project. Physical restoration therefore remains BLOCKED on an approved isolated destination/method; manual logical restore does not substitute for physical evidence.

Before a future isolated restore, record source backup timestamp, target project/ref, cost authorization if applicable, DB version, notifications/schedules disabled and entry closed. Target must differ from this shared project, all production databases and Kareocar. Keep restored contents private. After restore, use an independently authorized DATA_STEWARD and the official journal replay/recorded cleanup entry before visitors or outreach resume; check schema/RLS/RPC, knowledge membership and all affected erasures plus unrelated records. Record actual RPO/RTO; no assumed threshold or PASS.

## Deletion receipt retirement checklist

The six rows only inventory vendor-visible DB snapshots. Manual/offline copies, incident exports, logs, Netlify journal store and vendor support copies must be inventoried separately; none is certified retired by this page. For each receipt, first verify current erasure, terminal case status and absence of all affected recoverable copies. Record authorized steward, time, affected inventory references and action outcome in restricted operational evidence. Only then may the protected purge procedure remove that receipt. A fixed seven-day timer or absence from this page is insufficient. No receipt was purged, and there is no automated purge implementation in this revision.

D-05 remains OWNER_APPROVED_CONDITIONAL, approvalConditionsSatisfied=false, activationAllowed=false; consent registry stays DRAFT. This inventory neither supplies a legal opinion nor completes J-003/J-004.

J-004-r7 adds a [protected read-only current-erasure check](J004-2026-10-07-erasure-readiness.md). It prepares counts for the above checkpoint, never certifies vendor copies or permits purge. The actual six physical backups and isolated restore remain unverified by this new tool.
