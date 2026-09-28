# A-003-r5 Provider Coordinate Verification Report

Submission Version: A-003-r5

Report date: 2026-09-28
Dataset: `data/providers/staging/providers.json`, `provider-services.json`, `provider-service-areas.json`

## 結論

本次延續 r4 的可追溯原則，不重做亂碼修復，也不把 Google Maps 地址搜尋 URL、地圖視窗中心或行政區中心當作座標。本次新增 1 筆已驗證 WGS84 座標：`NTPC-HC-004`。其機構名稱與正式地址先以新北市高齡長期照顧處「新北市居家長照機構名冊」核對；再以新北市政府民政局「新北市門牌位置數值資料 11509」同一建物門牌點取得 EPSG:3826 座標並轉為 WGS84。加上 r4 已驗證的 `NTPC-HC-005`，目前共 2 筆已驗證座標。

其餘 28 筆仍維持 `null`／`PENDING`。地址搜尋 URL 僅是人工核對入口，**不是**座標證據。

## 已驗證來源與轉換

| Source ID | 來源與可重現 URL | 本次使用的紀錄／核對結果 |
| --- | --- | --- |
| SRC-002 | 新北市高齡長期照顧處「新北市長照特約單位」：https://www.careyou.ntpc.gov.tw/w/agecare/unit | `NTPC-HC-005` 列為居家服務啟用單位；名稱、地址（里／鄰及 `1、2樓`／`1~2樓` 的標點差異）及電話 `02-2972-2060` 與 JSON 相符。完整查核證據見 `qa/provider-service-active-evidence.md`。 |
| SRC-003 | 新北市高齡長期照顧處「新北市居家長照機構名冊 11506」：https://www.careyou.ntpc.gov.tw/WebUPD/agecare/InstitutionalRoster/%E6%96%B0%E5%8C%97%E5%B8%82%E5%B1%85%E5%AE%B6%E9%95%B7%E7%85%A7%E6%A9%9F%E6%A7%8B%E5%90%8D%E5%86%8A11506.pdf | `NTPC-HC-004`（新北市私立旺福居家長照機構）列於名冊；名稱與立案地址 `新北市三重區福隆路48號1樓` 與 JSON 相符。 |
| SRC-COORD-NTPC-001 | 新北市政府民政局「新北市門牌位置數值資料 11509」：https://data.gov.tw/dataset/168887；CSV：https://data.ntpc.gov.tw/api/datasets/d7b568ab-3819-40c8-a6e7-a6b199443101/csv/file | CSV 紀錄 A：`65000,65000020,長江里,016,長元街,,,,１００之２號,300752.019217,2773265.3017167`（`NTPC-HC-005`）。紀錄 B：`65000,65000020,溪美里,010,福隆路,,,,４８號,299673.374200,2774565.5731000`（`NTPC-HC-004`）。欄位 `x_3826`／`y_3826` 為 EPSG:3826，均為與 Provider 正式地址相同的建物門牌點；樓層不改變建物門牌點。資料集詮釋資料於 2026-09-14 更新，本次取得／查核日期為 2026-09-28。 |

轉換：以 EPSG:3826（TWD97 / TM2 zone 121）座標，使用 GRS80 橢球、中央經線 121°、比例尺 0.9999、false easting 250000 的逆橫麥卡托轉換為 EPSG:4326（WGS84）。`NTPC-HC-004`：`x=299673.374200`、`y=2774565.5731000` → `lat=25.07852424`、`lng=121.49241746`；`NTPC-HC-005`：`x=300752.019217`、`y=2773265.3017167` → `lat=25.06674961`、`lng=121.50306191`。轉換程式與 JSON／候選覆蓋率一致性檢查見 `qa/verify-coordinates.mjs`。

## 逐筆對照

