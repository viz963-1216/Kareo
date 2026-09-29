# A-003-r12 Provider Coordinate Verification Report

Submission Version: A-003-r12（交接整理；證據資料維持 r11）

Report date: 2026-09-29
Dataset: `data/providers/staging/providers.json`、`provider-services.json`、`provider-service-areas.json`
Evidence: `data/providers/qa/a-003-evidence.json`（機器可讀；座標、服務範圍與待補清單的唯一依據）

> 標示 `A003:BEGIN／END` 的區塊由 `node data/providers/qa/verify-coordinates.mjs --write` 從資料與證據重算產生，請勿手改；
> `node data/providers/qa/verify-coordinates.mjs` 會在區塊內容與資料不一致時失敗。

## 階段結論

- **資料面已補齊到可交付狀態：** 30 家 Provider 都有服務範圍；29／30 有官方門牌點驗證座標，另有 1 筆依指示採用的非官方地圖座標。
- **座標：** 30／30 有座標，其中 29 筆是官方門牌點（已驗證）。NTPC-AD-004 依 DEC-A003-07 採用 Google Maps 商家標記，屬**非官方座標**，不計入已驗證，另列統計。
- **影響：** NTPC-AD-004 是全部 41 個輔具組合的候選，採用非官方座標後，這 41 組在資料上成為 READY，但**都依賴一筆非官方座標**，在 Jerry 確認 DEC-A003-07 前不作為正式驗收依據。
- **指示紀錄：** 7 項資料依本工作階段使用者的指示處理，記錄在 `a-003-evidence.json` 的 `decisions`（DEC-A003-01～07），並附原文摘錄、日期、工作階段識別與範圍核對。對話無法證實該使用者是否為 Jerry／專案負責人，需由 Jerry 在 PR review 確認。
- **官方證實 vs 平台設定：** DEC-A003-01（輔具）與 DEC-A003-02（TP-HMN-001、003）建立的服務範圍是**平台設定**，官方來源並未直接證實這些 Provider 在這些行政區提供服務。兩者分開統計，見「服務範圍依據」。
- **驗收範圍：** 本報告只代表資料交付檢查通過，不是正式 E2E 或部署驗收。
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
| r8 | 輔具服務範圍 | 12 家依簽約縣市建立全區服務範圍（臺北 12 區／新北 29 區；兩市都簽約者兩市都納入），共 415 筆 | DEC-A003-01；SRC-004、SRC-005 簽約名單 |
| r8 | TP-HMN-001、003 服務範圍 | 套用醫院本體在 SRC-007 的服務區域：馬偕「全區」→ 臺北 12 區；北護「萬華、大同、中正」 | DEC-A003-02；SRC-007 序號 64、37 |
| r8 | TP-AD-002 地址與座標 | 地址依 Google Maps 更正為「民權東路6段180巷6號B1樓」（官方名單誤植為 18巷；電話相同）；座標取官方門牌點 180巷6號（含地下一層） | DEC-A003-03；SRC-COORD-TPE-001／002 |
| r8 | NTPC-AD-004 座標 | 忽略，維持 null | DEC-A003-04 |
| r8 | NTPC-HC-003 電話 | 依 Google Maps 更新為 02-2990-2007（與 SRC-002 1150924 名單相同） | DEC-A003-05 |
| r8 | 檢查程式 | 證據引用的 decisionId 必須存在於 `decisions` | `qa/lib/a-003-coverage.mjs` |
| r9 | 決定紀錄 | r8 把決定者寫成「專案負責人（repo owner）」屬未經證實的推定，改為「本工作階段使用者」，並補上原文摘錄、工作階段識別與範圍核對 | `a-003-evidence.json` `decisions[].approval` |
| r11 | NTPC-AD-004 座標 | 依 DEC-A003-07 採用 Google Maps 商家標記 (24.9619599, 121.5177834)，記錄在 `unofficialCoordinates`，不計入已驗證；檢查程式要求 UNOFFICIAL_COORDINATE 指示且數值一致 | DEC-A003-07；SRC-GMAPS-001 |
| r10 | NTPC-AD-004 地址 | 依 DEC-A003-06 改為「231新北市新店區下城里安康路一段359之25號」。官方門牌資料（11509）下城里安康路一段只有 355、361 號，沒有 359 號，所以座標仍為 null | DEC-A003-06；SRC-COORD-NTPC-001 |
| r9 | 服務範圍依據 | 每筆服務範圍證據標示 `basis`（`OFFICIAL`／`PLATFORM_SETTING`）；報告分開統計，覆蓋率表列出依平台設定納入的候選 | `qa/lib/a-003-coverage.mjs` |

## 摘要

