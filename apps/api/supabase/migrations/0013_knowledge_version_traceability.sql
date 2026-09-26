-- TASK-B-008-r3：修正 J-003 H-3／H-4（歷史版本不完整、撤回可立即重發同版）。
-- 依 Jerry 委託修正（PR #36 comment）：carry-forward 不可覆寫舊紀錄 version 破壞歷史；
-- 需要不可變快照或版本—紀錄關聯，讓舊版本仍可完整查詢與回復。
--
-- 設計：
-- 1. knowledge_records.version 改為「第一次被發布時的版本」，一旦寫入就不再被 carry-forward 覆寫
--    （之前 migration 0011 的 carry-forward 會把 version 改成新版號，導致 tests/db/verify-db.mjs
--    的 K5（版本 001 發布後仍可用 version=001 追溯其原始紀錄集）、K6（撤回 002 恢復 001 必須拿回
--    完整內容，包含被 carry-forward 的紀錄）都會失敗——因為 B、C 的 version 欄位已經被覆寫成 002，
--    withdraw 用 version=001 尋找可恢復的紀錄時找不到它們）。
-- 2. 新增 knowledge_version_records 關聯表：每次發布時，把「這個版本實際包含的全部紀錄」
--    （新發布的 + carry-forward 進來的）完整寫一份快照進這張表，不可變、不覆寫、不刪除。
--    這張表才是撤回／回復時判斷「這個版本到底包含哪些紀錄」的依據，不依賴 knowledge_records.version
--    （否則同一筆紀錄若連續被好幾個版本 carry-forward，version 欄位只能記住最早那次，
--    withdraw 用 version 欄位去找「目前這個版本包含哪些紀錄」在超過兩個版本時會找不全）。
--
-- 編號使用 0013：0008（B-011a）、0009／0010（B-010）、0011（本檔基礎，B-008-r2）、0012（B-009）
-- 已被其他分支使用；staging 合併後最新為 0008，此檔延續本分支既有的 0011 繼續往下編。

create table if not exists knowledge_version_records (
  version_id text not null references knowledge_versions (id),
  knowledge_record_id text not null references knowledge_records (id),
  primary key (version_id, knowledge_record_id)
);

alter table knowledge_version_records enable row level security;
revoke all on table knowledge_version_records from anon, authenticated;
grant select, insert, update, delete on table knowledge_version_records to service_role;

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

  -- 被新內容取代的舊 PUBLISHED 紀錄 → SUPERSEDED（D-03-v2）。version 欄位保持原樣（不可變，第一次發布時的版本）。
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

  -- 剩下（未被取代、未失效）的舊 PUBLISHED 紀錄：帶入新版本，但 version 欄位不變（不可變快照，
  -- 追溯性依 knowledge_version_records，不依賴這裡）。
  select count(*) into v_carried_count from public.knowledge_records where status = 'PUBLISHED';

  update public.knowledge_versions
  set status = 'ARCHIVED'
  where status = 'PUBLISHED';

  insert into public.knowledge_versions (id, status, published_at, created_by, approved_by, notes)
  values (v_version_id, 'PUBLISHED', now(), v_created_by, v_approved_by, v_notes);

  update public.knowledge_records
  set status = 'PUBLISHED', version = v_version_id, updated_at = now()
  where id = any(v_record_ids) and status = 'APPROVED';
  get diagnostics v_published_count = row_count;

  -- 這個版本的完整內容快照（新發布 + carry-forward）：兩者聯集，寫入不可變關聯表。
  insert into knowledge_version_records (version_id, knowledge_record_id)
  select v_version_id, id from public.knowledge_records where status = 'PUBLISHED'
  on conflict do nothing;

  return jsonb_build_object(
    'publishedRecordCount', v_published_count,
    'supersededRecordCount', v_superseded_count + v_expired_count,
    'carriedForwardCount', v_carried_count
  );
end;
$$;

-- 撤回／回復改用 knowledge_version_records 判斷「這個版本包含哪些紀錄」，
-- 不再只看 knowledge_records.version（該欄位现在是不可變的「首次發布版本」，
-- 對被 carry-forward 超過一次的紀錄無法正確反映「目前這個版本」）。
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

  -- J-003 H-4／K7：不得把剛撤回的版本原地當成回復目標（會變成「撤回」形同無效）。
  if v_republish_version_id is not null and v_republish_version_id = v_current_id then
    raise exception 'withdraw_knowledge_version: republishVersionId cannot equal the version being withdrawn';
  end if;

  -- 依 README §5：不刪除資料，只是狀態轉換 + 留下撤回紀錄。
  update public.knowledge_versions
  set status = 'ARCHIVED', withdrawn_at = now(), withdrawn_by = v_withdrawn_by, withdrawal_reason = v_reason
  where id = v_current_id;

  -- 目前版本實際包含的紀錄（含 carry-forward 進來的），依 knowledge_version_records 判斷，全部 SUPERSEDED。
  update public.knowledge_records
  set status = 'SUPERSEDED', updated_at = now()
  where status = 'PUBLISHED'
    and id in (select knowledge_record_id from knowledge_version_records where version_id = v_current_id);

  if v_republish_version_id is not null then
    if not exists (
      select 1 from public.knowledge_versions where id = v_republish_version_id and status = 'ARCHIVED'
    ) then
      raise exception 'withdraw_knowledge_version: republishVersionId % is not an ARCHIVED version', v_republish_version_id;
    end if;

    update public.knowledge_versions
    set status = 'PUBLISHED', published_at = now()
    where id = v_republish_version_id;

    -- 回復目標版本「當時」的完整內容（依 knowledge_version_records 快照），不管這些紀錄目前個別
    -- 狀態是 SUPERSEDED 還是仍然 PUBLISHED（例如從未真的被取代、只是剛才被上面那段連帶標記）。
    update public.knowledge_records
    set status = 'PUBLISHED', updated_at = now()
    where id in (select knowledge_record_id from knowledge_version_records where version_id = v_republish_version_id);
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
