# Kareo Assessment Rules / 初步評估規則引擎

Owner: Jerry
Submission Version: J-002-r2
Rules version: `RULES-2026-09-23-r1`（PROPOSED：規則表與文案待 Jerry 逐條確認）
Decision: MVP_DECISIONS D-01 = 方案 B（不使用 AI，Jerry 2026-09-23 決定）

> MVP 的 Assessment 完全由本文件的確定性規則產生，不呼叫任何 AI／LLM。
> 同樣的輸入永遠得到同樣的輸出；每一個結論都能追溯到哪一條規則。
> 本引擎只做「初步預估」，不判定長照需要等級、不判定正式資格或補助。

---

## 1. 輸入與輸出

輸入：API_CONTRACT §8 的 Assessment Request（欄位與 enum 依 DATA_MODEL §8–14）。

輸出：沿用原本的 CareNeedProfile（`careNeeds`、`priority`、`summary`、`warnings`），**API 格式不變**，前端不需修改。

另存於資料庫（不回傳前端）：`rulesVersion`、每個需求的觸發規則 ID（例如 `HC-R1`、`KW-AD`），供稽核與除錯。

## 2. 處理順序

```text
1. 確認有 PUBLISHED Knowledge（沒有 → KNOWLEDGE_UNAVAILABLE，不產生結果）
2. 使用者勾選：needs = YES 一定列入；needs = NO 一定不列入
3. 結構化規則：只對 needs = UNKNOWN 的項目判斷是否「可能需要」
4. 關鍵字：只對 needs = UNKNOWN 且規則未觸發的項目補充判斷
5. 排序 priority
6. 依模板組成 summary（引用 PUBLISHED Knowledge 內容）
7. 附加固定 warnings
```

**原則：使用者明確的回答永遠優先。** 規則與關鍵字只能在使用者回答「不確定」時補充，不能推翻使用者選的「需要」或「不需要」。

## 3. 結構化規則（needs = UNKNOWN 時）

| 規則 ID | 需求 | 條件（任一成立） |
|---|---|---|
| HC-R1 | HOME_CARE | `dailyLivingLevel` ∈ {PARTIAL_ASSISTANCE, HIGH_ASSISTANCE, FULL_ASSISTANCE} |
| HC-R2 | HOME_CARE | `livingSituation` = ALONE 且 `mobilityLevel` ∈ {NEEDS_ASSISTANCE, WHEELCHAIR, BEDRIDDEN} |
| HC-R3 | HOME_CARE | `caregiverSituation` ∈ {NO_CAREGIVER, FAMILY_LIMITED} 且 `dailyLivingLevel` ≠ INDEPENDENT |
| MN-R1 | HOME_MEDICAL_NURSING | `mobilityLevel` = BEDRIDDEN |
| MN-R2 | HOME_MEDICAL_NURSING | `dailyLivingLevel` = FULL_ASSISTANCE |
| AD-R1 | ASSISTIVE_DEVICE | `mobilityLevel` ∈ {NEEDS_ASSISTANCE, WHEELCHAIR, BEDRIDDEN} |
| TR-R1 | TRANSPORTATION | `mobilityLevel` ∈ {WHEELCHAIR, BEDRIDDEN} |

`UNKNOWN` 的欄位不觸發任何規則（不猜）。
`livingSituation` = INSTITUTION 時不套用 HC-R2／HC-R3（機構住民通常已有照顧安排），並在 summary 加入模板 `S-INSTITUTION`。

## 4. 關鍵字規則（自由文字，needs = UNKNOWN 且結構化規則未觸發時）

