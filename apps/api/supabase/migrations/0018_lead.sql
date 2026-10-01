-- TASK-B-006：Lead（我要媒合）與內部接件所需資料表。依 docs/DATA_MODEL.md 第 22、36-38 節、
-- docs/API_CONTRACT.md 第 12 節、docs/LEAD_OPERATIONS.md。

create table if not exists internal_operators (
  id text primary key,
  display_name text not null,
  roles text[] not null default '{}',
  key_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null,
  revoked_at timestamptz
);

create unique index if not exists internal_operators_key_hash_idx on internal_operators (key_hash);

create table if not exists leads (
  id text primary key,
  session_id text not null references sessions (id),
  assessment_id text not null references assessments (id),
  recommendation_id text not null references recommendation_runs (id),
  provider_id text not null references providers (id),
  service_type text not null,
  contact_name text,
  contact_phone text,
  contact_consent_at timestamptz not null,
  idempotency_key text not null,
  status text not null default 'NEW',
  status_reason text,
  assigned_operator_id text references internal_operators (id),
  first_contacted_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

-- 這個欄位只記錄「這筆 Lead 本身是由哪個 key 直接建立」的溯源，不再是冪等判斷的查詢依據
-- （J-003-r8：同一 key 若解析為既有的「業務重複」Lead，而非自己建立新 Lead，原本不會被記錄在
-- 任何地方，導致該 key 結案後重送會錯誤地建立第二筆 Lead——見 lead_idempotency_records）。
create index if not exists leads_session_idempotency_key_idx on leads (session_id, idempotency_key);

-- API_CONTRACT §12 / ARCHITECTURE §20.5：同一 session + provider + serviceType 若已有未終態
-- （非 CLOSED/CANCELLED）的 Lead，視為重複，以資料庫唯一約束保證（不用「先查後寫」，避免併發下
-- 出現兩筆同時未終態的重複 Lead）。
create unique index if not exists leads_session_provider_service_open_idx
  on leads (session_id, provider_id, service_type)
  where status not in ('CLOSED', 'CANCELLED');

-- J-003-r8（Jerry 委託審查 #47，問題 3）：同一 (session, Idempotency-Key) 這次請求「最終解析到
-- 哪一筆 Lead」的不可變記錄——不論這次請求是真的建立了新 Lead，還是找到既有的業務重複 Lead
-- 而回傳它。沒有這張表時，業務重複的分支從未被任何地方記錄，一旦該 Lead 結案，同一個 key 重送
-- 會因為「open-duplicate 查詢」找不到任何未終態 Lead 而建立第二筆全新 Lead，等於同一個
-- Idempotency-Key 重試卻建立出兩筆 Lead。`request_fingerprint` 用來判斷重送內容是否相同
-- （不同 → IDEMPOTENCY_CONFLICT）。
create table if not exists lead_idempotency_records (
  id text primary key,
  session_id text not null references sessions (id),
  idempotency_key text not null,
  lead_id text not null references leads (id),
  request_fingerprint text not null,
  duplicate boolean not null,
  created_at timestamptz not null
);

create unique index if not exists lead_idempotency_records_session_key_idx
  on lead_idempotency_records (session_id, idempotency_key);

create index if not exists leads_session_id_idx on leads (session_id);
create index if not exists leads_status_idx on leads (status);

create table if not exists lead_status_events (
  id text primary key,
  lead_id text not null references leads (id),
  from_status text,
  to_status text not null,
  reason_code text,
  note text,
  operator_id text not null references internal_operators (id),
  created_at timestamptz not null
);

create index if not exists lead_status_events_lead_id_idx on lead_status_events (lead_id);

create table if not exists lead_access_events (
  id text primary key,
  lead_id text not null references leads (id),
  operator_id text not null references internal_operators (id),
  action text not null,
  created_at timestamptz not null
);

create index if not exists lead_access_events_lead_id_idx on lead_access_events (lead_id);

-- 依既有慣例（0002/0004/0014）：核心 Business Table 只有 Backend（service_role）可存取，
-- 前端不得繞過 Kareo API 或 CLI 直接讀寫；內部操作者密鑰雜湊同樣不對外開放查詢。
alter table internal_operators enable row level security;
alter table leads enable row level security;
alter table lead_status_events enable row level security;
alter table lead_access_events enable row level security;
alter table lead_idempotency_records enable row level security;
revoke all on table internal_operators, leads, lead_status_events, lead_access_events, lead_idempotency_records
  from anon, authenticated;
grant select, insert, update, delete
  on table internal_operators, leads, lead_status_events, lead_access_events, lead_idempotency_records
  to service_role;

-- J-003-r8（問題 1）：CAS 狀態更新與 LeadStatusEvent 寫入必須同成功同失敗——先前分兩次 REST
-- 呼叫（UPDATE 再 INSERT），INSERT 失敗時狀態已經轉移但歷程沒有對應事件，且無法重試補回
-- （重試會被「目前狀態已不是 expectedStatus」擋下）。改為單一 Postgres function，同一交易內
-- 完成兩者，任一步失敗整個撤回（依 ARCHITECTURE §22 的既有原子寫入模式）。
create or replace function public.update_lead_status_with_event(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_lead_id text := payload ->> 'leadId';
  v_expected_status text := payload ->> 'expectedStatus';
  v_to_status text := payload ->> 'toStatus';
  v_status_reason text := payload ->> 'statusReason';
  v_first_contacted_at timestamptz := nullif(payload ->> 'firstContactedAt', '')::timestamptz;
  v_closed_at timestamptz := nullif(payload ->> 'closedAt', '')::timestamptz;
  v_updated_at timestamptz := (payload ->> 'updatedAt')::timestamptz;
  v_event_id text := payload ->> 'eventId';
  v_operator_id text := payload ->> 'operatorId';
  v_reason_code text := payload ->> 'reasonCode';
  v_note text := payload ->> 'note';
  v_updated integer;
begin
  update public.leads
  set status = v_to_status,
      status_reason = v_status_reason,
      updated_at = v_updated_at,
      first_contacted_at = coalesce(v_first_contacted_at, first_contacted_at),
      closed_at = coalesce(v_closed_at, closed_at)
  where id = v_lead_id and status = v_expected_status;
  get diagnostics v_updated = row_count;

  -- Compare-and-set 沒有命中（狀態已被其他操作變更，或 id 不存在）：完全不寫事件，呼叫端
  -- 自行查詢分類是 NOT_FOUND 還是 INVALID_STATUS_TRANSITION（同其他既有模式）。
  if v_updated = 0 then
    return jsonb_build_object('updated', false);
  end if;

  insert into public.lead_status_events (id, lead_id, from_status, to_status, reason_code, note, operator_id, created_at)
  values (v_event_id, v_lead_id, v_expected_status, v_to_status, v_reason_code, v_note, v_operator_id, v_updated_at);

  return jsonb_build_object('updated', true);
end;
$$;

revoke execute on function public.update_lead_status_with_event(jsonb) from public, anon, authenticated;
grant execute on function public.update_lead_status_with_event(jsonb) to service_role;

-- J-003-r8（問題 2）：reveal-contact 只能由「被指派案件」的操作者執行（LEAD_OPERATIONS §2）。
-- 單一 UPDATE 內用 COALESCE 原子完成「若尚未指派則指派給這次呼叫的操作者（視為接手這個案件），
-- 否則維持原指派對象」，回傳目前的完整 Lead 列；Node 層比對 assigned_operator_id 是否等於
-- 呼叫者，不等於就是別人的案件，拒絕顯示聯絡資料。REST `.update()` 無法表示 COALESCE 既有欄位
-- 值，故用 RPC。
create or replace function public.claim_lead_for_reveal(p_lead_id text, p_operator_id text)
returns public.leads
language sql
security invoker
set search_path = public
as $$
  update public.leads
  set assigned_operator_id = coalesce(assigned_operator_id, p_operator_id)
  where id = p_lead_id
  returning *;
$$;

revoke execute on function public.claim_lead_for_reveal(text, text) from public, anon, authenticated;
grant execute on function public.claim_lead_for_reveal(text, text) to service_role;
