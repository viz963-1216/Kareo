# J-004-r15 / A-008-r4 — New Taipei official home-care catalogue

Date: 2026-10-08. Owner-authorized central execution, Issue #106. Existing Kareo acceptance project only: `ojawadobnaxduxybqolk`.

## Scope / kickoff understanding

Task: collect the official New Taipei home-care catalogue linked by its health bureau, reconcile all institutions, import public data and verify reading. A owns `data/providers/**`; central J owns spec clarification, tasks, local HTTP regression evidence and publication. Forbidden: secrets, Kareocar/other databases, paid production project, health/contact writes, inferred service coverage or consent activation. Input: current official PDF and protected staging aa7450a (800 public resources); output: all 366 dispositions and 318 new providers with 1394 confirmed area additions, read verification and traceable source snapshots. Acceptance: originals intact, suspension excluded, independent source flags correct, >1000 records readable, atomic delta import and observed public version.

## Change and validation

24-page official1151007 PDF: 366 source rows, 48 merged-existing IDs, 318 new; one suspended provider excluded from active lookup/recommendation. Four outside-city offices have only evidenced New Taipei service areas. No office city is rewritten. Original 800 core Provider rows and every original Service/Area/ContractRegion row are protected; previously verified area claims remain, subsequent official claims stored separately in QA `additionalSources`.

Totals: 1118 resources / 1117 ACTIVE; 517 home-care / 516 ACTIVE; 3 home-medical/nursing, 581 assistive merchants and 17 query-only centers. Services1101, areas2517, contracts588, public metadata1111. Coordinates for new providers are null. Re-extraction from actual PDF matched all366 public rows exactly; source hashes and exhaustive reconciliation passed. Data QA71/71. Dev gate115 PASS,0 FAIL,49 PENDING.

LOCAL-04 now reads every active Provider beyond the 1000-row boundary and every New Taipei official service-area result via real local HTTP/PostgREST; it checks outside-city eligibility and suspended detail rejection. All50 local cases retained. CI/localHTTP results will be linked after execution.

The public snapshot adapter previously discarded every outside-city office by location even when confirmed service areas were in New Taipei. It now accepts ACTIVE institutions with directly sourced Taipei/New Taipei service areas; assessments and query filters still reject other service cities. Public adapter tests compare real recommendations with the official district evidence and check suspension/cross-city eligibility. No backend business logic was changed.

First head89b6d94: all8 engineeringCI jobs passed, but LOCAL-15's obsolete expectation of DISTANCE for the entire New Taipei catalogue correctly failed: new source providers lack verified coordinates and must downgrade. The revision asserts full-catalogue DISTRICT_ROTATION with null distances, then verifies distance ordering in a controlled LOCAL-only fixture using three existing officially verified providers. LOCAL-28 proves a real DISTANCE→DISTRICT_ROTATION downgrade after removing one coordinate in that same controlled fixture. It does not add coordinates or remove source providers from the actual dataset. LOCAL-30 now checks ACTIVE count rather than including a suspended provider. Full50 results must pass at the revised head before merge.

## Guarded cloud import plan

Before mutation four current cloud table counts/hashes: providers800 `8c7d0f47df51ae0179f8779636af245a` (excluding public_info), services783 `28780366bb05d5c0df526a73f0f5ae3d`, areas1123 `93a04dc6c980c2818bac7ded6ef01128`, contracts588 `173f7e4d333cd349126623db3c461e65`. Lock and re-check them in the same transaction; call existing atomic `import_provider_dataset` with new rows only, update only public metadata for the48 retained IDs, and verify the original protected IDs' hashes again before COMMIT. No schema or RLS change; no health or Lead operations.

This section is a plan until actual execution evidence is recorded in the PR conversation. Pages is a static publication of real public records with local rules, not the server API or formal49 deployed E2E. D-05 remains DRAFT and J-003 Integrated remains false.
