-- TASK-B-009-r2：Jerry 委託修正（PR #37）第 1、3 項。
-- 1) crawler_runs 新增 content_hash：即使當次沒有偵測到變更，也保留本次抓取用來比對的雜湊
--    （PDF 為原始位元組雜湊、文字來源為正規化文字雜湊），供稽核追溯「當天到底看到了什麼」，
--    不再只有偵測到變更時才留下紀錄（PRODUCT_SPEC §42：Snapshot → Content Hash 全程可追溯）。
-- 2) knowledge_changes 新增 partial unique index：同一 knowledge_record_id + new_content_hash
--    同時只能有一筆 status = 'NEEDS_REVIEW'，避免同一筆尚未審核的變更因重跑／重試／併發被
--    重複建立（tests/integration/repro/b009-hash-dedupe.repro.ts 情境 2）。單一 INSERT 本身即為
--    原子操作，唯一索引由 Postgres 保證併發安全，不需要額外的交易包裝。
--
-- 編號 0016：依 J-003-r7（2026-09-29）跨分支 migration 全域順序表再次重新命名（原檔名
-- 0013_crawler_hash_traceability.sql → 0015_crawler_hash_traceability.sql → 本檔，尚未套用於
-- 任何環境，只改檔名，內容不變）；全域順序見 0015_crawler_runs.sql 開頭說明。

alter table crawler_runs add column if not exists content_hash text;

create unique index if not exists knowledge_changes_open_dedupe_idx
  on knowledge_changes (knowledge_record_id, new_content_hash)
  where status = 'NEEDS_REVIEW';