| Provider ID | 名稱 | 地址 | lat | lng | 地址參考 URL | 驗證方式 | 日期 | 狀態 | 未驗證原因 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TP-HC-001 | 財團法人天主教失智老人社會福利基金會附設臺北市私立聖若瑟居家式服務類長期照顧服務機構 | 臺北市萬華區東園街140巷7號2樓 | null | null | https://www.google.com/maps/search/?api=1&query=%E8%87%BA%E5%8C%97%E5%B8%82%E8%90%AC%E8%8F%AF%E5%8D%80%E6%9D%B1%E5%9C%92%E8%A1%97140%E5%B7%B77%E8%99%9F2%E6%A8%93 | 未完成座標驗證；URL 僅地址參考 | — | PENDING | 未取得可重現 WGS84 證據 |
| TP-HC-002 | 財團法人台北市立心慈善基金會附設臺北市私立立心居家式服務類長期照顧服務機構 | 臺北市萬華區艋舺大道120巷39弄3號2樓 | null | null | https://www.google.com/maps/search/?api=1&query=%E8%87%BA%E5%8C%97%E5%B8%82%E8%90%AC%E8%8F%AF%E5%8D%80%E8%89%8B%E8%88%BA%E5%A4%A7%E9%81%93120%E5%B7%B739%E5%BC%843%E8%99%9F2%E6%A8%93 | 未完成座標驗證；URL 僅地址參考 | — | PENDING | 未取得可重現 WGS84 證據 |
| TP-HC-003 | 臺北市私立寬安居家長照機構 | 臺北市萬華區莒光路328號6樓 | null | null | https://www.google.com/maps/search/?api=1&query=%E8%87%BA%E5%8C%97%E5%B8%82%E8%90%AC%E8%8F%AF%E5%8D%80%E8%8E%92%E5%85%89%E8%B7%AF328%E8%99%9F6%E6%A8%93 | 未完成座標驗證；URL 僅地址參考 | — | PENDING | 未取得可重現 WGS84 證據 |
| TP-HC-004 | 財團法人中華民國佛教慈濟慈善事業基金會臺北市私立慈濟居家長照機構 | 臺北市萬華區莒光路222號5樓 | null | null | https://www.google.com/maps/search/?api=1&query=%E8%87%BA%E5%8C%97%E5%B8%82%E8%90%AC%E8%8F%AF%E5%8D%80%E8%8E%92%E5%85%89%E8%B7%AF222%E8%99%9F5%E6%A8%93 | 未完成座標驗證；URL 僅地址參考 | — | PENDING | 未取得可重現 WGS84 證據 |
| TP-HC-005 | 中華民國紅十字會附設私立博愛居家長照機構 | 臺北市萬華區康定路62號11樓 | null | null | https://www.google.com/maps/search/?api=1&query=%E8%87%BA%E5%8C%97%E5%B8%82%E8%90%AC%E8%8F%AF%E5%8D%80%E5%BA%B7%E5%AE%9A%E8%B7%AF62%E8%99%9F11%E6%A8%93 | 未完成座標驗證；URL 僅地址參考 | — | PENDING | 未取得可重現 WGS84 證據 |
| TP-HC-006 | 臺北市私立大心居家長照機構 | 臺北市萬華區康定路348號2樓之1 | null | null | https://www.google.com/maps/search/?api=1&query=%E8%87%BA%E5%8C%97%E5%B8%82%E8%90%AC%E8%8F%AF%E5%8D%80%E5%BA%B7%E5%AE%9A%E8%B7%AF348%E8%99%9F2%E6%A8%93%E4%B9%8B1 | 未完成座標驗證；URL 僅地址參考 | — | PENDING | 未取得可重現 WGS84 證據 |
| TP-HC-007 | 有限責任臺北市全國照服員勞動合作社附設臺北市私立全方位居家長照機構 | 臺北市萬華區青年路106巷9號 | null | null | https://www.google.com/maps/search/?api=1&query=%E8%87%BA%E5%8C%97%E5%B8%82%E8%90%AC%E8%8F%AF%E5%8D%80%E9%9D%92%E5%B9%B4%E8%B7%AF106%E5%B7%B79%E8%99%9F | 未完成座標驗證；URL 僅地址參考 | — | PENDING | 未取得可重現 WGS84 證據 |
| TP-HC-008 | 臺北市私立璞馨居家長照機構 | 臺北市萬華區東園街66巷21弄51號2樓 | null | null | https://www.google.com/maps/search/?api=1&query=%E8%87%BA%E5%8C%97%E5%B8%82%E8%90%AC%E8%8F%AF%E5%8D%80%E6%9D%B1%E5%9C%92%E8%A1%9766%E5%B7%B721%E5%BC%8451%E8%99%9F2%E6%A8%93 | 未完成座標驗證；URL 僅地址參考 | — | PENDING | 未取得可重現 WGS84 證據 |
| TP-HC-009 | 紙飛機服務科技股份有限公司附設臺北市私立紙飛機居家長照機構 | 臺北市萬華區西園路1段200號8樓之2 | null | null | https://www.google.com/maps/search/?api=1&query=%E8%87%BA%E5%8C%97%E5%B8%82%E8%90%AC%E8%8F%AF%E5%8D%80%E8%A5%BF%E5%9C%92%E8%B7%AF1%E6%AE%B5200%E8%99%9F8%E6%A8%93%E4%B9%8B2 | 未完成座標驗證；URL 僅地址參考 | — | PENDING | 未取得可重現 WGS84 證據 |
| TP-HC-010 | 私立愛吾愛居家長照機構 | 臺北市萬華區大理街171之1號2樓207室 | null | null | https://www.google.com/maps/search/?api=1&query=%E8%87%BA%E5%8C%97%E5%B8%82%E8%90%AC%E8%8F%AF%E5%8D%80%E5%A4%A7%E7%90%86%E8%A1%97171%E4%B9%8B1%E8%99%9F2%E6%A8%93207%E5%AE%A4 | 未完成座標驗證；URL 僅地址參考 | — | PENDING | 未取得可重現 WGS84 證據 |
| NTPC-HC-001 | 萓品管理顧問有限公司附設新北市私立禾善居家長照機構 | 新北市樹林區仁愛街3號1樓 | null | null | https://www.google.com/maps/search/?api=1&query=%E6%96%B0%E5%8C%97%E5%B8%82%E6%A8%B9%E6%9E%97%E5%8D%80%E4%BB%81%E6%84%9B%E8%A1%973%E8%99%9F1%E6%A8%93 | 未完成座標驗證；URL 僅地址參考 | — | PENDING | 未取得可重現 WGS84 證據 |
| NTPC-HC-002 | 社團法人中華長照協會附設新北市私立永樂居家式服務類長期照顧服務機構 | 新北市永和區文化路155號 | null | null | https://www.google.com/maps/search/?api=1&query=%E6%96%B0%E5%8C%97%E5%B8%82%E6%B0%B8%E5%92%8C%E5%8D%80%E6%96%87%E5%8C%96%E8%B7%AF155%E8%99%9F | 未完成座標驗證；URL 僅地址參考 | — | PENDING | 未取得可重現 WGS84 證據 |
| NTPC-HC-003 | 台灣全齡長照股份有限公司附設新北市私立禾薪居家長照機構 | 新北市新莊區新莊路16之2號1樓 | null | null | https://www.google.com/maps/search/?api=1&query=%E6%96%B0%E5%8C%97%E5%B8%82%E6%96%B0%E8%8E%8A%E5%8D%80%E6%96%B0%E8%8E%8A%E8%B7%AF16%E4%B9%8B2%E8%99%9F1%E6%A8%93 | 未完成座標驗證；URL 僅地址參考 | — | PENDING | 未取得可重現 WGS84 證據 |
| NTPC-HC-004 | 新北市私立旺福居家長照機構 | 新北市三重區福隆路48號1樓 | 25.07852424 | 121.49241746 | https://www.google.com/maps/search/?api=1&query=%E6%96%B0%E5%8C%97%E5%B8%82%E4%B8%89%E9%87%8D%E5%8D%80%E7%A6%8F%E9%9A%86%E8%B7%AF48%E8%99%9F1%E6%A8%93 | `SRC-003` 機構名稱／正式地址人工核對＋`SRC-COORD-NTPC-001` 同建物門牌點（EPSG:3826 → EPSG:4326）；非 Google 搜尋中心 | 2026-09-28 | VERIFIED | — |
| NTPC-HC-005 | 新北市私立全曜居家式服務類長期照顧服務機構 | 新北市三重區長元街100之2號1~2樓 | 25.06674961 | 121.50306191 | https://www.google.com/maps/search/?api=1&query=%E6%96%B0%E5%8C%97%E5%B8%82%E4%B8%89%E9%87%8D%E5%8D%80%E9%95%B7%E5%85%83%E8%A1%97100%E4%B9%8B2%E8%99%9F1~2%E6%A8%93 | `SRC-002` 機構／地址／電話人工核對＋`SRC-COORD-NTPC-001` 同建物門牌點（EPSG:3826 → EPSG:4326）；非 Google 搜尋中心 | 2026-09-27 | VERIFIED | — |
| TP-HMN-001 | 台灣基督長老教會馬偕醫療財團法人附設馬偕居家護理所 | 臺北市中山區中山北路二段96巷9號1-3樓 | null | null | https://www.google.com/maps/search/?api=1&query=%E8%87%BA%E5%8C%97%E5%B8%82%E4%B8%AD%E5%B1%B1%E5%8D%80%E4%B8%AD%E5%B1%B1%E5%8C%97%E8%B7%AF%E4%BA%8C%E6%AE%B596%E5%B7%B79%E8%99%9F1-3%E6%A8%93 | 未完成座標驗證；URL 僅地址參考 | — | PENDING | 未取得可重現 WGS84 證據 |
| TP-HMN-002 | 臺北市立聯合醫院附設陽明居家護理所 | 臺北市士林區雨聲街105號6樓 | null | null | https://www.google.com/maps/search/?api=1&query=%E8%87%BA%E5%8C%97%E5%B8%82%E5%A3%AB%E6%9E%97%E5%8D%80%E9%9B%A8%E8%81%B2%E8%A1%97105%E8%99%9F6%E6%A8%93 | 未完成座標驗證；URL 僅地址參考 | — | PENDING | 未取得可重現 WGS84 證據 |
| TP-HMN-003 | 國立臺灣大學醫學院附設醫院北護分院附設居家護理所 | 臺北市萬華區康定路37號 | null | null | https://www.google.com/maps/search/?api=1&query=%E8%87%BA%E5%8C%97%E5%B8%82%E8%90%AC%E8%8F%AF%E5%8D%80%E5%BA%B7%E5%AE%9A%E8%B7%AF37%E8%99%9F | 未完成座標驗證；URL 僅地址參考 | — | PENDING | 未取得可重現 WGS84 證據 |
| TP-AD-001 | 晨玉有限公司 | 臺北市中山區南京東路2段150號5樓526室 | null | null | https://www.google.com/maps/search/?api=1&query=%E8%87%BA%E5%8C%97%E5%B8%82%E4%B8%AD%E5%B1%B1%E5%8D%80%E5%8D%97%E4%BA%AC%E6%9D%B1%E8%B7%AF2%E6%AE%B5150%E8%99%9F5%E6%A8%93526%E5%AE%A4 | 未完成座標驗證；URL 僅地址參考 | — | PENDING | 未取得可重現 WGS84 證據 |
| TP-AD-002 | 諾貝兒寶貝股份有限公司內湖分公司 | 臺北市內湖區民權東路6段18巷6號B1樓 | null | null | https://www.google.com/maps/search/?api=1&query=%E8%87%BA%E5%8C%97%E5%B8%82%E5%85%A7%E6%B9%96%E5%8D%80%E6%B0%91%E6%AC%8A%E6%9D%B1%E8%B7%AF6%E6%AE%B518%E5%B7%B76%E8%99%9FB1%E6%A8%93 | 未完成座標驗證；URL 僅地址參考 | — | PENDING | 未取得可重現 WGS84 證據 |
| TP-AD-003 | 可能設計有限公司 | 臺北市文山區興隆路1段55巷27弄1之5 | null | null | https://www.google.com/maps/search/?api=1&query=%E8%87%BA%E5%8C%97%E5%B8%82%E6%96%87%E5%B1%B1%E5%8D%80%E8%88%88%E9%9A%86%E8%B7%AF1%E6%AE%B555%E5%B7%B727%E5%BC%841%E4%B9%8B5 | 未完成座標驗證；URL 僅地址參考 | — | PENDING | 未取得可重現 WGS84 證據 |
| NTPC-AD-001 | 弘采介護有限公司 | 新北市新店區中正路501-6號4樓(吉成特區) | null | null | https://www.google.com/maps/search/?api=1&query=%E6%96%B0%E5%8C%97%E5%B8%82%E6%96%B0%E5%BA%97%E5%8D%80%E4%B8%AD%E6%AD%A3%E8%B7%AF501-6%E8%99%9F4%E6%A8%93(%E5%90%89%E6%88%90%E7%89%B9%E5%8D%80) | 未完成座標驗證；URL 僅地址參考 | — | PENDING | 未取得可重現 WGS84 證據 |
| NTPC-AD-002 | 大瀚醫療儀器有限公司 | 新北市板橋區校前街28號 | null | null | https://www.google.com/maps/search/?api=1&query=%E6%96%B0%E5%8C%97%E5%B8%82%E6%9D%BF%E6%A9%8B%E5%8D%80%E6%A0%A1%E5%89%8D%E8%A1%9728%E8%99%9F | 未完成座標驗證；URL 僅地址參考 | — | PENDING | 未取得可重現 WGS84 證據 |
| NTPC-AD-003 | 宏宇醫療器材行 | 新北市板橋區南雅南路二段134號1樓 | null | null | https://www.google.com/maps/search/?api=1&query=%E6%96%B0%E5%8C%97%E5%B8%82%E6%9D%BF%E6%A9%8B%E5%8D%80%E5%8D%97%E9%9B%85%E5%8D%97%E8%B7%AF%E4%BA%8C%E6%AE%B5134%E8%99%9F1%E6%A8%93 | 未完成座標驗證；URL 僅地址參考 | — | PENDING | 未取得可重現 WGS84 證據 |
| NTPC-AD-004 | 吉評醫療器材股份有限公司 | 新北市新店區安康路一段359-25號 | null | null | https://www.google.com/maps/search/?api=1&query=%E6%96%B0%E5%8C%97%E5%B8%82%E6%96%B0%E5%BA%97%E5%8D%80%E5%AE%89%E5%BA%B7%E8%B7%AF%E4%B8%80%E6%AE%B5359-25%E8%99%9F | 未完成座標驗證；URL 僅地址參考 | — | PENDING | 未取得可重現 WGS84 證據 |
| NTPC-AD-005 | 學府松藥局 | 新北市土城區學府路一段38號 | null | null | https://www.google.com/maps/search/?api=1&query=%E6%96%B0%E5%8C%97%E5%B8%82%E5%9C%9F%E5%9F%8E%E5%8D%80%E5%AD%B8%E5%BA%9C%E8%B7%AF%E4%B8%80%E6%AE%B538%E8%99%9F | 未完成座標驗證；URL 僅地址參考 | — | PENDING | 未取得可重現 WGS84 證據 |
| NTPC-AD-006 | 兆謙益企業有限公司 | 新北市林口區源泉街12號 | null | null | https://www.google.com/maps/search/?api=1&query=%E6%96%B0%E5%8C%97%E5%B8%82%E6%9E%97%E5%8F%A3%E5%8D%80%E6%BA%90%E6%B3%89%E8%A1%9712%E8%99%9F | 未完成座標驗證；URL 僅地址參考 | — | PENDING | 未取得可重現 WGS84 證據 |
| NTPC-AD-007 | 瑞康醫療器材有限公司 | 新北市中和區圓通路295-1號 | null | null | https://www.google.com/maps/search/?api=1&query=%E6%96%B0%E5%8C%97%E5%B8%82%E4%B8%AD%E5%92%8C%E5%8D%80%E5%9C%93%E9%80%9A%E8%B7%AF295-1%E8%99%9F | 未完成座標驗證；URL 僅地址參考 | — | PENDING | 未取得可重現 WGS84 證據 |
| NTPC-AD-008 | 鴻銘醫療儀器行 | 新北市淡水區民生路47-2號 | null | null | https://www.google.com/maps/search/?api=1&query=%E6%96%B0%E5%8C%97%E5%B8%82%E6%B7%A1%E6%B0%B4%E5%8D%80%E6%B0%91%E7%94%9F%E8%B7%AF47-2%E8%99%9F | 未完成座標驗證；URL 僅地址參考 | — | PENDING | 未取得可重現 WGS84 證據 |
| NTPC-AD-009 | 美德耐股份有限公司雙和門市部 | 新北市中和區中正路291號 | null | null | https://www.google.com/maps/search/?api=1&query=%E6%96%B0%E5%8C%97%E5%B8%82%E4%B8%AD%E5%92%8C%E5%8D%80%E4%B8%AD%E6%AD%A3%E8%B7%AF291%E8%99%9F | 未完成座標驗證；URL 僅地址參考 | — | PENDING | 未取得可重現 WGS84 證據 |

