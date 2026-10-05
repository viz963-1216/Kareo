# D-05 protected data rights verification

Submission Version: B-015-r1 / J central integration
Date: 2026-10-05 Asia/Taipei
Base: staging 8d11cd3d68bf3d66cac5c561c71a8ff0ae2cf042; local working tree recorded dirty.

Implemented DATA_STEWARD-only privacy CLI with private request/export files. Node and SQL each authenticate the active personal operator; an identifier alone is not identity proof. Exact case export omits token/hash/key and unrelated sessions. Contact corrections preserve scope and cannot resurrect an erased contact. Assessment correction reuses the existing validator, current published resolver and real engine; replaces the profile, removes stale recommendations, stops unresolved outreach and writes minimal audit in one transaction. Lost-token STOP/DELETE use the existing business RPCs. No public administrative route.

Forward migration 0027 came from Supabase CLI 2.119.0 migration new privacy_rights (20261005030522), then numbered per repository. Table RLS and visitor-role EXECUTE denial verified; function is security invoker. Minimal rights audit is bounded to 1 year and pruned with recorded cleanup; contains no original health/contact values or proof documents. No actual messages sent or individual identity certified.

Evidence: actual PostgreSQL 17 / official PostgREST / bundled Functions / supabase-js / protected real CLI, 46/46 local PASS, including LOCAL-42–46. Report evidence/D05-2026-10-05-privacy-rights-local.json. SQL regression includes authorization, proxy verification requirement, wrong target/ref reuse, stale revision/publication, exact export, closed-case contact correction without erased-contact resurrection, atomic audit failure, lost-token stop/delete and retention pruning. Backend typecheck and 740 tests passed; isolated fresh DB 24 PASS (19 behaviour / 5 schema), 0 FAIL. The DB privilege verifier distinguishes trigger bodies from directly callable RPCs while checking visitor denial for both. Final head CI is authoritative for all submitted changes.

Limitations: no cloud migration/rights operation yet; private export not emailed; human verification only synthetic attestation; no independent production deletion journal or physical backup restored. This does not activate D-05 or count any of the 49 deployed E2E cases. Actual Netlify/Supabase account setup and deployed verification remain.

Post-submission update: PR #81 head d4cc79da0dff0ea18a8103040931978fd6fc3aa9 passed all nine CI jobs and merged to staging e5c13c95a2ceb20887b3d1f38e6655e8ab475ad7. Migration 0027 was applied to the existing acceptance project ojawadobnaxduxybqolk; aggregate checks found zero privacy operations, assessments and leads and visitor-role RPC denial. No real rights request was executed. The original local report remains historical evidence. B-016's independent journal update is documented separately.
