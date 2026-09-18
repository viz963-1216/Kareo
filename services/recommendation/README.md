# Recommendation Service — Plan

Task: TASK-B-001
Owner: Engineer B
Status: DRAFT — 待 Jerry 核准

本文件規劃 `services/recommendation/**`，依 `docs/DATA_MODEL.md` 第 20–21 節、`docs/PRODUCT_SPEC.md` 第 17–27 節、`docs/ARCHITECTURE.md` 第 7 節。

---

## 1. 責任

Recommendation Service 是 Backend API 呼叫的內部邏輯層，負責：

- 依 `CareNeedProfile` 與指定 `serviceType`，從 Provider DB 篩出符合條件的 Provider
- 依是否有精確位置決定排序策略（Distance Ranking / Stable Rotation）
- 產生最多 3 筆 `RecommendationItem`，附上可解釋的 `reasons`
- 記錄一次 `RecommendationRun`（含 `rankingType`、`locationPrecision`、`knowledgeVersion`）

**本模組不負責**：Provider 資料維護（Engineer A / Provider Service 負責）、Assessment 內容生成、AI 選商家（明確禁止）。

---

## 2. 輸入 / 輸出

輸入（對應 `POST /api/v1/recommendations`）：

```json
{
  "assessmentId": "ASM-001",
  "serviceType": "HOME_CARE"
}
```

輸出：`RecommendationRun` + 最多 3 筆 `RecommendationItem`（含 Provider 展示欄位、`rank`、`distanceKm`、`reasons`），格式完全依 `API_CONTRACT.md` 第 9 節。

---

## 3. 處理流程

```text
1. 讀取 Assessment / CareNeedProfile → 取得 location（city/district/precision/lat/lng）
2. Eligible Provider：status = ACTIVE
3. Service Type Match：ProviderService.serviceType = 指定 serviceType 且 active = true
4. Service Area Match：ProviderServiceArea 包含 Assessment 的 city/district
   （地址與服務範圍分開判斷，Provider 本身地址不等於服務範圍）
5. 依 locationPrecision 分流：
   a. GPS / EXACT（有 lat/lng）→ 計算 Distance（Haversine）→ 由近到遠排序
   b. DISTRICT / CITY（僅有行政區）→ Stable Rotation 排序
   c. NONE（無位置）→ rankingType = NO_LOCATION，仍可回傳符合 Service Type + Service Area 的結果，
      但不得標示「附近」或距離
6. 取前 3 筆，若不足 3 筆則回傳實際數量；0 筆則回傳空陣列 + notice
7. 每筆結果組成 reasons（例如「服務範圍包含 OO 區」「提供您需要的 OO 服務」，有距離時加「距離約 X 公里」）
8. 寫入 RecommendationRun + RecommendationItem
```

---

## 4. Stable Rotation 演算法規劃

依 `PRODUCT_SPEC.md` 第 23 節，禁止純 Random：

```text
seed = hash(sessionId + district + date)
使用 seed 對符合條件的 Provider 清單做確定性排序（例如以 seed 為基礎的 shuffle 或加權排序）
```

- 同一 `sessionId` + 同一 `district` + 同一天 → 結果穩定不變
- 換日期 → seed 改變 → 可以輪替，避免長期固定同幾家曝光
- 明確**不得**因商家付費而改變自然推薦順序（`PRODUCT_SPEC.md` 第 5 節），本模組不接受任何付費排序參數

---

## 5. 排序型別（enum，不可自行新增）

`rankingType`：`DISTANCE` / `DISTRICT_ROTATION` / `CITY_ROTATION` / `NO_LOCATION`（依 `DATA_MODEL.md` 第 20 節）

---

## 6. Error Handling

- 找不到任何符合 Provider → 正常回應（`success:true`），`providers: []`，`notice` 提示改看更多資源或聯絡 1966，**不得回 Error**。
- `serviceType` 不在允許 enum 內 → `VALIDATION_ERROR`。
- `assessmentId` 不存在 → `NOT_FOUND`。
- 計算 Distance 需要的 lat/lng 缺漏但 locationPrecision 宣稱 GPS/EXACT → fallback 降級為 Stable Rotation，並記錄 Known Issue（不得中斷流程）。

---

## 7. Test Strategy

- Unit Test：Service Area 篩選邏輯、Distance 排序正確性、Stable Rotation 在同 seed 下結果一致、不同 date 下結果可變化。
- 邊界測試：0 家 / 1 家 / 2 家 / 超過 3 家符合條件。
- 禁止測試：不得測試「LLM 自行選商家」路徑，因為此路徑本來就不應存在。

---

## 8. 技術決策（需 Jerry 核准）

- Distance 計算是否需要考慮實際路網距離，或 MVP 僅用直線距離（Haversine）即可（建議 MVP 用直線距離，未來可換 Google Distance Matrix API）。
- Stable Rotation 的 hash / seed 演算法實作細節（例如簡單 mod 運算 vs cryptographic hash），效能與可預測性需求由 Jerry 確認。

---

## Source of Truth

```text
PRODUCT_SPEC.md → ARCHITECTURE.md → DATA_MODEL.md → API_CONTRACT.md → GIT_RULES.md → TASK → Code
```
