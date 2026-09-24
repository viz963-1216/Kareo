# Kareo Assessment Rules / 初步評估規則引擎

Owner: Jerry
Submission Version: J-002-r4
Rules version: `RULES-2026-09-24-r5`（**SPEC-APPROVED 2026-09-24**：r4 身心障礙福利補助 §6.5 文字經 Jerry 確認；r5 依 D-17a 新增 §6.6 個人自付估算，模板文字依 Jerry「要清算」指示撰寫）。r2、r3 為 SPEC-APPROVED 2026-09-24（D-01a）
Decision: MVP_DECISIONS D-01 = 方案 B（不使用 AI，Jerry 2026-09-23 決定）

> MVP 的 Assessment 完全由本文件的確定性規則產生，不呼叫任何 AI／LLM。
> 同樣的輸入永遠得到同樣的輸出；每一個結論都能追溯到哪一條規則。
> 本引擎只做「初步預估」，不判定長照需要等級、不判定正式資格或補助。

---

## 1. 輸入與輸出

輸入：API_CONTRACT §8 的 Assessment Request（欄位與 enum 依 DATA_MODEL §8–14）。

輸出：沿用原本的 CareNeedProfile（`careNeeds`、`priority`、`summary`、`warnings`），**API 格式不變**，前端不需修改。

另存於資料庫（不回傳前端，DATA_MODEL §7）：`rulesVersion`、`ruleTrace`（每個需求的觸發規則 ID，例如 `HC-R1`、`KW-AD`；使用的模板 ID；引用的知識 recordId），供稽核與除錯。

## 2. 處理順序

