# A-003-r7 Provider Coordinate Verification Report

Submission Version: A-003-r7（取代 r6 報告）

Report date: 2026-09-29
Dataset: `data/providers/staging/providers.json`、`provider-services.json`、`provider-service-areas.json`
Evidence: `data/providers/qa/a-003-evidence.json`（機器可讀；座標、服務範圍與待補清單的唯一依據）

> 標示 `A003:BEGIN／END` 的區塊由 `node data/providers/qa/verify-coordinates.mjs --write` 從資料與證據重算產生，請勿手改；
> `node data/providers/qa/verify-coordinates.mjs` 會在區塊內容與資料不一致時失敗。

## 階段結論

- **A-003 仍未全數完成。** 座標已補到 28／30；剩下 2 筆是官方正式地址在官方門牌資料中不存在，另有 14 家居家護理／輔具 Provider 缺服務範圍，需要 Jerry 決定資料來源或規則。詳見 `qa/pending-verification.md`。
- 「lat/lng 非 null」不等於「已驗證」：只有 `a-003-evidence.json` 內通過全部檢查的證據，才計入已驗證；檢查程式也會拒絕任何缺證據的非 null 座標。

## 版次更正紀錄

| 版次 | 項目 | 更正內容 | 依據 |
| --- | --- | --- | --- |
| r6 | NTPC-HC-003 服務範圍 | r5 缺漏；補上新莊區、三重區、林口區，因此 r5 的三重／新莊「2／2 READY」不成立 | SRC-002 1150924 名單序號 291 |
| r6 | 名冊 11506 的 Source ID | r5 誤用 `SRC-003`，改登記為 `SRC-006` | `sources/source-registry.md` |
| r6 | 新北市座標 | 新增 11 筆，共 13 筆 | SRC-COORD-NTPC-001 |
| r7 | 臺北市座標系統 | r6 以「座標系統未載明」保留 null。r7 找到民政局門牌圖層 `CA/HOUSENO` 的空間參考（`latestWkid 3826`），且 15 筆門牌的 TM2X／TM2Y 與 CSV 完全相同，因此確認為 EPSG:3826 | SRC-COORD-TPE-002 |
| r7 | 臺北市座標 | 新增 15 筆，共 28 筆 | SRC-COORD-TPE-001／002 |
| r7 | TP-HC-005 | r6 誤判「找不到康定路62號」：CSV 只以樓層列出（例如 `６２號十一樓`），同一建物共用門牌點 | SRC-COORD-TPE-001 |
| r7 | TP-HMN-002 服務範圍 | 新增士林區、北投區 | SRC-007 序號 49 |
| r7 | TP-AD-003 地址 | 補上官方名單的「號」（`1之5` → `1之5號`），並同步更新 Google Maps URL | SRC-004 序號 374 |
| r7 | 檢查程式 | 證據未通過檢查時，不再計入已驗證 | `qa/lib/a-003-coverage.mjs` |

## 摘要

<!-- A003:BEGIN summary -->
- Provider 總數：30
- ProviderServiceArea 筆數：86
- lat/lng 非 null：28
- 有完整驗證證據的座標：28（名稱／地址核對＋官方門牌點＋可重現轉換，見 `qa/a-003-evidence.json`）
- 非 null 但缺證據：0
- 尚待驗證座標：2
- 缺 ProviderServiceArea 的 ACTIVE Provider：14
- 服務類型 × 行政區組合：26；DISTANCE READY：24（HOME_CARE × 新北市三重區、HOME_CARE × 新北市土城區、HOME_CARE × 新北市中和區、HOME_CARE × 新北市五股區、HOME_CARE × 新北市永和區、HOME_CARE × 新北市板橋區、HOME_CARE × 新北市林口區、HOME_CARE × 新北市泰山區、HOME_CARE × 新北市新店區、HOME_CARE × 新北市新莊區、HOME_CARE × 新北市樹林區、HOME_CARE × 新北市蘆洲區、HOME_CARE × 臺北市士林區、HOME_CARE × 臺北市大同區、HOME_CARE × 臺北市大安區、HOME_CARE × 臺北市中山區、HOME_CARE × 臺北市中正區、HOME_CARE × 臺北市內湖區、HOME_CARE × 臺北市文山區、HOME_CARE × 臺北市北投區、HOME_CARE × 臺北市松山區、HOME_CARE × 臺北市信義區、HOME_CARE × 臺北市南港區、HOME_CARE × 臺北市萬華區）
<!-- A003:END summary -->

