-- TASK-B-002: 最小 migration，僅建立 Session / Consent 所需資料表。
-- 依 docs/DATA_MODEL.md 第 4、6 節。不得順便建立 Recommendation / Knowledge / Lead Schema。

create table if not exists sessions (
  id text primary key,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists consents (
  id text primary key,
  session_id text not null references sessions (id),
  disclaimer_version text not null,
  privacy_version text not null,
  terms_version text not null,
  accepted_at timestamptz not null
);

create index if not exists consents_session_id_idx on consents (session_id);