```text
1. 確認有 PUBLISHED Knowledge（沒有 → KNOWLEDGE_UNAVAILABLE，不產生結果）
2. 使用者勾選：needs = YES 一定列入；needs = NO 一定不列入
3. 結構化規則：只對 needs = UNKNOWN 的項目判斷是否「可能需要」
4. 關鍵字：只對 needs = UNKNOWN 且規則未觸發的項目補充判斷
5. 排序 priority
6. 依模板組成 summary（引用 PUBLISHED Knowledge 內容，§6）
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
5. KW-TR 只代表「可能有就醫／復健／透析交通需求」，與 `BENEFIT_ITEMS.transportationPurposes` 的交通接送用途限制一致。

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

## 6. Summary 模板與補助說明

Summary 只能由下列模板組成，不得自由生成文字。`{}` 為程式帶入的值：**所有制度內容、年齡、等級、金額、比率、期間、分區、電話與服務時間都必須從當下 PUBLISHED Knowledge 的 `ruleData`／`summary` 讀取**，模板與程式碼中不得寫死任何政策數值（見 §6.4）。

### 6.1 輸出格式（沿用既有 `summary` 字串，不新增 API 欄位）

- `summary` 由多個句子組成，句子之間以換行字元 `\n` 分隔；前端每一行顯示為一段（C-005）。
- 句子順序固定：S-NEEDS／S-NONE → S-INSTITUTION → S-ELIG-* → S-SUB-*（依 §6.3 表格由上而下）→ S-DIS-*（§6.5）→ S-EST-*（§6.6，已知身分時；並依「取代」欄替換對應句）→ S-LOCAL-*（INFO／MISSING／NOCITY → CENTER）→ S-NEXT。
- 某句所需的知識紀錄不在 PUBLISHED 版本、`effectiveFrom` 晚於今天（Asia/Taipei）或 `effectiveTo` 已過 → **省略該句**，不改用預設值或其他縣市資料。
- 若 S-NEXT 無法產生 → 回 `KNOWLEDGE_UNAVAILABLE`（不產生部分結果）。
- 回應中的 `knowledgeVersion` 即為本次引用的知識版本；前端需顯示（C-005）。

### 6.2 需求與資格模板

| 模板 ID | 條件 | 文字 | 知識來源（`ruleData.type`，jurisdiction） |
|---|---|---|---|
| S-NEEDS | 至少一項需求 | 依您目前提供的資訊，可能優先需要{需求1}，也可能需要{其餘需求}。 | — |
| S-NONE | 沒有任何需求 | 依您目前提供的資訊，尚未看出明確的長照服務需求。若狀況改變或仍有疑問，建議撥打 {hotline.number} 詢問。 | `APPLICATION_CHANNELS`，TAIWAN |
| S-INSTITUTION | `livingSituation` = INSTITUTION | 目前居住於機構者，部分居家服務可能不適用，建議先與機構或 {hotline.number} 確認。 | `APPLICATION_CHANNELS`，TAIWAN |
| S-ELIG-AGE | `ageRange` ∈ {65_74, 75_84, 85_PLUS}，且 criteria 含 `AGE_65_PLUS` | 依年齡，可能符合長照服務的申請條件，實際仍需經照管專員評估。 | `ELIGIBILITY_ANY_OF`，TAIWAN |
| S-ELIG-OTHER | `ageRange` ∈ {UNDER_50, 50_64} | 若{其餘 criteria 的顯示文字，以「、」「或」串接}，也可能符合申請條件，實際仍需經照管專員評估。 | 同上 |
| S-ELIG-UNKNOWN | `ageRange` = UNKNOWN | 是否符合申請條件，需依{全部 criteria 的顯示文字}等情況由照管專員評估。 | 同上 |
| S-ELIG-DIS | `disabilityCertificate` = YES，且 criteria 含 `DISABILITY_CERTIFICATE`（取代 S-ELIG-OTHER／S-ELIG-UNKNOWN） | 您表示領有身心障礙證明，依規定可能符合長照服務的申請條件，實際仍需經照管專員評估。 | `ELIGIBILITY_ANY_OF`，TAIWAN |
| S-NEXT | 一律 | 下一步可撥打長照專線 {hotline.number}（{hotline.hours 顯示文字}）申請到府評估。 | `APPLICATION_CHANNELS`，TAIWAN |

criteria 顯示文字對照（隨 `rulesVersion` 維護；知識出現對照表沒有的 code 時，**省略該項**並在測試中失敗提示更新對照表，不自行猜文字）：

| code | 顯示文字 |
|---|---|
| `AGE_65_PLUS` | 年滿 65 歲 |
| `INDIGENOUS_AGE_55_PLUS` | 具原住民身分且年滿 55 歲 |
| `DISABILITY_CERTIFICATE` | 領有身心障礙證明 |
| `DEMENTIA` | 有失智症 |
| `PAC_PROGRAM` | 屬急性後期整合照護計畫收案對象 |

> 對照表的文字描述 code 的意義；code 本身與生效日來自知識。criteria 有自己的 `effectiveFrom` 且晚於今天時，不列入。

### 6.3 補助說明模板（PRODUCT_SPEC §1、§3、§14「可能適用的制度與補助」「補助初步預估」）

目的：讓使用者知道**可能適用哪些補助類別、需要什麼條件、官方規則怎麼算、依據哪一份官方來源與版本**。這不是個人核定額度，不計算使用者實際可得金額，不提供補助計算器。

| 模板 ID | 條件 | 文字 | 知識來源（`ruleData.type`，jurisdiction） |
|---|---|---|---|
| S-SUB-INTRO | 至少一項 S-SUB-* 項目句會出現 | 若經照管專員評估為長照需要等級第 {benefitEligibleMin} 級以上，依官方規定可能可使用下列長照給付；以下為官方公告的規則與上限，不是您的核定結果。 | `LEVEL_RANGE`，TAIWAN |
| S-SUB-CARE | careNeeds 含 HOME_CARE 或 HOME_MEDICAL_NURSING，且 `BENEFIT_ITEMS.items` 含 `CARE_AND_PROFESSIONAL` | 照顧及專業服務：每月額度依核定等級約 {最低額} 至 {最高額} 元（第 {最低級} 至第 {最高級} 級），{期間顯示文字}。 | `BENEFIT_ITEMS`、`BENEFIT_AMOUNTS.careAndProfessionalMonthly`、`BENEFIT_PERIODS`，TAIWAN |
| S-SUB-RESPITE | careNeeds 含 HOME_CARE，`caregiverSituation` ∈ {FAMILY_AVAILABLE, FAMILY_LIMITED}，且 items 含 `RESPITE` | 家庭照顧者喘息服務：每年額度依核定等級約 {最低額} 至 {最高額} 元。 | `BENEFIT_AMOUNTS.respiteYearly`、`BENEFIT_PERIODS`，TAIWAN |
| S-SUB-AD | careNeeds 含 ASSISTIVE_DEVICE，且 items 含 `ASSISTIVE_DEVICE_AND_HOME_MODIFICATION` | 輔具及居家無障礙環境改善服務：{期間顯示文字}，額度依核定組別為 {各組額度，僅列已生效者}。 | `BENEFIT_AMOUNTS.assistiveDevice3Years`、`BENEFIT_PERIODS`，TAIWAN |
| S-SUB-TR | careNeeds 含 TRANSPORTATION，且 items 含 `TRANSPORTATION` | 交通接送服務：{分區描述}，限用於{transportationPurposes 顯示文字}。 | `BENEFIT_ITEMS`、`TRANSPORT_ZONE`、`BENEFIT_AMOUNTS.transportationMonthlyByZone`，TAIWAN |
| S-SUB-COPAY | 至少一項 S-SUB-* 項目句出現 | 使用長照服務需依長照身分別自付部分費用，比率依服務項目不同，例如{第一個出現的項目}：{各類別顯示文字與比率}。身分別由主管機關認定。 | `COPAY_RATES`，TAIWAN |
| S-SUB-SOURCE | 至少一項 S-SUB-* 句出現 | 以上制度與金額依據：{逐筆「來源機關顯示文字〈紀錄 title〉（effectiveFrom 起適用）」，以「、」串接}；平台知識版本 {knowledgeVersion}。 | S-SUB-* 實際引用的每一筆紀錄（依 recordId 去重，依 recordId 排序） |
| S-SUB-DISCLAIMER | 至少一項 S-SUB-* 句出現 | 實際長照等級、給付額度與自付金額，須經照管專員評估核定後才確定。 | — |
| S-LOCAL-INFO | 使用者縣市已知，PUBLISHED 版本有該縣市（TAIPEI／NEW_TAIPEI）的地方紀錄（`ruleData.type` 以 `LOCAL_` 開頭、`LOCAL_CENTER` 除外），且與需求相關：`LOCAL_TRANSPORT_RULES` → careNeeds 含 TRANSPORTATION；`LOCAL_ASSISTIVE_DEVICE_PROCESS` → 含 ASSISTIVE_DEVICE；`LOCAL_APPLICATION` → 一律。`ruleData.requiresDisabilityCertificate = true` 的紀錄不由本句處理，改由 §6.5 S-DIS-*（只在使用者回答領有身心障礙證明時出現） | {city}：{紀錄 summary}（依據：{來源機關}〈{title}〉，{effectiveFrom} 起適用）。每筆相關紀錄一句，依 recordId 排序 | 該縣市 jurisdiction 的紀錄 |
| S-LOCAL-MISSING | 使用者縣市已知，但沒有任何 S-LOCAL-INFO 句會出現 | {city}的地方規定與資源目前尚未收錄於平台，請洽 {hotline.number} 或{city}長期照顧管理中心確認；平台不會以其他縣市的規定代替。 | `APPLICATION_CHANNELS`，TAIWAN |
| S-LOCAL-NOCITY | `location.precision` = NONE | 各縣市另有地方補助與服務資源，提供居住縣市後可查看；目前平台收錄臺北市、新北市。 | — |
| S-LOCAL-CENTER | 使用者縣市已知，且有該縣市 `LOCAL_CENTER` 紀錄 | {city}長期照顧管理中心：{address}，電話 {phone}。 | `LOCAL_CENTER`，該縣市 |

分區描述（S-SUB-TR）：

| 使用者位置 | 分區描述 |
|---|---|
| 有縣市＋行政區 | {city}{district}屬交通接送第 {zone} 區，每月額度 {該區額度} 元 |
| 只有縣市，且該縣市沒有行政區例外 | {city}屬交通接送第 {zone} 區，每月額度 {該區額度} 元 |
| 只有縣市，且該縣市有行政區例外（例如新北市） | {city}多數行政區屬第 {default zone} 區（每月 {額度} 元），部分行政區屬第 {例外 zone} 區（每月 {額度} 元），提供行政區後可確認 |
| 沒有位置 | 每月額度依居住地分區為 {最低額} 至 {最高額} 元，提供縣市與行政區後可確認所屬分區 |

金額／比率呈現規則：

1. 只列出官方紀錄中存在、且依 `effectiveFrom` 已生效的數值；金額加千分位，單位「元」；比率單位「%」。
2. 一律使用「額度」「上限」「約」「依核定等級／組別」「可能」等字眼；**不得**寫「您可獲得」「已核定」「您的額度為」「確定符合」或任何個人化金額（「依核定等級」「評估核定後才確定」這類說明正式程序的用語可以使用）。
3. 不依使用者資料推算長照需要等級、身分別或組別；只列官方規則的範圍。
4. 臺北市、新北市的地方制度分開：只讀取與使用者縣市相同 jurisdiction 的地方紀錄；**缺少時用 S-LOCAL-MISSING，不套用另一縣市的規則**。地方紀錄只呈現官方公告的使用規則與聯絡方式，不重算中央的額度或比率（兩者不一致時列為 CONFLICT，交 Jerry 判斷）。
5. 內容仍為 `NEEDS_REVIEW` 的紀錄不得出現在正式結果；知識包未核准前，staging／production 的結果頁不會出現 S-SUB-* 句。

### 6.5 身心障礙福利補助說明（r4，D-17）

只在 `disabilityCertificate` = YES 時出現（UNKNOWN 只出現 S-DIS-HINT）。這些是身心障礙福利，**與長照給付分開申請**；金額一律按官方身分別列出上限，不推算個人核定金額。

| 模板 ID | 條件 | 文字 | 知識來源（`ruleData.type`，jurisdiction） |
|---|---|---|---|
| S-DIS-INTRO | YES，且下列至少一句出現 | 因您表示領有身心障礙證明，另可能適用下列身心障礙福利補助（與長照給付分開申請）： | — |
| S-DIS-MED | YES，careNeeds 含 HOME_MEDICAL_NURSING，或 `mobilityLevel` = BEDRIDDEN | 居家使用的醫療輔具補助：例如{前 3 項品名與上限，格式「品名 低收／中低收／一般戶 元」}，共 {項目數} 項，每項上限依身分別而定；需三個月內的專科醫師診斷證明。 | `DISABILITY_MEDICAL_DEVICE_SUBSIDY`，TAIWAN |
| S-DIS-AD-LOCAL | YES，careNeeds 含 ASSISTIVE_DEVICE，且使用者縣市有 `LOCAL_DISABILITY_AD_TOPUP` 紀錄 | {city}身心障礙者輔具加碼補助：例如{最多 3 項品名與上限}；{全額說明}。 | `LOCAL_DISABILITY_AD_TOPUP`，該縣市 |
| S-DIS-SOURCE | 至少一句 S-DIS-* 出現 | 身心障礙福利補助依據：{逐筆「來源機關〈title〉（effectiveFrom 起適用）」}；實際補助以主管機關核定為準。 | 本次引用的紀錄 |
| S-DIS-HINT | `disabilityCertificate` = UNKNOWN | 若領有身心障礙證明，另有醫療輔具等身心障礙福利補助可申請，可洽戶籍所在地衛生局或社會局。 | — |

- 全額說明：`LOCAL_DISABILITY_AD_TOPUP.items[].fullAmountAllIncome = true` 的品項寫「標示項目不論身分別皆可補助至上限」；其餘品項寫「依身分別補助上限的 100%／75%／50%」（數值取自 `incomeShareOfMax`）。
- 品項挑選：依 ruleData 陣列順序取前 3 項，不依使用者狀況挑選（避免推測病情）。
- 不因 YES 而改變 careNeeds 或 priority；只影響 S-ELIG-DIS 與 §6.5。
- 句子順序：S-SUB-* 之後、S-LOCAL-* 之前。

### 6.6 個人自付估算（r5，D-17a）

`incomeCategory` ≠ UNKNOWN 時，把 §6.3、§6.5 中「並列各身分」的句子換成**只顯示使用者自己**的比例與金額；UNKNOWN 時維持原本並列句，不出現本節任何句子。

身分對照（規則表內容，隨 `rulesVersion` 維護；類別代碼與比率取自 `COPAY_RATES`／`DISABILITY_*` 紀錄）：

| `incomeCategory` | 顯示文字 | 長照身分別（`COPAY_RATES.categories`） | 身障補助欄位（`incomeOrder`） |
|---|---|---|---|
| `LOW_INCOME` | 低收入戶 | `1` | `LOW_INCOME` |
| `MIDDLE_LOW_INCOME` | 中低收入戶 | `1` | `MIDDLE_LOW_INCOME` |
| `ALLOWANCE` | 領有中低收入老人生活津貼或身心障礙者生活補助 | `2` | `GENERAL` |
| `GENERAL` | 一般戶 | `3` | `GENERAL` |

| 模板 ID | 條件 | 文字 | 取代 |
|---|---|---|---|
| S-EST-INTRO | 已知身分，且下列至少一句出現 | 依您選擇的經濟身分（{顯示文字}，長照身分別約為第 {類別} 類），估算如下；實際身分別以主管機關認定為準： | — |
| S-EST-COPAY | 同 S-SUB-COPAY 條件 | 使用長照服務的自付比例：{逐項「項目名稱 r%」，只列本次出現的 S-SUB 項目；交通依使用者分區}。 | S-SUB-COPAY |
| S-EST-CARE | S-SUB-CARE 出現 | 照顧及專業服務：若核定第 {最低級} 級並用滿每月額度 {額度} 元，您每月約自付 {金額} 元；若核定第 {最高級} 級（{額度} 元），約自付 {金額} 元。 | — |
| S-EST-RESPITE | S-SUB-RESPITE 出現 | 喘息服務：用滿每年額度時，您約自付 {最低額×r} 至 {最高額×r} 元。 | — |
| S-EST-AD | S-SUB-AD 出現 | 輔具及居家無障礙：用滿額度時，您約自付 {各組額度×r}。 | — |
| S-EST-TR | S-SUB-TR 出現且可確定分區（有行政區，或縣市無行政區例外） | 交通接送：每趟車資您自付 {r}%，用滿每月額度 {額度} 元時約自付 {金額} 元；超出額度的車資需全額自費。 | — |
| S-EST-DIS-MED | S-DIS-MED 條件 | 居家使用的醫療輔具補助：依您的身分，例如{前 3 項「品名 最高補助 x 元」}，共 {項目數} 項；需三個月內的專科醫師診斷證明。 | S-DIS-MED |
| S-EST-DIS-AD-LOCAL | S-DIS-AD-LOCAL 條件 | {city}身心障礙者輔具加碼補助：依您的身分，例如{最多 3 項「品名 最高補助 x 元」}。 | S-DIS-AD-LOCAL |
| S-EST-DISCLAIMER | S-EST-INTRO 出現 | 以上為依您自選身分與官方公告上限的估算，不是核定金額；實際等級、額度與自付金額，須經照管專員評估及主管機關核定。 | 與 S-SUB-DISCLAIMER 併存 |

計算規則：

1. 自付金額＝額度 × 比率，依 `COPAY_RATES.rounding`（目前 `FLOOR`，小數點後無條件捨去）；比率為 0 時寫「您在額度內可能免自付」。
2. 身障補助上限：`DISABILITY_MEDICAL_DEVICE_SUBSIDY.items[].max[欄位]`；地方加碼：`fullAmountAllIncome = true` → 上限全額，否則 上限 × `incomeShareOfMax[欄位]`（FLOOR）。
3. 不推算長照需要等級；等級一律以「若核定第 X 級」表示最低與最高兩個例子。
4. 所有數值只來自 PUBLISHED 知識；缺紀錄時省略該句（同 §6.1）。

### 6.4 內容對應與維護

- 程式只依 `ruleData.type` 與 jurisdiction 找紀錄，不以 recordId 寫死。目前 `KP-2026-09-23-001` 的對應（2026-09-24 內容核准，尚未 PUBLISHED）：`ELIGIBILITY_ANY_OF`＝KR-2026-001、`LEVEL_RANGE`＝KR-2026-002、`BENEFIT_ITEMS`＝KR-2026-003、`BENEFIT_AMOUNTS`＝KR-2026-004、`TRANSPORT_ZONE`＝KR-2026-005、`COPAY_RATES`＝KR-2026-006、`BENEFIT_PERIODS`＝KR-2026-007、`APPLICATION_CHANNELS`＝KR-2026-008、`LOCAL_CENTER`（TAIPEI）＝KR-2026-009。
- 同一 type＋jurisdiction 在 PUBLISHED 版本出現多筆有效紀錄 → 視為衝突，省略相關句子並記錄錯誤（不自行挑選）。
- 地方紀錄（`KP-2026-09-24-002`，NEEDS_REVIEW）：`LOCAL_TRANSPORT_RULES`（TAIPEI）＝KR-2026-010、`LOCAL_APPLICATION`（TAIPEI）＝KR-2026-011、`LOCAL_APPLICATION`（NEW_TAIPEI）＝KR-2026-012、`LOCAL_CENTER`（NEW_TAIPEI）＝KR-2026-013、`LOCAL_TRANSPORT_RULES`（NEW_TAIPEI）＝KR-2026-014、`LOCAL_ASSISTIVE_DEVICE_PROCESS`（NEW_TAIPEI）＝KR-2026-015。兩市官方頁面**未找到**中央給付以外的地方現金加碼補助（Source Registry 已知缺口 5）。在 KP-*-002 核准並發布前，兩市都顯示 S-LOCAL-MISSING；臺北市另顯示 S-LOCAL-CENTER。
- 同一縣市、同一 `ruleData.type` 可有多筆（例如各分站），但 `LOCAL_CENTER` 每個縣市只能一筆有效紀錄；`branches` 只用於後續顯示，MVP 模板只使用 `address`、`phone`。
- 顯示文字對照（criteria、期間、交通用途、身分別類別、來源機關）屬規則表內容，隨 `rulesVersion` 由 J-002 維護：

| 對照 | code → 顯示文字 |
|---|---|
| 期間（`BENEFIT_PERIODS`） | `MONTHLY_6M_POOL` → 按月給付，以 6 個月為一期；`EVERY_3_YEARS` → 每 3 年給付一次；`YEARLY` → 每年給付一次 |
| 交通用途 | `MEDICAL` → 就醫；`REHABILITATION` → 復健；`DIALYSIS` → 透析治療 |
| 身分別 | `1` → 第一類（低收入戶、中低收入戶等）；`2` → 第二類；`3` → 第三類（一般戶） |
| 來源機關（`source.authority`） | `LAW` → 全國法規資料庫；`MOHW` → 衛生福利部；`TAIPEI_GOV` → 臺北市政府；`NEW_TAIPEI_GOV` → 新北市政府；`KAREO_DRIVE` → 顯示 `ruleData.issuer`（原發布機關）；缺 `issuer` 時該句省略來源名稱、只寫標題 |
| 1966 服務時間 | `hotline.hours` 字串依「Mon-Fri 08:30-12:00,13:30-17:30」格式轉為「週一至週五 8:30–12:00、13:30–17:30」；格式無法解析時省略括號內容 |

- 模板文字（本節）屬 D-01a，2026-09-24 已核准；修改需遞增 `rulesVersion` 並經 Jerry 核准。

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

## 9. 必要測試案例（B-010 需全部實作；T14–T23 為 r2 新增，T24 為 r3 新增，T25–T31 為 r4 新增，T32–T38 為 r5 新增）

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
| T9 | 全部 UNKNOWN、freeText 空白 | 空陣列；S-NONE＋S-ELIG-UNKNOWN＋S-NEXT（另依位置加 S-LOCAL-*） |
| T10 | 無 PUBLISHED Knowledge | KNOWLEDGE_UNAVAILABLE，不寫入 COMPLETED Assessment |
| T11 | 同一輸入跑 100 次 | 輸出完全相同 |
| T12 | `livingSituation` = INSTITUTION、`caregiverSituation` = NO_CAREGIVER、`dailyLivingLevel` = INDEPENDENT | 不觸發 HC-R2／HC-R3；含 S-INSTITUTION |
| T13 | 任何輸入 | summary 不含「您已核定」「確定符合」「CMS 第」「您可獲得」等字樣（S-SUB-DISCLAIMER 的「評估核定後才確定」除外）；warnings 必定存在 |
| T14 | 臺北市＋任一行政區，transportation YES | S-SUB-TR 顯示第 1 區與該區額度（值取自知識）；有 S-LOCAL-CENTER（臺北市）；有臺北市 `LOCAL_TRANSPORT_RULES`／`LOCAL_APPLICATION` 已發布 → S-LOCAL-INFO，否則 S-LOCAL-MISSING |
| T15 | 新北市烏來區，transportation YES | S-SUB-TR 顯示第 4 區（行政區例外）；只出現新北市的 S-LOCAL-INFO／S-LOCAL-CENTER，不出現臺北市的任何地方句 |
| T16 | 新北市、precision = CITY，transportation YES | S-SUB-TR 使用「多數行政區…部分行政區…」描述 |
| T17 | precision = NONE，transportation YES | S-SUB-TR 顯示額度範圍；S-LOCAL-NOCITY；不出現任何縣市地方句 |
| T18 | PUBLISHED 版本缺 `BENEFIT_AMOUNTS` | 含金額的 S-SUB-* 句全部省略、其餘句子照常；不得出現任何預設數值 |
| T19 | 某筆紀錄 `effectiveFrom` 晚於今天 | 該紀錄不被引用 |
| T20 | **哨兵測試**：把 fixture 知識的金額、比率、年齡 code、1966 電話與時間換成哨兵值 | summary 只出現哨兵值，不出現原官方數值（證明程式沒有寫死政策數值） |
| T21 | 同一 type＋jurisdiction 有兩筆有效 PUBLISHED 紀錄 | 相關句子省略並記錄錯誤，不自行挑選 |
| T22 | 知識出現對照表沒有的 criteria code | 該項省略；測試提示需更新對照表 |
| T23 | careNeeds 含 HOME_CARE、`caregiverSituation` = NO_CAREGIVER | 不出現 S-SUB-RESPITE |
| T24 | 新北市、careNeeds 不含 TRANSPORTATION、ASSISTIVE_DEVICE | 只出現 `LOCAL_APPLICATION` 的 S-LOCAL-INFO，不出現交通或輔具的地方句 |
| T25 | `disabilityCertificate` 未提供 | 視為 UNKNOWN；出現 S-DIS-HINT；不回 VALIDATION_ERROR |
| T26 | `disabilityCertificate` = NO | 不出現任何 S-DIS-* 與 S-ELIG-DIS |
| T27 | YES、`ageRange` = 50_64 | 出現 S-ELIG-DIS，不出現 S-ELIG-OTHER |
| T28 | YES、新北市、careNeeds 含 ASSISTIVE_DEVICE 與 HOME_MEDICAL_NURSING | S-DIS-INTRO＋S-DIS-MED＋S-DIS-AD-LOCAL＋S-DIS-SOURCE；金額只來自知識（哨兵測試同 T20） |
| T29 | YES、臺北市、careNeeds 含 ASSISTIVE_DEVICE | 不出現新北市的 S-DIS-AD-LOCAL（地方隔離） |
| T30 | YES，但 careNeeds 與 mobilityLevel 都不符合 S-DIS-MED／S-DIS-AD-LOCAL | 不出現 S-DIS-INTRO（沒有內容時不留空標題） |
| T31 | `disabilityCertificate` = "MAYBE" | VALIDATION_ERROR |
| T32 | `incomeCategory` 未提供或 UNKNOWN | 與 r4 輸出完全相同（不出現 S-EST-*） |
| T33 | GENERAL、HOME_CARE | S-EST-COPAY 照顧及專業服務 16%；S-EST-CARE 第 2 級 10,020 元 → 1,603 元（FLOOR）、第 8 級 36,180 元 → 5,788 元；不出現並列三身分的 S-SUB-COPAY |
| T34 | MIDDLE_LOW_INCOME | 長照身分別第 1 類、比率 0 → 「可能免自付」；身障補助用中低收入戶欄 |
| T35 | ALLOWANCE、新北市烏來區、TRANSPORTATION | 第 2 類；交通第 4 區 7%，2,400 元 → 168 元 |
| T36 | GENERAL、YES、新北市、ASSISTIVE_DEVICE | 非動力樓梯滑椅 20,000 × 50% → 10,000 元；標「※」項目顯示全額 |
| T37 | 哨兵測試：比率、額度、身障上限換成哨兵值 | 估算只使用哨兵值 |
| T38 | `incomeCategory` = "RICH" | VALIDATION_ERROR |

## 10. 規則的維護

- 規則、關鍵字、模板、顯示文字對照一律在本文件修改，版本號遞增（`RULES-YYYY-MM-DD-rN`），並補對應測試。
- 程式不得出現本文件以外的規則，也不得出現任何政策數值（金額、比率、年齡門檻、分區、電話、服務時間）；這些只來自 PUBLISHED Knowledge。
- 未來若要引入 AI，需重新提出決策（費用、隱私、失敗行為），並先修訂 PRODUCT_SPEC §16。
