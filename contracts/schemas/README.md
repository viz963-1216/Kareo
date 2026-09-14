# Contract Schemas

本資料夾由 Jerry / Spec Owner 管理。

用途：保存未來可供 Frontend、Backend 與測試共同驗證的 Schema。

預計包含：

```text
assessment.schema.json
provider.schema.json
recommendation.schema.json
lead.schema.json
knowledge.schema.json
```

規則：

1. Schema 必須以 `docs/DATA_MODEL.md` 與 `docs/API_CONTRACT.md` 為準。
2. Engineer A / B / C 不得自行修改 Schema。
3. 需要新增欄位或 Enum 時，先建立 Issue。
4. Jerry 核准後，先更新 Spec，再更新 Schema，最後才修改 Code。