<!-- A003:BEGIN summary -->
- Provider 總數：30
- ProviderServiceArea 筆數：516
- lat/lng 非 null：30
- 有完整驗證證據的座標：29（名稱／地址核對＋官方門牌點＋可重現轉換，見 `qa/a-003-evidence.json`）
- 依指示採用的非官方座標（非官方門牌點，不計入已驗證）：1（NTPC-AD-004，DEC-A003-07）
- 非 null 但缺任何證據：0
- 仍無座標：0
- 缺 ProviderServiceArea 的 ACTIVE Provider：0
- 依指示建立的平台設定服務範圍（非官方證實）：430 筆（DEC-A003-01、DEC-A003-02）
- 服務類型 × 行政區組合：77；DISTANCE READY：77（HOME_CARE × 新北市三重區、HOME_CARE × 新北市土城區、HOME_CARE × 新北市中和區、HOME_CARE × 新北市五股區、HOME_CARE × 新北市永和區、HOME_CARE × 新北市板橋區、HOME_CARE × 新北市林口區、HOME_CARE × 新北市泰山區、HOME_CARE × 新北市新店區、HOME_CARE × 新北市新莊區、HOME_CARE × 新北市樹林區、HOME_CARE × 新北市蘆洲區、HOME_CARE × 臺北市士林區、HOME_CARE × 臺北市大同區、HOME_CARE × 臺北市大安區、HOME_CARE × 臺北市中山區、HOME_CARE × 臺北市中正區、HOME_CARE × 臺北市內湖區、HOME_CARE × 臺北市文山區、HOME_CARE × 臺北市北投區、HOME_CARE × 臺北市松山區、HOME_CARE × 臺北市信義區、HOME_CARE × 臺北市南港區、HOME_CARE × 臺北市萬華區、HOME_MEDICAL_NURSING × 臺北市士林區、HOME_MEDICAL_NURSING × 臺北市大同區、HOME_MEDICAL_NURSING × 臺北市大安區、HOME_MEDICAL_NURSING × 臺北市中山區、HOME_MEDICAL_NURSING × 臺北市中正區、HOME_MEDICAL_NURSING × 臺北市內湖區、HOME_MEDICAL_NURSING × 臺北市文山區、HOME_MEDICAL_NURSING × 臺北市北投區、HOME_MEDICAL_NURSING × 臺北市松山區、HOME_MEDICAL_NURSING × 臺北市信義區、HOME_MEDICAL_NURSING × 臺北市南港區、HOME_MEDICAL_NURSING × 臺北市萬華區、ASSISTIVE_DEVICE × 新北市八里區、ASSISTIVE_DEVICE × 新北市三芝區、ASSISTIVE_DEVICE × 新北市三重區、ASSISTIVE_DEVICE × 新北市三峽區、ASSISTIVE_DEVICE × 新北市土城區、ASSISTIVE_DEVICE × 新北市中和區、ASSISTIVE_DEVICE × 新北市五股區、ASSISTIVE_DEVICE × 新北市平溪區、ASSISTIVE_DEVICE × 新北市永和區、ASSISTIVE_DEVICE × 新北市石門區、ASSISTIVE_DEVICE × 新北市石碇區、ASSISTIVE_DEVICE × 新北市汐止區、ASSISTIVE_DEVICE × 新北市坪林區、ASSISTIVE_DEVICE × 新北市板橋區、ASSISTIVE_DEVICE × 新北市林口區、ASSISTIVE_DEVICE × 新北市金山區、ASSISTIVE_DEVICE × 新北市泰山區、ASSISTIVE_DEVICE × 新北市烏來區、ASSISTIVE_DEVICE × 新北市貢寮區、ASSISTIVE_DEVICE × 新北市淡水區、ASSISTIVE_DEVICE × 新北市深坑區、ASSISTIVE_DEVICE × 新北市新店區、ASSISTIVE_DEVICE × 新北市新莊區、ASSISTIVE_DEVICE × 新北市瑞芳區、ASSISTIVE_DEVICE × 新北市萬里區、ASSISTIVE_DEVICE × 新北市樹林區、ASSISTIVE_DEVICE × 新北市雙溪區、ASSISTIVE_DEVICE × 新北市蘆洲區、ASSISTIVE_DEVICE × 新北市鶯歌區、ASSISTIVE_DEVICE × 臺北市士林區、ASSISTIVE_DEVICE × 臺北市大同區、ASSISTIVE_DEVICE × 臺北市大安區、ASSISTIVE_DEVICE × 臺北市中山區、ASSISTIVE_DEVICE × 臺北市中正區、ASSISTIVE_DEVICE × 臺北市內湖區、ASSISTIVE_DEVICE × 臺北市文山區、ASSISTIVE_DEVICE × 臺北市北投區、ASSISTIVE_DEVICE × 臺北市松山區、ASSISTIVE_DEVICE × 臺北市信義區、ASSISTIVE_DEVICE × 臺北市南港區、ASSISTIVE_DEVICE × 臺北市萬華區）
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
5. **不使用**：Google Maps 座標或地圖中心、行政區中心、鄰近門牌、非官方公司資料網站、推估座標。找不到完全相符門牌的 Provider 保持 `null`。Google Maps 只在 DEC-A003-03／05 用來確認 TP-AD-002 的門牌與 NTPC-HC-003 的電話，座標仍一律取官方門牌點。

## 服務類型統計

<!-- A003:BEGIN by-service-type -->
| Service Type | ACTIVE Provider | 有已驗證座標 | 依指示採用的非官方座標 | 座標覆蓋率（含非官方） | 有服務範圍 | 行政區組合 | READY 組合 | 待補 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| HOME_CARE | 15 | 15 | 0 | 100% | 15 | 24 | 24 | — |
| HOME_MEDICAL_NURSING | 3 | 3 | 0 | 100% | 3 | 12 | 12 | — |
| ASSISTIVE_DEVICE | 12 | 11 | 1 | 100% | 12 | 41 | 41 | — |
<!-- A003:END by-service-type -->

## 服務範圍依據

<!-- A003:BEGIN service-area-basis -->
| Provider 類型 | 官方來源直接證實（本檔證據） | 官方來源（A-003-r1 人工核對 SRC-001，未列入本檔證據） | 依指示建立的平台設定（非官方證實） | 合計 |
| --- | --- | --- | --- | --- |
| HOME_CARE | 23 | 61 | 0 | 84 |
| HOME_MEDICAL_NURSING | 2 | 0 | 15 | 17 |
| ASSISTIVE_DEVICE | 0 | 0 | 415 | 415 |

