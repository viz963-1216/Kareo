-- B-011b-r7: cleanup and SUCCESS evidence commit in the same transaction.
-- Generated with Supabase CLI 2.119.0 migration new retention_cleanup_audit
-- (20261004110750), then numbered 0023 per the repository's sequential convention.
-- No new tables/fields/public user API; 0021 remains immutable.
create or replace function public.run_deletion_cleanup_recorded(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_run_id text := payload ->> 'runId';
  v_operator_id text := payload ->> 'operatorId';
  v_now timestamptz := (payload ->> 'now')::timestamptz;
  v_dry_run boolean := (payload ->> 'dryRun')::boolean;
  v_authorized text;
  v_counts jsonb;
  v_finished_at timestamptz;
begin
  if v_run_id is null or v_run_id !~ '^DRUN-[A-Z0-9_-]{1,120}$'
     or v_now is null or v_dry_run is null then
    raise exception 'INVALID_CLEANUP_REQUEST';
  end if;

  -- Node CLI checks the personal key first. SQL checks that the already verified
  -- operator is still active and holds the data role; SHARE prevents mid-run revocation.
  select id into v_authorized from public.internal_operators
  where id = v_operator_id and active = true and revoked_at is null
    and 'DATA_STEWARD' = any(roles)
  for share;
  if v_authorized is null then raise exception 'CLEANUP_OPERATOR_INVALID'; end if;

  -- Serialize recorded cleanup runs so concurrent jobs cannot both report the
  -- same candidates. Acquire the lock before the existing SQL computes its sets.
  perform pg_advisory_xact_lock(hashtext('recorded_retention_cleanup'));
  v_counts := public.run_deletion_cleanup(payload);
  v_finished_at := clock_timestamp();

  if not v_dry_run then
    insert into public.deletion_runs(id,started_at,finished_at,dry_run,status,
      sessions_deleted,leads_contact_cleared,leads_deleted,consents_deleted,error_message,operator_id)
    values(v_run_id,v_now,v_finished_at,false,'SUCCESS',
      (v_counts->>'sessionsDeleted')::integer,(v_counts->>'leadsContactCleared')::integer,
      (v_counts->>'leadsDeleted')::integer,(v_counts->>'consentsDeleted')::integer,null,v_authorized);
    -- Any INSERT/constraint/trigger failure propagates, rolling back every deletion.
  end if;
  return jsonb_build_object('id',v_run_id,'startedAt',v_now,'finishedAt',v_finished_at,
    'dryRun',v_dry_run,'status','SUCCESS','sessionsDeleted',(v_counts->>'sessionsDeleted')::integer,
    'leadsContactCleared',(v_counts->>'leadsContactCleared')::integer,
    'leadsDeleted',(v_counts->>'leadsDeleted')::integer,'consentsDeleted',(v_counts->>'consentsDeleted')::integer,
    'errorMessage',null,'operatorId',v_authorized);
end;
$$;
revoke execute on function public.run_deletion_cleanup_recorded(jsonb) from public, anon, authenticated;
grant execute on function public.run_deletion_cleanup_recorded(jsonb) to service_role;
