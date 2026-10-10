# J-004-r20 — 可操作 Netlify Demo

## 授權與範圍

2026-10-10 Jerry：先讓評估可操作，預作 Demo。原 release `140c219` 只有公開查詢與可勾選閱讀確認，並不能進入評估。本次在相同 Netlify 站建立獨立 `/demo/` artifact；首頁評估按鈕與原 `/consent`（沒有 ACTIVE archive 時）導入 `/demo/#/consent`。

Demo 使用既有 `publicProviderApi`、正式固定規則引擎與核對的公開機構／已發布知識快照；依使用者輸入產生結果，不使用固定 Mock 案例回應。回答只在分頁記憶體；重新整理／重新開始清除。Demo 無 GPS／可填自由文字／聯絡表單／Lead 或管理功能。根目錄 `/resources`、`/info` 保持原 real API。

## 部署方式

- 只有明確 `KAREO_RELEASE_SCOPE=public-resources` 與 `VITE_KAREO_ENABLE_DEMO=true` 才可附加 Demo。
- 主站先建置並複製，再以清理過的子程序環境產生獨立 `/demo/` 資產；不把雲端憑證传入展示建置。
- 主站不能改為 mock；`VITE_KAREO_DEMO=true` 仍被標準建置拒絕。
- Demo HTML 及 Netlify 回應設 `connect-src 'none'`、`form-action 'none'`；禁止 GPS／camera／microphone。資產放 `/demo/assets/`，靜態 hash 路由不與主站 real API 混用。
- `check-embedded-demo.mjs` 檢查分離資產、阻止連線的 CSP、展示標記與無契約 Mock fixtures。CI Netlify bundle 也執行這個檢查。
- 正式同意 registry、健康資料 API、資料庫、D-05 啟用及完整 release gate 不在本次變更範圍。這份 Demo 不採計正式49項 E2E通過。

## 已完成本機驗證

- Frontend 88 tests PASS；部署環境／路由相關 13 tests PASS。
- 同一次建置：主站 real artifact＋隔離 Demo artifact，TypeScript／Vite PASS。
- Embedded Demo checker PASS；無契約 Mock ID。
- Chrome：原 `/consent` 自動进入 `/demo/#/consent`，勾選後可開始需求分析。
- 虛構案例：75–84歲、家人協助有限、行動及日常生活需要協助、新北市板橋區，選居家照顧／輔具／交通，初步結果依條件列出三項需要。
- 可產生條列個管師／1966 摘要，顯示知識版本與來源；居家照顧推薦實際顯示三個服務範圍含板橋的單位，機構詳情與 Google Maps 外連存在，無建立媒合按鈕。
- 本機 HTTP server 記錄在上述完整操作期間只有 GET 靜態資產，無任何 `/api/` 請求或 POST。此為本機觀察，非雲端資料庫驗收。

發布後的精確 SHA、Netlify deploy ID 與線上操作結果將記錄於 release PR conversation；本文件不預先宣稱部署成功。
