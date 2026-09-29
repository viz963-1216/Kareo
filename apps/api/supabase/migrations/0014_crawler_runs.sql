-- TASK-B-009：Crawler 執行紀錄。依 docs/DATA_MODEL.md 第 28 節。
-- 每個 active Source Registry 來源每次排程觸發產生一筆；PRODUCT_SPEC §49：抓取失敗不得清空或
-- 刪除既有 Knowledge，也不得寫半套資料，本表只記錄「發生了什麼」，不影響 knowledge_records。
-- 編號 0014：依 J-003-r5（2026-09-27）跨分支 migration 全域順序表重新命名（原檔名
-- 0012_crawler_runs.sql，尚未套用於任何環境，只改檔名，內容不變）；合併順序需為
-- #33 → #36 → #40 → #37。
create table if not exists crawler_runs (
  id text primary key,
  source_id text not null references knowledge_sources (id),
  started_at timestamptz not null,
  finished_at timestamptz,
  status text not null,
  items_checked integer not null default 0,
  changes_detected integer not null default 0,
  error_message text
);

create index if not exists crawler_runs_source_id_idx on crawler_runs (source_id);
create index if not exists crawler_runs_started_at_idx on crawler_runs (started_at);

alter table crawler_runs enable row level security;
revoke all on table crawler_runs from anon, authenticated;
grant select, insert, update, delete on table crawler_runs to service_role;
