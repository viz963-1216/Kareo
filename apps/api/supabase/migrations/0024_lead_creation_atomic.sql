-- B-006-r3: generated with Supabase CLI 2.119.0 (20261004113314),
-- renamed to the repository's sequential migration convention. Existing migrations stay immutable.
-- The Session row is the common serialization point with deletion/withdrawal.
create or replace function public.create_lead_with_idempotency(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_session public.sessions%rowtype;
  v_ledger public.lead_idempotency_records%rowtype;
  v_lead public.leads%rowtype;
  v_session_id text := payload ->> 'sessionId';
  v_key text := payload ->> 'idempotencyKey';
  v_fingerprint text := payload ->> 'requestFingerprint';
  v_service text;
  v_duplicate boolean := false;
  v_now timestamptz := (payload ->> 'createdAt')::timestamptz;
begin
  select * into v_session from public.sessions where id = v_session_id for update;
  if not found or v_session.status is distinct from 'ACTIVE'
     or v_session.token_hash is distinct from (payload ->> 'sessionTokenHash')
     or v_session.token_hash is null or v_session.expires_at is null
     or v_session.expires_at <= clock_timestamp() then
    raise exception 'SESSION_INVALID: Session is no longer valid';
  end if;
  -- Do not lock Consent after Session: withdraw_consent updates Consent first.
  -- When this transaction wins the Session lock, withdrawal clears its Lead after commit.
  if not exists (select 1 from public.consents where id = payload ->> 'consentId'
      and session_id = v_session_id and withdrawn_at is null) then
    raise exception 'CONSENT_REQUIRED: Consent is no longer valid';
  end if;
  if v_key is null or v_fingerprint is null or v_now is null then
    raise exception 'VALIDATION_ERROR: Missing internal request metadata';
  end if;
  select * into v_ledger from public.lead_idempotency_records
    where session_id = v_session_id and idempotency_key = v_key;
  if found then
    if v_ledger.request_fingerprint is distinct from v_fingerprint then
      raise exception 'IDEMPOTENCY_CONFLICT: Request content differs';
    end if;
    select * into strict v_lead from public.leads where id = v_ledger.lead_id;
    v_duplicate := v_ledger.duplicate;
  else
    if not exists (select 1 from public.assessments where id = payload ->> 'assessmentId' and session_id = v_session_id) then
      raise exception 'NOT_FOUND: Assessment is unavailable';
    end if;
    select service_type into v_service from public.recommendation_runs
      where id = payload ->> 'recommendationId' and assessment_id = payload ->> 'assessmentId';
    if not found then raise exception 'NOT_FOUND: Recommendation is unavailable'; end if;
    if v_service is distinct from (payload ->> 'serviceType') or not exists (
      select 1 from public.recommendation_items where recommendation_run_id = payload ->> 'recommendationId'
      and provider_id = payload ->> 'providerId') then
      raise exception 'VALIDATION_ERROR: Provider or service does not match recommendation';
    end if;
    -- Lock an existing open Lead while deciding the business duplicate; status updates
    -- may close it concurrently. The partial unique index remains a final safety net.
    select * into v_lead from public.leads where session_id = v_session_id
      and provider_id = payload ->> 'providerId' and service_type = v_service
      and status not in ('CLOSED','CANCELLED') for update;
    v_duplicate := found;
    if not v_duplicate then
      insert into public.leads(id,session_id,assessment_id,recommendation_id,provider_id,service_type,
        contact_name,contact_phone,contact_consent_at,idempotency_key,status,created_at,updated_at)
      values(payload ->> 'id',v_session_id,payload ->> 'assessmentId',payload ->> 'recommendationId',
        payload ->> 'providerId',v_service,payload ->> 'contactName',payload ->> 'contactPhone',
        (payload ->> 'contactConsentAt')::timestamptz,v_key,'NEW',v_now,v_now) returning * into v_lead;
    end if;
    insert into public.lead_idempotency_records(id,session_id,idempotency_key,lead_id,request_fingerprint,duplicate,created_at)
    values(v_session_id || ':' || v_key,v_session_id,v_key,v_lead.id,v_fingerprint,v_duplicate,v_now);
  end if;
  -- Preserve existing API behaviour: original Lead/key mapping and duplicate flag,
  -- with the Lead's current status. No contact data is returned.
  return jsonb_build_object('leadId',v_lead.id,'status',v_lead.status,
    'createdAt',to_char(v_lead.created_at at time zone 'Asia/Taipei','YYYY-MM-DD"T"HH24:MI:SS.US') || '+08:00',
    'duplicate',v_duplicate);
end;
$$;
revoke execute on function public.create_lead_with_idempotency(jsonb) from public, anon, authenticated;
grant execute on function public.create_lead_with_idempotency(jsonb) to service_role;
