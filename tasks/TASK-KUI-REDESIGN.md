# TASK-KUI-REDESIGN — 網站改版實作

Owner：Jerry 中心整合／Frontend；Submission Version：KUI-r1。
授權：Jerry 2026-10-12「幫我根據這個調整」，來源為 docs/design/KAREO_WEBSITE_REDESIGN_SPEC.md。先盤點现況再實作，跨頁調整由 Jerry 統一整合。

## Allowed Paths
/apps/web/**、/docs/design/**、/docs/acceptance/**、/docs/PRODUCT_SPEC.md、/tasks/TASK-KUI-REDESIGN.md。

## Forbidden Paths
/apps/api/**、/services/**、/data/**、/contracts/**、資料庫 schema／資料／RLS、Kareocar、正式同意 registry、憑證與付費設定。

## 任務與驗收
- KUI-001：資訊頁真實開放／載入／空資料／未發布／故障狀態分開；來源／日期／維護者可查；不顯示互相矛盾的功能承諾；恢復操作有效。
- KUI-002：公開分頁內分析的資料告知與實作一致；雲端正式同意未啟用及完整 D-05 待驗收如實保留，不偽稱正式核准。
- KUI-003：首頁用途、唯一主要 CTA、真實三段流程、示意結果與邊界；兩步評估返回保留回答、結果可修改，不預設使用者的健康與需求。
- KUI-004：資訊／同意及共用正式評估提醒提供 tel:1966，不蓋過首頁主 CTA。
- KUI-005：綠白共用設計變數、文字與控件規格、焦點／hover／disabled／loading／error 一致。
- KUI-006：核心流程桌機／手機、鍵盤、放大／對比走查與截圖；不能當作全站 WCAG 或法律簽核。
- KUI-007：交付五人測試腳本與待填記錄，真人結果待 Jerry 招募执行，不冒充已完成。

保留真實唯讀 API、單位名冊、知識與推薦規則及個案寫入保護；不修改其資料契約。完成前需前端 typecheck／回歸、改版行為驗證、公開產物建置、瀏覽器走查、PR → staging → release 及發布後核對。