- DEC-A003-01（415 筆；TP-AD-001、TP-AD-002、TP-AD-003、NTPC-AD-001、NTPC-AD-002、NTPC-AD-003、NTPC-AD-004、NTPC-AD-005、NTPC-AD-006、NTPC-AD-007、NTPC-AD-008、NTPC-AD-009）：ASSISTIVE_DEVICE 的 ProviderServiceArea 以特約簽約縣市的全部行政區建立：與臺北市簽約者納入臺北市 12 區，與新北市簽約者納入新北市 29 區，兩市都簽約者兩市都納入。
- DEC-A003-02（15 筆；TP-HMN-001、TP-HMN-003）：TP-HMN-001、TP-HMN-003 套用其醫院本體在 SRC-007 的服務區域：馬偕紀念醫院「全區」→ 臺北市 12 區；臺大北護分院「萬華區、大同區、中正區」。
<!-- A003:END service-area-basis -->

## 服務類型 × 行政區覆蓋率

候選定義：Provider `status=ACTIVE`、對應 `ProviderService.active=true`，且 `ProviderServiceArea.active=true` 含該行政區。服務範圍只看 ProviderServiceArea，不由地址推測。

狀態判定（D-13c）：`READY` 表示全部候選都有通過檢查的已驗證座標，而且同服務類型沒有服務範圍未知的 ACTIVE Provider（這類 Provider 可能是任一行政區的隱藏候選）。其餘組合必須使用 `DISTRICT_ROTATION`。

