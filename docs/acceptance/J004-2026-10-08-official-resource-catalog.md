# J-004-r13 / A-008-r2 — Official public resource catalogue

Date: 2026-10-08. Owner-authorized central integration. Issue #106.

## Change

198 official home-care input rows have explicit dispositions: 197 in-scope retained/merged and one Keelung uncontracted row excluded. Existing 36 resources are preserved. The expanded canonical inventory is 803 resources: 199 home-care providers, 3 home-medical/nursing providers, 584 assistive merchants/locations and 17 centers/branches. There are 786 service rows, 1,123 confirmed area rows, 591 contract-region rows and 794 public metadata rows.

Official Taipei assistive classifications: 577 distinct records marked PURCHASE (long-term-care/disability purchase directories), and 4 SMART_TECH. These programme counts can overlap and do not equal all 584 merchants: some retained merchants have no classification evidence. Current official SMART address for 益康 is 60號; older ODS 6號 is not adopted. Directory classifications never infer delivery coverage or subsidy approval.

Original five center IDs remain mandatory. New sourced branches are allowed; all 17 remain query-only OTHER records without ProviderService. Public consultation/evaluation/recycling/repair information and appointment/branch limitations are shown independently of recommendation services. 汐南 is geographically Taipei Nangang even though it is in the New Taipei center network.

## Validation before cloud import / publication

- Backend typecheck and tests, frontend typecheck/tests/real build.
- A-004 data validation; A-003 evidence; A-007 original rows and center rules; new exhaustive source reconciliation.
- Negative controls: source row/provider deletion, invented merchant delivery areas, center eligibility, malformed/private metadata, and a later page failure after 1,000 rows.
- SQL metadata round-trip and old importer compatibility: actual 0029 function in PGlite; a failing child row rolls back metadata.
- Fresh and upgrade-from-0008 isolated DB: 24 / 28 PASS, 0 FAIL.
- Built Functions: 86 PASS, 0 FAIL. Dev gate: 115 PASS, 0 FAIL, 49 PENDING.

Exact PR CI, acceptance DB delta-import and public Pages version observations are appended after execution. Until then, this document does not claim those steps completed.

## Data traceability

See `data/providers/qa/official-catalog-report.md`, machine manifest and original snapshots. Public phone normalization retains the first main number and explicit extension while preserving full source text. Original address discrepancies are disclosed in public metadata rather than silently overwriting the immutable baseline. New coordinates remain null. Failed official evaluation results remain visible in details and recommendation reminders.

This work does not activate formal D-05, create real assessment/Lead records, approve subsidy eligibility, establish complete coverage of every New Taipei provider, or count local/Pages checks toward 49 deployed release E2E cases. J-003 Integrated remains false.
