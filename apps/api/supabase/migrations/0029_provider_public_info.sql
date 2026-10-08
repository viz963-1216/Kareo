-- D-20 / Issue #106: public directory metadata only; existing server-only RLS unchanged.
alter table public.providers add column if not exists public_info jsonb;
alter table public.providers add constraint providers_public_info_object check (public_info is null or jsonb_typeof(public_info) = 'object');

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
    id, name, type, resource_category, public_info, address, city, district, lat, lng, phone, website,
    google_maps_url, status, verified, created_at, updated_at
  )
  select
    p.id, p.name, p.type, coalesce(p.resource_category, 'SERVICE_PROVIDER'), p.public_info, p.address, p.city, p.district,
    p.lat, p.lng, p.phone, p.website, p.google_maps_url, p.status, p.verified, p.created_at, p.updated_at
  from jsonb_to_recordset(coalesce(payload -> 'providers', '[]'::jsonb)) as p(
    id text, name text, type text, resource_category text, public_info jsonb, address text, city text, district text,
    lat double precision, lng double precision, phone text, website text,
    google_maps_url text, status text, verified boolean,
    created_at timestamptz, updated_at timestamptz
  )
  on conflict (id) do update set
    name = excluded.name,
    type = excluded.type,
    resource_category = excluded.resource_category,
    public_info = coalesce(excluded.public_info, providers.public_info),
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
