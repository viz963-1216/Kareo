-- B-011b-r8: Supabase CLI 2.119.0-generated (20261004120052) forward migration; numbered per repo.
-- Retention durations, cancellation rules and API response shapes remain unchanged.
create or replace function public.withdraw_consent(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_session_id text := payload ->> 'sessionId';
  v_now timestamptz := (payload ->> 'now')::timestamptz;
  v_consent_updated integer;
  v_leads_cleared integer;
begin
  -- Common lock order: Session before Consent/Lead. Cleanup holds Session before
  -- deleting expired consent evidence; the reverse order could deadlock.
  perform 1 from public.sessions where id = v_session_id for update;
  update public.consents
  set withdrawn_at = v_now
  where id = (
    select id from public.consents
    where session_id = v_session_id and withdrawn_at is null
    order by accepted_at desc
    limit 1
  );
  get diagnostics v_consent_updated = row_count;

  if v_consent_updated = 0 then
    return jsonb_build_object('updated', false);
  end if;

  update public.sessions
  set status = 'DELETION_REQUESTED', updated_at = v_now
  where id = v_session_id and status = 'ACTIVE';

  with targets as (
    select id, status as old_status from public.leads
    where session_id = v_session_id and status not in ('CLOSED', 'CANCELLED')
    for update
  ),
  cancelled as (
    update public.leads l
    set status = 'CANCELLED', status_reason = 'CONSENT_WITHDRAWN', contact_name = null, contact_phone = null,
        closed_at = v_now, updated_at = v_now
    from targets t
    where l.id = t.id
    returning l.id, t.old_status
  ),
  events as (
    insert into public.lead_status_events (id, lead_id, from_status, to_status, reason_code, note, operator_id, created_at)
    select 'LSE-' || gen_random_uuid()::text, id, old_status, 'CANCELLED', 'CONSENT_WITHDRAWN', null, null, v_now
    from cancelled
    returning 1
  )
  select count(*) into v_leads_cleared from events;

  -- 已是 CLOSED／CANCELLED 的 Lead 不改狀態、不寫狀態事件（終態不可再轉移），但聯絡欄位同樣立即清空。
  update public.leads
  set contact_name = null, contact_phone = null, updated_at = v_now
  where session_id = v_session_id and (contact_name is not null or contact_phone is not null);

  return jsonb_build_object('updated', true, 'leadsCancelled', v_leads_cleared);
end;
$$;
revoke execute on function public.withdraw_consent(jsonb) from public, anon, authenticated;
grant execute on function public.withdraw_consent(jsonb) to service_role;

create or replace function public.run_deletion_cleanup(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now timestamptz := (payload ->> 'now')::timestamptz;
  v_dry_run boolean := coalesce((payload ->> 'dryRun')::boolean, false);
  v_session_ids text[];
  v_sessions_count integer;
  v_lead_contact_ids text[];
  v_leads_contact_cleared integer;
  v_lead_delete_ids text[];
  v_leads_deleted integer;
  v_consent_ids text[];
  v_consents_deleted integer;
begin
  -- ---- 1. session／評估資料（刪除／撤回請求：立即入選；ACTIVE 閒置 90 天）----
  if v_dry_run then
    select array_agg(s.id) into v_session_ids from public.sessions s
    where s.status = 'DELETION_REQUESTED'
       or (s.status = 'ACTIVE' and coalesce(s.last_seen_at, s.created_at) <= v_now - interval '90 days');
  else
    -- Lock before deleting health data. READ COMMITTED rechecks the predicate after
    -- a concurrent last_seen_at touch/withdrawal commits while waiting for this row.
    -- Stable ID order prevents cleaners acquiring multiple Sessions in reverse order.
    select array_agg(candidate.id) into v_session_ids from (
      select s.id from public.sessions s
      where s.status = 'DELETION_REQUESTED'
         or (s.status = 'ACTIVE' and coalesce(s.last_seen_at, s.created_at) <= v_now - interval '90 days')
      order by s.id for update
    ) candidate;
  end if;
  v_sessions_count := coalesce(array_length(v_session_ids, 1), 0);

  -- ---- 2. Lead 聯絡欄位（180 天）----
  select array_agg(id) into v_lead_contact_ids
  from public.leads
  where status in ('CLOSED', 'CANCELLED')
    and closed_at <= v_now - interval '180 days'
    and (contact_name is not null or contact_phone is not null);
  v_leads_contact_cleared := coalesce(array_length(v_lead_contact_ids, 1), 0);

  -- ---- 3. Lead 案件紀錄整筆（1 年）----
  select array_agg(id) into v_lead_delete_ids
  from public.leads
  where status in ('CLOSED', 'CANCELLED')
    and closed_at <= v_now - interval '1 year';
  v_leads_deleted := coalesce(array_length(v_lead_delete_ids, 1), 0);

  -- ---- 4. Consent 同意證據（3 年）----
  select array_agg(id) into v_consent_ids
  from public.consents
  where accepted_at <= v_now - interval '3 years';
  v_consents_deleted := coalesce(array_length(v_consent_ids, 1), 0);

  if v_dry_run then
    return jsonb_build_object(
      'sessionsDeleted', v_sessions_count,
      'leadsContactCleared', v_leads_contact_cleared,
      'leadsDeleted', v_leads_deleted,
      'consentsDeleted', v_consents_deleted,
      'dryRun', true
    );
  end if;

  -- ---- 實際刪除：1. session／評估資料 ----
  if v_sessions_count > 0 then
    delete from public.recommendation_items
    where recommendation_run_id in (
      select rr.id from public.recommendation_runs rr
      join public.assessments a on a.id = rr.assessment_id
      where a.session_id = any(v_session_ids)
    );

    delete from public.recommendation_runs
    where assessment_id in (select a.id from public.assessments a where a.session_id = any(v_session_ids));

    delete from public.care_need_profiles
    where assessment_id in (select a.id from public.assessments a where a.session_id = any(v_session_ids));

    delete from public.assessments a
    where a.session_id = any(v_session_ids);

    update public.sessions
    set status = 'DELETED', deleted_at = v_now, updated_at = v_now
    where id = any(v_session_ids);
  end if;

  -- ---- 實際刪除：2. Lead 聯絡欄位 ----
  if v_leads_contact_cleared > 0 then
    update public.leads
    set contact_name = null, contact_phone = null, updated_at = v_now
    where id = any(v_lead_contact_ids);
  end if;

  -- ---- 實際刪除：3. Lead 案件紀錄（先刪子表，再刪主表）----
  if v_leads_deleted > 0 then
    delete from public.lead_idempotency_records where lead_id = any(v_lead_delete_ids);
    delete from public.lead_access_events where lead_id = any(v_lead_delete_ids);
    delete from public.lead_status_events where lead_id = any(v_lead_delete_ids);
    delete from public.leads where id = any(v_lead_delete_ids);
  end if;

  -- ---- 實際刪除：4. Consent 同意證據 ----
  if v_consents_deleted > 0 then
    delete from public.consents where id = any(v_consent_ids);
  end if;

  return jsonb_build_object(
    'sessionsDeleted', v_sessions_count,
    'leadsContactCleared', v_leads_contact_cleared,
    'leadsDeleted', v_leads_deleted,
    'consentsDeleted', v_consents_deleted,
    'dryRun', false
  );
end;
$$;
revoke execute on function public.run_deletion_cleanup(jsonb) from public, anon, authenticated;
grant execute on function public.run_deletion_cleanup(jsonb) to service_role;