<!-- A003:BEGIN coverage -->
| Service Type | City | District | 候選數 | 有座標 | 覆蓋率 | 狀態 | 待補座標 | 依平台設定納入的候選 | 採非官方座標的候選 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| HOME_CARE | 新北市 | 三重區 | 3 | 3 | 100% | READY | — | — | — |
| HOME_CARE | 新北市 | 土城區 | 1 | 1 | 100% | READY | — | — | — |
| HOME_CARE | 新北市 | 中和區 | 3 | 3 | 100% | READY | — | — | — |
| HOME_CARE | 新北市 | 五股區 | 1 | 1 | 100% | READY | — | — | — |
| HOME_CARE | 新北市 | 永和區 | 2 | 2 | 100% | READY | — | — | — |
| HOME_CARE | 新北市 | 板橋區 | 3 | 3 | 100% | READY | — | — | — |
| HOME_CARE | 新北市 | 林口區 | 1 | 1 | 100% | READY | — | — | — |
| HOME_CARE | 新北市 | 泰山區 | 1 | 1 | 100% | READY | — | — | — |
| HOME_CARE | 新北市 | 新店區 | 1 | 1 | 100% | READY | — | — | — |
| HOME_CARE | 新北市 | 新莊區 | 3 | 3 | 100% | READY | — | — | — |
| HOME_CARE | 新北市 | 樹林區 | 2 | 2 | 100% | READY | — | — | — |
| HOME_CARE | 新北市 | 蘆洲區 | 2 | 2 | 100% | READY | — | — | — |
| HOME_CARE | 臺北市 | 士林區 | 3 | 3 | 100% | READY | — | — | — |
| HOME_CARE | 臺北市 | 大同區 | 10 | 10 | 100% | READY | — | — | — |
| HOME_CARE | 臺北市 | 大安區 | 4 | 4 | 100% | READY | — | — | — |
| HOME_CARE | 臺北市 | 中山區 | 7 | 7 | 100% | READY | — | — | — |
| HOME_CARE | 臺北市 | 中正區 | 9 | 9 | 100% | READY | — | — | — |
| HOME_CARE | 臺北市 | 內湖區 | 3 | 3 | 100% | READY | — | — | — |
| HOME_CARE | 臺北市 | 文山區 | 3 | 3 | 100% | READY | — | — | — |
| HOME_CARE | 臺北市 | 北投區 | 3 | 3 | 100% | READY | — | — | — |
| HOME_CARE | 臺北市 | 松山區 | 3 | 3 | 100% | READY | — | — | — |
| HOME_CARE | 臺北市 | 信義區 | 3 | 3 | 100% | READY | — | — | — |
| HOME_CARE | 臺北市 | 南港區 | 3 | 3 | 100% | READY | — | — | — |
| HOME_CARE | 臺北市 | 萬華區 | 10 | 10 | 100% | READY | — | — | — |
| HOME_MEDICAL_NURSING | 臺北市 | 士林區 | 2 | 2 | 100% | READY | — | TP-HMN-001 | — |
| HOME_MEDICAL_NURSING | 臺北市 | 大同區 | 2 | 2 | 100% | READY | — | TP-HMN-001、TP-HMN-003 | — |
| HOME_MEDICAL_NURSING | 臺北市 | 大安區 | 1 | 1 | 100% | READY | — | TP-HMN-001 | — |
| HOME_MEDICAL_NURSING | 臺北市 | 中山區 | 1 | 1 | 100% | READY | — | TP-HMN-001 | — |
| HOME_MEDICAL_NURSING | 臺北市 | 中正區 | 2 | 2 | 100% | READY | — | TP-HMN-001、TP-HMN-003 | — |
| HOME_MEDICAL_NURSING | 臺北市 | 內湖區 | 1 | 1 | 100% | READY | — | TP-HMN-001 | — |
| HOME_MEDICAL_NURSING | 臺北市 | 文山區 | 1 | 1 | 100% | READY | — | TP-HMN-001 | — |
| HOME_MEDICAL_NURSING | 臺北市 | 北投區 | 2 | 2 | 100% | READY | — | TP-HMN-001 | — |
| HOME_MEDICAL_NURSING | 臺北市 | 松山區 | 1 | 1 | 100% | READY | — | TP-HMN-001 | — |
| HOME_MEDICAL_NURSING | 臺北市 | 信義區 | 1 | 1 | 100% | READY | — | TP-HMN-001 | — |
| HOME_MEDICAL_NURSING | 臺北市 | 南港區 | 1 | 1 | 100% | READY | — | TP-HMN-001 | — |
| HOME_MEDICAL_NURSING | 臺北市 | 萬華區 | 2 | 2 | 100% | READY | — | TP-HMN-001、TP-HMN-003 | — |
| ASSISTIVE_DEVICE | 新北市 | 八里區 | 11 | 11 | 100% | READY | — | NTPC-AD-001、NTPC-AD-002、NTPC-AD-003、NTPC-AD-004、NTPC-AD-005、NTPC-AD-006、NTPC-AD-007、NTPC-AD-008、NTPC-AD-009、TP-AD-001、TP-AD-003 | NTPC-AD-004 |
| ASSISTIVE_DEVICE | 新北市 | 三芝區 | 11 | 11 | 100% | READY | — | NTPC-AD-001、NTPC-AD-002、NTPC-AD-003、NTPC-AD-004、NTPC-AD-005、NTPC-AD-006、NTPC-AD-007、NTPC-AD-008、NTPC-AD-009、TP-AD-001、TP-AD-003 | NTPC-AD-004 |
| ASSISTIVE_DEVICE | 新北市 | 三重區 | 11 | 11 | 100% | READY | — | NTPC-AD-001、NTPC-AD-002、NTPC-AD-003、NTPC-AD-004、NTPC-AD-005、NTPC-AD-006、NTPC-AD-007、NTPC-AD-008、NTPC-AD-009、TP-AD-001、TP-AD-003 | NTPC-AD-004 |
| ASSISTIVE_DEVICE | 新北市 | 三峽區 | 11 | 11 | 100% | READY | — | NTPC-AD-001、NTPC-AD-002、NTPC-AD-003、NTPC-AD-004、NTPC-AD-005、NTPC-AD-006、NTPC-AD-007、NTPC-AD-008、NTPC-AD-009、TP-AD-001、TP-AD-003 | NTPC-AD-004 |
| ASSISTIVE_DEVICE | 新北市 | 土城區 | 11 | 11 | 100% | READY | — | NTPC-AD-001、NTPC-AD-002、NTPC-AD-003、NTPC-AD-004、NTPC-AD-005、NTPC-AD-006、NTPC-AD-007、NTPC-AD-008、NTPC-AD-009、TP-AD-001、TP-AD-003 | NTPC-AD-004 |
| ASSISTIVE_DEVICE | 新北市 | 中和區 | 11 | 11 | 100% | READY | — | NTPC-AD-001、NTPC-AD-002、NTPC-AD-003、NTPC-AD-004、NTPC-AD-005、NTPC-AD-006、NTPC-AD-007、NTPC-AD-008、NTPC-AD-009、TP-AD-001、TP-AD-003 | NTPC-AD-004 |
| ASSISTIVE_DEVICE | 新北市 | 五股區 | 11 | 11 | 100% | READY | — | NTPC-AD-001、NTPC-AD-002、NTPC-AD-003、NTPC-AD-004、NTPC-AD-005、NTPC-AD-006、NTPC-AD-007、NTPC-AD-008、NTPC-AD-009、TP-AD-001、TP-AD-003 | NTPC-AD-004 |
| ASSISTIVE_DEVICE | 新北市 | 平溪區 | 11 | 11 | 100% | READY | — | NTPC-AD-001、NTPC-AD-002、NTPC-AD-003、NTPC-AD-004、NTPC-AD-005、NTPC-AD-006、NTPC-AD-007、NTPC-AD-008、NTPC-AD-009、TP-AD-001、TP-AD-003 | NTPC-AD-004 |
| ASSISTIVE_DEVICE | 新北市 | 永和區 | 11 | 11 | 100% | READY | — | NTPC-AD-001、NTPC-AD-002、NTPC-AD-003、NTPC-AD-004、NTPC-AD-005、NTPC-AD-006、NTPC-AD-007、NTPC-AD-008、NTPC-AD-009、TP-AD-001、TP-AD-003 | NTPC-AD-004 |
| ASSISTIVE_DEVICE | 新北市 | 石門區 | 11 | 11 | 100% | READY | — | NTPC-AD-001、NTPC-AD-002、NTPC-AD-003、NTPC-AD-004、NTPC-AD-005、NTPC-AD-006、NTPC-AD-007、NTPC-AD-008、NTPC-AD-009、TP-AD-001、TP-AD-003 | NTPC-AD-004 |
| ASSISTIVE_DEVICE | 新北市 | 石碇區 | 11 | 11 | 100% | READY | — | NTPC-AD-001、NTPC-AD-002、NTPC-AD-003、NTPC-AD-004、NTPC-AD-005、NTPC-AD-006、NTPC-AD-007、NTPC-AD-008、NTPC-AD-009、TP-AD-001、TP-AD-003 | NTPC-AD-004 |
| ASSISTIVE_DEVICE | 新北市 | 汐止區 | 11 | 11 | 100% | READY | — | NTPC-AD-001、NTPC-AD-002、NTPC-AD-003、NTPC-AD-004、NTPC-AD-005、NTPC-AD-006、NTPC-AD-007、NTPC-AD-008、NTPC-AD-009、TP-AD-001、TP-AD-003 | NTPC-AD-004 |
| ASSISTIVE_DEVICE | 新北市 | 坪林區 | 11 | 11 | 100% | READY | — | NTPC-AD-001、NTPC-AD-002、NTPC-AD-003、NTPC-AD-004、NTPC-AD-005、NTPC-AD-006、NTPC-AD-007、NTPC-AD-008、NTPC-AD-009、TP-AD-001、TP-AD-003 | NTPC-AD-004 |
| ASSISTIVE_DEVICE | 新北市 | 板橋區 | 11 | 11 | 100% | READY | — | NTPC-AD-001、NTPC-AD-002、NTPC-AD-003、NTPC-AD-004、NTPC-AD-005、NTPC-AD-006、NTPC-AD-007、NTPC-AD-008、NTPC-AD-009、TP-AD-001、TP-AD-003 | NTPC-AD-004 |
| ASSISTIVE_DEVICE | 新北市 | 林口區 | 11 | 11 | 100% | READY | — | NTPC-AD-001、NTPC-AD-002、NTPC-AD-003、NTPC-AD-004、NTPC-AD-005、NTPC-AD-006、NTPC-AD-007、NTPC-AD-008、NTPC-AD-009、TP-AD-001、TP-AD-003 | NTPC-AD-004 |
| ASSISTIVE_DEVICE | 新北市 | 金山區 | 11 | 11 | 100% | READY | — | NTPC-AD-001、NTPC-AD-002、NTPC-AD-003、NTPC-AD-004、NTPC-AD-005、NTPC-AD-006、NTPC-AD-007、NTPC-AD-008、NTPC-AD-009、TP-AD-001、TP-AD-003 | NTPC-AD-004 |
| ASSISTIVE_DEVICE | 新北市 | 泰山區 | 11 | 11 | 100% | READY | — | NTPC-AD-001、NTPC-AD-002、NTPC-AD-003、NTPC-AD-004、NTPC-AD-005、NTPC-AD-006、NTPC-AD-007、NTPC-AD-008、NTPC-AD-009、TP-AD-001、TP-AD-003 | NTPC-AD-004 |
| ASSISTIVE_DEVICE | 新北市 | 烏來區 | 11 | 11 | 100% | READY | — | NTPC-AD-001、NTPC-AD-002、NTPC-AD-003、NTPC-AD-004、NTPC-AD-005、NTPC-AD-006、NTPC-AD-007、NTPC-AD-008、NTPC-AD-009、TP-AD-001、TP-AD-003 | NTPC-AD-004 |
| ASSISTIVE_DEVICE | 新北市 | 貢寮區 | 11 | 11 | 100% | READY | — | NTPC-AD-001、NTPC-AD-002、NTPC-AD-003、NTPC-AD-004、NTPC-AD-005、NTPC-AD-006、NTPC-AD-007、NTPC-AD-008、NTPC-AD-009、TP-AD-001、TP-AD-003 | NTPC-AD-004 |
| ASSISTIVE_DEVICE | 新北市 | 淡水區 | 11 | 11 | 100% | READY | — | NTPC-AD-001、NTPC-AD-002、NTPC-AD-003、NTPC-AD-004、NTPC-AD-005、NTPC-AD-006、NTPC-AD-007、NTPC-AD-008、NTPC-AD-009、TP-AD-001、TP-AD-003 | NTPC-AD-004 |
| ASSISTIVE_DEVICE | 新北市 | 深坑區 | 11 | 11 | 100% | READY | — | NTPC-AD-001、NTPC-AD-002、NTPC-AD-003、NTPC-AD-004、NTPC-AD-005、NTPC-AD-006、NTPC-AD-007、NTPC-AD-008、NTPC-AD-009、TP-AD-001、TP-AD-003 | NTPC-AD-004 |
| ASSISTIVE_DEVICE | 新北市 | 新店區 | 11 | 11 | 100% | READY | — | NTPC-AD-001、NTPC-AD-002、NTPC-AD-003、NTPC-AD-004、NTPC-AD-005、NTPC-AD-006、NTPC-AD-007、NTPC-AD-008、NTPC-AD-009、TP-AD-001、TP-AD-003 | NTPC-AD-004 |
| ASSISTIVE_DEVICE | 新北市 | 新莊區 | 11 | 11 | 100% | READY | — | NTPC-AD-001、NTPC-AD-002、NTPC-AD-003、NTPC-AD-004、NTPC-AD-005、NTPC-AD-006、NTPC-AD-007、NTPC-AD-008、NTPC-AD-009、TP-AD-001、TP-AD-003 | NTPC-AD-004 |
| ASSISTIVE_DEVICE | 新北市 | 瑞芳區 | 11 | 11 | 100% | READY | — | NTPC-AD-001、NTPC-AD-002、NTPC-AD-003、NTPC-AD-004、NTPC-AD-005、NTPC-AD-006、NTPC-AD-007、NTPC-AD-008、NTPC-AD-009、TP-AD-001、TP-AD-003 | NTPC-AD-004 |
| ASSISTIVE_DEVICE | 新北市 | 萬里區 | 11 | 11 | 100% | READY | — | NTPC-AD-001、NTPC-AD-002、NTPC-AD-003、NTPC-AD-004、NTPC-AD-005、NTPC-AD-006、NTPC-AD-007、NTPC-AD-008、NTPC-AD-009、TP-AD-001、TP-AD-003 | NTPC-AD-004 |
| ASSISTIVE_DEVICE | 新北市 | 樹林區 | 11 | 11 | 100% | READY | — | NTPC-AD-001、NTPC-AD-002、NTPC-AD-003、NTPC-AD-004、NTPC-AD-005、NTPC-AD-006、NTPC-AD-007、NTPC-AD-008、NTPC-AD-009、TP-AD-001、TP-AD-003 | NTPC-AD-004 |
| ASSISTIVE_DEVICE | 新北市 | 雙溪區 | 11 | 11 | 100% | READY | — | NTPC-AD-001、NTPC-AD-002、NTPC-AD-003、NTPC-AD-004、NTPC-AD-005、NTPC-AD-006、NTPC-AD-007、NTPC-AD-008、NTPC-AD-009、TP-AD-001、TP-AD-003 | NTPC-AD-004 |
| ASSISTIVE_DEVICE | 新北市 | 蘆洲區 | 11 | 11 | 100% | READY | — | NTPC-AD-001、NTPC-AD-002、NTPC-AD-003、NTPC-AD-004、NTPC-AD-005、NTPC-AD-006、NTPC-AD-007、NTPC-AD-008、NTPC-AD-009、TP-AD-001、TP-AD-003 | NTPC-AD-004 |
| ASSISTIVE_DEVICE | 新北市 | 鶯歌區 | 11 | 11 | 100% | READY | — | NTPC-AD-001、NTPC-AD-002、NTPC-AD-003、NTPC-AD-004、NTPC-AD-005、NTPC-AD-006、NTPC-AD-007、NTPC-AD-008、NTPC-AD-009、TP-AD-001、TP-AD-003 | NTPC-AD-004 |
| ASSISTIVE_DEVICE | 臺北市 | 士林區 | 8 | 8 | 100% | READY | — | NTPC-AD-001、NTPC-AD-004、NTPC-AD-005、NTPC-AD-008、NTPC-AD-009、TP-AD-001、TP-AD-002、TP-AD-003 | NTPC-AD-004 |
| ASSISTIVE_DEVICE | 臺北市 | 大同區 | 8 | 8 | 100% | READY | — | NTPC-AD-001、NTPC-AD-004、NTPC-AD-005、NTPC-AD-008、NTPC-AD-009、TP-AD-001、TP-AD-002、TP-AD-003 | NTPC-AD-004 |
| ASSISTIVE_DEVICE | 臺北市 | 大安區 | 8 | 8 | 100% | READY | — | NTPC-AD-001、NTPC-AD-004、NTPC-AD-005、NTPC-AD-008、NTPC-AD-009、TP-AD-001、TP-AD-002、TP-AD-003 | NTPC-AD-004 |
| ASSISTIVE_DEVICE | 臺北市 | 中山區 | 8 | 8 | 100% | READY | — | NTPC-AD-001、NTPC-AD-004、NTPC-AD-005、NTPC-AD-008、NTPC-AD-009、TP-AD-001、TP-AD-002、TP-AD-003 | NTPC-AD-004 |
| ASSISTIVE_DEVICE | 臺北市 | 中正區 | 8 | 8 | 100% | READY | — | NTPC-AD-001、NTPC-AD-004、NTPC-AD-005、NTPC-AD-008、NTPC-AD-009、TP-AD-001、TP-AD-002、TP-AD-003 | NTPC-AD-004 |
| ASSISTIVE_DEVICE | 臺北市 | 內湖區 | 8 | 8 | 100% | READY | — | NTPC-AD-001、NTPC-AD-004、NTPC-AD-005、NTPC-AD-008、NTPC-AD-009、TP-AD-001、TP-AD-002、TP-AD-003 | NTPC-AD-004 |
| ASSISTIVE_DEVICE | 臺北市 | 文山區 | 8 | 8 | 100% | READY | — | NTPC-AD-001、NTPC-AD-004、NTPC-AD-005、NTPC-AD-008、NTPC-AD-009、TP-AD-001、TP-AD-002、TP-AD-003 | NTPC-AD-004 |
| ASSISTIVE_DEVICE | 臺北市 | 北投區 | 8 | 8 | 100% | READY | — | NTPC-AD-001、NTPC-AD-004、NTPC-AD-005、NTPC-AD-008、NTPC-AD-009、TP-AD-001、TP-AD-002、TP-AD-003 | NTPC-AD-004 |
| ASSISTIVE_DEVICE | 臺北市 | 松山區 | 8 | 8 | 100% | READY | — | NTPC-AD-001、NTPC-AD-004、NTPC-AD-005、NTPC-AD-008、NTPC-AD-009、TP-AD-001、TP-AD-002、TP-AD-003 | NTPC-AD-004 |
| ASSISTIVE_DEVICE | 臺北市 | 信義區 | 8 | 8 | 100% | READY | — | NTPC-AD-001、NTPC-AD-004、NTPC-AD-005、NTPC-AD-008、NTPC-AD-009、TP-AD-001、TP-AD-002、TP-AD-003 | NTPC-AD-004 |
| ASSISTIVE_DEVICE | 臺北市 | 南港區 | 8 | 8 | 100% | READY | — | NTPC-AD-001、NTPC-AD-004、NTPC-AD-005、NTPC-AD-008、NTPC-AD-009、TP-AD-001、TP-AD-002、TP-AD-003 | NTPC-AD-004 |
| ASSISTIVE_DEVICE | 臺北市 | 萬華區 | 8 | 8 | 100% | READY | — | NTPC-AD-001、NTPC-AD-004、NTPC-AD-005、NTPC-AD-008、NTPC-AD-009、TP-AD-001、TP-AD-002、TP-AD-003 | NTPC-AD-004 |
<!-- A003:END coverage -->

