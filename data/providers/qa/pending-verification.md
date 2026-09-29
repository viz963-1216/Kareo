# A-003 待補資料清單

Submission Version: A-003-r9
更新日期：2026-09-29

每筆資料都來自 `qa/a-003-evidence.json` 的 `pending`。`node data/providers/qa/verify-coordinates.mjs` 會確認：

- 每個沒有完整座標證據的 Provider 都列出「座標」。
- 每個有啟用服務、但沒有 ProviderServiceArea 的 Provider 都列出「服務範圍」。
- 已驗證的項目不會留在清單上。

r8 依本工作階段使用者的指示（`a-003-evidence.json` 的 `decisions`，DEC-A003-01～05，含原文摘錄）處理了先前待決的項目，目前只剩 1 筆，而且已依指示暫不處理。指示者身分需由 Jerry 在 PR review 確認。

<!-- A003:BEGIN pending -->
| Provider ID | 名稱 | 缺少 | 已查閱來源與日期 | 尚無法確認的原因 | 下一步 |
| --- | --- | --- | --- | --- | --- |
| NTPC-AD-004 | 吉評醫療器材股份有限公司 | 座標（DEC-A003-04） | SRC-COORD-NTPC-001（2026-09-29）：新店區（65000060）安康路一段共 822 筆門牌紀錄，沒有任何「３５９」開頭的號（含 359之25號）。<br>SRC-004（2026-09-29）：臺北市名單序號 318 的同名廠商地址為臺北市信義區基隆路1段155號13樓之5，與 providers.json 的新北市地址不同。 | 依 DEC-A003-04 暫不處理：官方門牌資料找不到正式地址「安康路一段359-25號」，座標維持 null。 | 如日後需要，再向新北市輔具資源中心或廠商確認正確門牌。 |
<!-- A003:END pending -->

## 其他觀察

- NTPC-HC-003 電話已依 DEC-A003-05 更新為 `02-2990-2007`（Google Maps 與 SRC-002 1150924 名單相同）。
