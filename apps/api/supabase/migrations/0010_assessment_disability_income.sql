-- TASK-B-010-r2: D-17／D-17a 新增選填欄位。
-- 依 docs/DATA_MODEL.md v0.5/v0.6 §8a／§8b、docs/MVP_DECISIONS.md D-17／D-17a（2026-09-24 SPEC-APPROVED）。
-- 兩者皆選填、預設 UNKNOWN；屬敏感資料，保存與刪除同 Assessment（PRIVACY_AND_RETENTION §2）。

alter table assessments add column if not exists disability_certificate text not null default 'UNKNOWN';
alter table assessments add column if not exists income_category text not null default 'UNKNOWN';

alter table assessments
  add constraint assessments_disability_certificate_check
  check (disability_certificate in ('YES', 'NO', 'UNKNOWN'));

alter table assessments
  add constraint assessments_income_category_check
  check (income_category in ('LOW_INCOME', 'MIDDLE_LOW_INCOME', 'ALLOWANCE', 'GENERAL', 'UNKNOWN'));

-- create_assessment_with_profile（migration 0009）需要一併重建以寫入這兩個新欄位。
create or replace function public.create_assessment_with_profile(payload jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  a jsonb := payload -> 'assessment';
  p jsonb := payload -> 'care_need_profile';
begin
  if (a ->> 'rules_version') is null or (a -> 'rule_trace') is null then
    raise exception 'create_assessment_with_profile: rules_version and rule_trace are required';
  end if;

  insert into public.assessments (
    id, session_id, age_range, city, district, location_precision, lat, lng,
    living_situation, caregiver_situation, mobility_level, daily_living_level,
    disability_certificate, income_category,
    home_care_need, medical_nursing_need, assistive_device_need, transportation_need,
    free_text, status, knowledge_version, rules_version, rule_trace, created_at, updated_at
  ) values (
    a ->> 'id', a ->> 'session_id', a ->> 'age_range', a ->> 'city', a ->> 'district',
    a ->> 'location_precision', (a ->> 'lat')::double precision, (a ->> 'lng')::double precision,
    a ->> 'living_situation', a ->> 'caregiver_situation', a ->> 'mobility_level', a ->> 'daily_living_level',
    coalesce(a ->> 'disability_certificate', 'UNKNOWN'), coalesce(a ->> 'income_category', 'UNKNOWN'),
    a ->> 'home_care_need', a ->> 'medical_nursing_need', a ->> 'assistive_device_need', a ->> 'transportation_need',
    coalesce(a ->> 'free_text', ''), a ->> 'status', a ->> 'knowledge_version', a ->> 'rules_version', a -> 'rule_trace',
    (a ->> 'created_at')::timestamptz, (a ->> 'updated_at')::timestamptz
  );

  insert into public.care_need_profiles (id, assessment_id, care_needs, priority, summary, warnings, created_at)
  values (
    p ->> 'id',
    p ->> 'assessment_id',
    array(select jsonb_array_elements_text(coalesce(p -> 'care_needs', '[]'::jsonb))),
    array(select jsonb_array_elements_text(coalesce(p -> 'priority', '[]'::jsonb))),
    p ->> 'summary',
    array(select jsonb_array_elements_text(coalesce(p -> 'warnings', '[]'::jsonb))),
    (p ->> 'created_at')::timestamptz
  );
end;
$$;

revoke execute on function public.create_assessment_with_profile(jsonb) from public, anon, authenticated;
grant execute on function public.create_assessment_with_profile(jsonb) to service_role;
