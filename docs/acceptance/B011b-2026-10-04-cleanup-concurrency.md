# B-011b-r8：清理候選重新確認與撤回鎖順序

2026-10-04；基底 staging `4866937c134bc09fc74fac75be0742bd16db4b25`（#75）。Integrated：否。

## 實際問題

真正 PG17 三連線：Session 曾閒置 100 天，holder 在交易內更新 last_seen_at（使用者恢復使用）；worker 依尚未提交的舊值選入清理，刪除健康資料後在 UPDATE Session 等待 holder。holder 提交最新活動時間後，舊清理仍回 sessionsDeleted=1、Session DELETED。新增回歸在修正前 FAIL（預期 0，實際 1）。

清理先鎖 Session 後會再刪滿 3 年 Consent；舊 withdraw_consent 先更新 Consent，再更新 Session。兩者若處理同一個閒置 Session／過期同意，鎖順序相反。新增測試在真正 RPC 的 Consent UPDATE 用合成 trigger 暫停，讓 cleanup 進入等待，再釋放 gate；新實作兩者成功，回復 0021 的舊 withdrawal SQL 後確實出現 PostgreSQL 40P01 deadlock。對照要求 FAIL DEADLOCK_OBSERVED，不能把初始化錯誤当證據。

## 修正

前向 0025（Supabase CLI 2.119.0 生成 20261004120052），舊 migration 不變。

- 真正清理：先依固定 Session ID 順序 SELECT FOR UPDATE 選候選，再刪健康資料。READ COMMITTED 在等待列更新後重新檢查 eligibility；剛恢復使用者不再被舊名單誤刪。
- dry-run：保留只讀候選計數，不取上述 Session 寫入鎖；不写业务資料或執行紀錄。
- withdraw_consent：先鎖 Session 再更新 Consent／Lead，與 cleanup、delete、Lead creation 採一致順序。
- 不改保存期限、取消／清空聯絡資料規則、公開 response、表、欄位；原 audit 同交易入口 0023 繼續使用更新後的 cleanup。
- invoker、固定 search_path、僅 service_role EXECUTE 不變。

## 驗證

- PG17 三條獨立 backend：16 PASS（14 既有＋resumed Session＋withdraw/cleanup 競態）；透過 pg_blocking_pids 實際觀察等待，不以單執行緒 mock 代替。
- 修正前 resumed Session 回歸 FAIL；錯誤知識 mutex 對照 FAIL SHARED_LOCK_NOT_OBSERVED；舊 withdrawal 對照 FAIL DEADLOCK_OBSERVED。兩個對照皆進 CI，要求特定錯誤及非零 exit。
- 所有 API：716 PASS／50 files（含刪除期限、dry-run、稽核回滾與晚到 Lead）。
- Fresh DB 24 PASS；upgrade 0018 28 PASS；無 FAIL。
- CI 與雲端前向套用結果於 PR 留言記錄。

本機合成資料、無雲端清理。此處不宣稱全部寫入路徑的晚到請求均已涵蓋；J 接著複驗評估／推薦。D-05 仍 DRAFT；每日排程、內容包雲端回填及 49 項部署 E2E 未因此通過。
