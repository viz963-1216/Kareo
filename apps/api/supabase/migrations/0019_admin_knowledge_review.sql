-- TASK-B-012：Admin Knowledge Review API。依 docs/API_CONTRACT.md §26（v0.4，D-16／D-16a）、
-- docs/DATA_MODEL.md 第 41 節（AdminAuditEvent）。

-- migration 0018（B-006）已建立 internal_operators；本檔只新增 admin session 與稽核紀錄。

create table if not exists admin_sessions (
  id text primary key,
  operator_id text not null references internal_operators (id),
  token_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null
);

create unique index if not exists admin_sessions_token_hash_idx on admin_sessions (token_hash);

-- DATA_MODEL §41：只能新增，不得修改或刪除；只有 service_role 可寫入。稽核寫入必須跟同一筆資料
-- 變更在同一交易內完成（見下方三個 admin_* RPC），不是 Node 層分開呼叫兩次。
create table if not exists admin_audit_events (
  id text primary key,
  operator_id text not null references internal_operators (id),
  action text not null,
  target_type text not null,
  target_id text not null,
  reason text,
  detail jsonb,
  created_at timestamptz not null
);

create index if not exists admin_audit_events_target_idx on admin_audit_events (target_type, target_id);
create index if not exists admin_audit_events_operator_idx on admin_audit_events (operator_id);

alter table admin_sessions enable row level security;
alter table admin_audit_events enable row level security;
revoke all on table admin_sessions, admin_audit_events from anon, authenticated;
-- admin_sessions 需要 update（撤銷／覆蓋）與 delete（過期清理），比照一般 Business Table。
grant select, insert, update, delete on table admin_sessions to service_role;
-- admin_audit_events 依 DATA_MODEL §41「只能新增」，刻意不 grant update／delete 給 service_role，
-- 在資料庫層擋掉事後竄改或刪除稽核紀錄（service_role 繞過 RLS，但不繞過權限授予）。
grant select, insert on table admin_audit_events to service_role;

