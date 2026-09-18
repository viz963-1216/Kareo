-- Kareo staging: only the trusted backend may access session/consent records.
-- Apply after 0001_session_consent.sql. No core schema/contract changes.
begin;
alter table public.sessions enable row level security;
alter table public.consents enable row level security;
revoke all on table public.sessions, public.consents from anon, authenticated;
grant usage on schema public to service_role;
grant select, insert, update, delete on table public.sessions, public.consents to service_role;
commit;
