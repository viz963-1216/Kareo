# A-006｜服務範圍待確認資源盤點（r2 參考）

Submission Version：A-006-r2
更新日期：2026-10-02
依據：GitHub Issue #49、A-003-r13 的 `a-003-evidence.json` 與 `pending-verification.md`

## 判定規則

- **可查詢收錄**：有雙北相關資源、簽約或服務關聯的可追溯證據；不要求已確認服務行政區。
- **可推薦候選**：必須已有可追溯的實際服務行政區；範圍未知時不得推薦為符合使用者所在地。
- 本文件只保留 14 家 `UNCONFIRMED` 的人工閱讀索引；r2 的機器可讀特約縣市、完整收錄狀態與推薦覆蓋以 `staging/provider-contract-regions.json`、`qa/lookup-listing-report.md`、`qa/recommendation-coverage-report.md` 為準。

## 14 家受影響資源

| Provider ID | 正式名稱 | 服務類型 | 收錄狀態 | 可推薦候選 | 已確認事實／來源 | serviceAreaStatus |
| --- | --- | --- | --- | --- | --- | --- |
| NTPC-AD-001 | 弘采介護有限公司 | ASSISTIVE_DEVICE | LISTED_AREA_UNCONFIRMED | 否 | 雙北特約／簽約關聯；SRC-004／SRC-005 | UNCONFIRMED |
| NTPC-AD-002 | 大瀚醫療儀器有限公司 | ASSISTIVE_DEVICE | LISTED_AREA_UNCONFIRMED | 否 | 新北特約／簽約關聯；SRC-005 | UNCONFIRMED |
| NTPC-AD-003 | 宏宇醫療器材行 | ASSISTIVE_DEVICE | LISTED_AREA_UNCONFIRMED | 否 | 新北特約／簽約關聯；SRC-005 | UNCONFIRMED |
| NTPC-AD-004 | 吉評醫療器材股份有限公司 | ASSISTIVE_DEVICE | LISTED_AREA_UNCONFIRMED | 否 | 雙北特約／簽約關聯；SRC-004／SRC-005；吉評座標依 DEC-A003-07 為 UNOFFICIAL | UNCONFIRMED |
| NTPC-AD-005 | 學府松藥局 | ASSISTIVE_DEVICE | LISTED_AREA_UNCONFIRMED | 否 | 雙北特約／簽約關聯；SRC-004／SRC-005 | UNCONFIRMED |
| NTPC-AD-006 | 兆謙益企業有限公司 | ASSISTIVE_DEVICE | LISTED_AREA_UNCONFIRMED | 否 | 新北特約／簽約關聯；SRC-005 | UNCONFIRMED |
| NTPC-AD-007 | 瑞康醫療器材有限公司 | ASSISTIVE_DEVICE | LISTED_AREA_UNCONFIRMED | 否 | 新北特約／簽約關聯；SRC-005 | UNCONFIRMED |
| NTPC-AD-008 | 鴻銘醫療儀器行 | ASSISTIVE_DEVICE | LISTED_AREA_UNCONFIRMED | 否 | 雙北特約／簽約關聯；SRC-004／SRC-005 | UNCONFIRMED |
| NTPC-AD-009 | 美德耐股份有限公司雙和門市部 | ASSISTIVE_DEVICE | LISTED_AREA_UNCONFIRMED | 否 | 雙北特約／簽約關聯；SRC-004／SRC-005 | UNCONFIRMED |
| TP-AD-001 | 晨玉有限公司 | ASSISTIVE_DEVICE | LISTED_AREA_UNCONFIRMED | 否 | 雙北特約／簽約關聯；SRC-004／SRC-005 | UNCONFIRMED |
| TP-AD-002 | 諾貝兒寶貝股份有限公司內湖分公司 | ASSISTIVE_DEVICE | LISTED_AREA_UNCONFIRMED | 否 | 臺北特約／簽約關聯；SRC-004 | UNCONFIRMED |
| TP-AD-003 | 可能設計有限公司 | ASSISTIVE_DEVICE | LISTED_AREA_UNCONFIRMED | 否 | 雙北特約／簽約關聯；SRC-004／SRC-005 | UNCONFIRMED |
| TP-HMN-001 | 台灣基督長老教會馬偕醫療財團法人附設馬偕居家護理所 | HOME_MEDICAL_NURSING | LISTED_AREA_UNCONFIRMED | 否 | 居家護理服務已由 SRC-008／SRC-009 佐證 | UNCONFIRMED |
| TP-HMN-003 | 國立臺灣大學醫學院附設醫院北護分院附設居家護理所 | HOME_MEDICAL_NURSING | LISTED_AREA_UNCONFIRMED | 否 | 居家護理服務已由 SRC-008／SRC-010 佐證 | UNCONFIRMED |

## 限制與後續

- 地址、電話、官網與 Maps 入口仍以 `data/providers/staging/providers.json` 為準，後續須逐筆核對並寫入 A-006 對照資料。
- 未找到逐行政區服務證據前，不新增 active `ProviderServiceArea`。
- 不得將「雙北特約／簽約」改寫成「雙北每一行政區都可服務」。
- 不得以醫院本體服務區域推定附設居家護理所的服務行政區。
