# A-003-r6 Provider Coordinate Verification Report

Submission Version: A-003-r6（取代 r5 報告）

Report date: 2026-09-29
Dataset: `data/providers/staging/providers.json`、`provider-services.json`、`provider-service-areas.json`
Evidence: `data/providers/qa/a-003-evidence.json`（機器可讀；座標、服務範圍與待補清單的唯一依據）

> 標示 `A003:BEGIN／END` 的區塊由 `node data/providers/qa/verify-coordinates.mjs --write` 從資料與證據重算產生，請勿手改；
> `node data/providers/qa/verify-coordinates.mjs` 會在區塊內容與資料不一致時失敗。

## 階段結論

- **本 PR 是 A-003-r2 座標工作的階段成果，不是 A-003 全部完成。** 仍有 Provider 缺座標或服務範圍，詳見 `qa/pending-verification.md`。
- 「lat/lng 非 null」不等於「已驗證」：只有 `a-003-evidence.json` 內有完整證據鏈的座標才計入已驗證，檢查程式同時拒絕任何缺證據的非 null 座標。

## r5 → r6 更正

| 項目 | r5 內容 | r6 更正 | 依據 |
| --- | --- | --- | --- |
| NTPC-HC-003 服務範圍 | 無 ProviderServiceArea；三重區、新莊區被標為 2／2 READY | 新增 新莊區、三重區、林口區 3 筆（官方名單「可提供服務區域」） | SRC-002 1150924 名單序號 291 |
| 三重區／新莊區 READY | 候選集合漏掉 NTPC-HC-003，READY 判定不成立 | 重新計算（見下方覆蓋率） | 同上 |
| 名冊 11506 的 Source ID | 誤用 `SRC-003`（registry 中為臺北市居家護理所名單） | 改登記為 `SRC-006` | `sources/source-registry.md` |
| 座標證據 | 寫在 `verify-coordinates.mjs` 內，只有 2 筆 | 移至 `qa/a-003-evidence.json`，共 13 筆；報告統計改由程式產生並檢查 | 本報告 |
| 新北市其餘 HOME_CARE 服務範圍 | `geocoding-service-area-report.md` 標為 PENDING | 5 家 NTPC-HC 共 23 筆與官方名單逐筆一致 | SRC-002 1150924 名單 |

## 摘要

<!-- A003:BEGIN summary -->
- Provider 總數：30
- ProviderServiceArea 筆數：84
- lat/lng 非 null：13
- 有完整驗證證據的座標：13（名稱／地址核對＋官方門牌點＋可重現轉換，見 `qa/a-003-evidence.json`）
- 非 null 但缺證據：0
- 尚待驗證座標：17
- 缺 ProviderServiceArea 的 ACTIVE Provider：15
- 服務類型 × 行政區組合：24；DISTANCE READY：12（HOME_CARE × 新北市三重區、HOME_CARE × 新北市土城區、HOME_CARE × 新北市中和區、HOME_CARE × 新北市五股區、HOME_CARE × 新北市永和區、HOME_CARE × 新北市板橋區、HOME_CARE × 新北市林口區、HOME_CARE × 新北市泰山區、HOME_CARE × 新北市新店區、HOME_CARE × 新北市新莊區、HOME_CARE × 新北市樹林區、HOME_CARE × 新北市蘆洲區）
<!-- A003:END summary -->

## 座標驗證方法（可重現）

1. **機構身分**：以官方名單核對 Provider 名稱與正式地址（HOME_CARE：SRC-002「114~116年新北市長照特約單位名單1150924」；NTPC-HC-004 另核對 SRC-006 名冊 11506；輔具：SRC-005 repo 內 `raw/(雲端)輔具服務特約廠商一覽表.xlsx`「114~116特約廠商總表」）。名單地址多出「里／鄰」或 `台／臺` 差異不影響門牌。
2. **門牌點**：在新北市政府民政局「新北市門牌位置數值資料 11509」（SRC-COORD-NTPC-001，CSV sha256 `72007bb7…f80ccf034`）找出與正式地址**同行政區代碼、同街路段、同巷弄、同號**的紀錄；原始 CSV 列完整記錄在證據檔。地址中的 `501-6號` 對應門牌資料的 `５０１之６號`（`-` 即「之」）。同一建物各樓層共用同一門牌點（例：長元街 100之2號 3 樓至 17 樓座標相同），所以樓層不影響座標。
3. **座標轉換**：來源欄位 `x_3826`／`y_3826` 為 EPSG:3826（TWD97 / TM2 121）。以 PROJ 9.8.1（pyproj 3.8.0）轉為 EPSG:4326（WGS84），四捨五入到小數 8 位；`verify-coordinates.mjs` 以 GRS80 逆橫麥卡托公式獨立重算，誤差須小於 1e-7°（約 1 公分）。
4. **不使用**：Google Maps 搜尋結果或地圖中心、行政區中心、鄰近門牌、推估座標。找不到完全相符門牌的 Provider 保持 `null`（例：NTPC-AD-004）。
5. **臺北市**：臺北市政府民政局「臺北市門牌位置數值資料」（SRC-COORD-TPE-001）可找到 14／16 筆臺北 Provider 的相符門牌紀錄，但 data.taipei 與 data.gov.tw 的詮釋資料都**未載明座標系統**。不得假設座標系統後轉換，所以臺北市座標全部保持 `null`；已找到的原始紀錄列在待補清單，方便確認座標系統後直接處理。

