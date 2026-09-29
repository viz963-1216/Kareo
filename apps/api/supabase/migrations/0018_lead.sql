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

-- API_CONTRACT §3.3：同一 session + 同一 Idempotency-Key 只能對應一筆 Lead（不論內容是否相同，
-- 由 Service 層先查出既有紀錄比對內容決定回原結果或 IDEMPOTENCY_CONFLICT，這裡的唯一約束只負責
-- 防止併發下真的寫入兩筆）。
create unique index if not exists leads_session_idempotency_key_idx on leads (session_id, idempotency_key);

-- API_CONTRACT §12 / ARCHITECTURE §20.5：同一 session + provider + serviceType 若已有未終態
-- （非 CLOSED/CANCELLED）的 Lead，視為重複，以資料庫唯一約束保證（不用「先查後寫」，避免併發下
-- 出現兩筆同時未終態的重複 Lead）。
create unique index if not exists leads_session_provider_service_open_idx
  on leads (session_id, provider_id, service_type)
  where status not in ('CLOSED', 'CANCELLED');

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
revoke all on table internal_operators, leads, lead_status_events, lead_access_events from anon, authenticated;
grant select, insert, update, delete on table internal_operators, leads, lead_status_events, lead_access_events to service_role;
