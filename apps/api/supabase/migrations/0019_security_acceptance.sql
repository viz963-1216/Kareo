-- TASK-B-011b：Security + Privacy Acceptance。依 docs/DATA_MODEL.md §39-40、
-- docs/ARCHITECTURE.md §20.4-20.7、docs/PRIVACY_AND_RETENTION.md §6、docs/API_CONTRACT.md §6-7。

-- ===== 1. RateLimitCounter（DATA_MODEL §39）=====
-- key 由規則名稱＋session id 或 IP 雜湊組成（不存 IP 明文，見 ARCHITECTURE §20.4）。
create table if not exists rate_limit_counters (
  key text primary key,
  window_start timestamptz not null,
  count integer not null default 0,
  expires_at timestamptz not null
);

create index if not exists rate_limit_counters_expires_at_idx on rate_limit_counters (expires_at);

-- 原子檢查＋遞增：用 pg_advisory_xact_lock 以 key 的雜湊序列化同一個 key 的併發呼叫，避免
-- 「row 尚未存在」時兩個交易同時 insert 造成其中一次遞增被覆蓋（單純 upsert 在 row 不存在的
-- 第一次呼叫無法用 select ... for update 鎖住任何列）。視窗過期則重置為新視窗的第 1 次。
create or replace function public.check_rate_limit(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_key text := payload ->> 'key';
  v_window_seconds integer := (payload ->> 'windowSeconds')::integer;
  v_limit integer := (payload ->> 'limit')::integer;
  v_now timestamptz := (payload ->> 'now')::timestamptz;
  v_window_start timestamptz;
  v_count integer;
  v_expires_at timestamptz;
begin
  perform pg_advisory_xact_lock(hashtext('rate_limit:' || v_key));

  select window_start, count into v_window_start, v_count
  from public.rate_limit_counters where key = v_key;

  if not found or v_window_start + make_interval(secs => v_window_seconds) <= v_now then
    v_window_start := v_now;
    v_count := 1;
    v_expires_at := v_now + make_interval(secs => v_window_seconds);
    insert into public.rate_limit_counters (key, window_start, count, expires_at)
    values (v_key, v_window_start, v_count, v_expires_at)
    on conflict (key) do update
      set window_start = excluded.window_start, count = excluded.count, expires_at = excluded.expires_at;
  else
    v_count := v_count + 1;
    v_expires_at := v_window_start + make_interval(secs => v_window_seconds);
    update public.rate_limit_counters set count = v_count where key = v_key;
  end if;

  if v_count > v_limit then
    return jsonb_build_object(
      'allowed', false,
      'retryAfterSeconds', greatest(1, ceil(extract(epoch from (v_expires_at - v_now)))::integer)
    );
  end if;
  return jsonb_build_object('allowed', true);
end;
$$;

revoke execute on function public.check_rate_limit(jsonb) from public, anon, authenticated;
grant execute on function public.check_rate_limit(jsonb) to service_role;

alter table rate_limit_counters enable row level security;
revoke all on table rate_limit_counters from anon, authenticated;
grant select, insert, update, delete on table rate_limit_counters to service_role;

-- ===== 2. DeletionRun（DATA_MODEL §40）=====
create table if not exists deletion_runs (
  id text primary key,
  started_at timestamptz not null,
  finished_at timestamptz,
  dry_run boolean not null,
  status text not null,                 -- RUNNING | SUCCESS | FAILED
  sessions_deleted integer not null default 0,
  leads_contact_cleared integer not null default 0,
  error_message text,
  operator_id text references internal_operators (id)
);

alter table deletion_runs enable row level security;
revoke all on table deletion_runs from anon, authenticated;
grant select, insert, update, delete on table deletion_runs to service_role;

-- ===== 3. lead_status_events.operator_id 改為可為 null =====
-- 同意撤回（consent/withdraw）與使用者刪除（DELETE /session）觸發的 Lead 取消是系統自動行為，
-- 沒有真人操作者；依 LEAD_OPERATIONS §2「不使用共用帳號」，不虛構一個共用的系統操作者帳號頂替，
-- 改為允許 operator_id 為 null 表示「系統自動」，查詢／顯示時可用 null 識別，不混入真人操作紀錄。
alter table lead_status_events alter column operator_id drop not null;

-- ===== 4. request_session_deletion：DELETE /api/v1/session（PRIVACY_AND_RETENTION §6.1）=====
-- 同一交易內：session 只在目前 ACTIVE 時才能轉為 DELETION_REQUESTED（CAS，避免重複呼叫或跟
-- consent/withdraw 競爭）；同一 session 尚未終態的 Lead 立即標記 CANCELLED（USER_DELETED）並清空
-- 聯絡欄位（§6.1「Lead 的聯絡欄位立即清空」）。Assessment／CareNeedProfile／RecommendationRun
-- 等資料的實際刪除由每日清理作業（run_deletion_cleanup）在 7 天後處理，不在這裡做。
create or replace function public.request_session_deletion(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_session_id text := payload ->> 'sessionId';
  v_now timestamptz := (payload ->> 'now')::timestamptz;
  v_updated integer;
  v_leads_cleared integer;
begin
  update public.sessions
  set status = 'DELETION_REQUESTED', updated_at = v_now
  where id = v_session_id and status = 'ACTIVE';
  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    return jsonb_build_object('updated', false);
  end if;

  with targets as (
    select id, status as old_status from public.leads
    where session_id = v_session_id and status not in ('CLOSED', 'CANCELLED')
    for update
  ),
  cancelled as (
    update public.leads l
    set status = 'CANCELLED', status_reason = 'USER_DELETED', contact_name = null, contact_phone = null,
        closed_at = v_now, updated_at = v_now
    from targets t
    where l.id = t.id
    returning l.id, t.old_status
  ),
  events as (
    insert into public.lead_status_events (id, lead_id, from_status, to_status, reason_code, note, operator_id, created_at)
    select 'LSE-' || gen_random_uuid()::text, id, old_status, 'CANCELLED', 'USER_DELETED', null, null, v_now
    from cancelled
    returning 1
  )
  select count(*) into v_leads_cleared from events;

  return jsonb_build_object('updated', true, 'leadsCancelled', v_leads_cleared);
end;
$$;

revoke execute on function public.request_session_deletion(jsonb) from public, anon, authenticated;
grant execute on function public.request_session_deletion(jsonb) to service_role;

-- ===== 5. withdraw_consent：POST /api/v1/consent/withdraw（PRIVACY_AND_RETENTION §3.3）=====
-- 同一交易內：標記目前仍生效（withdrawn_at is null）的最新 Consent 為已撤回、session 轉
-- DELETION_REQUESTED（進入跟 DELETE /session 相同的刪除流程，§3.3「session 資料進入刪除流程
-- （§6）」）、尚未終態的 Lead 立即標記 CANCELLED（CONSENT_WITHDRAWN）並清空聯絡欄位——跟
-- request_session_deletion 的 Lead 處理方式一致，差別只在觸發原因與原因碼，因為兩者都代表
-- 「使用者不再同意繼續處理資料」的同一種使用者意圖。
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

  return jsonb_build_object('updated', true, 'leadsCancelled', v_leads_cleared);
end;
$$;

revoke execute on function public.withdraw_consent(jsonb) from public, anon, authenticated;
grant execute on function public.withdraw_consent(jsonb) to service_role;

-- ===== 6. run_deletion_cleanup：每日到期清理作業（PRIVACY_AND_RETENTION §6.3）=====
-- 支援 dry-run；找出 DELETION_REQUESTED 滿 7 天的 session，刪除其「沒有建立過 Lead」的
-- Assessment／CareNeedProfile／RecommendationRun／RecommendationItem（Lead 已在
-- request_session_deletion／withdraw_consent 當下立即處理，這裡不重複處理 Lead；曾經建立過
-- Lead 的 Assessment／RecommendationRun 因為 leads.recommendation_id 是 not null FK、且 Lead
-- 案件骨架要永久保留供統計，不在這裡刪除，見下方 NOTE），並把 session 轉為 DELETED、寫入
-- deleted_at。dry_run=true 時只計算筆數，不實際刪除，也不寫入 deletion_runs（呼叫端的 CLI
-- 另外決定是否記錄 dry-run 的結果；本函式本身只負責「算」或「刪」）。
--
-- NOTE（已知限制，B-011b 範圍內的簡化，詳見 PR Known Issues）：PRIVACY_AND_RETENTION §6.1 字面
-- 要求 7 天後「刪除」session 的 Assessment／RecommendationRun，不分是否曾建立 Lead；但現有
-- schema（B-006／migration 0018）讓 Lead 永久保留（§6.1「案件骨架保留供統計」）又對
-- RecommendationRun 有 not null FK，兩者在「曾送出媒合需求」的案例上互相矛盾。本函式選擇優先
-- 保留 Lead 案件骨架的完整性（不違反 FK、不刪除還有 Lead 在參照的資料），讓曾經送出媒合需求的
-- Assessment／RecommendationRun 繼續存在，直到這點由 Jerry 決定是否調整 Lead 的保存期限規則或
-- schema（例如讓 recommendation_id 可為 null）。
create or replace function public.run_deletion_cleanup(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now timestamptz := (payload ->> 'now')::timestamptz;
  v_dry_run boolean := coalesce((payload ->> 'dryRun')::boolean, false);
  v_cutoff timestamptz := v_now - interval '7 days';
  v_session_ids text[];
  v_sessions_count integer;
begin
  select array_agg(id) into v_session_ids
  from public.sessions
  where status = 'DELETION_REQUESTED' and updated_at <= v_cutoff;

  v_sessions_count := coalesce(array_length(v_session_ids, 1), 0);

  if v_dry_run or v_sessions_count = 0 then
    return jsonb_build_object('sessionsDeleted', v_sessions_count, 'dryRun', v_dry_run);
  end if;

  -- Lead 案件骨架（無個資）永久保留供統計（PRIVACY_AND_RETENTION §6.1），且 leads.recommendation_id
  -- 是 not null FK 指向 recommendation_runs——只要這個 session 底下任何一筆 Assessment 曾經產生過
  -- 被 Lead 引用的 RecommendationRun，就不能刪除該 Assessment／RecommendationRun／Item，否則違反
  -- FK。因此只清理「完全沒有建立過 Lead」的 Assessment（多數情況：使用者做完評估、看了推薦，
  -- 但沒有送出媒合需求）；曾經送出媒合需求的 Assessment／RecommendationRun 保留，直到 Lead 本身
  -- 的保存期限另外處理（不在本次 B-011b 範圍內，見 PR Known Issues）。
  with eligible_assessments as (
    select a.id from public.assessments a
    where a.session_id = any(v_session_ids)
      and not exists (select 1 from public.leads l where l.assessment_id = a.id)
  )
  delete from public.recommendation_items
  where recommendation_run_id in (
    select rr.id from public.recommendation_runs rr
    where rr.assessment_id in (select id from eligible_assessments)
  );

  with eligible_assessments as (
    select a.id from public.assessments a
    where a.session_id = any(v_session_ids)
      and not exists (select 1 from public.leads l where l.assessment_id = a.id)
  )
  delete from public.recommendation_runs
  where assessment_id in (select id from eligible_assessments);

  with eligible_assessments as (
    select a.id from public.assessments a
    where a.session_id = any(v_session_ids)
      and not exists (select 1 from public.leads l where l.assessment_id = a.id)
  )
  delete from public.care_need_profiles
  where assessment_id in (select id from eligible_assessments);

  delete from public.assessments a
  where a.session_id = any(v_session_ids)
    and not exists (select 1 from public.leads l where l.assessment_id = a.id);

  update public.sessions
  set status = 'DELETED', deleted_at = v_now, updated_at = v_now
  where id = any(v_session_ids);

  return jsonb_build_object('sessionsDeleted', v_sessions_count, 'dryRun', v_dry_run);
end;
$$;

revoke execute on function public.run_deletion_cleanup(jsonb) from public, anon, authenticated;
grant execute on function public.run_deletion_cleanup(jsonb) to service_role;
