# ProviderService `active` Evidence (A-004-r2)

`active=true` is set only where the Provider appears in a current official list for that
service type. Records that could not be checked against a source keep `active` unset and are
listed as blocked. Values were not defaulted.

Checked on 2026-09-23.

## Confirmed: `active=true` (30)

| ProviderService IDs | Source | Evidence |
|---|---|---|
| PSV-TP-HC-001 … 010-HOME_CARE | SRC-001, in repo: `raw/臺北市居家服務機構一覽表_1150810更新.pdf` (115.8.10 更新) | Name and address of all 10 Providers match rows in the list. |
| PSV-NTPC-AD-001 … 009-ASSISTIVE_DEVICE | SRC-005, in repo: `raw/(雲端)輔具服務特約廠商一覽表.xlsx` | All 9 are in sheet `114~116特約廠商總表` (current contract period). None are in sheet `不續約廠商` (non-renewed vendors). |
| PSV-TP-HMN-001 … 003-HOME_MEDICAL_NURSING | SRC-003, official attachment `臺北市居家護理所一覽表(115年9月1日更新).pdf` from the SRC-003 page on health.gov.taipei (not committed; sha256 `b9d8d42f…edac485`) | Rows 1–3 match the name and address of TP-HMN-001 (馬偕), 002 (陽明), 003 (北護分院). |
| PSV-NTPC-HC-001 … 005-HOME_CARE | SRC-002, official list `114~116年新北市長照特約單位名單1150916(居家服務、居家喘息、短照服務).pdf` from the 新北市高齡長期照顧處 unit list page https://www.careyou.ntpc.gov.tw/w/agecare/unit (not committed; sha256 `b33555c6…4a8c23c`) | All 5 are listed with 居家服務 ✔, and names and addresses match. The list's addresses add 里/鄰, and 台/臺 differ. |
| PSV-TP-AD-001 … 003-ASSISTIVE_DEVICE | SRC-004, official attachment `115年臺北市政府身障輔具暨長期輔具及居家無障礙環境改善特約服務門市名單.pdf` (115.9.1 更新) from the SRC-004 page on dosw.gov.taipei (not committed; sha256 `ad4d0bb1…6089efd`) | 晨玉有限公司, 諾貝兒寶貝股份有限公司內湖分公司 and 可能設計有限公司 are listed with matching addresses. |

## Blocked: none

The 5 NTPC-HC records were blocked in the first r2 commit and were confirmed later on 2026-09-23
(see the SRC-002 row above). The 新北市衛生局 page now points to 高齡長期照顧處 for the current list.

## Observations (not changed; outside this fix)

- NTPC-HC-003 `phone` is `0955-992-465`, but the SRC-002 1150916 list shows `02-2990-2007`.
- The SRC-002 1150916 list gives district-level service areas for NTPC-HC-003 (新莊、三重、林口),
  which `qa/validation-report.md` recorded as unavailable. Adding service areas is out of scope
  for this fix.