## 座標驗證方法（可重現）

1. **機構身分**：以官方名單核對 Provider 名稱與正式地址。
   - 臺北居家服務：SRC-001（repo 內 PDF）。
   - 臺北居家護理所：SRC-003。
   - 臺北輔具：SRC-004（115.9.1 ODS）。
   - 新北居家服務：SRC-002 1150924 名單；NTPC-HC-004 另核對 SRC-006。
   - 新北輔具：SRC-005（repo 內 xlsx）。

   名單地址多出「里／鄰」、`台／臺`，或 PDF 以部首字「⾧」代替「長」，都不影響核對。
2. **門牌點**：在官方門牌資料找出與正式地址**同行政區代碼、同街路段、同巷弄、同號**的紀錄，並把原始 CSV 列完整記錄在證據檔。
   - 新北：SRC-COORD-NTPC-001。
   - 臺北：SRC-COORD-TPE-001。

   比對規則：
   - `501-6號` 等同 `５０１之６號`。
   - `2段` 等同 `二段`。
   - 同一建物各樓層共用同一門牌點（例：康定路62號各樓層座標相同），所以只比到「號」。
3. **座標系統**：
   - 新北：CSV 欄位名稱 `x_3826`／`y_3826` 已載明。
   - 臺北：民政局門牌圖層 SRC-COORD-TPE-002 的 `spatialReference` 為 `{wkid: 102443, latestWkid: 3826}`。15 筆門牌在該圖層的 TM2X／TM2Y 與 CSV 數值逐位相同，系統前端也以 `TW:972121`（TWD97 TM2 121）處理這兩個欄位。
4. **座標轉換**：以 PROJ 9.8.1（pyproj 3.8.0）將 EPSG:3826 轉為 EPSG:4326（WGS84），四捨五入到小數 8 位。`verify-coordinates.mjs` 以 GRS80 逆橫麥卡托公式獨立重算，誤差須小於 1e-7°（約 1 公分）。
5. **不使用**：Google Maps 搜尋結果或地圖中心、行政區中心、鄰近門牌、非官方公司資料網站、推估座標。找不到完全相符門牌的 Provider 保持 `null`。

## 服務類型統計

<!-- A003:BEGIN by-service-type -->
| Service Type | ACTIVE Provider | 有已驗證座標 | 座標覆蓋率 | 有服務範圍 | 行政區組合 | READY 組合 | 待補 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| HOME_CARE | 15 | 15 | 100% | 15 | 24 | 24 | — |
| HOME_MEDICAL_NURSING | 3 | 3 | 100% | 1 | 2 | 0 | 服務範圍未知：TP-HMN-001、TP-HMN-003；不得由地址推測，也因此沒有可推薦組合 |
| ASSISTIVE_DEVICE | 12 | 10 | 83% | 0 | 0 | 0 | 服務範圍未知：TP-AD-001、TP-AD-002、TP-AD-003、NTPC-AD-001、NTPC-AD-002、NTPC-AD-003、NTPC-AD-004、NTPC-AD-005、NTPC-AD-006、NTPC-AD-007、NTPC-AD-008、NTPC-AD-009；不得由地址推測，也因此沒有可推薦組合 |
<!-- A003:END by-service-type -->

## 服務類型 × 行政區覆蓋率

候選定義：Provider `status=ACTIVE`、對應 `ProviderService.active=true`，且 `ProviderServiceArea.active=true` 含該行政區。服務範圍只看 ProviderServiceArea，不由地址推測。

狀態判定（D-13c）：`READY` 表示全部候選都有通過檢查的已驗證座標，而且同服務類型沒有服務範圍未知的 ACTIVE Provider（這類 Provider 可能是任一行政區的隱藏候選）。其餘組合必須使用 `DISTRICT_ROTATION`。

