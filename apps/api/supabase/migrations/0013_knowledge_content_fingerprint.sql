-- Jerry 委託修正第二輪（2026-09-27）：獨立於 content_hash（來源 PDF／網頁原始雜湊）之外的
-- 「審核內容指紋」欄位。同一來源（content_hash 不變）仍可能對應不同的人工整理內容（summary／
-- ruleData 等），匯入的冪等判斷與核准前的內容綁定檢查都必須用這個欄位，不能只看 content_hash。
-- 由 Node 端（services/contentFingerprint.ts）從實際保存的欄位重新計算，不信任輸入自報的值。
--
-- 編號 0013：延續本分支既有的 0011／0012；與 B-005（PR #40）的 0013_recommendation.sql 撞號，
-- 依 J-003-r5 的跨分支全域順序表，B-008（本 PR）維持 0013，B-005 的檔案改名為其他號碼；
-- 合併順序需為 #33 → #36 → #40 → #37。
--
-- 「已套用」判斷：staging 目前沒有任何 knowledge_records 資料（J-003 以唯讀查詢確認），因此這裡
-- 直接把新欄位設為 not null，不需要另外處理「舊資料沒有指紋值」的回填問題。

alter table knowledge_records add column if not exists content_fingerprint text;

-- 對「目前還沒有 content_fingerprint 值」的既有紀錄（理論上不存在，見上方說明；此處僅為升級路徑
-- 的防禦性處理，避免下一行 not null 在有殘留測試資料時失敗）填入一個明顯不會被誤認為真實指紋的
-- 佔位值，並在應用層強制要求新寫入的紀錄一律帶入真正計算出的指紋（見 knowledgeImportService.ts）。
update knowledge_records set content_fingerprint = 'sha256:' || repeat('0', 64) where content_fingerprint is null;

alter table knowledge_records alter column content_fingerprint set not null;
