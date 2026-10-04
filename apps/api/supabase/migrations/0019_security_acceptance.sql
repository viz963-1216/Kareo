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
-- 2026-10-03（Jerry D-05 確認四條保存期限定案後新增）：leads_deleted／consents_deleted 是
-- DATA_MODEL §40 原始 9 個欄位之外，為了交付「案件紀錄 1 年整筆刪除」「同意證據 3 年」這兩條
-- 新確認規則的冪等計數證據而新增的欄位，屬於額外新增、可為空／有預設值，不影響既有欄位；
-- 請 Jerry 視需要同步更新 DATA_MODEL §40 文件。
create table if not exists deletion_runs (
  id text primary key,
  started_at timestamptz not null,
  finished_at timestamptz,
  dry_run boolean not null,
  status text not null,                 -- RUNNING | SUCCESS | FAILED
  sessions_deleted integer not null default 0,
  leads_contact_cleared integer not null default 0,
  leads_deleted integer not null default 0,
  consents_deleted integer not null default 0,
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

-- Lead 案件骨架（結案後 1 年）與健康評估資料（刪除請求 7 天／最後使用 90 天）的保存期限不同
-- （PRIVACY_AND_RETENTION §2、§6.1，D-05）。leads 對 assessments／recommendation_runs 的外鍵會讓
-- 評估資料在 Lead 存在期間無法刪除，因此移除這兩個外鍵：Lead 仍保留 assessment_id／
-- recommendation_id 的值（DATA_MODEL §22「Lead 其餘欄位保留」），但評估資料可依自己的期限刪除。
-- 建立 Lead 時的存在與歸屬檢查由 leadService 負責（assessment、recommendation run、provider 皆驗證）。
alter table leads drop constraint if exists leads_assessment_id_fkey;
alter table leads drop constraint if exists leads_recommendation_id_fkey;

-- ===== 4. request_session_deletion：DELETE /api/v1/session（PRIVACY_AND_RETENTION §6.1）=====
-- 同一交易內：session 只在目前 ACTIVE 時才能轉為 DELETION_REQUESTED（CAS，避免重複呼叫或跟
-- consent/withdraw 競爭）；同一 session 尚未終態的 Lead 立即標記 CANCELLED（USER_DELETED），
-- 且該 session 全部 Lead（含已 CLOSED／CANCELLED）的聯絡欄位立即清空（§6.1）。Assessment／CareNeedProfile／RecommendationRun
-- 等資料的實際刪除由每日清理作業（run_deletion_cleanup）處理，不在這裡做：DELETION_REQUESTED 的 session
-- 一入選就刪（見 run_deletion_cleanup），7 天只是最遲完成期限（deletionScheduledBefore），不是等待期。
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

  -- 已是 CLOSED／CANCELLED 的 Lead 不改狀態、不寫狀態事件（終態不可再轉移），但聯絡欄位同樣立即清空。
  update public.leads
  set contact_name = null, contact_phone = null, updated_at = v_now
  where session_id = v_session_id and (contact_name is not null or contact_phone is not null);

  return jsonb_build_object('updated', true, 'leadsCancelled', v_leads_cleared);
end;
$$;

revoke execute on function public.request_session_deletion(jsonb) from public, anon, authenticated;
grant execute on function public.request_session_deletion(jsonb) to service_role;

-- ===== 5. withdraw_consent：POST /api/v1/consent/withdraw（PRIVACY_AND_RETENTION §3.3）=====
-- 同一交易內：標記目前仍生效（withdrawn_at is null）的最新 Consent 為已撤回、session 轉
-- DELETION_REQUESTED（進入跟 DELETE /session 相同的刪除流程，§3.3「session 資料進入刪除流程
-- （§6）」）、尚未終態的 Lead 立即標記 CANCELLED（CONSENT_WITHDRAWN）、全部 Lead 的聯絡欄位立即清空——跟
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

  -- 已是 CLOSED／CANCELLED 的 Lead 不改狀態、不寫狀態事件（終態不可再轉移），但聯絡欄位同樣立即清空。
  update public.leads
  set contact_name = null, contact_phone = null, updated_at = v_now
  where session_id = v_session_id and (contact_name is not null or contact_phone is not null);

  return jsonb_build_object('updated', true, 'leadsCancelled', v_leads_cleared);
end;
$$;

revoke execute on function public.withdraw_consent(jsonb) from public, anon, authenticated;
grant execute on function public.withdraw_consent(jsonb) to service_role;

-- ===== 6. run_deletion_cleanup：每日到期清理作業（PRIVACY_AND_RETENTION §6.3，2026-10-03
-- Jerry D-05 確認四條保存期限定案：評估資料 90 天、媒合聯絡資料結案/取消後 180 天、案件紀錄
-- 結案後 1 年整筆刪除、同意證據 3 年）=====
--
-- 四條各自獨立的到期清理，每次執行都全部處理一輪，彼此不互相影響：
--
--   1. session／評估資料：涵蓋兩種來源——(a) 使用者主動刪除／撤回同意（D-05a；PRIVACY_AND_RETENTION
--      §6.1，session 已轉 DELETION_REQUESTED）：「請求後 7 天內完成」是最遲完成期限，不是等待期，
--      所以只要 session 是 DELETION_REQUESTED，下一次清理就入選；每日作業 + 失敗重試要在請求 + 7 天
--      之前完成，deletionScheduledBefore 才不會是不實承諾。(b) 一般 session 最後使用後 90 天未使用
--      （status 仍是 ACTIVE，§2「匿名 session...最後使用後 90 天刪除」）。
--      兩者都刪除該 session 全部 Assessment／CareNeedProfile／RecommendationRun／
--      RecommendationItem（不論是否建立過 Lead；Lead 案件骨架依項目 2、3 自己的期限處理），
--      並把 session 轉為 DELETED。
--   2. Lead 聯絡欄位（180 天）：已結案或取消滿 180 天、聯絡欄位尚未清空的 Lead（透過撤回／刪除
--      觸發的取消已經在 request_session_deletion／withdraw_consent 當下立即清空，不會再被這裡
--      重複計入）——清空 contact_name／contact_phone，Lead 本身（案件骨架）保留。
--   3. Lead 案件紀錄（1 年）：已結案或取消滿 1 年的 Lead，整筆連同其
--      lead_status_events／lead_access_events／lead_idempotency_records 一併刪除（這些表的
--      lead_id 外鍵沒有 cascade，需要依序刪除子表再刪主表）。
--   4. Consent 同意證據（3 年）：建立滿 3 年的 Consent 整筆刪除（本身只存版本與時間，不含健康
--      資料，見 DATA_MODEL §6／PRIVACY_AND_RETENTION §2）。
--
-- dry_run=true 時只計算四項筆數，不實際刪除，也不寫入 deletion_runs（呼叫端的 CLI 另外決定是否
-- 記錄 dry-run 的結果；本函式本身只負責「算」或「刪」，四項計數同時回傳供冪等驗證比對）。
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
  select array_agg(distinct s.id) into v_session_ids
  from public.sessions s
  where s.status = 'DELETION_REQUESTED'
     or (s.status = 'ACTIVE' and coalesce(s.last_seen_at, s.created_at) <= v_now - interval '90 days');
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

-- ===== 7. public.rls_auto_enable()：收緊不必要的 EXECUTE（Supabase security advisor WARN）=====
-- 雲端專案既有、非本專案 migration 建立的函式（RETURNS event_trigger，建立 public 表時自動啟用 RLS）。
-- event trigger 由資料庫在 DDL 時觸發，不需要 anon／authenticated 的 EXECUTE；這裡只撤銷該權限，
-- 不刪除函式、不變更 event trigger。函式不存在時（全新或本機資料庫）略過。
do $$
declare
  v_fn regprocedure;
begin
  for v_fn in
    select p.oid::regprocedure from pg_proc p
    where p.proname = 'rls_auto_enable' and p.pronamespace = 'public'::regnamespace
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', v_fn);
  end loop;
end;
$$;
