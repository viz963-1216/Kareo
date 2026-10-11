# J-004-r20：同區所在地推薦修正

Jerry 實測南港仍出现內湖／北投機構，指定家屬需就近到同區廠商。本輪限现有 Netlify `/demo/` 公開資料分析。

## 根因與修正

r19只要求官方服務範圍覆蓋行政區，外區機構能服務南港也進入候選。r20新增所在地city及district必須同輸入位置，仍要求ACTIVE、服務類別與已確認服務範圍。完整住址在同區已定位單位中依原始直線距離排序；只填區則同區隨機最多3家，同評估保留首次結果。零家或不足3家不跨區補足，公開查詢連結預填同縣市、行政區及LOCATED_IN。所在地不等同到府服務範圍，未確認者只能公開查詢。

## 驗證

- Frontend 92/92 PASS，實際adapter回歸包含南港DISTRICT／EXACT、雙北41行政區×3類服務共123組範圍與家數檢查、同評估快取、無API請求、地址不送API。
- backend既有publicProviderPreview回歸12/12 PASS；按owner新規則修正旧跨區預期。三重的外區輔具商家不進推薦，板橋可列已確認的一家；坪林只列同區兩家。
- Frontend typecheck、公開主站＋Demo雙產物build、embedded Demo資產／no-network CSP／fixture scan PASS。
- 純程式／公開資料，無Supabase資料修改、無新增付費服務。正式後端B-005、D-05和49項正式E2E狀態不變。

發布後以PR留言補上確切SHA、Netlify deploy與線上南港操作證據，不預先宣告部署成功。