| 規則 ID | 需求 | 關鍵字 |
|---|---|---|
| KW-HC | HOME_CARE | 洗澡、沐浴、如廁、上廁所、換尿布、餵食、吃飯要人、穿衣、白天沒人、沒人照顧、獨居、照顧不來、喘不過氣 |
| KW-MN | HOME_MEDICAL_NURSING | 傷口、換藥、壓瘡、褥瘡、鼻胃管、尿管、導尿、氣切、抽痰、管路、打針、胰島素、造口 |
| KW-AD | ASSISTIVE_DEVICE | 輪椅、助行器、拐杖、扶手、跌倒、滑倒、樓梯、上下樓、爬樓梯、浴室、洗澡椅、便盆椅、電動床、氣墊床 |
| KW-TR | TRANSPORTATION | 就醫、回診、看診、看醫生、洗腎、透析、復健、去醫院 |

比對規則：

1. 先正規化：全形轉半形、移除空白與標點。
2. **否定詞**：關鍵字前 4 個字內出現「不、沒、無、不用、不需、不需要、沒有、已經不」時，不算命中。例如「不需要輪椅」不觸發 KW-AD。
3. 只記錄命中的規則 ID，**不保存命中片段**，也不把原文放進 summary 或 log。
4. 關鍵字清單有版本號（隨 `rulesVersion`），修改須經 Jerry 核准並新增測試案例。
5. KW-TR 只代表「可能有就醫／復健／透析交通需求」，符合 KR-2026-003 交通接送用途限制。

> 關鍵字比對一定會有漏判與誤判，所以只用來**補充**使用者沒有明確回答的項目，而且結果頁一律寫「可能需要」。

## 5. 排序（priority）

每個列入的需求計分，分數高者在前；同分依固定順序 HOME_CARE → HOME_MEDICAL_NURSING → ASSISTIVE_DEVICE → TRANSPORTATION。

| 加分條件 | 分數 |
|---|---|
| 使用者勾選 YES | +3 |
| 結構化規則觸發 | +2 |
| 關鍵字觸發 | +1 |
| HOME_CARE：`dailyLivingLevel` ∈ {HIGH_ASSISTANCE, FULL_ASSISTANCE} | +2 |
| HOME_CARE：`caregiverSituation` ∈ {NO_CAREGIVER, FAMILY_LIMITED} 或 `livingSituation` = ALONE | +1 |
| HOME_MEDICAL_NURSING：`mobilityLevel` = BEDRIDDEN | +2 |
| ASSISTIVE_DEVICE：`mobilityLevel` ∈ {NEEDS_ASSISTANCE, WHEELCHAIR} | +1 |
| TRANSPORTATION：`mobilityLevel` ∈ {WHEELCHAIR, BEDRIDDEN} | +1 |

## 6. Summary 模板

Summary 只能由下列已核准的模板組成（`{}` 為程式帶入的值），不得自由生成文字。

| 模板 ID | 條件 | 文字 |
|---|---|---|
| S-NEEDS | 至少一項需求 | 依您目前提供的資訊，可能優先需要{需求1}，也可能需要{其餘需求}。 |
| S-NONE | 沒有任何需求 | 依您目前提供的資訊，尚未看出明確的長照服務需求。若狀況改變或仍有疑問，建議撥打 1966 詢問。 |
| S-ELIG-AGE | `ageRange` ∈ {65_74, 75_84, 85_PLUS} | 依年齡，可能符合長照服務的申請條件，實際仍需經照管專員評估。 |
| S-ELIG-OTHER | `ageRange` ∈ {UNDER_50, 50_64} | 若領有身心障礙證明、有失智症，或具原住民身分且年滿 55 歲，也可能符合申請條件。 |
| S-ELIG-UNKNOWN | `ageRange` = UNKNOWN | 是否符合申請條件，需依年齡、身心障礙證明或失智症等情況由照管專員評估。 |
| S-TR | 需求含 TRANSPORTATION | 長照交通接送服務以就醫、復健或透析為主。 |
| S-INSTITUTION | `livingSituation` = INSTITUTION | 目前居住於機構者，部分居家服務可能不適用，建議先與機構或 1966 確認。 |
| S-NEXT | 一律 | 下一步可撥打長照專線 1966（週一至週五 8:30–12:00、13:30–17:30）申請到府評估。 |

