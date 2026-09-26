-- J-003 read-only probe: which Kareo migrations are present in a database.
-- Nothing recorded which migrations were applied to the staging Supabase project (docs/DEPLOYMENT.md asked for
-- a date/operator entry that was never written), and the SQL-editor route leaves no schema_migrations row.
-- This query only READS the catalog (no data, no personal information) and reports each migration's marker.
--
-- Run in the Supabase SQL editor of the project you are checking (or psql). Paste only the result table.
-- Numbering follows the J-003-r5 plan (docs/INTEGRATION_ACCEPTANCE.md「Migration 全域順序」); the file that
-- currently carries each marker is shown in `file`.
with markers(n, file, present) as (values
  ('0001', '0001_session_consent',                     to_regclass('public.sessions') is not null and to_regclass('public.consents') is not null),
  ('0002', '0002_session_consent_access',              coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.consents')), false)),
  ('0003', '0003_assessment',                          to_regclass('public.assessments') is not null and to_regclass('public.care_need_profiles') is not null),
  ('0004', '0004_provider',                            to_regclass('public.providers') is not null and to_regclass('public.provider_service_areas') is not null),
  ('0005', '0005_import_provider_dataset',             to_regprocedure('public.import_provider_dataset(jsonb)') is not null),
  ('0006', '0006_knowledge',                           to_regclass('public.knowledge_records') is not null and to_regclass('public.knowledge_changes') is not null),
  ('0007', '0007_knowledge_publish_withdraw',          to_regprocedure('public.publish_knowledge_version(jsonb)') is not null),
  ('0008', '0008_session_token',                       exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sessions' and column_name = 'token_hash')),
  ('0009', '0009_assessment_rules_engine (#33)',       exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'assessments' and column_name = 'rules_version')),
  ('0010', '0010_assessment_disability_income (#33)',  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'assessments' and column_name = 'income_category')),
  ('0011', '0011_knowledge_publish_carry_forward (#36)', coalesce((select prosrc like '%carried%' from pg_proc where oid = to_regprocedure('public.publish_knowledge_version(jsonb)')), false)),
  ('0012', '0013_knowledge_version_traceability (#36)', to_regclass('public.knowledge_version_records') is not null),
  ('0013', '0009_recommendation (#40)',                to_regclass('public.recommendation_runs') is not null),
  ('0014', '0012_crawler_runs (#37)',                  to_regclass('public.crawler_runs') is not null),
  ('0015', '0013_crawler_hash_traceability (#37)',     exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'crawler_runs' and column_name = 'content_hash'))
)
select n as planned_number, file, present from markers order by n;

-- Only when 0006 is present: upgrade-path facts that decide whether B-008's version-membership table needs a
-- backfill (U2 in tests/db/verify-db.mjs) and whether B-009's de-duplication index can be created.
-- select count(*) filter (where status = 'PUBLISHED') as published_versions, count(*) as all_versions from knowledge_versions;
-- select count(*) as duplicate_open_changes from (select knowledge_record_id, new_content_hash from knowledge_changes
--   where status = 'NEEDS_REVIEW' group by 1, 2 having count(*) > 1) d;
