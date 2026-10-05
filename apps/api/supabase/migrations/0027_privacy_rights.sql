-- CLI 2.119.0 generated 20261005030522; numbered per repository convention.
-- B-015-r1: restricted data rights. No public management route.
create table public.privacy_operations (
  request_id text primary key,
  operator_id text not null references public.internal_operators(id),
  session_id text not null,
  action text not null check (action in ('CONTEXT','EXPORT','CORRECT_CONTACT','CORRECT_ASSESSMENT','STOP','DELETE')),
  received_at timestamptz not null,
  verified_at timestamptz not null,
  verification_method text not null check (verification_method in ('ORIGINAL_CONTACT_CONFIRMED','AUTHORIZED_PROXY_CONFIRMED')),
  verification_ref text not null,
  proxy_authority_ref text,
  created_at timestamptz not null,
  result_counts jsonb not null
);
create index privacy_operations_session_idx on public.privacy_operations(session_id,created_at);
create index privacy_operations_retention_idx on public.privacy_operations(created_at);
alter table public.privacy_operations enable row level security;
revoke all on public.privacy_operations from public,anon,authenticated;
grant select,insert,delete on public.privacy_operations to service_role;

create function public.process_privacy_right(payload jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare
  v_operator text; v_session text; v_now timestamptz:=clock_timestamp();
  v_action text:=payload->>'action'; v_request text:=payload->>'requestId';
  v_received timestamptz:=(payload->>'receivedAt')::timestamptz;
  v_verified timestamptz:=(payload->>'verifiedAt')::timestamptz;
  v_method text:=payload->>'verificationMethod'; v_ref text:=payload->>'verificationRef';
  v_proxy text:=payload->>'proxyAuthorityRef';
  v_state text; v_row public.assessments; v_data jsonb; v_counts jsonb:='{}';
  v_input jsonb:=payload->'assessment'; v_profile jsonb:=payload->'profile';
  v_cancelled integer:=0; v_updated integer:=0;
begin
  -- Recheck personal authorization inside the transaction (no caller-supplied ID only).
  select id into v_operator from public.internal_operators
    where id=payload->>'operatorId' and key_hash=payload->>'operatorKeyHash'
      and active and revoked_at is null and 'DATA_STEWARD'=any(roles) for share;
  if v_operator is null then raise exception 'PRIVACY_UNAUTHORIZED'; end if;
  if v_action is null or v_action not in ('CONTEXT','EXPORT','CORRECT_CONTACT','CORRECT_ASSESSMENT','STOP','DELETE')
     or v_request is null or v_request !~ '^PRQ-[A-Z0-9_-]{1,100}$'
     or v_received is null or v_verified is null or v_received>v_verified or v_verified>v_now+interval '5 seconds'
     or v_verified<v_now-interval '7 days'
     or v_method is null or v_method not in ('ORIGINAL_CONTACT_CONFIRMED','AUTHORIZED_PROXY_CONFIRMED')
     or v_ref is null or v_ref !~ '^[A-Z0-9_-]{5,120}$'
     or (v_proxy is not null and v_proxy !~ '^[A-Z0-9_-]{5,120}$')
     or (v_method='AUTHORIZED_PROXY_CONFIRMED' and (v_proxy is null or v_proxy !~ '^[A-Z0-9_-]{5,120}$')) then
    raise exception 'PRIVACY_VERIFICATION_REQUIRED';
  end if;
  if exists(select 1 from public.privacy_operations where request_id=v_request) then raise exception 'PRIVACY_REQUEST_ALREADY_USED'; end if;
  if payload->>'leadId' is not null then
    select session_id into v_session from public.leads where id=payload->>'leadId';
    if payload->>'sessionId' is not null and payload->>'sessionId' is distinct from v_session then raise exception 'PRIVACY_TARGET_MISMATCH'; end if;
  else v_session:=payload->>'sessionId'; end if;
  select status into v_state from public.sessions where id=v_session for update;
  if v_state is null then raise exception 'PRIVACY_TARGET_NOT_FOUND'; end if;

  if v_action='CONTEXT' then
    v_data:=jsonb_build_object('sessionId',v_session,'status',v_state,
      'assessments',coalesce((select jsonb_agg(jsonb_build_object('id',id,'updatedAt',updated_at)) from public.assessments where session_id=v_session),'[]'),
      'leads',coalesce((select jsonb_agg(jsonb_build_object('id',id,'updatedAt',updated_at)) from public.leads where session_id=v_session),'[]'));
  elsif v_action='EXPORT' then
    v_data:=jsonb_build_object('session',(select to_jsonb(s)-'token_hash' from public.sessions s where id=v_session),
      'consents',coalesce((select jsonb_agg(to_jsonb(c)) from public.consents c where session_id=v_session),'[]'),
      'assessments',coalesce((select jsonb_agg(to_jsonb(a)) from public.assessments a where session_id=v_session),'[]'),
      'profiles',coalesce((select jsonb_agg(to_jsonb(p)) from public.care_need_profiles p join public.assessments a on a.id=p.assessment_id where a.session_id=v_session),'[]'),
      'recommendations',coalesce((select jsonb_agg(to_jsonb(r)) from public.recommendation_runs r join public.assessments a on a.id=r.assessment_id where a.session_id=v_session),'[]'),
      'recommendationItems',coalesce((select jsonb_agg(to_jsonb(i)) from public.recommendation_items i join public.recommendation_runs r on r.id=i.recommendation_run_id join public.assessments a on a.id=r.assessment_id where a.session_id=v_session),'[]'),
      'leads',coalesce((select jsonb_agg(to_jsonb(l)-'idempotency_key'-'assigned_operator_id') from public.leads l where session_id=v_session),'[]'),
      'leadEvents',coalesce((select jsonb_agg(to_jsonb(e)-'operator_id'-'note') from public.lead_status_events e join public.leads l on l.id=e.lead_id where l.session_id=v_session),'[]'));
  elsif v_action='CORRECT_CONTACT' then
    if payload->>'leadId' is null or payload->>'contactName' is null or length(payload->>'contactName') not between 1 and 30
      or payload->>'contactPhone' is null or payload->>'contactPhone' !~ '^(09[0-9]{8}|0[0-9]{1,2}-?[0-9]{6,8})$' then raise exception 'PRIVACY_INVALID_CORRECTION'; end if;
    update public.leads set contact_name=payload->>'contactName',contact_phone=payload->>'contactPhone',updated_at=v_now
      where id=payload->>'leadId' and session_id=v_session and contact_phone is not null
        and updated_at=(payload->>'expectedUpdatedAt')::timestamptz;
    get diagnostics v_updated=row_count;
    if v_updated<>1 then raise exception 'PRIVACY_STATE_CHANGED'; end if;
    v_counts:=jsonb_build_object('leadsCorrected',1);
  elsif v_action='CORRECT_ASSESSMENT' then
    if v_state<>'ACTIVE' then raise exception 'PRIVACY_STATE_CHANGED'; end if;
    select * into v_row from public.assessments where id=payload->>'assessmentId' and session_id=v_session for update;
    if v_row.id is null then raise exception 'PRIVACY_TARGET_MISMATCH'; end if;
    if v_row.updated_at is distinct from (payload->>'expectedUpdatedAt')::timestamptz then raise exception 'PRIVACY_STATE_CHANGED'; end if;
    -- Bind the computed result to the still-current published knowledge snapshot.
    perform id from public.knowledge_versions where id=v_input->>'knowledgeVersion' and status='PUBLISHED' for share;
    if not found then raise exception 'PRIVACY_STATE_CHANGED'; end if;
    if v_input is null or v_profile is null or v_input->>'sessionId' is distinct from v_session
      or v_input->>'rulesVersion' is null or v_input->'ruleTrace' is null then raise exception 'PRIVACY_INVALID_CORRECTION'; end if;
    update public.assessments set age_range=v_input->>'ageRange',city=v_input->'location'->>'city',district=v_input->'location'->>'district',
      location_precision=v_input->'location'->>'precision',lat=(v_input->'location'->>'lat')::double precision,lng=(v_input->'location'->>'lng')::double precision,
      living_situation=v_input->>'livingSituation',caregiver_situation=v_input->>'caregiverSituation',mobility_level=v_input->>'mobilityLevel',daily_living_level=v_input->>'dailyLivingLevel',
      disability_certificate=v_input->>'disabilityCertificate',income_category=v_input->>'incomeCategory',
      home_care_need=v_input->'needs'->>'homeCare',medical_nursing_need=v_input->'needs'->>'medicalNursing',assistive_device_need=v_input->'needs'->>'assistiveDevice',transportation_need=v_input->'needs'->>'transportation',
      free_text=v_input->>'freeText',knowledge_version=v_input->>'knowledgeVersion',rules_version=v_input->>'rulesVersion',rule_trace=v_input->'ruleTrace',updated_at=v_now where id=v_row.id;
    update public.care_need_profiles set care_needs=array(select jsonb_array_elements_text(v_profile->'careNeeds')),
      priority=array(select jsonb_array_elements_text(v_profile->'priority')),summary=v_profile->>'summary',warnings=array(select jsonb_array_elements_text(v_profile->'warnings')) where assessment_id=v_row.id;
    get diagnostics v_updated=row_count;
    if v_updated<>1 then raise exception 'PRIVACY_INVALID_CORRECTION'; end if;
    delete from public.recommendation_items where recommendation_run_id in (select id from public.recommendation_runs where assessment_id=v_row.id);
    delete from public.recommendation_runs where assessment_id=v_row.id;
    with t as (select id,status old_status from public.leads where assessment_id=v_row.id and session_id=v_session and status not in ('CLOSED','CANCELLED') for update),
    c as (update public.leads l set status='CANCELLED',status_reason='DATA_CORRECTED',contact_name=null,contact_phone=null,closed_at=v_now,updated_at=v_now from t where l.id=t.id returning l.id,t.old_status),
    e as (insert into public.lead_status_events(id,lead_id,from_status,to_status,reason_code,note,operator_id,created_at)
      select 'LSE-'||gen_random_uuid()::text,id,old_status,'CANCELLED','DATA_CORRECTED',null,v_operator,v_now from c returning 1)
    select count(*) into v_cancelled from e;
    v_counts:=jsonb_build_object('assessmentsCorrected',1,'leadsCancelled',v_cancelled,'staleRecommendationsRemoved',true);
  elsif v_action='STOP' then
    v_counts:=public.withdraw_consent(jsonb_build_object('sessionId',v_session,'now',v_now));
    -- No current consent is still a legitimate stop request; stop active Session.
    if not (v_counts->>'updated')::boolean then v_counts:=public.request_session_deletion(jsonb_build_object('sessionId',v_session,'now',v_now)); end if;
  elsif v_action='DELETE' then
    v_counts:=public.request_session_deletion(jsonb_build_object('sessionId',v_session,'now',v_now));
  end if;
  insert into public.privacy_operations(request_id,operator_id,session_id,action,received_at,verified_at,verification_method,verification_ref,proxy_authority_ref,created_at,result_counts)
    values(v_request,v_operator,v_session,v_action,v_received,v_verified,v_method,v_ref,v_proxy,v_now,v_counts);
  return jsonb_build_object('requestId',v_request,'action',v_action,'counts',v_counts,'data',v_data);
end; $$;
revoke execute on function public.process_privacy_right(jsonb) from public,anon,authenticated;
grant execute on function public.process_privacy_right(jsonb) to service_role;

-- Minimal rights audit follows the operational-case ceiling, not indefinite retention.
-- It is pruned only with a successfully recorded real cleanup, in that transaction.
create function public.prune_privacy_operations_after_cleanup()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if new.status='SUCCESS' and new.dry_run=false then
    delete from public.privacy_operations where created_at <= new.started_at-interval '1 year';
  end if;
  return new;
end; $$;
revoke execute on function public.prune_privacy_operations_after_cleanup() from public,anon,authenticated;
create trigger privacy_operations_retention after insert on public.deletion_runs
for each row execute function public.prune_privacy_operations_after_cleanup();
