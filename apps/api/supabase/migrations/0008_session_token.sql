-- TASK-B-011a: Session Token 基礎欄位。依 docs/DATA_MODEL.md 第 4、6 節（v0.2）、
-- docs/ARCHITECTURE.md §20.1-20.3。舊有 sessions/consents 表在 0001 建立，這裡只擴充欄位，
-- 不重建、不動既有資料。

alter table sessions
  add column if not exists token_hash text,
  add column if not exists last_seen_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists status text not null default 'ACTIVE',
  add column if not exists deleted_at timestamptz;

-- 舊資料（本 migration 之前建立的 Session）沒有 token，一律視為已失效，
-- 不得讓它們意外通過新的 Token 驗證。
update sessions set status = 'DELETED' where token_hash is null and status = 'ACTIVE';

create unique index if not exists sessions_token_hash_idx on sessions (token_hash);

alter table consents
  add column if not exists withdrawn_at timestamptz;

-- Token 是唯一的存取憑證，只能由 Backend（service_role）查詢比對，
-- 沿用 0002 既有的 RLS（anon/authenticated 已被 revoke），這裡不需要重新設定。
