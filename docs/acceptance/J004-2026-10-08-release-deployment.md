# J-004-r17：release 公開查詢部署與額度控制

日期：2026-10-08；決策者／操作者：Jerry 授權、Codex 執行。

## 授權與範圍

Jerry 已付費並要求「正式分支改成 release、恢復正式部署、避免浪費額度」，另授權優先處理必要事項。這是恢復公開資源／制度資訊查詢，使用既有 Kareo 驗收資料庫；不是新的正式資料庫或完整 MVP 正式營運授權。D-05、49項部署E2E、正式接件、備份／回滾等未完成項目保持待驗。

## 設定與首次部署的實際證據

- GitHub `release` 從已驗證且合併的 `3026cf5934c11d437c20034ff7fba238db68f570` 建立；既有 main 保留。GitHub 預設分支仍 staging，工程師 PR 仍進 staging。
- Netlify 限定 site `faeb21e1-94d1-4d42-bbbc-6f9692caaef9`（`kareo-tw`），repo `viz963-1216/Kareo`。
- 實際儲存：production branch=`release`，branch deploys=None（API allowed_branches=[release]）、Deploy Previews=None（skip_prs=true）、builds=Active（stop_builds=false）。未修改存取保護或自動加值。
- 原 published SHA=`8f509c0567436392b9421bfb2e906d565c6f9438`；10/08 付款前最新 staging 部署因 credit exceeded 被略過。
- 10/08 09:18Z 首次 release 部署成功：`6ac75fa90d1514471a2e51ed`，marker SHA=`3026cf5934c11d437c20034ff7fba238db68f570`、branch=release、context=production。
- GET smoke：首頁、精確marker、知識版本 `KB-2026-09-24-001`、未知API JSON404，4/4 PASS。讀取 Provider／知識清單均HTTP200；篩選、來源與完整UI尚須分別驗證。
- 公開GET runner：E2E-21 PASS；E2E-44／48 僅清單成功，完整案例PENDING。未建立Session／同意／評估／Lead。

## 本版實作與驗證

- 同步產品、架構、Git規則、AI守則、發布手冊與J-004工作。
- CI／隔離HTTP workflow 納入release PR；完整release gate同樣納入release，保持嚴格、不隱藏失敗或偽造PASS。
- 修正原本只辨識main的建置保護：release同樣禁止mock／展示替代頁、要求session token。
- 明確 `KAREO_RELEASE_SCOPE=public-resources`：三個前端同意版本必須未配置。現有前端因缺乏版本無法啟動個案流程。完整啟用需另通過D-05、完整gate並移除公開限定配置。
- 版本／mode安全測試7 PASS；根目錄script／adapter測試104 PASS；路由檢查25 PASS；release-context real site build PASS。
- 配置及保護變更須經feature→staging PR，再以staging→release PR集中發布；本文件不預先聲稱後續PR已合併或新版已部署。

## 後續使用

A／B／C繼續feature→staging，CI照常；只有Jerry確認可發布的批次才進release，減少每次staging合併及PR預覽的額度消耗。Netlify traffic／Functions仍有用量，不承諾零費用。私人按需驗收保持原授權、版本及目的，不重新開放所有自動預覽。

完整release gate可能FAIL／PENDING，公開查詢恢復不採計完整MVP通過。完整正式營運仍需正式環境隔離、D-05 ACTIVE與完整E2E等既定條件。