摘要：已驗證 2／30；待查 28／30；`providers.json` 的非 null 座標 2。非 null 值與來源證據均由 `qa/verify-coordinates.mjs` 檢查。

## 可實際推薦候選的覆蓋率

候選定義：Provider `status=ACTIVE`、對應 `ProviderService.active=true`、且 `ProviderServiceArea.active=true`。僅以 ProviderServiceArea 計算服務地區，不由地址推測。

| Service Type | City | District | 已驗證／候選總數 | DISTANCE 狀態 | 原因 |
| --- | --- | --- | --- | --- | --- |
| HOME_CARE | 新北市 | 三重區 | 2／2 | READY | `NTPC-HC-004`、`NTPC-HC-005` 均有已驗證座標；可做多家 DISTANCE 排序驗收。 |
| HOME_CARE | 新北市 | 土城區 | 1／1 | READY | 唯一正式候選 `NTPC-HC-005` 已驗證；可供 B-005／J-003 做 DISTANCE 驗收。 |
| HOME_CARE | 新北市 | 中和區 | 2／3 | BLOCKED | 仍有 1 個正式候選為 null；不得混排。 |
| HOME_CARE | 新北市 | 五股區 | 1／1 | READY | 唯一正式候選 `NTPC-HC-005` 已驗證；可做 DISTANCE 驗收。 |
| HOME_CARE | 新北市 | 永和區 | 1／2 | BLOCKED | 另 1 個正式候選仍為 null；不得混排。 |
| HOME_CARE | 新北市 | 板橋區 | 2／3 | BLOCKED | 仍有 1 個正式候選為 null；不得混排。 |
| HOME_CARE | 新北市 | 泰山區 | 1／1 | READY | 唯一正式候選 `NTPC-HC-005` 已驗證；可做 DISTANCE 驗收。 |
| HOME_CARE | 新北市 | 新店區 | 1／1 | READY | 唯一正式候選 `NTPC-HC-005` 已驗證；可做 DISTANCE 驗收。 |
| HOME_CARE | 新北市 | 新莊區 | 2／2 | READY | `NTPC-HC-004`、`NTPC-HC-005` 均有已驗證座標。 |
| HOME_CARE | 新北市 | 樹林區 | 1／2 | BLOCKED | 另 1 個正式候選仍為 null；不得混排。 |
| HOME_CARE | 新北市 | 蘆洲區 | 2／2 | READY | `NTPC-HC-004`、`NTPC-HC-005` 均有已驗證座標。 |
| HOME_CARE | 臺北市 | 士林區 | 0／3 | BLOCKED | 所有候選座標均為 null；不得使用 DISTANCE。 |
| HOME_CARE | 臺北市 | 大同區 | 0／10 | BLOCKED | 所有候選座標均為 null；不得使用 DISTANCE。 |
| HOME_CARE | 臺北市 | 大安區 | 0／4 | BLOCKED | 所有候選座標均為 null；不得使用 DISTANCE。 |
| HOME_CARE | 臺北市 | 中山區 | 0／7 | BLOCKED | 所有候選座標均為 null；不得使用 DISTANCE。 |
| HOME_CARE | 臺北市 | 中正區 | 0／9 | BLOCKED | 所有候選座標均為 null；不得使用 DISTANCE。 |
| HOME_CARE | 臺北市 | 內湖區 | 0／3 | BLOCKED | 所有候選座標均為 null；不得使用 DISTANCE。 |
| HOME_CARE | 臺北市 | 文山區 | 0／3 | BLOCKED | 所有候選座標均為 null；不得使用 DISTANCE。 |
| HOME_CARE | 臺北市 | 北投區 | 0／3 | BLOCKED | 所有候選座標均為 null；不得使用 DISTANCE。 |
| HOME_CARE | 臺北市 | 松山區 | 0／3 | BLOCKED | 所有候選座標均為 null；不得使用 DISTANCE。 |
| HOME_CARE | 臺北市 | 信義區 | 0／3 | BLOCKED | 所有候選座標均為 null；不得使用 DISTANCE。 |
| HOME_CARE | 臺北市 | 南港區 | 0／3 | BLOCKED | 所有候選座標均為 null；不得使用 DISTANCE。 |
| HOME_CARE | 臺北市 | 萬華區 | 0／10 | BLOCKED | 所有候選座標均為 null；不得使用 DISTANCE。 |
| HOME_MEDICAL_NURSING | 臺北市 | （無 Service Area 行政區） | 0／0 | BLOCKED | 缺 ProviderServiceArea；不得由地址推測。 |
| ASSISTIVE_DEVICE | 臺北市 | （無 Service Area 行政區） | 0／0 | BLOCKED | 缺 ProviderServiceArea；不得由地址推測。 |
| ASSISTIVE_DEVICE | 新北市 | （無 Service Area 行政區） | 0／0 | BLOCKED | 缺 ProviderServiceArea；不得由地址推測。 |

