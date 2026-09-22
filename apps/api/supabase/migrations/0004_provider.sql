-- TASK-B-004: 最小 migration，僅建立 Provider / ProviderService / ProviderServiceArea 資料表。
-- 依 docs/DATA_MODEL.md 第 17-19 節。不得順便建立 Recommendation / Lead / Knowledge / Crawler Schema。

create table if not exists providers (
  id text primary key,
  name text not null,
  type text not null,
  address text not null,
  city text not null,
  district text not null,
  lat double precision,
  lng double precision,
  phone text,
  website text,
  google_maps_url text,
  status text not null,
  verified boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists provider_services (
  id text primary key,
  provider_id text not null references providers (id),
  service_type text not null,
  active boolean not null default true
);

create table if not exists provider_service_areas (
  id text primary key,
  provider_id text not null references providers (id),
  city text not null,
  district text not null,
  active boolean not null default true
);

create index if not exists provider_services_provider_id_idx on provider_services (provider_id);
create index if not exists provider_service_areas_provider_id_idx on provider_service_areas (provider_id);
create index if not exists provider_service_areas_lookup_idx on provider_service_areas (city, district);

-- 延續 0002 / 0003 相同原則：Provider 資料由 Kareo Backend 統一管理讀寫，
-- Frontend 不得繞過 Kareo API 直接查詢核心 Business Tables（依 tasks/TASK-B-004.md）。
alter table providers enable row level security;
alter table provider_services enable row level security;
alter table provider_service_areas enable row level security;
revoke all on table providers, provider_services, provider_service_areas from anon, authenticated;
grant select, insert, update, delete on table providers, provider_services, provider_service_areas to service_role;
