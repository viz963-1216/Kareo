# Mock Contracts

本資料夾由 Jerry / Spec Owner 管理。

用途：提供 Engineer C 可直接使用的固定 Mock API Response，讓 Frontend 不需要等待 Backend。

未來預計建立：

```text
assessment-response.json
recommendation-response.json
provider-response.json
lead-response.json
transportation-response.json
```

規則：

1. Mock 格式必須與 `docs/API_CONTRACT.md` 完全一致。
2. Engineer B / C 不得因為實作方便自行修改 Mock Contract。
3. 需要新增或修改欄位時，先建立 Issue，交 Jerry Review。
4. Mock 只代表 API 格式，不代表正式 Provider 或政策資料。
5. 正式整合時由 Jerry 將 Mock Data 替換為 Real API。
