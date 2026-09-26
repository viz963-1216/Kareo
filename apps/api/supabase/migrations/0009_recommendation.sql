-- TASK-B-005: Recommendation Engine 執行紀錄與單筆推薦結果。依 docs/DATA_MODEL.md 第 20-21 節。
-- 編號使用 0009：若與其他未合併分支（例如 B-010 的 0009_*.sql）編號衝突，屬正常情況，
-- 由 Jerry 於 staging 整合時重新編號（比照 0012 註解中 0008-0011 的既有作法）。

create table if not exists recommendation_runs (
  id text primary key,
  assessment_id text not null references assessments (id),
  service_type text not null,
  ranking_type text not null,
  location_precision text not null,
  knowledge_version text not null,
  created_at timestamptz not null
);

create table if not exists recommendation_items (
  id text primary key,
  recommendation_run_id text not null references recommendation_runs (id),
  provider_id text not null references providers (id),
  rank integer not null,
  score numeric not null,
  distance_km numeric,
  reasons text[] not null default '{}',
  created_at timestamptz not null
);

create index if not exists recommendation_runs_assessment_id_idx on recommendation_runs (assessment_id);
create index if not exists recommendation_items_run_id_idx on recommendation_items (recommendation_run_id);

-- 依 0002/0003 相同原則：Recommendation 為核心 Business Table，只有 Backend（service_role）可存取，
-- 前端不得繞過 Kareo API 直接讀寫。
alter table recommendation_runs enable row level security;
alter table recommendation_items enable row level security;
revoke all on table recommendation_runs, recommendation_items from anon, authenticated;
grant select, insert, update, delete on table recommendation_runs, recommendation_items to service_role;
