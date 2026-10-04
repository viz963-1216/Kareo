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

-- TASK-B-012-r3（Jerry 2026-10-01 指示 2）：內容包層級中繼資料，解除 publish-preview／publish
-- 的 PACK_NOT_APPROVED 架構缺口（詳細設計說明見 migration 0020）。放在這裡（表定義）是因為
-- admin_decide_knowledge_record（下方）需要寫入 knowledge_record_review_events，函式定義順序
-- 不能晚於資料表；upsert_content_pack／compute_publish_plan／admin_publish_knowledge_version
-- 等實際使用 content_packs 的函式放在 0020。
create table if not exists content_packs (
  id text primary key,
  -- 依 contracts/knowledge/content-pack.schema.json：只有 status=APPROVED 時才會填；
  -- NEEDS_REVIEW 階段為 null（尚未決定版號），故允許 null。
  intended_knowledge_version text,
  source_registry_version text,
  status text not null,
  pack_fingerprint text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists content_packs_status_idx on content_packs (status);

-- 逐筆審核證據：CLI（approveKnowledgePack）與管理頁（decision 端點）核准都寫入同一份只能新增的
-- 審核紀錄，source 區分來源。reviewed_by 可能是 CLI 操作者輸入的任意姓名，不是 internal_operators
-- 的 FK（CLI 核准不透過管理 session）。
create table if not exists knowledge_record_review_events (
  id text primary key,
  knowledge_record_id text not null references knowledge_records (id),
  decision text not null,
  reason text,
  reviewed_by text not null,
  reviewed_at timestamptz not null,
  content_fingerprint text not null,
  source text not null,
  created_at timestamptz not null
);

create index if not exists knowledge_record_review_events_record_idx
  on knowledge_record_review_events (knowledge_record_id);

alter table admin_sessions enable row level security;
alter table admin_audit_events enable row level security;
alter table content_packs enable row level security;
alter table knowledge_record_review_events enable row level security;
revoke all on table admin_sessions, admin_audit_events, content_packs, knowledge_record_review_events
  from anon, authenticated;
-- admin_sessions 需要 update（撤銷／覆蓋）與 delete（過期清理），比照一般 Business Table。
grant select, insert, update, delete on table admin_sessions to service_role;
grant select, insert, update, delete on table content_packs to service_role;
-- admin_audit_events／knowledge_record_review_events 依 DATA_MODEL §41「只能新增」，刻意不
-- grant update／delete 給 service_role，在資料庫層擋掉事後竄改或刪除稽核紀錄
-- （service_role 繞過 RLS，但不繞過權限授予）。
grant select, insert on table admin_audit_events to service_role;
grant select, insert on table knowledge_record_review_events to service_role;

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

  -- TASK-B-012-r3（Jerry 指示 2）：管理頁核准也寫入跟 CLI approveKnowledgePack 共用的逐筆審核
  -- 證據表，source='ADMIN_API'，跟上面的 admin_audit_events 寫入同一交易。
  insert into public.knowledge_record_review_events
    (id, knowledge_record_id, decision, reason, reviewed_by, reviewed_at, content_fingerprint, source, created_at)
  values (v_audit_id || '-review', v_record_id, v_decision, v_reason, v_operator_id, v_now, v_expected_fp, 'ADMIN_API', v_now);

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
  -- J-003-r8（Jerry 委託審查 #48，問題 3，P1）：原本這裡只是一般 SELECT，READ COMMITTED 下同一
  -- 交易內之後的陳述式（包括委派呼叫的 public.withdraw_knowledge_version 自己的 SELECT）仍可能
  -- 看到「這個 SELECT 之後、交易尚未提交前」被其他交易 commit 的新狀態——同一個 transaction
  -- 本身不保證這段 read-check-write 不被插入。改用 `for update` 鎖住目前 PUBLISHED 這一列：
  -- 任何其他交易只要嘗試 UPDATE 同一列（不論是直接呼叫 publish_knowledge_version、
  -- withdraw_knowledge_version，或另一個 admin_withdraw_knowledge_version），都會被這個列鎖
  -- 擋下直到本交易 commit／rollback，讓「確認當下看到的版本」與「真正撤回的版本」保證一致，
  -- 不需要重寫既有 publish/withdraw 函式本身的邏輯（它們的 UPDATE ... WHERE status='PUBLISHED'
  -- 在鎖釋放後會重新依最新狀態求值，天然接上這個序列化點）。
  select id into v_current_id from public.knowledge_versions where status = 'PUBLISHED' for update;
  if v_current_id is null or v_current_id <> v_withdraw_version_id then
    raise exception 'STATE_CHANGED: current PUBLISHED version is not %', v_withdraw_version_id;
  end if;

  if v_republish_version_id is not null then
    if v_republish_version_id = v_withdraw_version_id then
      raise exception 'STATE_CHANGED: republishVersionId cannot equal withdrawVersionId';
    end if;
    -- 同理鎖住恢復目標這一列：避免在本交易確認它「符合恢復條件」之後、真正撤回之前，
    -- 被另一個交易搶先把它發布或再次撤回。
    if not exists (
      select 1 from public.knowledge_versions
      where id = v_republish_version_id and status = 'ARCHIVED' and withdrawn_at is null
      for update
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