<!-- A003:BEGIN coverage -->
| Service Type | City | District | 候選數 | 已驗證座標 | 覆蓋率 | 狀態 | 待補座標 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| HOME_CARE | 新北市 | 三重區 | 3 | 3 | 100% | READY | — |
| HOME_CARE | 新北市 | 土城區 | 1 | 1 | 100% | READY | — |
| HOME_CARE | 新北市 | 中和區 | 3 | 3 | 100% | READY | — |
| HOME_CARE | 新北市 | 五股區 | 1 | 1 | 100% | READY | — |
| HOME_CARE | 新北市 | 永和區 | 2 | 2 | 100% | READY | — |
| HOME_CARE | 新北市 | 板橋區 | 3 | 3 | 100% | READY | — |
| HOME_CARE | 新北市 | 林口區 | 1 | 1 | 100% | READY | — |
| HOME_CARE | 新北市 | 泰山區 | 1 | 1 | 100% | READY | — |
| HOME_CARE | 新北市 | 新店區 | 1 | 1 | 100% | READY | — |
| HOME_CARE | 新北市 | 新莊區 | 3 | 3 | 100% | READY | — |
| HOME_CARE | 新北市 | 樹林區 | 2 | 2 | 100% | READY | — |
| HOME_CARE | 新北市 | 蘆洲區 | 2 | 2 | 100% | READY | — |
| HOME_CARE | 臺北市 | 士林區 | 3 | 3 | 100% | READY | — |
| HOME_CARE | 臺北市 | 大同區 | 10 | 10 | 100% | READY | — |
| HOME_CARE | 臺北市 | 大安區 | 4 | 4 | 100% | READY | — |
| HOME_CARE | 臺北市 | 中山區 | 7 | 7 | 100% | READY | — |
| HOME_CARE | 臺北市 | 中正區 | 9 | 9 | 100% | READY | — |
| HOME_CARE | 臺北市 | 內湖區 | 3 | 3 | 100% | READY | — |
| HOME_CARE | 臺北市 | 文山區 | 3 | 3 | 100% | READY | — |
| HOME_CARE | 臺北市 | 北投區 | 3 | 3 | 100% | READY | — |
| HOME_CARE | 臺北市 | 松山區 | 3 | 3 | 100% | READY | — |
| HOME_CARE | 臺北市 | 信義區 | 3 | 3 | 100% | READY | — |
| HOME_CARE | 臺北市 | 南港區 | 3 | 3 | 100% | READY | — |
| HOME_CARE | 臺北市 | 萬華區 | 10 | 10 | 100% | READY | — |
| HOME_MEDICAL_NURSING | 臺北市 | 士林區 | 1 | 1 | 100% | BLOCKED（同類型有 Provider 服務範圍未知） | — |
| HOME_MEDICAL_NURSING | 臺北市 | 北投區 | 1 | 1 | 100% | BLOCKED（同類型有 Provider 服務範圍未知） | — |
<!-- A003:END coverage -->

注意事項：

- READY 只代表**目前 Kareo 資料集（30 筆）**內的候選都有已驗證座標，不代表官方名單上所有服務單位。
- 候選數 1 的組合只能驗收單一候選的 `DISTANCE` 與 `distanceKm`；多家距離排序請用候選數 2 以上的組合。
- `HOME_MEDICAL_NURSING` 目前只有 TP-HMN-002 有官方服務範圍，TP-HMN-001、003 仍未知，所以該類型全部 BLOCKED。
- `ASSISTIVE_DEVICE` 沒有任何 ProviderServiceArea，因此沒有候選組合。

## 逐筆對照

