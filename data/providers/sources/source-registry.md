# Kareo Provider Source Registry

> Task: TASK-A-002 — Official Provider Dataset v1  
> Submission Version: A-002-r1  
> Scope: Taipei City / New Taipei City

## Purpose

This registry records the official or traceable primary sources used to build the Kareo Provider Dataset.

Only government, official, or traceable first-party public sources should be treated as formal Provider sources.

Unknown or unverified information must not be guessed.

---

## Source Registry

| Source ID | Source Name | Authority / Organization | Source URL | Provider Type | Jurisdiction | Retrieved At | Notes |
|---|---|---|---|---|---|---|---|
| SRC-001 | 臺北市居家服務機構一覽表 | 臺北市政府社會局 | https://dosw.gov.taipei/News_Content.aspx?n=5EF22734BA80A829&s=B534D9A9215C502D&sms=96505C2A85F034FD | HOME_CARE | Taipei City | 2026-09-18 | Official Taipei City government source; provider list attachment available on source page. |
| SRC-002 | 新北市居家長照機構名冊 | 新北市政府衛生局 | https://www.health.ntpc.gov.tw/ | HOME_CARE | New Taipei City | 2026-09-18 | Official government registry; includes provider name, address, service items, phone, and service area. |
| SRC-003 | 臺北市居家護理機構名單 | 臺北市政府衛生局 | https://health.gov.taipei/News_Content.aspx?n=A01CA16FC0C64647&s=480610F542590DA6&sms=BACDBFD1C6E1EF90 | HOME_MEDICAL_NURSING | Taipei City | 2026-09-18 | Official Taipei City government source; includes the Taipei home nursing institution list updated 2026-09-01. |
| SRC-004 | 115年臺北市政府身障輔具暨長期輔具及居家無障礙環境改善特約服務門市名單 | 臺北市政府社會局 | https://dosw.gov.taipei/cp.aspx?n=457FA2416BF17247&s=74E8961109D68F2E | ASSISTIVE_DEVICE | Taipei City | 2026-09-18 | Official Taipei City government source; provides the 2026 contracted assistive-device and long-term-care assistive-device service store list in PDF and ODS formats. |
| SRC-005 | 新北市長照輔具／無障礙服務特約廠商 | 新北市輔具資源中心／新北市政府社會局 | https://atrc.aihsin.ntpc.gov.tw/NewsInfo/24 | ASSISTIVE_DEVICE | New Taipei City | 2026-09-18 | Official New Taipei City assistive-device resource source; provides contracted assistive-device vendor lookup and downloadable vendor lists. |

---

## Provider Type Reference

| Provider Type | Description |
|---|---|
| HOME_CARE | 居家照顧 |
| HOME_MEDICAL_NURSING | 居家醫療與護理 |
| ASSISTIVE_DEVICE | 輔具 |

---

## Verification Rules

- Prefer government and official public data.
- Every formal Provider must be traceable to a registered source.
- Do not use AI-generated provider information as source data.
- Do not use blogs, social media posts, SEO websites, or unverifiable directories as formal sources.
- Do not infer service areas from provider addresses.
- Unknown information should remain `null` or `UNKNOWN`.
- `verified = true` means Kareo basic data verification, not government certification.

---

## Pending / Unverified Sources

Sources that have not yet been verified should be recorded here before being included in the formal dataset.

| Source Name | URL | Reason Pending | Next Action |
|---|---|---|---|
| None | — | — | — |