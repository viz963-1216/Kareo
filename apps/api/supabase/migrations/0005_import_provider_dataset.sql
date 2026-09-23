-- TASK-B-004 r2：Provider 匯入的原子寫入函式。
-- 依 docs/ARCHITECTURE.md §22 與 docs/MVP_DECISIONS.md D-10（Jerry 2026-09-23 核准）。
--
-- 規則：
-- 1. 只負責寫入。不做驗證、不含業務規則；所有驗證在 Node 的 providerImportService 完成。
-- 2. 三張表在同一次呼叫（同一個交易）內寫入，任一步失敗整個交易回滾，沒有任何資料對外可見。
-- 3. 只有 service_role 可以執行，不開放給前端。
-- 4. SQL 錯誤直接讓交易失敗並向上拋出，由 Node 端轉成安全錯誤。
--
-- payload 格式（key 與欄位名稱一致，由 SupabaseProviderRepository 組出）：
--   { "providers": [...], "provider_services": [...], "provider_service_areas": [...] }
-- 回傳：{ "providers": n, "provider_services": n, "provider_service_areas": n }（實際寫入筆數）

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
begin
  insert into public.providers (
    id, name, type, address, city, district, lat, lng, phone, website,
    google_maps_url, status, verified, created_at, updated_at
  )
  select
    p.id, p.name, p.type, p.address, p.city, p.district, p.lat, p.lng, p.phone, p.website,
    p.google_maps_url, p.status, p.verified, p.created_at, p.updated_at
  from jsonb_to_recordset(coalesce(payload -> 'providers', '[]'::jsonb)) as p(
    id text, name text, type text, address text, city text, district text,
    lat double precision, lng double precision, phone text, website text,
    google_maps_url text, status text, verified boolean,
    created_at timestamptz, updated_at timestamptz
  )
  on conflict (id) do update set
    name = excluded.name,
    type = excluded.type,
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

  return jsonb_build_object(
    'providers', providers_written,
    'provider_services', services_written,
    'provider_service_areas', areas_written
  );
end;
$$;

revoke execute on function public.import_provider_dataset(jsonb) from public, anon, authenticated;
grant execute on function public.import_provider_dataset(jsonb) to service_role;
