-- Jerry 委託修正第二輪（2026-09-27，回應 J-003 對 B-009 的複查）：保存每次成功抓取的原始快照
-- （位元組本身，不只是雜湊），並把「原始位元組雜湊」與「正文／正規化文字雜湊」分開記錄。
--
-- 根因：docs/knowledge/source-registry.md 對不同來源記錄的基準雜湊表示法不一致（有些標「HTML
-- sha256」＝整頁原始位元組雜湊，有些標「文字 sha256」＝抽取後的正文雜湊，PDF 一律是原始位元組
-- 雜湊）。crawler 只用單一表示法（正規化文字雜湊）跟 KnowledgeRecord.contentHash 比對，遇到用
-- 「HTML sha256」建立基準的來源，未變更頁面第一次抓取就會被誤判為變更（見 crawlerService.ts
-- 的比對邏輯：改為同時計算兩種雜湊，任一種跟基準相符就視為未變更，不混用表示法比較）。
--
-- 設計：snapshot 掛在 knowledge_sources（一律存在，Source Registry 匯入時就有），不掛在
-- knowledge_records（可能還沒有，例如來源第一次被登錄、尚未有人工匯入過任何內容）——這樣
-- 「來源尚無 KnowledgeRecord」時仍能保存快照、追蹤「這是不是第一次看到這個版本」，不會因為
-- 沒有 KnowledgeRecord 可掛就直接遺失新來源的變更追蹤。
--
-- 儲存方案：直接存進 Postgres bytea 欄位（現有架構已有的能力，不新增付費外部服務、不新增依賴）。
-- MVP 規模下（每日一次、數十個來源）容量可忽略；若之後來源／頻率大幅增加，可再評估搬到物件儲存，
-- 屬後續任務範圍，這裡先滿足「原站日後改變或離線，仍能讀回當次原始快照並重新計算同一 raw hash」
-- 的最小可行需求。
--
-- 編號 0016：延續本分支 0014／0015；與其他分支的 migration 編號如有衝突，由 J-003 於整合時協調。
create table if not exists crawler_snapshots (
  id text primary key,
  source_id text not null references knowledge_sources (id),
  crawler_run_id text not null references crawler_runs (id),
  fetched_at timestamptz not null,
  content_type text,
  raw_bytes bytea not null,
  raw_hash text not null,
  -- 只有能做文字正規化的來源（非 PDF／二進位）才有值；PDF 一律為 null，明確標記「未抽取文字」，
  -- 不假裝有做正文抽取。
  normalized_hash text,
  -- 抽取方法版本：記錄這個 normalized_hash 是用哪一版正規化規則算出來的（見 crawlerService.ts
  -- normalizeFetchedContent 的版本字串），日後規則調整時，舊快照的 normalized_hash 不會被誤認為
  -- 用新規則重算過。PDF（無正文抽取）固定記 'none'。
  extraction_method_version text not null,
  created_at timestamptz not null
);

create index if not exists crawler_snapshots_source_id_idx on crawler_snapshots (source_id, fetched_at desc);
create index if not exists crawler_snapshots_run_id_idx on crawler_snapshots (crawler_run_id);

alter table crawler_snapshots enable row level security;
revoke all on table crawler_snapshots from anon, authenticated;
grant select, insert, update, delete on table crawler_snapshots to service_role;

-- CrawlerRun 關聯到「當次抓取產生的快照」，供稽核直接從一筆 CrawlerRun 找到當時的完整原始內容
-- （不是只有雜湊）。允許 null：抓取失敗（沒有位元組可存）時沒有快照可掛。
alter table crawler_runs add column if not exists snapshot_id text references crawler_snapshots (id);
