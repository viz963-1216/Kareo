-- TASK-B-008：Publish / Withdraw 的原子寫入函式。
-- 依 docs/ARCHITECTURE.md §22 / MVP_DECISIONS D-10 的模式（B-004 已核准同一做法）：
-- 這兩個操作都跨 knowledge_versions 與 knowledge_records 兩張表，Supabase REST 無法把多次
-- 寫入包在同一交易內，所以改用 Postgres function，只負責寫入，不做業務判斷以外的驗證。
-- 只有 service_role 可執行，不開放給前端；發布/撤回一律透過受保護的內部指令觸發（不提供公開 API）。

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
  v_missing_count integer;
begin
  select array_agg(value) into v_record_ids from jsonb_array_elements_text(payload -> 'recordIds');

  if v_version_id is null or v_created_by is null or v_approved_by is null then
    raise exception 'publish_knowledge_version: versionId, createdBy, approvedBy are required';
  end if;
  if v_record_ids is null or array_length(v_record_ids, 1) is null then
    raise exception 'publish_knowledge_version: recordIds must be a non-empty array';
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

  -- 前一個 PUBLISHED 版本（若存在）→ ARCHIVED，其紀錄 → SUPERSEDED（一般發布造成的取代，非「撤回」）。
  update public.knowledge_versions
  set status = 'ARCHIVED'
  where status = 'PUBLISHED';

  update public.knowledge_records
  set status = 'SUPERSEDED', updated_at = now()
  where status = 'PUBLISHED';
  get diagnostics v_superseded_count = row_count;

  insert into public.knowledge_versions (id, status, published_at, created_by, approved_by, notes)
  values (v_version_id, 'PUBLISHED', now(), v_created_by, v_approved_by, v_notes);

  update public.knowledge_records
  set status = 'PUBLISHED', version = v_version_id, updated_at = now()
  where id = any(v_record_ids) and status = 'APPROVED';
  get diagnostics v_published_count = row_count;

  return jsonb_build_object('publishedRecordCount', v_published_count, 'supersededRecordCount', v_superseded_count);
end;
$$;

create or replace function public.withdraw_knowledge_version(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_reason text := payload ->> 'reason';
  v_withdrawn_by text := payload ->> 'withdrawnBy';
  v_republish_version_id text := payload ->> 'republishVersionId';
  v_current_id text;
begin
  if v_reason is null or v_withdrawn_by is null then
    raise exception 'withdraw_knowledge_version: reason and withdrawnBy are required';
  end if;

  select id into v_current_id from public.knowledge_versions where status = 'PUBLISHED';
  if v_current_id is null then
    raise exception 'withdraw_knowledge_version: no PUBLISHED version to withdraw';
  end if;

  -- 依 README §5：不刪除資料，只是狀態轉換 + 留下撤回紀錄。
  update public.knowledge_versions
  set status = 'ARCHIVED', withdrawn_at = now(), withdrawn_by = v_withdrawn_by, withdrawal_reason = v_reason
  where id = v_current_id;

  update public.knowledge_records
  set status = 'SUPERSEDED', updated_at = now()
  where version = v_current_id and status = 'PUBLISHED';

  if v_republish_version_id is not null then
    if not exists (
      select 1 from public.knowledge_versions where id = v_republish_version_id and status = 'ARCHIVED'
    ) then
      raise exception 'withdraw_knowledge_version: republishVersionId % is not an ARCHIVED version', v_republish_version_id;
    end if;

    update public.knowledge_versions
    set status = 'PUBLISHED', published_at = now()
    where id = v_republish_version_id;

    update public.knowledge_records
    set status = 'PUBLISHED', updated_at = now()
    where version = v_republish_version_id and status = 'SUPERSEDED';
  end if;
  -- 沒有指定 republishVersionId：系統回到「無 PUBLISHED 版本」狀態，
  -- 依 contract Assessment 會回 KNOWLEDGE_UNAVAILABLE，不得以未審核資料頂替。

  return jsonb_build_object('republishedVersionId', v_republish_version_id);
end;
$$;

revoke execute on function public.publish_knowledge_version(jsonb) from public, anon, authenticated;
revoke execute on function public.withdraw_knowledge_version(jsonb) from public, anon, authenticated;
grant execute on function public.publish_knowledge_version(jsonb) to service_role;
grant execute on function public.withdraw_knowledge_version(jsonb) to service_role;
