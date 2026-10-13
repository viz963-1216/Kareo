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

## KUI-r3 — 2026-10-13 公開資源篩選

Jerry 指示移除特約縣市篩選及重新檢查條件。沿用上方 Allowed／Forbidden Paths；前端移除 contractCity 表單欄位與送出、修正中心／地區連動、查詢及分頁返回保留。機構特約資料及後端 API 契約不刪除。驗收：真實 GET 篩選符合條件、清除回全部、縣市切換重設行政區、中心不沿用服務範圍、進詳細頁返回還原條件與頁码、手機可操作。

## KUI-r4 — 2026-10-13 篩選控制項尺寸

Jerry 要求篩選按鈕保持一致大小。沿用上方 Allowed／Forbidden Paths，僅調整長照資源表單樣式：選單、搜尋框、查詢／清除按鈕高度統一為 48px；說明文字不可撐高或推移同列選單。桌面選單兩欄等寬、操作按鈕等寬；手機單欄等寬。驗收包含一般及輔具中心狀態、桌面及 375px 手機的實際控制項尺寸與無水平溢出，保留查詢／清除／disabled／焦點行為。