注意事項：

- READY 只代表**目前 Kareo 資料集（30 筆）**內的候選都有已驗證座標，不代表官方名單上所有服務單位。
- 候選數 1 的組合只能驗收單一候選的 `DISTANCE` 與 `distanceKm`；多家距離排序請用候選數 2 以上的組合。
- HOME_CARE 24 組的候選都來自官方服務範圍。
- HOME_MEDICAL_NURSING 12 組都含 TP-HMN-001（DEC-A003-02 平台設定），其中士林區、北投區的 TP-HMN-002 是官方證實。
- ASSISTIVE_DEVICE 41 組的服務範圍全部來自 DEC-A003-01 平台設定，而且都含 NTPC-AD-004 的非官方座標（DEC-A003-07），見「採非官方座標的候選」欄。

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
| TP-HMN-001 | 台灣基督長老教會馬偕醫療財團法人附設馬偕居家護理所 | HOME_MEDICAL_NURSING | 25.05988525 | 121.5222678 | VERIFIED | SRC-003 名稱／地址；SRC-COORD-TPE-001 `中山北路二段９６巷９號`（EPSG:3826 → WGS84） | 2026-09-29 | 12 | — |
| TP-HMN-002 | 臺北市立聯合醫院附設陽明居家護理所 | HOME_MEDICAL_NURSING | 25.10519407 | 121.53156558 | VERIFIED | SRC-003 名稱／地址；SRC-COORD-TPE-001 `雨聲街１０５號`（EPSG:3826 → WGS84） | 2026-09-29 | 2 | — |
| TP-HMN-003 | 國立臺灣大學醫學院附設醫院北護分院附設居家護理所 | HOME_MEDICAL_NURSING | 25.04222858 | 121.50255105 | VERIFIED | SRC-003 名稱／地址；SRC-COORD-TPE-001 `康定路３７號`（EPSG:3826 → WGS84） | 2026-09-29 | 3 | — |
| TP-AD-001 | 晨玉有限公司 | ASSISTIVE_DEVICE | 25.0518338 | 121.53419877 | VERIFIED | SRC-004 名稱／地址；SRC-COORD-TPE-001 `南京東路二段１５０號`（EPSG:3826 → WGS84） | 2026-09-29 | 41 | — |
| TP-AD-002 | 諾貝兒寶貝股份有限公司內湖分公司 | ASSISTIVE_DEVICE | 25.0681963 | 121.59264905 | VERIFIED | SRC-004＋SRC-GMAPS-001 名稱／地址；SRC-COORD-TPE-001 `民權東路六段１８０巷６號地下一層`（EPSG:3826 → WGS84） | 2026-09-29 | 12 | — |
| TP-AD-003 | 可能設計有限公司 | ASSISTIVE_DEVICE | 25.00427674 | 121.54125347 | VERIFIED | SRC-004 名稱／地址；SRC-COORD-TPE-001 `興隆路一段５５巷２７弄１之５號`（EPSG:3826 → WGS84） | 2026-09-29 | 41 | — |
| NTPC-AD-001 | 弘采介護有限公司 | ASSISTIVE_DEVICE | 24.98385487 | 121.53356671 | VERIFIED | SRC-005 名稱／地址；SRC-COORD-NTPC-001 `中正路５０１之６號`（EPSG:3826 → WGS84） | 2026-09-29 | 41 | — |
| NTPC-AD-002 | 大瀚醫療儀器有限公司 | ASSISTIVE_DEVICE | 25.0030857 | 121.46068223 | VERIFIED | SRC-005 名稱／地址；SRC-COORD-NTPC-001 `校前街２８號`（EPSG:3826 → WGS84） | 2026-09-29 | 29 | — |
| NTPC-AD-003 | 宏宇醫療器材行 | ASSISTIVE_DEVICE | 24.99666299 | 121.45189673 | VERIFIED | SRC-005 名稱／地址；SRC-COORD-NTPC-001 `南雅南路二段１３４號`（EPSG:3826 → WGS84） | 2026-09-29 | 29 | — |
| NTPC-AD-004 | 吉評醫療器材股份有限公司 | ASSISTIVE_DEVICE | 24.9619599 | 121.5177834 | UNOFFICIAL | SRC-GMAPS-001 地圖標記（非官方門牌點，依 DEC-A003-07） | 2026-09-29 | 41 | — |
| NTPC-AD-005 | 學府松藥局 | ASSISTIVE_DEVICE | 24.98854427 | 121.45802719 | VERIFIED | SRC-005 名稱／地址；SRC-COORD-NTPC-001 `學府路一段３８號`（EPSG:3826 → WGS84） | 2026-09-29 | 41 | — |
| NTPC-AD-006 | 兆謙益企業有限公司 | ASSISTIVE_DEVICE | 25.07237267 | 121.35861123 | VERIFIED | SRC-005 名稱／地址；SRC-COORD-NTPC-001 `源泉街１２號`（EPSG:3826 → WGS84） | 2026-09-29 | 29 | — |
| NTPC-AD-007 | 瑞康醫療器材有限公司 | ASSISTIVE_DEVICE | 24.99206804 | 121.49471705 | VERIFIED | SRC-005 名稱／地址；SRC-COORD-NTPC-001 `圓通路２９５之１號`（EPSG:3826 → WGS84） | 2026-09-29 | 29 | — |
| NTPC-AD-008 | 鴻銘醫療儀器行 | ASSISTIVE_DEVICE | 25.13823097 | 121.46201283 | VERIFIED | SRC-005 名稱／地址；SRC-COORD-NTPC-001 `民生路４７之２號`（EPSG:3826 → WGS84） | 2026-09-29 | 41 | — |
| NTPC-AD-009 | 美德耐股份有限公司雙和門市部 | ASSISTIVE_DEVICE | 24.9937458 | 121.49408179 | VERIFIED | SRC-005 名稱／地址；SRC-COORD-NTPC-001 `中正路２９１號`（EPSG:3826 → WGS84） | 2026-09-29 | 41 | — |
<!-- A003:END providers -->