## 服務類型統計

<!-- A003:BEGIN by-service-type -->
| Service Type | ACTIVE Provider | 有已驗證座標 | 座標覆蓋率 | 有服務範圍 | 行政區組合 | READY 組合 | 待補 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| HOME_CARE | 15 | 5 | 33% | 15 | 24 | 12 | — |
| HOME_MEDICAL_NURSING | 3 | 0 | 0% | 0 | 0 | 0 | 服務範圍未知：TP-HMN-001、TP-HMN-002、TP-HMN-003；不得由地址推測，也因此沒有可推薦組合 |
| ASSISTIVE_DEVICE | 12 | 8 | 67% | 0 | 0 | 0 | 服務範圍未知：TP-AD-001、TP-AD-002、TP-AD-003、NTPC-AD-001、NTPC-AD-002、NTPC-AD-003、NTPC-AD-004、NTPC-AD-005、NTPC-AD-006、NTPC-AD-007、NTPC-AD-008、NTPC-AD-009；不得由地址推測，也因此沒有可推薦組合 |
<!-- A003:END by-service-type -->

## 服務類型 × 行政區覆蓋率

候選定義：Provider `status=ACTIVE`、對應 `ProviderService.active=true`，且 `ProviderServiceArea.active=true` 含該行政區。服務範圍只看 ProviderServiceArea，不由地址推測。

狀態判定（D-13c）：`READY` 表示全部候選都有已驗證座標，且同服務類型沒有服務範圍未知的 ACTIVE Provider（未知者可能是任一行政區的隱藏候選）。其餘組合必須使用 `DISTRICT_ROTATION`。

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
| HOME_CARE | 臺北市 | 士林區 | 3 | 0 | 0% | BLOCKED（缺座標） | TP-HC-004、TP-HC-009、TP-HC-010 |
| HOME_CARE | 臺北市 | 大同區 | 10 | 0 | 0% | BLOCKED（缺座標） | TP-HC-001、TP-HC-002、TP-HC-003、TP-HC-004、TP-HC-005、TP-HC-006、TP-HC-007、TP-HC-008、TP-HC-009、TP-HC-010 |
| HOME_CARE | 臺北市 | 大安區 | 4 | 0 | 0% | BLOCKED（缺座標） | TP-HC-003、TP-HC-004、TP-HC-009、TP-HC-010 |
| HOME_CARE | 臺北市 | 中山區 | 7 | 0 | 0% | BLOCKED（缺座標） | TP-HC-001、TP-HC-003、TP-HC-004、TP-HC-005、TP-HC-008、TP-HC-009、TP-HC-010 |
| HOME_CARE | 臺北市 | 中正區 | 9 | 0 | 0% | BLOCKED（缺座標） | TP-HC-001、TP-HC-002、TP-HC-003、TP-HC-004、TP-HC-005、TP-HC-006、TP-HC-007、TP-HC-008、TP-HC-010 |
| HOME_CARE | 臺北市 | 內湖區 | 3 | 0 | 0% | BLOCKED（缺座標） | TP-HC-004、TP-HC-009、TP-HC-010 |
| HOME_CARE | 臺北市 | 文山區 | 3 | 0 | 0% | BLOCKED（缺座標） | TP-HC-004、TP-HC-006、TP-HC-010 |
| HOME_CARE | 臺北市 | 北投區 | 3 | 0 | 0% | BLOCKED（缺座標） | TP-HC-004、TP-HC-009、TP-HC-010 |
| HOME_CARE | 臺北市 | 松山區 | 3 | 0 | 0% | BLOCKED（缺座標） | TP-HC-004、TP-HC-009、TP-HC-010 |
| HOME_CARE | 臺北市 | 信義區 | 3 | 0 | 0% | BLOCKED（缺座標） | TP-HC-004、TP-HC-009、TP-HC-010 |
| HOME_CARE | 臺北市 | 南港區 | 3 | 0 | 0% | BLOCKED（缺座標） | TP-HC-004、TP-HC-009、TP-HC-010 |
| HOME_CARE | 臺北市 | 萬華區 | 10 | 0 | 0% | BLOCKED（缺座標） | TP-HC-001、TP-HC-002、TP-HC-003、TP-HC-004、TP-HC-005、TP-HC-006、TP-HC-007、TP-HC-008、TP-HC-009、TP-HC-010 |
<!-- A003:END coverage -->

