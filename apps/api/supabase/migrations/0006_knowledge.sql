-- TASK-B-008: Knowledge 資料表。依 docs/DATA_MODEL.md 第 23、24、26 節。
-- 不建立完整 Crawler / KnowledgeChange 工作流程（B-009 延後），但表格結構先建好。

create table if not exists knowledge_sources (
  id text primary key,
  name text not null,
  authority text not null,
  jurisdiction text not null,
  source_url text not null,
  active boolean not null default true,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists knowledge_versions (
  id text primary key,
  status text not null,
  published_at timestamptz,
  created_by text not null,
  approved_by text,
  notes text,
  -- 依 contracts/knowledge/README.md §5：撤回需記錄原因、操作者與時間，
  -- 只在「撤回」時填入，跟一般發布新版本造成的 ARCHIVED（supersede）區分開來。
  withdrawn_at timestamptz,
  withdrawn_by text,
  withdrawal_reason text
);

-- 同一時間只能有一個 PUBLISHED 版本（依 contracts/knowledge/README.md §4）。
create unique index if not exists knowledge_versions_one_published_idx
  on knowledge_versions ((true)) where status = 'PUBLISHED';

create table if not exists knowledge_records (
  id text primary key,
  source_id text not null references knowledge_sources (id),
  title text not null,
  category text not null,
  jurisdiction text not null,
  source_url text not null,
  published_at timestamptz,
  effective_from date not null,
  effective_to date,
  fetched_at timestamptz not null,
  last_verified_at timestamptz not null,
  content_hash text not null,
  status text not null,
  version text references knowledge_versions (id),
  raw_text text not null,
  summary text not null,
  rule_data jsonb not null default '{}',
  created_at timestamptz not null,
  updated_at timestamptz not null,
  -- 依 contracts/knowledge/README.md §3 第 5 點：以 (packId, recordId) 冪等。
  pack_id text not null,
  pack_record_id text not null,
  unique (pack_id, pack_record_id)
);

create table if not exists knowledge_changes (
  id text primary key,
  knowledge_record_id text not null references knowledge_records (id),
  old_content_hash text,
  new_content_hash text not null,
  old_content text,
  new_content text not null,
  ai_summary text,
  status text not null,
  detected_at timestamptz not null,
  reviewed_at timestamptz,
  reviewed_by text
);

create index if not exists knowledge_records_source_id_idx on knowledge_records (source_id);
create index if not exists knowledge_records_version_idx on knowledge_records (version);
create index if not exists knowledge_records_status_idx on knowledge_records (status);
create index if not exists knowledge_records_lookup_idx on knowledge_records (jurisdiction, category, title);
create index if not exists knowledge_changes_record_id_idx on knowledge_changes (knowledge_record_id);

alter table knowledge_sources enable row level security;
alter table knowledge_versions enable row level security;
alter table knowledge_records enable row level security;
alter table knowledge_changes enable row level security;
revoke all on table knowledge_sources, knowledge_versions, knowledge_records, knowledge_changes
  from anon, authenticated;
grant select, insert, update, delete on table knowledge_sources, knowledge_versions, knowledge_records, knowledge_changes
  to service_role;
