# A-006｜可推薦覆蓋報告

Submission Version: A-006-r2
產生方式：`node data/providers/qa/verify-resource-query-data.mjs --write`

僅統計已有可追溯證據的 active `ProviderServiceArea`。此報告不把 Provider 地址、特約縣市或母機構範圍當作服務範圍。

<!-- A006:BEGIN coverage -->
- active ProviderServiceArea：86
- 可推薦組合（服務類型 × 行政區）：26
- 本表只根據 active ProviderServiceArea 計算；特約縣市不參與推薦候選或覆蓋率。

| Service Type | City | District | 可推薦候選數 | Provider IDs | 同服務類型的 UNCONFIRMED Provider |
| --- | --- | --- | --- | --- |
| HOME_CARE | 新北市 | 三重區 | 3 | NTPC-HC-003、NTPC-HC-004、NTPC-HC-005 | — |
| HOME_CARE | 新北市 | 土城區 | 1 | NTPC-HC-005 | — |
| HOME_CARE | 新北市 | 中和區 | 3 | NTPC-HC-002、NTPC-HC-004、NTPC-HC-005 | — |
| HOME_CARE | 新北市 | 五股區 | 1 | NTPC-HC-005 | — |
| HOME_CARE | 新北市 | 永和區 | 2 | NTPC-HC-002、NTPC-HC-005 | — |
| HOME_CARE | 新北市 | 板橋區 | 3 | NTPC-HC-002、NTPC-HC-004、NTPC-HC-005 | — |
| HOME_CARE | 新北市 | 林口區 | 1 | NTPC-HC-003 | — |
| HOME_CARE | 新北市 | 泰山區 | 1 | NTPC-HC-005 | — |
| HOME_CARE | 新北市 | 新店區 | 1 | NTPC-HC-005 | — |
| HOME_CARE | 新北市 | 新莊區 | 3 | NTPC-HC-003、NTPC-HC-004、NTPC-HC-005 | — |
| HOME_CARE | 新北市 | 樹林區 | 2 | NTPC-HC-001、NTPC-HC-005 | — |
| HOME_CARE | 新北市 | 蘆洲區 | 2 | NTPC-HC-004、NTPC-HC-005 | — |
| HOME_CARE | 臺北市 | 士林區 | 3 | TP-HC-004、TP-HC-009、TP-HC-010 | — |
| HOME_CARE | 臺北市 | 大同區 | 10 | TP-HC-001、TP-HC-002、TP-HC-003、TP-HC-004、TP-HC-005、TP-HC-006、TP-HC-007、TP-HC-008、TP-HC-009、TP-HC-010 | — |
| HOME_CARE | 臺北市 | 大安區 | 4 | TP-HC-003、TP-HC-004、TP-HC-009、TP-HC-010 | — |
| HOME_CARE | 臺北市 | 中山區 | 7 | TP-HC-001、TP-HC-003、TP-HC-004、TP-HC-005、TP-HC-008、TP-HC-009、TP-HC-010 | — |
| HOME_CARE | 臺北市 | 中正區 | 9 | TP-HC-001、TP-HC-002、TP-HC-003、TP-HC-004、TP-HC-005、TP-HC-006、TP-HC-007、TP-HC-008、TP-HC-010 | — |
| HOME_CARE | 臺北市 | 內湖區 | 3 | TP-HC-004、TP-HC-009、TP-HC-010 | — |
| HOME_CARE | 臺北市 | 文山區 | 3 | TP-HC-004、TP-HC-006、TP-HC-010 | — |
| HOME_CARE | 臺北市 | 北投區 | 3 | TP-HC-004、TP-HC-009、TP-HC-010 | — |
| HOME_CARE | 臺北市 | 松山區 | 3 | TP-HC-004、TP-HC-009、TP-HC-010 | — |
| HOME_CARE | 臺北市 | 信義區 | 3 | TP-HC-004、TP-HC-009、TP-HC-010 | — |
| HOME_CARE | 臺北市 | 南港區 | 3 | TP-HC-004、TP-HC-009、TP-HC-010 | — |
| HOME_CARE | 臺北市 | 萬華區 | 10 | TP-HC-001、TP-HC-002、TP-HC-003、TP-HC-004、TP-HC-005、TP-HC-006、TP-HC-007、TP-HC-008、TP-HC-009、TP-HC-010 | — |
| HOME_MEDICAL_NURSING | 臺北市 | 士林區 | 1 | TP-HMN-002 | TP-HMN-001、TP-HMN-003 |
| HOME_MEDICAL_NURSING | 臺北市 | 北投區 | 1 | TP-HMN-002 | TP-HMN-001、TP-HMN-003 |
<!-- A006:END coverage -->
