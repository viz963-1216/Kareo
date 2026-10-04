-- TASK-B-013：Public Resource Lookup API。依 docs/DATA_MODEL.md 第 17、19b 節
-- （v0.2.5，D-19 Q1／Q2）、docs/API_CONTRACT.md §10、§10a（v0.6）。
-- 只新增欄位／新表，不改既有欄位行為，依「追加（2026-10-01，D-19 Q1／Q2）」明確核准的範圍。

-- ===== 1. providers.resource_category（D-19 Q2）=====
-- 既有資料未提供者視為 SERVICE_PROVIDER（既有服務單位）；輔具資源中心一律 type = OTHER、
-- 沒有 ProviderService（推薦永遠不會選到，驗證在 Node 的 providerImportService 完成）。
alter table providers
  add column if not exists resource_category text not null default 'SERVICE_PROVIDER';

-- ===== 2. ProviderContractRegion（D-19 Q1）=====
-- 記錄「已列於該縣市政府特約名單」的事實，不是服務範圍，推薦不讀取。
create table if not exists provider_contract_regions (
  id text primary key,
  provider_id text not null references providers (id),
  city text not null,
  service_type text not null,
  source_id text,
  checked_at timestamptz,
  active boolean not null default true
);

create index if not exists provider_contract_regions_provider_id_idx on provider_contract_regions (provider_id);

alter table provider_contract_regions enable row level security;
revoke all on table provider_contract_regions from anon, authenticated;
grant select, insert, update, delete on table provider_contract_regions to service_role;

-- ===== 3. import_provider_dataset：擴充支援 resource_category 與 provider_contract_regions =====
-- 沿用既有三張表的寫入邏輯不變，只新增 providers.resource_category 欄位與第四張表的 upsert。
create or replace function public.import_provider_dataset(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  providers_written integer;
  services_written integer;
  areas_written integer;
  contract_regions_written integer;
begin
  insert into public.providers (
    id, name, type, resource_category, address, city, district, lat, lng, phone, website,
    google_maps_url, status, verified, created_at, updated_at
  )
  select
    p.id, p.name, p.type, coalesce(p.resource_category, 'SERVICE_PROVIDER'), p.address, p.city, p.district,
    p.lat, p.lng, p.phone, p.website, p.google_maps_url, p.status, p.verified, p.created_at, p.updated_at
  from jsonb_to_recordset(coalesce(payload -> 'providers', '[]'::jsonb)) as p(
    id text, name text, type text, resource_category text, address text, city text, district text,
    lat double precision, lng double precision, phone text, website text,
    google_maps_url text, status text, verified boolean,
    created_at timestamptz, updated_at timestamptz
  )
  on conflict (id) do update set
    name = excluded.name,
    type = excluded.type,
    resource_category = excluded.resource_category,
    address = excluded.address,
    city = excluded.city,
    district = excluded.district,
    lat = excluded.lat,
    lng = excluded.lng,
    phone = excluded.phone,
    website = excluded.website,
    google_maps_url = excluded.google_maps_url,
    status = excluded.status,
    verified = excluded.verified,
    updated_at = excluded.updated_at;
  get diagnostics providers_written = row_count;

  insert into public.provider_services (id, provider_id, service_type, active)
  select s.id, s.provider_id, s.service_type, s.active
  from jsonb_to_recordset(coalesce(payload -> 'provider_services', '[]'::jsonb)) as s(
    id text, provider_id text, service_type text, active boolean
  )
  on conflict (id) do update set
    provider_id = excluded.provider_id,
    service_type = excluded.service_type,
    active = excluded.active;
  get diagnostics services_written = row_count;

  insert into public.provider_service_areas (id, provider_id, city, district, active)
  select a.id, a.provider_id, a.city, a.district, a.active
  from jsonb_to_recordset(coalesce(payload -> 'provider_service_areas', '[]'::jsonb)) as a(
    id text, provider_id text, city text, district text, active boolean
  )
  on conflict (id) do update set
    provider_id = excluded.provider_id,
    city = excluded.city,
    district = excluded.district,
    active = excluded.active;
  get diagnostics areas_written = row_count;

  insert into public.provider_contract_regions (id, provider_id, city, service_type, source_id, checked_at, active)
  select c.id, c.provider_id, c.city, c.service_type, c.source_id, c.checked_at, c.active
  from jsonb_to_recordset(coalesce(payload -> 'provider_contract_regions', '[]'::jsonb)) as c(
    id text, provider_id text, city text, service_type text, source_id text, checked_at timestamptz, active boolean
  )
  on conflict (id) do update set
    provider_id = excluded.provider_id,
    city = excluded.city,
    service_type = excluded.service_type,
    source_id = excluded.source_id,
    checked_at = excluded.checked_at,
    active = excluded.active;
  get diagnostics contract_regions_written = row_count;

  return jsonb_build_object(
    'providers', providers_written,
    'provider_services', services_written,
    'provider_service_areas', areas_written,
    'provider_contract_regions', contract_regions_written
  );
end;
$$;

revoke execute on function public.import_provider_dataset(jsonb) from public, anon, authenticated;
grant execute on function public.import_provider_dataset(jsonb) to service_role;
