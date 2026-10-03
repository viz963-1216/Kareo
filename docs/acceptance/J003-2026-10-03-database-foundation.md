# J-003 資料庫基礎整合 — 2026-10-03

Jerry 授權完成隱私要求研究並繼續下一步。目標為 Kareo staging：
Supabase ojawadobnaxduxybqolk；Netlify kareo-tw（staging 分支）。KareoCar 未動。

## 套用前查核

只有 sessions／consents。無 ACTIVE session、無 consent 紀錄。
0008 已於上一輪套用。本輪僅套已合併 migration，不套 #48/#55/#57 的未合併 0019。
本機 fresh：24 PASS；upgrade-from=0008：28 PASS，均 0 FAIL/0 PENDING。

## 雲端套用

依原檔次序 0003–0007、0009–0018（15 個 migration），工具歷史名稱 `kareo_` 加原檔 stem。
全部成功。Supabase history 的 timestamp 是工具生成，原始 repo 數字次序保留在此與名稱中。
21 張 public 資料表皆 RLS=true；anon/authenticated SELECT=false；service_role SELECT=true。
未刪除真實資料、未建立假的使用者同意。

## Provider 匯入

A gate 與查詢資料 gate PASS。經正式 importProviderDataset service 驗證及
SupabaseProviderRepository.toImportPayload 轉換，使用已合併 import_provider_dataset RPC 原子寫入。
30 providers、30 provider_services、86 provider_service_areas；不補推測服務範圍。
19 筆 contract regions 暫未匯入（需 B013 schema）；沒有提前套未合併契約實作。

## 網站結果與限制

knowledge/status 不再資料表不存在 500，改為契約定義的 503 KNOWLEDGE_UNAVAILABLE（尚未發布）。
Provider detail 真實 API 可讀回公開資料，驗證紀錄於 PR 留言補上。
正式評估仍受 DRAFT consent 及未發布知識阻擋；不能宣稱完整 E2E 或 Integrated。
B012/B011b/B013 仍需修正、統一編號、合併與接線；排程／正式發布不在本輪。
