# A-003 待補資料清單

Submission Version: A-003-r11
更新日期：2026-09-29

每筆資料都來自 `qa/a-003-evidence.json` 的 `pending`。`node data/providers/qa/verify-coordinates.mjs` 會確認：

- 每個沒有完整座標證據的 Provider 都列出「座標」。
- 每個有啟用服務、但沒有 ProviderServiceArea 的 Provider 都列出「服務範圍」。
- 已驗證的項目不會留在清單上。

本工作階段使用者的指示記錄在 `a-003-evidence.json` 的 `decisions`（DEC-A003-01～07，含原文摘錄）。r11 起已沒有缺座標或缺服務範圍的 Provider；NTPC-AD-004 的座標是依 DEC-A003-07 採用的**非官方座標**，列在 `unofficialCoordinates`，待官方門牌資料收錄後改用官方門牌點。指示者身分需由 Jerry 在 PR review 確認。

<!-- A003:BEGIN pending -->
| Provider ID | 名稱 | 缺少 | 已查閱來源與日期 | 尚無法確認的原因 | 下一步 |
| --- | --- | --- | --- | --- | --- |
<!-- A003:END pending -->

## 其他觀察

- NTPC-HC-003 電話已依 DEC-A003-05 更新為 `02-2990-2007`（Google Maps 與 SRC-002 1150924 名單相同）。
