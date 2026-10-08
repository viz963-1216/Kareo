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

## 最終發布與驗收收尾（2026-10-08 09:34Z）

- #112：head `26fdb1e2ebc8723e78346f5f8403961151032323` 的8項CI與50項隔離HTTP全部PASS；合併staging SHA=`10d6702f4f0b1e8135de3cdc34564206b68a55e7`。
- #113：staging→release公開限定發布；promotion head 的CI與隔離HTTP成功。merge SHA／實際發布SHA=`56500c835df2869ad7e4540f6f0730cb31ccbbcd`，deploy=`6ac7631c4b91470008fb7960`。
- Netlify自動發布一次，已ready；#112 PR、staging合併與#113 PR均未建立新Netlify預覽／staging正式部署。先前初次恢復的部署仍可回復，未實際演練回滾，不採計完整回滾驗收。
- 公開 marker 在GET測試前後均為上述完整SHA、branch=release、context=production，證據 [public-release-2026-10-08.json](../../tests/e2e/results/public-release-2026-10-08.json)。
- 最新SHA的GET smoke 4/4 PASS；未知API E2E-21 PASS；E2E-44／48僅清單API成功，完整案例仍PENDING。
- 完整release gate：**116 PASS、0 FAIL、48 PENDING，FAILED**。完整部署49案例只有E2E-21的未知API驗證採計；未將隔離HTTP50項或清單成功算成正式主流程通過。詳見 [完整gate原始輸出](J004-2026-10-08-release-gate.txt)。
- #113的首次strict gate因未設定base URL而失敗，已新增非機密repository variable `KAREO_RELEASE_BASE_URL=https://kareo-tw.netlify.app`。重跑後當時target仍為PR head而尚未部署，正確回報版本不符；此紀錄不採計為最終merge SHA的錯誤，最終SHA已按前後marker重驗。
- 公開API基準：1117啟用資源、17輔具資源中心、21知識紀錄。新北居家照顧：機構所在地336筆，SERVICE_AREA 365筆，後者與官方可服務新北名單一致；不是刪減資料。
- 無Session、同意、評估或Lead寫入；無secret搬移／新購DB／調整預算／移除保護。

## 優先次序

1. 已完成：部署來源與額度控制、公開查詢恢復、精確版本與讀取證據。
2. 下一輪：公開查詢完整UI／分頁／來源／無Session驗收、知識與清理排程最新事件及資料品質（例如官方名冊多電話的顯示）核對。
3. 個案流程正式啟用：仍按D-05與完整J-003／J-004前置條件處理，不能藉分支切換、付款或本輪公開查詢通過取代。
