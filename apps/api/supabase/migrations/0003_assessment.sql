-- TASK-B-003: 最小 migration，僅建立 Assessment / CareNeedProfile 所需資料表。
-- 依 docs/DATA_MODEL.md 第 7、16 節。不得順便建立 Provider / Recommendation / Lead / Knowledge / Crawler Schema。

create table if not exists assessments (
  id text primary key,
  session_id text not null references sessions (id),
  age_range text not null,
  city text not null,
  district text not null,
  location_precision text not null,
  lat double precision,
  lng double precision,
  living_situation text not null,
  caregiver_situation text not null,
  mobility_level text not null,
  daily_living_level text not null,
  home_care_need text not null,
  medical_nursing_need text not null,
  assistive_device_need text not null,
  transportation_need text not null,
  free_text text not null default '',
  status text not null,
  knowledge_version text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists care_need_profiles (
  id text primary key,
  assessment_id text not null references assessments (id),
  care_needs text[] not null default '{}',
  priority text[] not null default '{}',
  summary text not null,
  warnings text[] not null default '{}',
  created_at timestamptz not null
);

create index if not exists assessments_session_id_idx on assessments (session_id);
create index if not exists care_need_profiles_assessment_id_idx on care_need_profiles (assessment_id);

-- 依 apps/api/supabase/migrations/0002_session_consent_access.sql 相同原則：
-- 只有 Backend（service_role）可存取，前端不得繞過 Kareo API 直接讀寫。
alter table assessments enable row level security;
alter table care_need_profiles enable row level security;
revoke all on table assessments, care_need_profiles from anon, authenticated;
grant select, insert, update, delete on table assessments, care_need_profiles to service_role;