## 驗收狀態

### 本次完成（A-003-r12）

- 完成 A 工程師暫時接管的交接整理：本版只補充 QA 報告的分類、影響與決策清單；**未變更** Provider、座標、服務範圍或機器可讀證據資料。
- r11 已完成：NTPC-AD-004 地址依 DEC-A003-06 更新；座標依 DEC-A003-07 採用 Google Maps 商家標記並標為非官方。檢查程式已有非官方座標規則與統計，並新增測試。

### 交接整理：服務範圍與座標採用

| 分類 | 涉及 Provider／資料 | 來源與查核日 | 限制與推薦影響 |
| --- | --- | --- | --- |
| 官方查證座標 | 除 NTPC-AD-004 外的 29 家 Provider | 官方名冊身分核對＋臺北／新北官方門牌點；2026-09-29；完整列於 `a-003-evidence.json.coordinates` | 可作為資料層級距離排序前置。HOME_CARE 的 24 個組合同時使用官方服務範圍，可供 B-005／J-003 選作真實資料 smoke。 |
| 平台設定服務範圍 | DEC-A003-01：TP-AD-001～003、NTPC-AD-001～009，共 415 筆 | SRC-004 臺北特約門市名單、SRC-005 新北特約廠商名單；2026-09-29 | 官方只證實簽約，不直接證實各行政區服務能力。輔具 41 組候選因此可列入，但在 Jerry 確認前不可作正式推薦／DISTANCE 驗收依據。 |
| 平台設定服務範圍 | DEC-A003-02：TP-HMN-001（臺北 12 區）、TP-HMN-003（萬華／大同／中正），共 15 筆 | SRC-007 醫院本體服務區域；2026-09-29 | 官方來源列的是醫院本體，非附設居家護理所。居家護理 12 組僅可作資料或開發測試，不能作正式 DISTANCE 驗收。 |
| 非官方地圖座標 | DEC-A003-07：NTPC-AD-004 吉評醫療器材股份有限公司，(24.9619599, 121.5177834) | SRC-GMAPS-001 商家頁的名稱、地址、電話比對；2026-09-29 | 非官方門牌點，不計入 29 筆 VERIFIED。它是全部 41 組輔具候選之一；若不採用，這 41 組必須依 D-13c 改用 `DISTRICT_ROTATION`。 |
| 資料更正／歷史項 | DEC-A003-03（TP-AD-002 門牌）、05（NTPC-HC-003 電話）、06（NTPC-AD-004 地址） | 原指示＋SRC-GMAPS-001／官方名冊；2026-09-29 | 屬欄位更正，未以 Google Maps 取代官方門牌座標。DEC-A003-04 已被 06／07 取代，無待決動作。 |

