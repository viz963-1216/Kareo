-- import_provider_dataset 回滾驗證（ARCHITECTURE §22 第 5 點；由 J-003 在 staging Supabase 執行）
--
-- 執行方式（逐條自動提交，遇到預期中的錯誤要繼續往下跑，所以 ON_ERROR_STOP=0）：
--   psql "<staging 資料庫連線字串>" -v ON_ERROR_STOP=0 -f apps/api/supabase/tests/import_provider_dataset_rollback.sql
-- 需在 0004、0005 migration 之後執行，並使用可執行此 function 的角色（service_role 或 postgres）。
-- 注意：Supabase SQL Editor 會把整份腳本當成一個交易，第一個錯誤就會中止，請改用 psql，或逐段貼上執行。
--
-- 預期結果：
--   - 步驟 1、3 各出現 1 個 ERROR（foreign key 違反，這是刻意製造的）
--   - 出現 3 行 PASS，完全沒有 FAIL
-- 所有測試資料 id 皆以 ROLLBACK-TEST- 開頭，最後會清除。

-- 0. 清除上次殘留
delete from public.provider_service_areas where id like 'ROLLBACK-TEST-%';
delete from public.provider_services where id like 'ROLLBACK-TEST-%';
delete from public.providers where id like 'ROLLBACK-TEST-%';

-- 1. 第二階段失敗：provider 合法，provider_services 指向不存在的 provider（FK 違反）→ 預期 ERROR
select public.import_provider_dataset('{
  "providers": [{"id": "ROLLBACK-TEST-P1", "name": "回滾測試", "type": "HOME_CARE", "address": "測試地址",
                 "city": "新北市", "district": "三重區", "lat": null, "lng": null, "phone": null, "website": null,
                 "google_maps_url": null, "status": "ACTIVE", "verified": false,
                 "created_at": "2026-09-23T00:00:00+08:00", "updated_at": "2026-09-23T00:00:00+08:00"}],
  "provider_services": [{"id": "ROLLBACK-TEST-S1", "provider_id": "ROLLBACK-TEST-MISSING", "service_type": "HOME_CARE", "active": true}],
  "provider_service_areas": []
}'::jsonb);

-- 2. 驗證：三張表都不能有測試資料（第一階段寫入的 provider 也必須被回滾）
do $$
declare p integer; s integer; a integer;
begin
  select count(*) into p from public.providers where id like 'ROLLBACK-TEST-%';
  select count(*) into s from public.provider_services where id like 'ROLLBACK-TEST-%';
  select count(*) into a from public.provider_service_areas where id like 'ROLLBACK-TEST-%';
  if p + s + a <> 0 then
    raise exception 'FAIL (stage 2): rows remain after failed import: providers=%, services=%, areas=%', p, s, a;
  end if;
  raise notice 'PASS (stage 2): failed import left no rows in any table';
end $$;

-- 3. 第三階段失敗：provider 與 service 合法，provider_service_areas 指向不存在的 provider → 預期 ERROR
select public.import_provider_dataset('{
  "providers": [{"id": "ROLLBACK-TEST-P1", "name": "回滾測試", "type": "HOME_CARE", "address": "測試地址",
                 "city": "新北市", "district": "三重區", "lat": null, "lng": null, "phone": null, "website": null,
                 "google_maps_url": null, "status": "ACTIVE", "verified": false,
                 "created_at": "2026-09-23T00:00:00+08:00", "updated_at": "2026-09-23T00:00:00+08:00"}],
  "provider_services": [{"id": "ROLLBACK-TEST-S1", "provider_id": "ROLLBACK-TEST-P1", "service_type": "HOME_CARE", "active": true}],
  "provider_service_areas": [{"id": "ROLLBACK-TEST-A1", "provider_id": "ROLLBACK-TEST-MISSING", "city": "新北市", "district": "三重區", "active": true}]
}'::jsonb);

-- 4. 驗證：第一、二階段寫入的 provider 與 service 都必須被回滾
do $$
declare p integer; s integer; a integer;
begin
  select count(*) into p from public.providers where id like 'ROLLBACK-TEST-%';
  select count(*) into s from public.provider_services where id like 'ROLLBACK-TEST-%';
  select count(*) into a from public.provider_service_areas where id like 'ROLLBACK-TEST-%';
  if p + s + a <> 0 then
    raise exception 'FAIL (stage 3): rows remain after failed import: providers=%, services=%, areas=%', p, s, a;
  end if;
  raise notice 'PASS (stage 3): failed import left no rows in any table';
end $$;

-- 5. 對照組：合法 payload 必須三張表各寫入 1 筆（證明上面的 PASS 不是因為 function 根本沒寫入）
select public.import_provider_dataset('{
  "providers": [{"id": "ROLLBACK-TEST-P1", "name": "回滾測試", "type": "HOME_CARE", "address": "測試地址",
                 "city": "新北市", "district": "三重區", "lat": null, "lng": null, "phone": null, "website": null,
                 "google_maps_url": null, "status": "ACTIVE", "verified": false,
                 "created_at": "2026-09-23T00:00:00+08:00", "updated_at": "2026-09-23T00:00:00+08:00"}],
  "provider_services": [{"id": "ROLLBACK-TEST-S1", "provider_id": "ROLLBACK-TEST-P1", "service_type": "HOME_CARE", "active": true}],
  "provider_service_areas": [{"id": "ROLLBACK-TEST-A1", "provider_id": "ROLLBACK-TEST-P1", "city": "新北市", "district": "三重區", "active": true}]
}'::jsonb);

do $$
declare p integer; s integer; a integer;
begin
  select count(*) into p from public.providers where id like 'ROLLBACK-TEST-%';
  select count(*) into s from public.provider_services where id like 'ROLLBACK-TEST-%';
  select count(*) into a from public.provider_service_areas where id like 'ROLLBACK-TEST-%';
  if p <> 1 or s <> 1 or a <> 1 then
    raise exception 'FAIL (control): expected 1/1/1 rows, got providers=%, services=%, areas=%', p, s, a;
  end if;
  raise notice 'PASS (control): valid import wrote 1 row to each table';
end $$;

-- 6. 清除測試資料
delete from public.provider_service_areas where id like 'ROLLBACK-TEST-%';
delete from public.provider_services where id like 'ROLLBACK-TEST-%';
delete from public.providers where id like 'ROLLBACK-TEST-%';
