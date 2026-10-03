-- TASK-B-012-r3（Jerry 2026-10-01 指示）：內容包層級持久化（解除 publish-preview／publish 的
-- PACK_NOT_APPROVED 架構缺口），以及統一發布／撤回四個入口的鎖定機制。

-- ===== 1. 內容包層級中繼資料 =====
-- 之前內容包的 intendedKnowledgeVersion／status 只存在 CLI 讀取的 JSON 檔案裡，從未持久化
-- （knowledgeImportService.ts 驗證 pack.status 後就丟棄）。Admin API 只能存取資料庫，
-- 無法重建 targetVersionId 或 PACK_NOT_APPROVED／TARGET_VERSION_INVALID／TARGET_VERSION_CONFLICT。
create table if not exists content_packs (
  id text primary key,                          -- packId
  intended_knowledge_version text not null,
  source_registry_version text,
  status text not null,                         -- NEEDS_REVIEW | APPROVED | REJECTED（pack 本身的狀態）
  -- 依 recordId 排序的 (recordId, contentFingerprint) 清單 + 版號 + 狀態 算出的指紋；
  -- 同一 packId 重新匯入時，指紋不變才允許 NEEDS_REVIEW → APPROVED；指紋變了一律拒絕，
  -- 必須使用新 packId（見下方 upsert_content_pack）。
  pack_fingerprint text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists content_packs_status_idx on content_packs (status);

-- ===== 2. 逐筆審核證據（CLI 核准與管理頁核准共用同一份，只能新增）=====
-- 跟 admin_audit_events（B-012 既有，記錄「誰透過管理 API 做了什麼」的一般稽核）不同：這張表
-- 專門記錄「這筆 KnowledgeRecord 的核准/退回決定本身」，不論決定來自 CLI（approveKnowledgePack）
-- 還是管理頁（decision 端點），reviewed_by 可能是 CLI 操作者輸入的任意姓名（不是
-- internal_operators 的 FK），管理頁則會是真正的 operatorId。
create table if not exists knowledge_record_review_events (
  id text primary key,
  knowledge_record_id text not null references knowledge_records (id),
  decision text not null,                       -- APPROVED | REJECTED
  reason text,
  reviewed_by text not null,
  reviewed_at timestamptz not null,
  content_fingerprint text not null,
  source text not null,                         -- CLI_PACK | ADMIN_API
  created_at timestamptz not null
);

create index if not exists knowledge_record_review_events_record_idx
  on knowledge_record_review_events (knowledge_record_id);

alter table content_packs enable row level security;
alter table knowledge_record_review_events enable row level security;
revoke all on table content_packs, knowledge_record_review_events from anon, authenticated;
grant select, insert, update, delete on table content_packs to service_role;
-- 只能新增：不 grant update／delete，在資料庫層擋掉事後竄改或刪除審核證據。
grant select, insert on table knowledge_record_review_events to service_role;

-- ===== 3. upsert_content_pack：匯入／回填時寫入 pack 層級中繼資料 =====
-- 同一 packId 重新匯入：指紋不變才允許 NEEDS_REVIEW → APPROVED。指紋變了，判斷依據是「這次
-- 匯入」宣告的 status 是否為 APPROVED（2026-10-03 審查修正）——核准必須對應已登錄的內容，不能
-- 在同一次匯入裡同時改內容又核准；這次匯入宣告 NEEDS_REVIEW（更正草稿）則仍允許覆寫中繼資料。
create or replace function public.upsert_content_pack(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id text := payload ->> 'packId';
  v_version text := payload ->> 'intendedKnowledgeVersion';
  v_source_registry_version text := payload ->> 'sourceRegistryVersion';
  v_status text := payload ->> 'status';
  v_fingerprint text := payload ->> 'packFingerprint';
  v_now timestamptz := (payload ->> 'now')::timestamptz;
  v_existing record;
begin
  select * into v_existing from public.content_packs where id = v_id;

  if not found then
    insert into public.content_packs (id, intended_knowledge_version, source_registry_version, status, pack_fingerprint, created_at, updated_at)
    values (v_id, v_version, v_source_registry_version, v_status, v_fingerprint, v_now, v_now);
    return jsonb_build_object('action', 'inserted');
  end if;

  if v_existing.pack_fingerprint = v_fingerprint then
    if v_existing.status = 'NEEDS_REVIEW' and v_status = 'APPROVED' then
      -- 升級時 intendedKnowledgeVersion 依 schema 規則從 null 填入實際版號，這裡也要一併更新，
      -- 不能只改 status（否則升級後讀回來仍是 null，跟「只有 APPROVED 時才會填」的規則矛盾）。
      update public.content_packs
      set status = 'APPROVED', intended_knowledge_version = v_version, source_registry_version = v_source_registry_version, updated_at = v_now
      where id = v_id;
      return jsonb_build_object('action', 'promoted');
    end if;
    update public.content_packs
    set intended_knowledge_version = v_version, source_registry_version = v_source_registry_version, updated_at = v_now
    where id = v_id;
    return jsonb_build_object('action', 'unchanged');
  end if;

  -- 指紋不同、這次匯入宣告 APPROVED：拒絕，不管既有登錄狀態是什麼（核准必須對應已登錄的內容）。
  if v_status = 'APPROVED' then
    raise exception 'PACK_CONTENT_CHANGED: packId % already exists with different content; import a new packId instead', v_id;
  end if;

  update public.content_packs
  set intended_knowledge_version = v_version,
      source_registry_version = v_source_registry_version,
      status = v_status,
      pack_fingerprint = v_fingerprint,
      updated_at = v_now
  where id = v_id;
  return jsonb_build_object('action', 'updated');
end;
$$;

revoke execute on function public.upsert_content_pack(jsonb) from public, anon, authenticated;
grant execute on function public.upsert_content_pack(jsonb) to service_role;

-- ===== 4. compute_publish_plan：預覽與發布共用的唯一計畫計算（Jerry 指示 2）=====
-- 候選紀錄 = status='APPROVED' 且所屬內容包在 content_packs 中 status='APPROVED'。
-- previewToken 涵蓋 API_CONTRACT §26.8 全部項目，另加相關內容包的 status 與 pack_fingerprint
-- （Jerry 指示 2 最後一點）。
create or replace function public.compute_publish_plan()
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Taipei')::date;
  v_current_version_id text;
  v_approved_count integer;
  v_pack_blocked_count integer;
  v_target_version text;
  v_target_version_count integer;
  v_candidates jsonb;
  v_new_records jsonb;
  v_excluded jsonb;
  v_carried jsonb;
  v_superseded_count integer;
  v_blockers jsonb := '[]'::jsonb;
  v_can_publish boolean := true;
  v_token text;
  v_pack_summaries jsonb;
begin
  select id into v_current_version_id from public.knowledge_versions where status = 'PUBLISHED';

  select count(*) into v_approved_count from public.knowledge_records where status = 'APPROVED';

  select count(*) into v_pack_blocked_count
  from public.knowledge_records kr
  where kr.status = 'APPROVED'
    and not exists (
      select 1 from public.content_packs cp where cp.id = kr.pack_id and cp.status = 'APPROVED'
    );

  if v_approved_count = 0 then
    v_blockers := v_blockers || jsonb_build_object('code', 'NO_APPROVED_RECORDS', 'message', '目前沒有任何已核准的紀錄。');
    v_can_publish := false;
  elsif v_pack_blocked_count > 0 then
    v_blockers := v_blockers || jsonb_build_object('code', 'PACK_NOT_APPROVED', 'message', '內容包資料尚未登錄。');
    v_can_publish := false;
  end if;

  -- 完全合格的候選（紀錄 APPROVED 且所屬內容包 APPROVED）。
  if v_can_publish then
    select jsonb_agg(jsonb_build_object(
      'id', kr.id, 'packId', kr.pack_id, 'recordId', kr.pack_record_id, 'title', kr.title,
      'jurisdiction', kr.jurisdiction, 'effectiveFrom', kr.effective_from, 'effectiveTo', kr.effective_to,
      'contentFingerprint', kr.content_fingerprint, 'ruleData', kr.rule_data
    ))
    into v_candidates
    from public.knowledge_records kr
    where kr.status = 'APPROVED'
      and exists (select 1 from public.content_packs cp where cp.id = kr.pack_id and cp.status = 'APPROVED');
    v_candidates := coalesce(v_candidates, '[]'::jsonb);

    select count(distinct cp.intended_knowledge_version)
    into v_target_version_count
    from public.knowledge_records kr
    join public.content_packs cp on cp.id = kr.pack_id
    where kr.status = 'APPROVED' and cp.status = 'APPROVED';

    select cp.intended_knowledge_version
    into v_target_version
    from public.knowledge_records kr
    join public.content_packs cp on cp.id = kr.pack_id
    where kr.status = 'APPROVED' and cp.status = 'APPROVED'
    limit 1;

    if v_target_version is null or v_target_version !~ '^KB-\d{4}-\d{2}-\d{2}-\d{3}$' then
      v_blockers := v_blockers || jsonb_build_object('code', 'TARGET_VERSION_INVALID', 'message', '內容包缺少或格式不合法的 intendedKnowledgeVersion。');
      v_can_publish := false;
    elsif v_target_version_count > 1 then
      v_blockers := v_blockers || jsonb_build_object('code', 'TARGET_VERSION_CONFLICT', 'message', '候選紀錄所屬內容包的 intendedKnowledgeVersion 不只一個。');
      v_can_publish := false;
    end if;
  end if;

  if v_can_publish then
    select jsonb_agg(c) into v_new_records
    from jsonb_array_elements(v_candidates) c
    where (c ->> 'effectiveTo') is null or (c ->> 'effectiveTo')::date >= v_today;
    v_new_records := coalesce(v_new_records, '[]'::jsonb);

    select jsonb_agg(c) into v_excluded
    from jsonb_array_elements(v_candidates) c
    where (c ->> 'effectiveTo') is not null and (c ->> 'effectiveTo')::date < v_today;
    v_excluded := coalesce(v_excluded, '[]'::jsonb);

    if jsonb_array_length(v_new_records) = 0 then
      v_blockers := v_blockers || jsonb_build_object('code', 'ALL_CANDIDATES_EXPIRED', 'message', '候選紀錄的 effectiveTo 全部早於發布日。');
      v_can_publish := false;
    elsif exists (select 1 from public.knowledge_versions where id = v_target_version) then
      v_blockers := v_blockers || jsonb_build_object('code', 'VERSION_ALREADY_EXISTS', 'message', format('版本 %s 已存在，不得覆寫或改用其他號碼。', v_target_version));
      v_can_publish := false;
    end if;
  end if;

  if v_can_publish then
    -- 被新內容取代（同 jurisdiction+type+title）或已失效的現有 PUBLISHED 紀錄 → SUPERSEDED。
    select count(*) into v_superseded_count
    from public.knowledge_records old
    where old.status = 'PUBLISHED'
      and (
        (old.effective_to is not null and old.effective_to < v_today)
        or exists (
          select 1 from jsonb_array_elements(v_new_records) nr
          where (nr ->> 'jurisdiction') = old.jurisdiction
            and (nr -> 'ruleData' ->> 'type') = (old.rule_data ->> 'type')
            and (nr ->> 'title') = old.title
        )
      );

    select jsonb_agg(jsonb_build_object('id', id, 'contentFingerprint', content_fingerprint))
    into v_carried
    from public.knowledge_records
    where status = 'PUBLISHED'
      and not (
        (effective_to is not null and effective_to < v_today)
        or exists (
          select 1 from jsonb_array_elements(v_new_records) nr
          where (nr ->> 'jurisdiction') = jurisdiction
            and (nr -> 'ruleData' ->> 'type') = (rule_data ->> 'type')
            and (nr ->> 'title') = title
        )
      );
    v_carried := coalesce(v_carried, '[]'::jsonb);

    select jsonb_agg(jsonb_build_object('packId', id, 'status', status, 'packFingerprint', pack_fingerprint))
    into v_pack_summaries
    from public.content_packs
    where id in (select distinct packId from jsonb_to_recordset(v_new_records) as x(packId text, "recordId" text, title text, jurisdiction text, "effectiveFrom" text, "effectiveTo" text, "contentFingerprint" text, "ruleData" jsonb));

    v_token := encode(sha256((
      v_target_version || '|' || coalesce(v_current_version_id, '') || '|' || v_today::text || '|' ||
      (select string_agg(x ->> 'id' || ':' || (x ->> 'contentFingerprint'), ',' order by x ->> 'id') from jsonb_array_elements(v_new_records) x) || '|' ||
      (select coalesce(string_agg(x ->> 'id' || ':' || (x ->> 'contentFingerprint'), ',' order by x ->> 'id'), '') from jsonb_array_elements(v_carried) x) || '|' ||
      (select coalesce(string_agg(x ->> 'id', ',' order by x ->> 'id'), '') from jsonb_array_elements(v_excluded) x) || '|' ||
      (select coalesce(string_agg((x ->> 'packId') || ':' || (x ->> 'status') || ':' || (x ->> 'packFingerprint'), ',' order by x ->> 'packId'), '') from jsonb_array_elements(v_pack_summaries) x)
    )::bytea), 'hex');

    return jsonb_build_object(
      'canPublish', true,
      'targetVersionId', v_target_version,
      'currentVersionId', v_current_version_id,
      'publishDate', v_today,
      'publishedRecordCount', jsonb_array_length(v_new_records),
      'carriedForwardCount', jsonb_array_length(v_carried),
      'totalRecordCount', jsonb_array_length(v_new_records) + jsonb_array_length(v_carried),
      'supersededRecordCount', v_superseded_count,
      'excludedRecordCount', jsonb_array_length(v_excluded),
      'newRecords', v_new_records,
      'carriedForwardRecords', v_carried,
      'blockers', '[]'::jsonb,
      'previewToken', 'PPV-sha256:' || v_token,
      'generatedAt', to_char(now() at time zone 'Asia/Taipei', 'YYYY-MM-DD"T"HH24:MI:SS"+08:00"')
    );
  end if;

  return jsonb_build_object(
    'canPublish', false,
    'targetVersionId', null,
    'currentVersionId', v_current_version_id,
    'publishDate', v_today,
    'publishedRecordCount', 0,
    'carriedForwardCount', 0,
    'totalRecordCount', 0,
    'supersededRecordCount', 0,
    'excludedRecordCount', 0,
    'newRecords', '[]'::jsonb,
    'carriedForwardRecords', '[]'::jsonb,
    'blockers', v_blockers,
    'previewToken', null,
    'generatedAt', to_char(now() at time zone 'Asia/Taipei', 'YYYY-MM-DD"T"HH24:MI:SS"+08:00"')
  );
end;
$$;

revoke execute on function public.compute_publish_plan() from public, anon, authenticated;
grant execute on function public.compute_publish_plan() to service_role;

-- ===== 5. 統一鎖定：pg_advisory_xact_lock(8823001) =====
-- 固定常數，所有發布／撤回入口（CLI publish_knowledge_version、CLI withdraw_knowledge_version，
-- 透過委派也覆蓋 admin_publish_knowledge_version、admin_withdraw_knowledge_version）交易一開始
-- 都先取得這個鎖。advisory lock 不依賴任何資料列存在與否（這是 r2 用 `for update` 不足之處：
-- 沒有 PUBLISHED 版本時鎖不到任何列），交易結束自動釋放，同一交易內重複呼叫安全（reentrant）。
-- 8823001 任意挑選，只需要在這個專案裡全域唯一、不跟其他用途的 advisory lock 撞號。
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
  perform pg_advisory_xact_lock(8823001);

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

  select count(*) into v_missing_count
  from unnest(v_record_ids) as r(id)
  where not exists (
    select 1 from public.knowledge_records kr where kr.id = r.id and kr.status = 'APPROVED'
  );
  if v_missing_count > 0 then
    raise exception 'publish_knowledge_version: % of the given recordIds are not currently APPROVED', v_missing_count;
  end if;

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

  update public.knowledge_records
  set status = 'SUPERSEDED', updated_at = now()
  where status = 'PUBLISHED'
    and effective_to is not null
    and effective_to < v_today;
  get diagnostics v_expired_count = row_count;

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
  perform pg_advisory_xact_lock(8823001);

  if v_reason is null or v_withdrawn_by is null then
    raise exception 'withdraw_knowledge_version: reason and withdrawnBy are required';
  end if;

  select id into v_current_id from public.knowledge_versions where status = 'PUBLISHED';
  if v_current_id is null then
    raise exception 'withdraw_knowledge_version: no PUBLISHED version to withdraw';
  end if;

  if v_republish_version_id is not null and v_republish_version_id = v_current_id then
    raise exception 'withdraw_knowledge_version: republishVersionId cannot equal the version being withdrawn';
  end if;

  update public.knowledge_versions
  set status = 'ARCHIVED', withdrawn_at = now(), withdrawn_by = v_withdrawn_by, withdrawal_reason = v_reason
  where id = v_current_id;

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

    update public.knowledge_records
    set status = 'PUBLISHED', updated_at = now()
    where id in (select knowledge_record_id from knowledge_version_records where version_id = v_republish_version_id);
  end if;

  return jsonb_build_object('republishedVersionId', v_republish_version_id);
end;
$$;

revoke execute on function public.publish_knowledge_version(jsonb) from public, anon, authenticated;
revoke execute on function public.withdraw_knowledge_version(jsonb) from public, anon, authenticated;
grant execute on function public.publish_knowledge_version(jsonb) to service_role;
grant execute on function public.withdraw_knowledge_version(jsonb) to service_role;

-- ===== 6. admin_withdraw_knowledge_version：改用 pg_advisory_xact_lock，取代 r2 的 `for update` =====
-- Jerry 指示 3：`for update` 在沒有 PUBLISHED 版本時鎖不到任何資料列，且 CLI 路徑沒有共用這個
-- 鎖，不足以防止競態。改成跟 publish_knowledge_version／withdraw_knowledge_version 同一個
-- pg_advisory_xact_lock(8823001)——取得鎖之後才檢查、寫入與稽核；委派呼叫
-- withdraw_knowledge_version 時那裡也會再呼叫一次同一個鎖，同一交易內重複呼叫是安全的
-- （reentrant），不會自己卡死自己。
create or replace function public.admin_withdraw_knowledge_version(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_withdraw_version_id text := payload ->> 'withdrawVersionId';
  v_republish_version_id text := payload ->> 'republishVersionId';
  v_reason text := payload ->> 'reason';
  v_operator_id text := payload ->> 'operatorId';
  v_audit_id text := payload ->> 'auditId';
  v_now timestamptz := (payload ->> 'now')::timestamptz;
  v_today date := (payload ->> 'today')::date;
  v_current_id text;
  v_result jsonb;
begin
  perform pg_advisory_xact_lock(8823001);

  select id into v_current_id from public.knowledge_versions where status = 'PUBLISHED';
  if v_current_id is null or v_current_id <> v_withdraw_version_id then
    raise exception 'STATE_CHANGED: current PUBLISHED version is not %', v_withdraw_version_id;
  end if;

  if v_republish_version_id is not null then
    if v_republish_version_id = v_withdraw_version_id then
      raise exception 'STATE_CHANGED: republishVersionId cannot equal withdrawVersionId';
    end if;
    if not exists (
      select 1 from public.knowledge_versions
      where id = v_republish_version_id and status = 'ARCHIVED' and withdrawn_at is null
    ) then
      raise exception 'STATE_CHANGED: republishVersionId % is not a restorable ARCHIVED version', v_republish_version_id;
    end if;
    if not exists (select 1 from knowledge_version_records where version_id = v_republish_version_id) then
      raise exception 'STATE_CHANGED: republishVersionId % has no snapshot records', v_republish_version_id;
    end if;
    if exists (
      select 1
      from knowledge_version_records vr
      join public.knowledge_records kr on kr.id = vr.knowledge_record_id
      where vr.version_id = v_republish_version_id and kr.effective_to is not null and kr.effective_to < v_today
    ) then
      raise exception 'STATE_CHANGED: republishVersionId % contains an expired record', v_republish_version_id;
    end if;
  end if;

  v_result := public.withdraw_knowledge_version(jsonb_build_object(
    'reason', v_reason,
    'withdrawnBy', v_operator_id,
    'republishVersionId', v_republish_version_id
  ));

  insert into public.admin_audit_events (id, operator_id, action, target_type, target_id, reason, detail, created_at)
  values (
    v_audit_id, v_operator_id, 'KNOWLEDGE_VERSION_WITHDRAWN', 'KNOWLEDGE_VERSION', v_withdraw_version_id, v_reason,
    jsonb_build_object('republishVersionId', v_republish_version_id), v_now
  );

  return v_result;
end;
$$;

revoke execute on function public.admin_withdraw_knowledge_version(jsonb) from public, anon, authenticated;
grant execute on function public.admin_withdraw_knowledge_version(jsonb) to service_role;

-- ===== 7. admin_publish_knowledge_version：管理頁發布（Jerry 指示 2 最後一段）=====
-- 同一交易內：取得鎖 → 重算計畫與 token（呼叫 compute_publish_plan，跟 publish-preview 共用
-- 同一套計算，不是 Node 層各自算一次）→ 跟操作者確認時的 versionId／previewToken 比對 →
-- 不一致或重算後出現 blocker 都不寫入，回對應錯誤 → 一致才沿用 publish_knowledge_version 寫入
-- → 寫稽核。
create or replace function public.admin_publish_knowledge_version(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_version_id text := payload ->> 'versionId';
  v_preview_token text := payload ->> 'previewToken';
  v_operator_id text := payload ->> 'operatorId';
  v_audit_id text := payload ->> 'auditId';
  v_now timestamptz := (payload ->> 'now')::timestamptz;
  v_plan jsonb;
  v_record_ids text[];
  v_publish_result jsonb;
begin
  perform pg_advisory_xact_lock(8823001);

  v_plan := public.compute_publish_plan();

  if not (v_plan ->> 'canPublish')::boolean then
    raise exception 'VALIDATION_ERROR: %', (v_plan -> 'blockers' -> 0 ->> 'message');
  end if;
  if (v_plan ->> 'targetVersionId') is distinct from v_version_id
     or (v_plan ->> 'previewToken') is distinct from v_preview_token then
    raise exception 'STATE_CHANGED: recomputed plan no longer matches the confirmed preview';
  end if;

  select array_agg(x ->> 'id') into v_record_ids from jsonb_array_elements(v_plan -> 'newRecords') x;

  v_publish_result := public.publish_knowledge_version(jsonb_build_object(
    'versionId', v_version_id,
    'recordIds', v_record_ids,
    'createdBy', v_operator_id,
    'approvedBy', v_operator_id,
    'notes', null
  ));

  insert into public.admin_audit_events (id, operator_id, action, target_type, target_id, reason, detail, created_at)
  values (
    v_audit_id, v_operator_id, 'KNOWLEDGE_VERSION_PUBLISHED', 'KNOWLEDGE_VERSION', v_version_id, null,
    v_publish_result, v_now
  );

  return v_publish_result || jsonb_build_object('versionId', v_version_id, 'publishedAt', v_now);
end;
$$;

revoke execute on function public.admin_publish_knowledge_version(jsonb) from public, anon, authenticated;
grant execute on function public.admin_publish_knowledge_version(jsonb) to service_role;

-- ===== 8. approve_or_reject_knowledge_record：CLI（approveKnowledgePack）用，寫入跟管理頁
-- admin_decide_knowledge_record 共用的同一份 knowledge_record_review_events（Jerry 指示 2）=====
-- 同一個原子 UPDATE（status=NEEDS_REVIEW 且 content_fingerprint 相符）＋審核證據 INSERT，
-- source='CLI_PACK'；reviewed_by 是內容包 JSON 裡 review.reviewedBy 的任意姓名，不是
-- internal_operators 的 FK（CLI 核准不經過管理 session）。
create or replace function public.approve_or_reject_knowledge_record(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_record_id text := payload ->> 'recordId';
  v_decision text := payload ->> 'decision';
  v_reason text := payload ->> 'reason';
  v_expected_fp text := payload ->> 'expectedContentFingerprint';
  v_reviewed_by text := payload ->> 'reviewedBy';
  v_source text := payload ->> 'source';
  v_event_id text := payload ->> 'reviewEventId';
  v_now timestamptz := (payload ->> 'now')::timestamptz;
  v_updated integer;
begin
  if v_decision not in ('APPROVED', 'REJECTED') then
    raise exception 'approve_or_reject_knowledge_record: decision must be APPROVED or REJECTED';
  end if;
  if v_source not in ('CLI_PACK', 'ADMIN_API') then
    raise exception 'approve_or_reject_knowledge_record: source must be CLI_PACK or ADMIN_API';
  end if;

  update public.knowledge_records
  set status = v_decision, updated_at = v_now
  where id = v_record_id and status = 'NEEDS_REVIEW' and content_fingerprint = v_expected_fp;
  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    return jsonb_build_object('updated', false);
  end if;

  insert into public.knowledge_record_review_events
    (id, knowledge_record_id, decision, reason, reviewed_by, reviewed_at, content_fingerprint, source, created_at)
  values (v_event_id, v_record_id, v_decision, v_reason, v_reviewed_by, v_now, v_expected_fp, v_source, v_now);

  return jsonb_build_object('updated', true);
end;
$$;

revoke execute on function public.approve_or_reject_knowledge_record(jsonb) from public, anon, authenticated;
grant execute on function public.approve_or_reject_knowledge_record(jsonb) to service_role;
