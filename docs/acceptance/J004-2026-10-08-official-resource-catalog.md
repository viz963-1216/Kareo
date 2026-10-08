# J-004-r14 / A-008-r3 — Official public resource catalogue

Date: 2026-10-08. Owner-authorized central integration. Issue #106.

## Change

198 official home-care input rows have explicit dispositions: 197 in-scope retained/merged and one Keelung uncontracted row excluded. Existing 36 resources are preserved. The expanded canonical inventory is 800 resources: 199 home-care providers, 3 home-medical/nursing providers, 581 assistive merchants/locations and 17 centers/branches. There are 783 service rows, 1,123 confirmed area rows, 588 contract-region rows and 791 public metadata rows.

Official Taipei assistive classifications: 575 distinct records marked PURCHASE (long-term-care/disability purchase directories), and 4 SMART_TECH. These programme counts can overlap and do not equal all 581 merchants: some retained merchants have no classification evidence. Current official SMART address for 益康 is 60號; older ODS 6號 is not adopted. Directory classifications never infer delivery coverage or subsidy approval.

Original five center IDs remain mandatory. New sourced branches are allowed; all 17 remain query-only OTHER records without ProviderService. Public consultation/evaluation/recycling/repair information and appointment/branch limitations are shown independently of recommendation services. 汐南 is geographically Taipei Nangang even though it is in the New Taipei center network.

## Validation before cloud import / publication

- Backend typecheck and tests, frontend typecheck/tests/real build.
- A-004 data validation; A-003 evidence; A-007 original rows and center rules; new exhaustive source reconciliation.
- Negative controls: source row/provider deletion, invented merchant delivery areas, center eligibility, malformed/private metadata, and a later page failure after 1,000 rows.
- SQL metadata round-trip and old importer compatibility: actual 0029 function in PGlite; a failing child row rolls back metadata.
- Fresh and upgrade-from-0008 isolated DB: 24 / 28 PASS, 0 FAIL.
- Built Functions: 86 PASS, 0 FAIL. Dev gate: 115 PASS, 0 FAIL, 49 PENDING.

Exact PR CI, acceptance DB delta-import and public Pages version observations are appended after execution. Until then, this document does not claim those steps completed.

## Executed r13 and r14 correction

- PR #107 merged to staging `b86aeac641738e033976c683002ea7fdc3b8fed5`. Head `1d369691c2e6479d446d2257acb3eef1ac562a9c`: all 8 CI jobs passed (run 37719061430); actual local PostgreSQL/PostgREST/HTTP 50/50 passed (run 37719061491).
- Acceptance project `ojawadobnaxduxybqolk`: 0029 public metadata migration applied; original 36/31/119/19 rows guarded before and after the atomic public delta import. Initial r13 totals 803/786/1123/591; metadata 794. Original content hashes unchanged, RLS enabled and anon/authenticated SELECT denied on all four tables. No health or Lead writes.
- Pages artifact `02afabbb5978f0f5b5b3b468e7177d408fa60aac` published from clean source b86aeac. Actual public manifest matched source SHA and 803 rows. Browser observed PURCHASE 577, SMART_TECH 4, centers 17, working next page and actual public center services.
- That browser review discovered three same-doorplate address spellings. r14 merges their categories and provenance (manifest.addressAliases), bringing current canonical total to 800, merchants 581, services 783, contracts 588, metadata 791, PURCHASE 575, SMART_TECH 4. r14 also restores the first mobile/toll-free source numbers in nine records. All original 36 rows remain unchanged. Data QA now 61/61 passed, including duplicate-location and corrupted-phone negative controls. r14 cloud adjustment and Pages publication require this correction PR to pass before being claimed complete.

## Data traceability

See `data/providers/qa/official-catalog-report.md`, machine manifest and original snapshots. Public phone normalization retains the first main number and explicit extension while preserving full source text. Original address discrepancies are disclosed in public metadata rather than silently overwriting the immutable baseline. New coordinates remain null. Failed official evaluation results remain visible in details and recommendation reminders.

This work does not activate formal D-05, create real assessment/Lead records, approve subsidy eligibility, establish complete coverage of every New Taipei provider, or count local/Pages checks toward 49 deployed release E2E cases. J-003 Integrated remains false.
