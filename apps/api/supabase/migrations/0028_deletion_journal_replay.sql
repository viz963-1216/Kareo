-- CLI 2.119.0 generated 20261005032952; numbered per repository convention.
-- B-016: only an authenticated data steward may replay independent receipts.
create function public.replay_deletion_receipts(payload jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare
  v_operator text; v_receipt jsonb; v_result jsonb; v_status text;
  v_applied integer:=0; v_absent integer:=0; v_now timestamptz:=clock_timestamp();
begin
  select id into v_operator from public.internal_operators
    where id=payload->>'operatorId' and key_hash=payload->>'operatorKeyHash'
      and active and revoked_at is null and 'DATA_STEWARD'=any(roles) for share;
  if v_operator is null then raise exception 'DELETION_REPLAY_UNAUTHORIZED'; end if;
  if payload->>'projectRef' is null or payload->>'projectRef' !~ '^([a-z0-9]{20}|LOCAL-SYNTHETIC)$'
    or jsonb_typeof(payload->'receipts') is distinct from 'array'
    or jsonb_array_length(payload->'receipts')>10000 then raise exception 'DELETION_REPLAY_INVALID'; end if;
  -- Validate the entire batch before mutation; a foreign or malformed receipt
  -- aborts the transaction, including any earlier item. No raw values in errors.
  for v_receipt in select value from jsonb_array_elements(payload->'receipts') loop
    if (select count(*) from jsonb_object_keys(v_receipt))<>5
      or v_receipt->>'schemaVersion' is distinct from '1'
      or v_receipt->>'projectRef' is distinct from payload->>'projectRef'
      or v_receipt->>'sessionId' is null or v_receipt->>'sessionId' !~ '^[A-Za-z0-9_-]{1,120}$'
      or v_receipt->>'action' is null or v_receipt->>'action' not in ('CONSENT_WITHDRAWN','USER_DELETED')
      or v_receipt->>'requestedAt' is null or (v_receipt->>'requestedAt')::timestamptz>v_now+interval '5 seconds' then
      raise exception 'DELETION_REPLAY_INVALID';
    end if;
  end loop;
  -- Lock sessions first and in stable order, matching normal withdrawal/cleanup.
  perform id from public.sessions where id in (select value->>'sessionId' from jsonb_array_elements(payload->'receipts')) order by id for update;
  for v_receipt in select value from jsonb_array_elements(payload->'receipts') order by (value->>'requestedAt')::timestamptz loop
    select status into v_status from public.sessions where id=v_receipt->>'sessionId';
    if not found then v_absent:=v_absent+1; continue; end if;
    if v_status='DELETED' then continue; end if;
    if v_receipt->>'action'='CONSENT_WITHDRAWN' then
      v_result:=public.withdraw_consent(jsonb_build_object('sessionId',v_receipt->>'sessionId','now',v_receipt->>'requestedAt'));
      if not coalesce((v_result->>'updated')::boolean,false) then
        v_result:=public.request_session_deletion(jsonb_build_object('sessionId',v_receipt->>'sessionId','now',v_receipt->>'requestedAt'));
      end if;
    else
      v_result:=public.request_session_deletion(jsonb_build_object('sessionId',v_receipt->>'sessionId','now',v_receipt->>'requestedAt'));
    end if;
    if coalesce((v_result->>'updated')::boolean,false) then v_applied:=v_applied+1; end if;
    -- A restored DELETION_REQUESTED row must not postpone its original clock.
    update public.sessions set updated_at=least(updated_at,(v_receipt->>'requestedAt')::timestamptz)
      where id=v_receipt->>'sessionId' and status='DELETION_REQUESTED';
  end loop;
  if payload ? 'cleanup' then
    -- Replay, erasure and SUCCESS audit commit together. The authenticated ID
    -- overrides the caller's cleanup attribution. Failure rolls everything back.
    v_result:=public.run_deletion_cleanup_recorded((payload->'cleanup') || jsonb_build_object('operatorId',v_operator));
    return jsonb_build_object('deletionRun',v_result,'receiptsRead',jsonb_array_length(payload->'receipts'),'sessionsMarked',v_applied,'sessionsAbsent',v_absent);
  end if;
  return jsonb_build_object('receiptsRead',jsonb_array_length(payload->'receipts'),'sessionsMarked',v_applied,'sessionsAbsent',v_absent);
end; $$;
revoke execute on function public.replay_deletion_receipts(jsonb) from public,anon,authenticated;
grant execute on function public.replay_deletion_receipts(jsonb) to service_role;

-- A previously used rights request reference must fail before writing an intent
-- to the independent store. CONTEXT's separate unique reference also serializes
-- concurrent attempts before the final rights operation.
create function public.check_privacy_request_unused(payload jsonb)
returns boolean language plpgsql security invoker set search_path=public as $$
begin
  perform id from public.internal_operators where id=payload->>'operatorId' and key_hash=payload->>'operatorKeyHash'
    and active and revoked_at is null and 'DATA_STEWARD'=any(roles) for share;
  if not found then raise exception 'PRIVACY_UNAUTHORIZED'; end if;
  if payload->>'requestId' is null or payload->>'requestId' !~ '^PRQ-[A-Z0-9_-]{1,92}$' then raise exception 'PRIVACY_VERIFICATION_REQUIRED'; end if;
  if exists(select 1 from public.privacy_operations where request_id=payload->>'requestId') then raise exception 'PRIVACY_REQUEST_ALREADY_USED'; end if;
  return true;
end; $$;
revoke execute on function public.check_privacy_request_unused(jsonb) from public,anon,authenticated;
grant execute on function public.check_privacy_request_unused(jsonb) to service_role;