<!-- A003:BEGIN providers -->
| Provider ID | 名稱 | 類型 | lat | lng | 座標狀態 | 座標證據 | 查核日 | 服務範圍筆數 | 待補 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TP-HC-001 | 財團法人天主教失智老人社會福利基金會附設臺北市私立聖若瑟居家式服務類長期照顧服務機構 | HOME_CARE | 25.0234622 | 121.49706155 | VERIFIED | SRC-001 名稱／地址；SRC-COORD-TPE-001 `東園街１４０巷７號`（EPSG:3826 → WGS84） | 2026-09-29 | 4 | — |
| TP-HC-002 | 財團法人台北市立心慈善基金會附設臺北市私立立心居家式服務類長期照顧服務機構 | HOME_CARE | 25.0320453 | 121.5023651 | VERIFIED | SRC-001 名稱／地址；SRC-COORD-TPE-001 `艋舺大道１２０巷３９弄３號`（EPSG:3826 → WGS84） | 2026-09-29 | 3 | — |
| TP-HC-003 | 臺北市私立寬安居家長照機構 | HOME_CARE | 25.03124832 | 121.49749533 | VERIFIED | SRC-001 名稱／地址；SRC-COORD-TPE-001 `莒光路３２８號`（EPSG:3826 → WGS84） | 2026-09-29 | 5 | — |
| TP-HC-004 | 財團法人中華民國佛教慈濟慈善事業基金會臺北市私立慈濟居家長照機構 | HOME_CARE | 25.03133506 | 121.50025409 | VERIFIED | SRC-001 名稱／地址；SRC-COORD-TPE-001 `莒光路２２２號`（EPSG:3826 → WGS84） | 2026-09-29 | 12 | — |
| TP-HC-005 | 中華民國紅十字會附設私立博愛居家長照機構 | HOME_CARE | 25.04244164 | 121.50231089 | VERIFIED | SRC-001 名稱／地址；SRC-COORD-TPE-001 `康定路６２號十一樓`（EPSG:3826 → WGS84） | 2026-09-29 | 4 | — |
| TP-HC-006 | 臺北市私立大心居家長照機構 | HOME_CARE | 25.03492333 | 121.5010587 | VERIFIED | SRC-001 名稱／地址；SRC-COORD-TPE-001 `康定路３４８號`（EPSG:3826 → WGS84） | 2026-09-29 | 4 | — |
| TP-HC-007 | 有限責任臺北市全國照服員勞動合作社附設臺北市私立全方位居家長照機構 | HOME_CARE | 25.02265945 | 121.50212962 | VERIFIED | SRC-001 名稱／地址；SRC-COORD-TPE-001 `青年路１０６巷９號`（EPSG:3826 → WGS84） | 2026-09-29 | 3 | — |
| TP-HC-008 | 臺北市私立璞馨居家長照機構 | HOME_CARE | 25.02660963 | 121.495373 | VERIFIED | SRC-001 名稱／地址；SRC-COORD-TPE-001 `東園街６６巷２１弄５１號`（EPSG:3826 → WGS84） | 2026-09-29 | 4 | — |
| TP-HC-009 | 紙飛機服務科技股份有限公司附設臺北市私立紙飛機居家長照機構 | HOME_CARE | 25.03592264 | 121.49920788 | VERIFIED | SRC-001 名稱／地址；SRC-COORD-TPE-001 `西園路一段２００號`（EPSG:3826 → WGS84） | 2026-09-29 | 10 | — |
| TP-HC-010 | 私立愛吾愛居家長照機構 | HOME_CARE | 25.03397772 | 121.49491673 | VERIFIED | SRC-001 名稱／地址；SRC-COORD-TPE-001 `大理街１７１之１號`（EPSG:3826 → WGS84） | 2026-09-29 | 12 | — |
| NTPC-HC-001 | 萓品管理顧問有限公司附設新北市私立禾善居家長照機構 | HOME_CARE | 24.98165119 | 121.42139256 | VERIFIED | SRC-002 名稱／地址；SRC-COORD-NTPC-001 `仁愛街３號`（EPSG:3826 → WGS84） | 2026-09-29 | 1 | — |
| NTPC-HC-002 | 社團法人中華長照協會附設新北市私立永樂居家式服務類長期照顧服務機構 | HOME_CARE | 25.01625499 | 121.51041539 | VERIFIED | SRC-002 名稱／地址；SRC-COORD-NTPC-001 `文化路１５５號`（EPSG:3826 → WGS84） | 2026-09-29 | 3 | — |
| NTPC-HC-003 | 台灣全齡長照股份有限公司附設新北市私立禾薪居家長照機構 | HOME_CARE | 25.03758368 | 121.45887535 | VERIFIED | SRC-002 名稱／地址；SRC-COORD-NTPC-001 `新莊路１６之２號`（EPSG:3826 → WGS84） | 2026-09-29 | 3 | — |
| NTPC-HC-004 | 新北市私立旺福居家長照機構 | HOME_CARE | 25.07852424 | 121.49241746 | VERIFIED | SRC-002＋SRC-006 名稱／地址；SRC-COORD-NTPC-001 `福隆路４８號`（EPSG:3826 → WGS84） | 2026-09-29 | 5 | — |
| NTPC-HC-005 | 新北市私立全曜居家式服務類長期照顧服務機構 | HOME_CARE | 25.06674961 | 121.50306191 | VERIFIED | SRC-002 名稱／地址；SRC-COORD-NTPC-001 `長元街１００之２號`（EPSG:3826 → WGS84） | 2026-09-29 | 11 | — |
| TP-HMN-001 | 台灣基督長老教會馬偕醫療財團法人附設馬偕居家護理所 | HOME_MEDICAL_NURSING | 25.05988525 | 121.5222678 | VERIFIED | SRC-003 名稱／地址；SRC-COORD-TPE-001 `中山北路二段９６巷９號`（EPSG:3826 → WGS84） | 2026-09-29 | 0 | 服務範圍 |
| TP-HMN-002 | 臺北市立聯合醫院附設陽明居家護理所 | HOME_MEDICAL_NURSING | 25.10519407 | 121.53156558 | VERIFIED | SRC-003 名稱／地址；SRC-COORD-TPE-001 `雨聲街１０５號`（EPSG:3826 → WGS84） | 2026-09-29 | 2 | — |
| TP-HMN-003 | 國立臺灣大學醫學院附設醫院北護分院附設居家護理所 | HOME_MEDICAL_NURSING | 25.04222858 | 121.50255105 | VERIFIED | SRC-003 名稱／地址；SRC-COORD-TPE-001 `康定路３７號`（EPSG:3826 → WGS84） | 2026-09-29 | 0 | 服務範圍 |
| TP-AD-001 | 晨玉有限公司 | ASSISTIVE_DEVICE | 25.0518338 | 121.53419877 | VERIFIED | SRC-004 名稱／地址；SRC-COORD-TPE-001 `南京東路二段１５０號`（EPSG:3826 → WGS84） | 2026-09-29 | 0 | 服務範圍 |
| TP-AD-002 | 諾貝兒寶貝股份有限公司內湖分公司 | ASSISTIVE_DEVICE | null | null | PENDING | — | — | 0 | 座標、服務範圍 |
| TP-AD-003 | 可能設計有限公司 | ASSISTIVE_DEVICE | 25.00427674 | 121.54125347 | VERIFIED | SRC-004 名稱／地址；SRC-COORD-TPE-001 `興隆路一段５５巷２７弄１之５號`（EPSG:3826 → WGS84） | 2026-09-29 | 0 | 服務範圍 |
| NTPC-AD-001 | 弘采介護有限公司 | ASSISTIVE_DEVICE | 24.98385487 | 121.53356671 | VERIFIED | SRC-005 名稱／地址；SRC-COORD-NTPC-001 `中正路５０１之６號`（EPSG:3826 → WGS84） | 2026-09-29 | 0 | 服務範圍 |
| NTPC-AD-002 | 大瀚醫療儀器有限公司 | ASSISTIVE_DEVICE | 25.0030857 | 121.46068223 | VERIFIED | SRC-005 名稱／地址；SRC-COORD-NTPC-001 `校前街２８號`（EPSG:3826 → WGS84） | 2026-09-29 | 0 | 服務範圍 |
| NTPC-AD-003 | 宏宇醫療器材行 | ASSISTIVE_DEVICE | 24.99666299 | 121.45189673 | VERIFIED | SRC-005 名稱／地址；SRC-COORD-NTPC-001 `南雅南路二段１３４號`（EPSG:3826 → WGS84） | 2026-09-29 | 0 | 服務範圍 |
| NTPC-AD-004 | 吉評醫療器材股份有限公司 | ASSISTIVE_DEVICE | null | null | PENDING | — | — | 0 | 座標、服務範圍 |
| NTPC-AD-005 | 學府松藥局 | ASSISTIVE_DEVICE | 24.98854427 | 121.45802719 | VERIFIED | SRC-005 名稱／地址；SRC-COORD-NTPC-001 `學府路一段３８號`（EPSG:3826 → WGS84） | 2026-09-29 | 0 | 服務範圍 |
| NTPC-AD-006 | 兆謙益企業有限公司 | ASSISTIVE_DEVICE | 25.07237267 | 121.35861123 | VERIFIED | SRC-005 名稱／地址；SRC-COORD-NTPC-001 `源泉街１２號`（EPSG:3826 → WGS84） | 2026-09-29 | 0 | 服務範圍 |
| NTPC-AD-007 | 瑞康醫療器材有限公司 | ASSISTIVE_DEVICE | 24.99206804 | 121.49471705 | VERIFIED | SRC-005 名稱／地址；SRC-COORD-NTPC-001 `圓通路２９５之１號`（EPSG:3826 → WGS84） | 2026-09-29 | 0 | 服務範圍 |
| NTPC-AD-008 | 鴻銘醫療儀器行 | ASSISTIVE_DEVICE | 25.13823097 | 121.46201283 | VERIFIED | SRC-005 名稱／地址；SRC-COORD-NTPC-001 `民生路４７之２號`（EPSG:3826 → WGS84） | 2026-09-29 | 0 | 服務範圍 |
| NTPC-AD-009 | 美德耐股份有限公司雙和門市部 | ASSISTIVE_DEVICE | 24.9937458 | 121.49408179 | VERIFIED | SRC-005 名稱／地址；SRC-COORD-NTPC-001 `中正路２９１號`（EPSG:3826 → WGS84） | 2026-09-29 | 0 | 服務範圍 |
<!-- A003:END providers -->