-- 核准／退回單筆紀錄：沿用 B-008-r4 approveRecords 的原子檢查模式（status=NEEDS_REVIEW 且
-- content_fingerprint=期望值，單一 UPDATE 內完成），並在同一交易內寫入稽核紀錄
-- （API_CONTRACT §26.1：每個成功的管理 API 寫入都要跟同一筆資料變更同一交易）。
-- 回傳 updated=false 時代表沒有任何列符合條件（不存在／不是 NEEDS_REVIEW／指紋不符），
-- Node 層另外用唯讀查詢分類原因（同 approveRecords 既有模式），不在這裡分類。
create or replace function public.admin_decide_knowledge_record(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_record_id text := payload ->> 'recordId';
  v_decision text := payload ->> 'decision';
  v_reason text := payload ->> 'reason';
  v_expected_fp text := payload ->> 'expectedContentFingerprint';
  v_operator_id text := payload ->> 'operatorId';
  v_audit_id text := payload ->> 'auditId';
  v_now timestamptz := (payload ->> 'now')::timestamptz;
  v_updated integer;
begin
  if v_decision not in ('APPROVED', 'REJECTED') then
    raise exception 'admin_decide_knowledge_record: decision must be APPROVED or REJECTED';
  end if;

  update public.knowledge_records
  set status = v_decision, updated_at = v_now
  where id = v_record_id and status = 'NEEDS_REVIEW' and content_fingerprint = v_expected_fp;
  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    return jsonb_build_object('updated', false);
  end if;

  insert into public.admin_audit_events (id, operator_id, action, target_type, target_id, reason, detail, created_at)
  values (
    v_audit_id,
    v_operator_id,
    case when v_decision = 'APPROVED' then 'KNOWLEDGE_RECORD_APPROVED' else 'KNOWLEDGE_RECORD_REJECTED' end,
    'KNOWLEDGE_RECORD',
    v_record_id,
    v_reason,
    jsonb_build_object('contentFingerprint', v_expected_fp),
    v_now
  );

  return jsonb_build_object('updated', true);
end;
$$;

-- 變更「不影響已審核內容」結案：同一交易內更新 knowledge_changes 並寫入稽核紀錄。
create or replace function public.admin_dismiss_knowledge_change(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_change_id text := payload ->> 'changeId';
  v_reason text := payload ->> 'reason';
  v_operator_id text := payload ->> 'operatorId';
  v_audit_id text := payload ->> 'auditId';
  v_now timestamptz := (payload ->> 'now')::timestamptz;
  v_updated integer;
begin
  update public.knowledge_changes
  set status = 'DISMISSED', reviewed_at = v_now, reviewed_by = v_operator_id
  where id = v_change_id and status = 'NEEDS_REVIEW';
  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    return jsonb_build_object('updated', false);
  end if;

  insert into public.admin_audit_events (id, operator_id, action, target_type, target_id, reason, detail, created_at)
  values (v_audit_id, v_operator_id, 'KNOWLEDGE_CHANGE_DISMISSED', 'KNOWLEDGE_CHANGE', v_change_id, v_reason, null, v_now);

  return jsonb_build_object('updated', true);
end;
$$;

-- 管理頁撤回（API_CONTRACT §26.11）：比既有 withdraw_knowledge_version 多兩層檢查——
-- 1) withdrawVersionId 必須等於目前 PUBLISHED 版本（不然代表畫面資料已過期）。
-- 2) republishVersionId（若非 null）必須符合 §26.10 的可恢復條件：ARCHIVED、從未被撤回過
--    （withdrawn_at is null）、knowledge_version_records 至少 1 筆、快照內沒有任何紀錄已失效。
-- 這兩層檢查、實際寫入（沿用既有 public.withdraw_knowledge_version，不另寫一套狀態轉換邏輯）、
-- 與稽核紀錄，都在同一個函式（同一個交易）內完成——依 API_CONTRACT §26.11「必須與撤回／恢復
-- 寫入及稽核紀錄在同一交易內保證一致；只在 Node 層事先讀取驗證不足以避免競爭條件」。
-- 不符合上述兩層檢查時拋出以 'STATE_CHANGED:' 開頭的例外，Node 層依此字首判斷回
-- KNOWLEDGE_STATE_CHANGED，而不是把 SQL 例外原文外露。
create or replace function public.admin_withdraw_knowledge_version(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_withdraw_version_id text := payload ->> 'withdrawVersionId';
  v_republish_version_id text := payload ->> 'republishVersionId';
  v_reason text := payload ->> 'reason';
  v_operator_id text := payload ->> 'operatorId';
  v_audit_id text := payload ->> 'auditId';
  v_now timestamptz := (payload ->> 'now')::timestamptz;
  v_today date := (payload ->> 'today')::date;
  v_current_id text;
  v_result jsonb;
begin
  select id into v_current_id from public.knowledge_versions where status = 'PUBLISHED';
  if v_current_id is null or v_current_id <> v_withdraw_version_id then
    raise exception 'STATE_CHANGED: current PUBLISHED version is not %', v_withdraw_version_id;
  end if;

  if v_republish_version_id is not null then
    if v_republish_version_id = v_withdraw_version_id then
      raise exception 'STATE_CHANGED: republishVersionId cannot equal withdrawVersionId';
    end if;
    if not exists (
      select 1 from public.knowledge_versions
      where id = v_republish_version_id and status = 'ARCHIVED' and withdrawn_at is null
    ) then
      raise exception 'STATE_CHANGED: republishVersionId % is not a restorable ARCHIVED version', v_republish_version_id;
    end if;
    if not exists (select 1 from knowledge_version_records where version_id = v_republish_version_id) then
      raise exception 'STATE_CHANGED: republishVersionId % has no snapshot records', v_republish_version_id;
    end if;
    if exists (
      select 1
      from knowledge_version_records vr
      join public.knowledge_records kr on kr.id = vr.knowledge_record_id
      where vr.version_id = v_republish_version_id and kr.effective_to is not null and kr.effective_to < v_today
    ) then
      raise exception 'STATE_CHANGED: republishVersionId % contains an expired record', v_republish_version_id;
    end if;
  end if;

  v_result := public.withdraw_knowledge_version(jsonb_build_object(
    'reason', v_reason,
    'withdrawnBy', v_operator_id,
    'republishVersionId', v_republish_version_id
  ));

  insert into public.admin_audit_events (id, operator_id, action, target_type, target_id, reason, detail, created_at)
  values (
    v_audit_id, v_operator_id, 'KNOWLEDGE_VERSION_WITHDRAWN', 'KNOWLEDGE_VERSION', v_withdraw_version_id, v_reason,
    jsonb_build_object('republishVersionId', v_republish_version_id), v_now
  );

  return v_result;
end;
$$;

revoke execute on function public.admin_decide_knowledge_record(jsonb) from public, anon, authenticated;
revoke execute on function public.admin_dismiss_knowledge_change(jsonb) from public, anon, authenticated;
revoke execute on function public.admin_withdraw_knowledge_version(jsonb) from public, anon, authenticated;
grant execute on function public.admin_decide_knowledge_record(jsonb) to service_role;
grant execute on function public.admin_dismiss_knowledge_change(jsonb) to service_role;
grant execute on function public.admin_withdraw_knowledge_version(jsonb) to service_role;