注意：READY 只代表**目前 Kareo 資料集（30 筆）**內的候選都有已驗證座標，不代表官方名單上所有服務單位。候選數 1 的組合只能驗收單一候選的 `DISTANCE` 與 `distanceKm`；多家距離排序請用候選數 2–3 的組合（三重、中和、板橋、新莊：3 家；永和、樹林、蘆洲：2 家）。

`HOME_MEDICAL_NURSING` 與 `ASSISTIVE_DEVICE` 沒有任何 ProviderServiceArea，所以沒有候選組合，也不能做 DISTANCE 驗收（不是覆蓋率 0% 的 READY）。

## 逐筆對照

<!-- A003:BEGIN providers -->
| Provider ID | 名稱 | 類型 | lat | lng | 座標狀態 | 座標證據 | 查核日 | 服務範圍筆數 | 待補 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TP-HC-001 | 財團法人天主教失智老人社會福利基金會附設臺北市私立聖若瑟居家式服務類長期照顧服務機構 | HOME_CARE | null | null | PENDING | — | — | 4 | 座標 |
| TP-HC-002 | 財團法人台北市立心慈善基金會附設臺北市私立立心居家式服務類長期照顧服務機構 | HOME_CARE | null | null | PENDING | — | — | 3 | 座標 |
| TP-HC-003 | 臺北市私立寬安居家長照機構 | HOME_CARE | null | null | PENDING | — | — | 5 | 座標 |
| TP-HC-004 | 財團法人中華民國佛教慈濟慈善事業基金會臺北市私立慈濟居家長照機構 | HOME_CARE | null | null | PENDING | — | — | 12 | 座標 |
| TP-HC-005 | 中華民國紅十字會附設私立博愛居家長照機構 | HOME_CARE | null | null | PENDING | — | — | 4 | 座標 |
| TP-HC-006 | 臺北市私立大心居家長照機構 | HOME_CARE | null | null | PENDING | — | — | 4 | 座標 |
| TP-HC-007 | 有限責任臺北市全國照服員勞動合作社附設臺北市私立全方位居家長照機構 | HOME_CARE | null | null | PENDING | — | — | 3 | 座標 |
| TP-HC-008 | 臺北市私立璞馨居家長照機構 | HOME_CARE | null | null | PENDING | — | — | 4 | 座標 |
| TP-HC-009 | 紙飛機服務科技股份有限公司附設臺北市私立紙飛機居家長照機構 | HOME_CARE | null | null | PENDING | — | — | 10 | 座標 |
| TP-HC-010 | 私立愛吾愛居家長照機構 | HOME_CARE | null | null | PENDING | — | — | 12 | 座標 |
| NTPC-HC-001 | 萓品管理顧問有限公司附設新北市私立禾善居家長照機構 | HOME_CARE | 24.98165119 | 121.42139256 | VERIFIED | SRC-002 名稱／地址；SRC-COORD-NTPC-001 `仁愛街３號`（EPSG:3826 → WGS84） | 2026-09-29 | 1 | — |
| NTPC-HC-002 | 社團法人中華長照協會附設新北市私立永樂居家式服務類長期照顧服務機構 | HOME_CARE | 25.01625499 | 121.51041539 | VERIFIED | SRC-002 名稱／地址；SRC-COORD-NTPC-001 `文化路１５５號`（EPSG:3826 → WGS84） | 2026-09-29 | 3 | — |
| NTPC-HC-003 | 台灣全齡長照股份有限公司附設新北市私立禾薪居家長照機構 | HOME_CARE | 25.03758368 | 121.45887535 | VERIFIED | SRC-002 名稱／地址；SRC-COORD-NTPC-001 `新莊路１６之２號`（EPSG:3826 → WGS84） | 2026-09-29 | 3 | — |
| NTPC-HC-004 | 新北市私立旺福居家長照機構 | HOME_CARE | 25.07852424 | 121.49241746 | VERIFIED | SRC-002＋SRC-006 名稱／地址；SRC-COORD-NTPC-001 `福隆路４８號`（EPSG:3826 → WGS84） | 2026-09-29 | 5 | — |
| NTPC-HC-005 | 新北市私立全曜居家式服務類長期照顧服務機構 | HOME_CARE | 25.06674961 | 121.50306191 | VERIFIED | SRC-002 名稱／地址；SRC-COORD-NTPC-001 `長元街１００之２號`（EPSG:3826 → WGS84） | 2026-09-29 | 11 | — |
| TP-HMN-001 | 台灣基督長老教會馬偕醫療財團法人附設馬偕居家護理所 | HOME_MEDICAL_NURSING | null | null | PENDING | — | — | 0 | 座標、服務範圍 |
| TP-HMN-002 | 臺北市立聯合醫院附設陽明居家護理所 | HOME_MEDICAL_NURSING | null | null | PENDING | — | — | 0 | 座標、服務範圍 |
| TP-HMN-003 | 國立臺灣大學醫學院附設醫院北護分院附設居家護理所 | HOME_MEDICAL_NURSING | null | null | PENDING | — | — | 0 | 座標、服務範圍 |
| TP-AD-001 | 晨玉有限公司 | ASSISTIVE_DEVICE | null | null | PENDING | — | — | 0 | 座標、服務範圍 |
| TP-AD-002 | 諾貝兒寶貝股份有限公司內湖分公司 | ASSISTIVE_DEVICE | null | null | PENDING | — | — | 0 | 座標、服務範圍 |
| TP-AD-003 | 可能設計有限公司 | ASSISTIVE_DEVICE | null | null | PENDING | — | — | 0 | 座標、服務範圍 |
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

