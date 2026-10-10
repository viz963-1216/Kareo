-- J-003 / E2E-27, designated Kareo acceptance project only.
-- No schema change and no retained fixture. Real atomic importer, service_role.
-- Short transaction locks the four public-resource tables while comparing full rows.
-- Both invalid and valid fixture operations are rolled back in subtransactions.
do $verify$
declare
  p jsonb;
  before_state jsonb;
  after_state jsonb;
  bad_service_failed boolean := false;
  bad_area_failed boolean := false;
  valid_was_checked boolean := false;
  written jsonb;
begin
  perform set_config('lock_timeout','3s',true);
  perform set_config('statement_timeout','10s',true);
  perform set_config('role','service_role',true);
  if current_user <> 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  lock table public.providers, public.provider_services, public.provider_service_areas,
    public.provider_contract_regions in share row exclusive mode;
  if exists(select 1 from public.providers where id like 'J003-OCT09-%')
    or exists(select 1 from public.provider_services where id like 'J003-OCT09-%')
    or exists(select 1 from public.provider_service_areas where id like 'J003-OCT09-%') then
    raise exception 'FIXTURE_PREFIX_COLLISION';
  end if;
  select jsonb_build_object(
    'providers', (select md5(string_agg(to_jsonb(t)::text,'|' order by id)) from public.providers t),
    'services', (select md5(string_agg(to_jsonb(t)::text,'|' order by id)) from public.provider_services t),
    'areas', (select md5(string_agg(to_jsonb(t)::text,'|' order by id)) from public.provider_service_areas t),
    'contracts', (select md5(string_agg(to_jsonb(t)::text,'|' order by id)) from public.provider_contract_regions t)
  ) into before_state;
  p := jsonb_build_object('id','J003-OCT09-P','name','J003 disposable rollback fixture',
    'type','HOME_CARE','address','新北市三重區測試地址','city','新北市','district','三重區',
    'status','INACTIVE','verified',false,'created_at',now(),'updated_at',now());
  begin
    perform public.import_provider_dataset(jsonb_build_object('providers',jsonb_build_array(p),
      'provider_services',jsonb_build_array(jsonb_build_object('id','J003-OCT09-S',
        'provider_id','J003-OCT09-MISSING','service_type','HOME_CARE','active',false))));
  exception when foreign_key_violation then bad_service_failed := true;
  end;
  if not bad_service_failed or exists(select 1 from public.providers where id = 'J003-OCT09-P') then
    raise exception 'SERVICE_STAGE_DID_NOT_ROLL_BACK';
  end if;
  begin
    perform public.import_provider_dataset(jsonb_build_object('providers',jsonb_build_array(p),
      'provider_services',jsonb_build_array(jsonb_build_object('id','J003-OCT09-S',
        'provider_id','J003-OCT09-P','service_type','HOME_CARE','active',false)),
      'provider_service_areas',jsonb_build_array(jsonb_build_object('id','J003-OCT09-A',
        'provider_id','J003-OCT09-MISSING','city','新北市','district','三重區','active',false))));
  exception when foreign_key_violation then bad_area_failed := true;
  end;
  if not bad_area_failed or exists(select 1 from public.providers where id = 'J003-OCT09-P')
    or exists(select 1 from public.provider_services where id = 'J003-OCT09-S') then
    raise exception 'AREA_STAGE_DID_NOT_ROLL_BACK';
  end if;
  begin
    written := public.import_provider_dataset(jsonb_build_object('providers',jsonb_build_array(p),
      'provider_services',jsonb_build_array(jsonb_build_object('id','J003-OCT09-S',
        'provider_id','J003-OCT09-P','service_type','HOME_CARE','active',false)),
      'provider_service_areas',jsonb_build_array(jsonb_build_object('id','J003-OCT09-A',
        'provider_id','J003-OCT09-P','city','新北市','district','三重區','active',false))));
    if written->>'providers' <> '1' or written->>'provider_services' <> '1'
      or written->>'provider_service_areas' <> '1'
      or not exists(select 1 from public.providers where id = 'J003-OCT09-P')
      or not exists(select 1 from public.provider_services where id = 'J003-OCT09-S')
      or not exists(select 1 from public.provider_service_areas where id = 'J003-OCT09-A') then
      raise exception 'VALID_BATCH_NOT_WRITTEN';
    end if;
    raise exception using errcode='P0001',message='ROLL_BACK_VALID_DISPOSABLE_BATCH';
  exception when raise_exception then
    if sqlerrm <> 'ROLL_BACK_VALID_DISPOSABLE_BATCH' then raise; end if;
    valid_was_checked := true;
  end;
  select jsonb_build_object(
    'providers', (select md5(string_agg(to_jsonb(t)::text,'|' order by id)) from public.providers t),
    'services', (select md5(string_agg(to_jsonb(t)::text,'|' order by id)) from public.provider_services t),
    'areas', (select md5(string_agg(to_jsonb(t)::text,'|' order by id)) from public.provider_service_areas t),
    'contracts', (select md5(string_agg(to_jsonb(t)::text,'|' order by id)) from public.provider_contract_regions t)
  ) into after_state;
  if not valid_was_checked or before_state is distinct from after_state then
    raise exception 'PUBLIC_DATA_CHANGED_OR_POSITIVE_CONTROL_NOT_CHECKED';
  end if;
end;
$verify$;
select current_user as verified_role, 'ASSERTIONS_COMPLETED' as verification,
  (select count(*) from public.providers) as providers,
  (select count(*) from public.provider_services) as services,
  (select count(*) from public.provider_service_areas) as areas,
  (select count(*) from public.provider_contract_regions) as contracts,
  (select count(*) from public.providers where id like 'J003-OCT09-%') as retained_test_providers,
  (select count(*) from public.provider_services where id like 'J003-OCT09-%') as retained_test_services,
  (select count(*) from public.provider_service_areas where id like 'J003-OCT09-%') as retained_test_areas;
