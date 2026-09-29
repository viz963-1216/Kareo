-- TASK-B-010: 正式規則引擎所需的 Assessment 欄位與原子寫入函式。
-- 依 docs/DATA_MODEL.md v0.2.2 §7 與 docs/API_CONTRACT.md v0.2.2 §8（J-002-r4，PR #31 合併後生效）。
-- 編號跳過 0008：0008_session_token.sql 由 B-011a（PR #32）使用；本檔與 0008 無相依。

-- DATA_MODEL §7：rulesVersion、ruleTrace（只存規則 ID、模板 ID、知識 recordId；不存自由文字或命中片段）。
-- 既有列為 Fake Adapter 時期資料，沒有規則版本，因此欄位允許 null；新寫入一律由 create_assessment_with_profile 填入。
alter table assessments add column if not exists rules_version text;
alter table assessments add column if not exists rule_trace jsonb;

-- API_CONTRACT §8：precision = NONE／CITY 時 city／district 為 null。
alter table assessments alter column city drop not null;
alter table assessments alter column district drop not null;

-- ARCHITECTURE §22 / D-10 模式：Assessment 與 CareNeedProfile 在同一個交易內寫入，
-- 任一步失敗整個交易回滾，不留下沒有結果的 COMPLETED Assessment。
-- 只負責寫入，不含業務規則；SQL 錯誤直接讓交易失敗，由 Node 端轉成安全錯誤。
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
    home_care_need, medical_nursing_need, assistive_device_need, transportation_need,
    free_text, status, knowledge_version, rules_version, rule_trace, created_at, updated_at
  ) values (
    a ->> 'id', a ->> 'session_id', a ->> 'age_range', a ->> 'city', a ->> 'district',
    a ->> 'location_precision', (a ->> 'lat')::double precision, (a ->> 'lng')::double precision,
    a ->> 'living_situation', a ->> 'caregiver_situation', a ->> 'mobility_level', a ->> 'daily_living_level',
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
