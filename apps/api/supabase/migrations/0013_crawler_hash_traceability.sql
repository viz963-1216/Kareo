-- TASK-B-009-r2：Jerry 委託修正（PR #37）第 1、3 項。
-- 1) crawler_runs 新增 content_hash：即使當次沒有偵測到變更，也保留本次抓取用來比對的雜湊
--    （PDF 為原始位元組雜湊、文字來源為正規化文字雜湊），供稽核追溯「當天到底看到了什麼」，
--    不再只有偵測到變更時才留下紀錄（PRODUCT_SPEC §42：Snapshot → Content Hash 全程可追溯）。
-- 2) knowledge_changes 新增 partial unique index：同一 knowledge_record_id + new_content_hash
--    同時只能有一筆 status = 'NEEDS_REVIEW'，避免同一筆尚未審核的變更因重跑／重試／併發被
--    重複建立（tests/integration/repro/b009-hash-dedupe.repro.ts 情境 2）。單一 INSERT 本身即為
--    原子操作，唯一索引由 Postgres 保證併發安全，不需要額外的交易包裝。
--
-- 編號使用 0013：若與其他未合併分支（例如 B-008-r3 的 0013_knowledge_version_traceability.sql）
-- 編號衝突，屬正常情況，由 Jerry 於 staging 整合時重新編號（比照 0012 註解中 0008-0011 的作法）。

alter table crawler_runs add column if not exists content_hash text;

create unique index if not exists knowledge_changes_open_dedupe_idx
  on knowledge_changes (knowledge_record_id, new_content_hash)
  where status = 'NEEDS_REVIEW';