## 驗收狀態

### 本次完成（A-003-r7）

- 確認臺北市門牌資料的座標系統，新增 15 筆臺北座標；已驗證座標共 28／30。
- 新增 TP-HMN-002 官方服務範圍（士林區、北投區）。
- TP-AD-003 地址依官方名單補上「號」。
- 檢查程式改為「證據通過全部檢查才算已驗證」，並新增測試。

### 仍待查證

- **2 筆座標：** TP-AD-002（官方名單地址「民權東路6段18巷」在官方門牌資料中不存在）、NTPC-AD-004（官方門牌資料沒有「安康路一段359號」）。
- **14 家服務範圍：** TP-HMN-001、TP-HMN-003，以及 12 家輔具。居家護理所的官方特約資料列的是醫院本體；輔具則是「民眾向任一特約廠商購買」的制度，廠商沒有行政區服務範圍。
- 逐筆原因與下一步見 `qa/pending-verification.md`。

### 可進行的驗收

- B-005／J-003 可在上方 24 個 READY 組合（臺北市與新北市的 HOME_CARE）驗收 `rankingType=DISTANCE` 與數值 `distanceKm`。
- D-13c：精確位置但同類型有服務範圍未知的 Provider 時，應改用 `DISTRICT_ROTATION`，可用 HOME_MEDICAL_NURSING × 士林區／北投區驗收。
- 行政區輪替、服務範圍篩選（A-005 AC-005、AC-006、AC-010）。

### 尚不可進行的驗收

- HOME_MEDICAL_NURSING 的 DISTANCE 排序（TP-HMN-001、003 服務範圍未知）。
- ASSISTIVE_DEVICE 的任何推薦驗收（沒有服務範圍，也就沒有候選）。
- A-003 整體完成驗收。

## 可重現檢查

```bash
node data/providers/qa/validate-providers.mjs
node data/providers/qa/verify-coordinates.mjs
node --test 'data/providers/qa/tests/*.test.mjs'
```

本 PR 未部署、未合併，未修改 `/data/providers/**` 以外檔案，未使用付費 geocoding 服務。