### 待 Jerry 決策（精簡）

- **DEC-A003-01：** 是否確認「輔具依簽約縣市全區」為平台設定？建議保留目前資料，但文件與驗收持續標為 `PLATFORM_SETTING`；若否決，移除 415 筆推定範圍，輔具不可宣稱行政區可服務。
- **DEC-A003-02：** 是否確認可把醫院本體服務區域套用至 TP-HMN-001／003？建議保留目前資料但不作官方事實；若否決，移除 15 筆推定範圍，居家護理僅保留直接可證實的範圍。
- **DEC-A003-07：** 是否接受 NTPC-AD-004 的 Google Maps 商家標記作「非官方座標」例外？建議僅在明確標示來源、精度限制與不可作正式驗收的條件下接受；若否決，將該 Provider 的 lat/lng 回復 `null`，所有依賴它的輔具組合依 D-13c 使用 `DISTRICT_ROTATION`。
- **不另重複請求的既有決定：** D-13c 已於 2026-09-24 列為 `SPEC-APPROVED`；任何候選缺已驗證座標時，整批改用 `DISTRICT_ROTATION`。DEC-A003-03／05／06 是資料更正，供本 PR review 一併核對即可。

### 先前版次（r9）

- 核對 DEC-A003-01～05 的來源（r9）：在原始工作階段找到使用者明確指示的原文，改正 r8「專案負責人」的未經證實推定，補上摘錄與範圍核對。
- 服務範圍分開標示官方證實與平台設定，報告與覆蓋率表自動產生。
- r8 的資料內容（座標 29／30、服務範圍 516 筆）未變更。