## 可重現檢查

```bash
node data/providers/qa/validate-providers.mjs
node data/providers/qa/verify-coordinates.mjs
git diff --check
```

### 可交付的 DISTANCE 驗收範圍

`HOME_CARE × 新北市 × 三重區` 是本次首個多家完整覆蓋組合：候選由 `status=ACTIVE`、`ProviderService.active=true`、`ProviderServiceArea.active=true` 計得，共有 `NTPC-HC-004` 與 `NTPC-HC-005`，且兩筆座標均已驗證。因此 B-005／J-003 可在 GPS／EXACT 情境驗收 `rankingType=DISTANCE`、兩家距離排序與數值 `distanceKm`。`土城區`、`五股區`、`新店區`、`泰山區`也維持完整覆蓋，但各只有同一個單一候選 `NTPC-HC-005`；`新莊區`與`蘆洲區`則新增為 2／2 READY。

### 仍未解決的缺口

- 其餘 HOME_CARE 組合仍有至少一個候選無已驗證座標，依 D-13c 必須使用 `DISTRICT_ROTATION`。
- `HOME_MEDICAL_NURSING`：已檢視 `SRC-003`（臺北市衛生局居家護理所名單）；可核對機構，但未找到逐機構正式服務縣市／行政區與有效狀態，故不新增 ProviderServiceArea，也不由營業地址推測。需 Jerry 提供明示服務範圍的正式資料或決定資料取得管道。
- `ASSISTIVE_DEVICE`：已檢視 `SRC-004`（臺北市政府社會局特約門市名單）與 `SRC-005`（新北市輔具資源中心特約資料）；可核對門市／特約資訊，但未找到逐門市、可寫入資料契約的服務縣市／行政區與有效狀態，故不新增 ProviderServiceArea，也不由營業地址推測。需 Jerry 提供正式服務範圍資料或決定外部輸入。

本 PR 未部署、未合併，且未改動 Allowed Paths 以外檔案。