- 需求名稱：HOME_CARE＝居家照顧、HOME_MEDICAL_NURSING＝居家醫療與護理、ASSISTIVE_DEVICE＝輔具與居家無障礙、TRANSPORTATION＝長照交通接送。
- S-ELIG-*、S-TR、S-NEXT 的內容來自 PUBLISHED Knowledge（KR-2026-001、KR-2026-003、KR-2026-008）。對應紀錄不在目前 PUBLISHED 版本時，省略該句；若 S-NEXT 無法產生，回 `KNOWLEDGE_UNAVAILABLE`。
- **MVP 不在結果頁顯示給付金額或部分負擔比率**，避免使用者誤以為是核定額度。相關知識只保留在資料庫，未來另行決定是否顯示。

## 7. Warnings（固定，依 API_CONTRACT §15）

```text
本結果僅為初步預估。
實際資格、長照等級、服務內容與補助，仍應由 1966 或所在地長期照顧管理中心正式評估確認。
```

## 8. 自由文字的處理

- 選填，上限 500 字。
- 只在 server 端做關鍵字比對，**不送到任何外部服務**。
- 保存期限依 PRIVACY_AND_RETENTION §2。
- log 不得記錄原文。

## 9. 必要測試案例（B-010 需全部實作）

| # | 輸入重點 | 預期 careNeeds／priority |
|---|---|---|
| T1 | needs 全 YES，其餘 UNKNOWN | 四項都列入；priority 依固定順序 |
| T2 | needs 全 NO，`mobilityLevel` = BEDRIDDEN | 空陣列（使用者回答優先）；summary = S-NONE |
| T3 | needs 全 UNKNOWN，`dailyLivingLevel` = PARTIAL_ASSISTANCE | 只有 HOME_CARE（HC-R1） |
| T4 | needs 全 UNKNOWN，`mobilityLevel` = WHEELCHAIR | ASSISTIVE_DEVICE（AD-R1）、TRANSPORTATION（TR-R1） |
| T5 | needs 全 UNKNOWN，`mobilityLevel` = BEDRIDDEN，`dailyLivingLevel` = FULL_ASSISTANCE | 四項都列入，HOME_CARE 與 HOME_MEDICAL_NURSING 排在前面 |
| T6 | assistiveDevice UNKNOWN，freeText「最近上下樓很容易跌倒」 | 含 ASSISTIVE_DEVICE（KW-AD） |
| T7 | assistiveDevice UNKNOWN，freeText「目前不需要輪椅」 | 不含 ASSISTIVE_DEVICE（否定詞） |
| T8 | transportation NO，freeText「每週要洗腎」 | 不含 TRANSPORTATION（NO 優先） |
| T9 | 全部 UNKNOWN、freeText 空白 | 空陣列；S-NONE＋S-ELIG-UNKNOWN＋S-NEXT |
| T10 | 無 PUBLISHED Knowledge | KNOWLEDGE_UNAVAILABLE，不寫入 COMPLETED Assessment |
| T11 | 同一輸入跑 100 次 | 輸出完全相同 |
| T12 | `livingSituation` = INSTITUTION、`caregiverSituation` = NO_CAREGIVER、`dailyLivingLevel` = INDEPENDENT | 不觸發 HC-R2／HC-R3；含 S-INSTITUTION |
| T13 | 任何輸入 | summary 不含「核定」「確定符合」「CMS 第」等字樣；warnings 必定存在 |

## 10. 規則的維護

- 規則、關鍵字、模板一律在本文件修改，版本號遞增（`RULES-YYYY-MM-DD-rN`），並補對應測試。
- 程式不得出現本文件以外的規則。
- 未來若要引入 AI，需重新提出決策（費用、隱私、失敗行為），並先修訂 PRODUCT_SPEC §16。