### 仍待處理

- NTPC-AD-004：目前使用非官方座標（DEC-A003-07）。官方門牌資料收錄「安康路一段359之25號」後，應改用官方門牌點並移除非官方座標。
- DEC-A003-01～07 的指示者身分需由 Jerry 在 PR review 確認。

### 可進行的驗收（資料層級，非正式 E2E／部署驗收）

- HOME_CARE 24 組（臺北、新北）：候選全部依官方服務範圍，且座標完整，B-005／J-003 可用來驗收 `rankingType=DISTANCE` 與數值 `distanceKm`。
- D-13c：精確位置但候選缺座標時應改 `DISTRICT_ROTATION`；目前資料已沒有缺座標的候選，需用測試資料驗收。
- 行政區輪替與服務範圍篩選（A-005 AC-005、AC-006、AC-010）。

### 尚不可作為正式驗收依據

- HOME_MEDICAL_NURSING 12 組 DISTANCE：資料上 READY，但候選依賴 DEC-A003-02 平台設定。在 Jerry 確認前，只可做資料或開發測試。
- 輔具推薦與 DISTANCE：服務範圍全部是 DEC-A003-01 平台設定，且 41 組都依賴 NTPC-AD-004 的非官方座標（DEC-A003-07），需 Jerry 確認。
- 正式 E2E、部署與 release gate：仍由 J-003／Jerry 執行，本 PR 未做。

## 可重現檢查

```bash
node data/providers/qa/validate-providers.mjs
node data/providers/qa/verify-coordinates.mjs
node --test 'data/providers/qa/tests/*.test.mjs'
```

本 PR 未部署、未合併，未修改 `/data/providers/**` 以外檔案，未使用付費 geocoding 服務。
