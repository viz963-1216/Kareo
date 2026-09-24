-- TASK-B-008-r2：修正 publish_knowledge_version，符合已核准的 D-03（README §4）與 D-03-v2：
-- 1. 版號存在檢查移進資料庫（Node 層已檢查，這裡是防禦性的第二層）。
-- 2. 已失效（effective_to 早於發布日）的舊 PUBLISHED 紀錄不再無條件變成 SUPERSEDED 後消失於新版本，
--    而是先判斷「是否被新內容取代」：
--    - 同 jurisdiction + ruleData.type + title 有新紀錄 → 視為取代 → SUPERSEDED。
--    - 沒有新紀錄取代、且已失效（effective_to 早於發布日） → SUPERSEDED（不帶入新版本）。
--    - 沒有新紀錄取代、且仍然有效 → 帶入新版本（version 改為新版號，status 維持 PUBLISHED）。
-- 編號使用 0011：0008（B-011a）、0009／0010（B-010）已被其他未合併分支佔用，避免衝突。
create or replace function public.publish_knowledge_version(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_version_id text := payload ->> 'versionId';
  v_created_by text := payload ->> 'createdBy';
  v_approved_by text := payload ->> 'approvedBy';
  v_notes text := payload ->> 'notes';
  v_record_ids text[];
  v_published_count integer;
  v_superseded_count integer;
  v_expired_count integer;
  v_carried_count integer;
  v_missing_count integer;
  v_today date := (now() at time zone 'Asia/Taipei')::date;
begin
  select array_agg(value) into v_record_ids from jsonb_array_elements_text(payload -> 'recordIds');

  if v_version_id is null or v_created_by is null or v_approved_by is null then
    raise exception 'publish_knowledge_version: versionId, createdBy, approvedBy are required';
  end if;
  if v_record_ids is null or array_length(v_record_ids, 1) is null then
    raise exception 'publish_knowledge_version: recordIds must be a non-empty array';
  end if;

  if exists (select 1 from public.knowledge_versions where id = v_version_id) then
    raise exception 'publish_knowledge_version: version % already exists', v_version_id;
  end if;

  -- 所有指定的紀錄必須目前是 APPROVED，否則整個交易失敗（不得發布未核准內容）。
  select count(*) into v_missing_count
  from unnest(v_record_ids) as r(id)
  where not exists (
    select 1 from public.knowledge_records kr where kr.id = r.id and kr.status = 'APPROVED'
  );
  if v_missing_count > 0 then
    raise exception 'publish_knowledge_version: % of the given recordIds are not currently APPROVED', v_missing_count;
  end if;

  -- 被新內容取代的舊 PUBLISHED 紀錄 → SUPERSEDED（D-03-v2）。
  update public.knowledge_records old
  set status = 'SUPERSEDED', updated_at = now()
  where old.status = 'PUBLISHED'
    and exists (
      select 1 from public.knowledge_records new_rec
      where new_rec.id = any(v_record_ids)
        and new_rec.jurisdiction = old.jurisdiction
        and (new_rec.rule_data ->> 'type') = (old.rule_data ->> 'type')
        and new_rec.title = old.title
    );
  get diagnostics v_superseded_count = row_count;

  -- 未被取代、但已失效的舊 PUBLISHED 紀錄 → SUPERSEDED（不帶入新版本）。
  update public.knowledge_records
  set status = 'SUPERSEDED', updated_at = now()
  where status = 'PUBLISHED'
    and effective_to is not null
    and effective_to < v_today;
  get diagnostics v_expired_count = row_count;

  update public.knowledge_versions
  set status = 'ARCHIVED'
  where status = 'PUBLISHED';

  insert into public.knowledge_versions (id, status, published_at, created_by, approved_by, notes)
  values (v_version_id, 'PUBLISHED', now(), v_created_by, v_approved_by, v_notes);

  -- 未被取代、未失效的舊 PUBLISHED 紀錄 → 帶入新版本（D-03-v2）。
  update public.knowledge_records
  set version = v_version_id, updated_at = now()
  where status = 'PUBLISHED' and version is distinct from v_version_id;
  get diagnostics v_carried_count = row_count;

  update public.knowledge_records
  set status = 'PUBLISHED', version = v_version_id, updated_at = now()
  where id = any(v_record_ids) and status = 'APPROVED';
  get diagnostics v_published_count = row_count;

  return jsonb_build_object(
    'publishedRecordCount', v_published_count,
    'supersededRecordCount', v_superseded_count + v_expired_count,
    'carriedForwardCount', v_carried_count
  );
end;
$$;

revoke execute on function public.publish_knowledge_version(jsonb) from public, anon, authenticated;
grant execute on function public.publish_knowledge_version(jsonb) to service_role;
