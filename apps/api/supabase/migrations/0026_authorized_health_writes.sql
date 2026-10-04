-- J-003-r13: CLI 2.119.0-generated (20261004121212) forward migration, sequential repository naming.
-- Public HTTP writes must recheck authorization inside their final atomic transaction.
-- Existing low-level atomic functions remain for trusted database tooling / restoration.
create or replace function public.require_writable_session(payload jsonb)
returns void language plpgsql security invoker set search_path = public
as $$
declare
  s public.sessions%rowtype;
begin
  select * into s from public.sessions where id = payload ->> 'sessionId' for update;
  if not found or s.status is distinct from 'ACTIVE' or s.token_hash is null
      or s.token_hash is distinct from (payload ->> 'sessionTokenHash')
      or s.expires_at is null or s.expires_at <= clock_timestamp() then
    raise exception 'SESSION_INVALID: Session is no longer valid';
  end if;
  if not exists(select 1 from public.consents where session_id=s.id and withdrawn_at is null) then
    raise exception 'CONSENT_REQUIRED: Consent is no longer valid';
  end if;
end;
$$;
create or replace function public.create_assessment_authorized(payload jsonb)
returns void language plpgsql security invoker set search_path = public
as $$
begin
  perform public.require_writable_session(payload);
  if (payload -> 'assessment' ->> 'session_id') is distinct from (payload ->> 'sessionId') then
    raise exception 'NOT_FOUND: Assessment does not belong to Session';
  end if;
  perform public.create_assessment_with_profile(payload);
end;
$$;
create or replace function public.create_recommendation_authorized(payload jsonb)
returns jsonb language plpgsql security invoker set search_path = public
as $$
begin
  perform public.require_writable_session(payload);
  if not exists(select 1 from public.assessments where id=payload -> 'run' ->> 'assessment_id'
      and session_id=payload ->> 'sessionId') then
    raise exception 'NOT_FOUND: Assessment is unavailable';
  end if;
  return public.create_recommendation_result(payload);
end;
$$;
revoke execute on function public.require_writable_session(jsonb),
  public.create_assessment_authorized(jsonb),public.create_recommendation_authorized(jsonb)
  from public, anon, authenticated;
grant execute on function public.require_writable_session(jsonb),
  public.create_assessment_authorized(jsonb),public.create_recommendation_authorized(jsonb)
  to service_role;