### 本次完成（A-003-r6）

- 新增 11 筆有完整證據的新北市座標（NTPC-HC-001～003、NTPC-AD-001～003、005～009），並重新核對 r4／r5 的 NTPC-HC-004、NTPC-HC-005；已驗證座標共 13 筆。
- 依官方名單補上 NTPC-HC-003 的 3 筆服務範圍，並逐筆核對 5 家 NTPC-HC 共 23 筆服務範圍。
- 更正 r5 的 READY 誤判與 Source ID 誤用。
- 證據改為機器可讀；統計、覆蓋率與待補清單改由程式產生並檢查一致性，另加測試。

### 仍待查證

- 臺北市 16 筆 Provider 的座標（來源座標系統未載明）。
- NTPC-AD-004 座標（官方門牌資料無相符門牌）。
- 15 家 HOME_MEDICAL_NURSING／ASSISTIVE_DEVICE Provider 的服務範圍（來源沒有逐機構服務行政區）。
- 逐筆原因與下一步見 `qa/pending-verification.md`。

### 可進行的驗收

- B-005／J-003 可在 GPS／EXACT 情境，用上方 READY 組合驗收 `rankingType=DISTANCE` 與數值 `distanceKm`。
- 可用 BLOCKED 組合驗收 D-13c：精確位置但候選缺座標時改 `DISTRICT_ROTATION`，`distanceKm=null`。
- 行政區輪替、服務範圍篩選（A-005 AC-005／AC-006／AC-010）。

### 尚不可進行的驗收

- 臺北市任何 DISTANCE 排序（全部候選缺座標）。
- HOME_MEDICAL_NURSING、ASSISTIVE_DEVICE 的任何推薦驗收（沒有服務範圍，也就沒有候選）。
- TASK-A-003 r2 AC「每筆非 null 座標都有來源、驗證方式與日期」已由檢查程式強制；但「覆蓋率報告完整」只代表**已有資料**的覆蓋率完整，不代表 30 筆都有座標。

## 可重現檢查

```bash
node data/providers/qa/validate-providers.mjs
node data/providers/qa/verify-coordinates.mjs
node --test 'data/providers/qa/tests/*.test.mjs'
```

本 PR 未部署、未合併，未修改 `/data/providers/**` 以外檔案，未使用付費 geocoding 服務。
