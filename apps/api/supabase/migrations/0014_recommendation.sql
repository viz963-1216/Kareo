-- TASK-B-005: Recommendation Engine 執行紀錄與單筆推薦結果。依 docs/DATA_MODEL.md 第 20-21 節。
-- 編號 0014：依 J-003-r7（2026-09-29）跨分支 migration 全域順序表重新命名（原檔名 0013_recommendation.sql，
-- 尚未套用於任何環境，只改檔名，內容不變）；因 B-008 新增的 0013_knowledge_content_fingerprint.sql
-- 也用了 0013，J-003-r7 協調為：B-008 保留 0013，本檔（recommendation）→ 0014，
-- B-009 的 crawler 三個檔案 → 0015／0016／0017。

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

-- Jerry 委託修正第二輪（2026-09-26）：擴大 ARCHITECTURE §22 原子寫入核准範圍（比照 Provider 匯入
-- import_provider_dataset 的既有模式），修正 RecommendationRun／RecommendationItem 依序寫入時，
-- Items 寫入失敗會留下沒有 Items、卻可能被後續 Lead 誤用的孤立 Run 的問題。
-- 只負責寫入，不做驗證／業務規則（驗證在 recommendationService 完成）；兩張表在同一次呼叫（同一個
-- 交易）內寫入，任一步失敗整個交易回滾，沒有任何資料對外可見；只有 service_role 可執行。
--
-- payload 格式：
--   { "run": { id, assessment_id, service_type, ranking_type, location_precision, knowledge_version, created_at },
--     "items": [{ id, recommendation_run_id, provider_id, rank, score, distance_km, reasons, created_at }, ...] }
-- 回傳：{ "run": 1, "items": n }（實際寫入筆數）

create or replace function public.create_recommendation_result(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  run_row jsonb := payload -> 'run';
  items_written integer;
begin
  insert into public.recommendation_runs (
    id, assessment_id, service_type, ranking_type, location_precision, knowledge_version, created_at
  )
  values (
    run_row ->> 'id',
    run_row ->> 'assessment_id',
    run_row ->> 'service_type',
    run_row ->> 'ranking_type',
    run_row ->> 'location_precision',
    run_row ->> 'knowledge_version',
    (run_row ->> 'created_at')::timestamptz
  );

  insert into public.recommendation_items (
    id, recommendation_run_id, provider_id, rank, score, distance_km, reasons, created_at
  )
  select
    i.id, i.recommendation_run_id, i.provider_id, i.rank, i.score, i.distance_km,
    array(select jsonb_array_elements_text(i.reasons)),
    i.created_at
  from jsonb_to_recordset(coalesce(payload -> 'items', '[]'::jsonb)) as i(
    id text, recommendation_run_id text, provider_id text, rank integer, score numeric,
    distance_km numeric, reasons jsonb, created_at timestamptz
  );
  get diagnostics items_written = row_count;

  return jsonb_build_object('run', 1, 'items', items_written);
end;
$$;

revoke execute on function public.create_recommendation_result(jsonb) from public, anon, authenticated;
grant execute on function public.create_recommendation_result(jsonb) to service_role;
