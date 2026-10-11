# 雙北公開門牌索引

此資料不是使用者地址紀錄。兩份原始資料來自臺北市／新北市政府民政局，依政府資料開放授權條款第1版利用，完整來源、版本與原檔 SHA-256 見 `manifest.json`，使用者可在 Demo 隱私頁看到顯名聲明。

- 原始資料：臺北市2026-10-02，1,157,763列；新北市11509，1,989,458列。
- 41個行政區、732,883個無歧義門牌；樓層合併到同一門牌，831個同名但位置相差超過30公尺的門牌排除。
- 來源坐標 EPSG:3826（TWD97/TM2 zone121），透過 pyproj 轉 EPSG:4326；lat/lng 六位小數，未用行政區中心或道路插值。
- 只做全形數字／路段中文數字／臺台及門牌樓層正規化，精確鍵值比對。不做模糊地址猜測。
- 1,035家公開機構有精確門牌對應（`provider-coordinates.json`）；83家未對應。已核准原座標優先，沒有修改 A 正式 Provider 檔案或 Supabase。
- 索引JSON按行政區分檔。Demo建置將其轉成同源、有內容hash的JS module；只載入所選行政區，不把輸入住址放進URL／request，保留 connect-src none。

再生成：在暫存目錄下載 manifest 中的原檔，在獨立 Python venv 安裝 pyproj，執行 `python scripts/geo/build-residence-index.py taipei.csv ntpc.zip`。原CSV/ZIP不提交，CI不依賴外網下載或 Python套件。`node scripts/geo/verify-residence-index.mjs` 檢查所有41個檔案雜湊、筆數、座標範圍與機構逐筆對應；新增資料版本需重新檢視來源。

門牌點位只供直線距離參考，可能有誤差、缺漏或更新差距，不能表示路程、到府時間、機構可接案或政府推薦。未知服務範圍的商家仍不進推薦。
