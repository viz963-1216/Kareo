# Kareo / 長照一點通 — Product Spec

Version: v0.6（J-002-r4，2026-09-24：§40–41 Jerry 指定資料夾來源 D-15；§37 身心障礙證明選填題 D-17、家庭經濟身分選填題與個人自付估算 D-17a）  
Status: LOCKED FOR MVP  
Owner: Jerry

---

# 1. 產品定位

Kareo / 長照一點通是一個提供給可能有長照需求的本人與家屬使用的免費長照需求初評與服務媒合平台。

核心流程：

```text
不知道是否需要長照
↓
完成免費初步評估
↓
了解可能需要哪些服務
↓
了解可能適用的制度與補助
↓
查看適合的服務單位
↓
提出媒合需求或查看更多資源
↓
聯絡 1966 / 照顧管理專員進行正式評估
```

# 2. 平台角色

平台主要提供：

- 長照需求初步評估
- 可能資格與補助的初步預估
- 照護服務建議
- 長照資源整理
- Provider 推薦
- 商家媒合
- 官方資訊導引

平台不是：

- 政府機關
- 長照資格核定單位
- 醫療診斷單位
- 正式 CMS 等級評估單位

# 3. 使用者完全免費

Consumer Price = 0

使用者可免費使用：

- Assessment / 初步評估
- Care Need Profile / 照護需求分析
- 補助初步預估
- 服務建議
- Top 3 Provider Recommendation
- Google Maps 資源查看
- 我要媒合
- Kareocar 外部導流

MVP 不建立：

- 使用者付款
- 付費解鎖
- Subscription
- 30 / 60 / 90 元方案
- Consumer Payment

# 4. 商業模式

平台只向 B2B 商家端變現。

未來可能收入來源：

- 商家認證
- 商家會員
- Qualified Lead 收費
- 成功媒合費
- Sponsored 曝光
- 商家 CRM / Lead 管理工具

MVP 不要求完成商家收費系統。

MVP 最重要的是先建立：

```text
User Need
↓
Recommendation
↓
Lead
↓
Provider
```

這條完整資料鏈。

# 5. Organic Recommendation 與商業曝光分離

自然推薦 Top 3 不得因為商家付費而改變排序。

未來如果有付費曝光，必須清楚標示：

```text
Sponsored
贊助推薦
```

禁止商家付費後偷偷進入自然推薦第一名。

# 6. 目標使用者

MVP 主要使用者：

- 家中開始出現照護需求的人
- 不確定是否需要長照的人
- 不知道該找哪一種服務的人
- 剛開始接觸 1966 的家屬
- 正在找居家照顧、輔具、居家醫護或長照交通的人

# 7. MVP 服務地區

第一階段：

- 臺北市
- 新北市

架構必須允許未來擴展到其他縣市。

# 8. MVP 服務類別

第一版支援：

```text
HOME_CARE
HOME_MEDICAL_NURSING
ASSISTIVE_DEVICE
TRANSPORTATION
```

# 9. HOME_CARE / 居家照顧

主要包含：

- 居家服務
- 日常生活協助
- 基本照護協助
- 喘息相關需求

第一版可以先把喘息視為 HOME_CARE 的 sub-service。

# 10. HOME_MEDICAL_NURSING / 居家醫療與護理

平台提供資訊、初步需求判斷、Provider 導引與媒合。

實際醫療與護理服務必須由合格單位執行。

# 11. ASSISTIVE_DEVICE / 輔具

例如：

- 輪椅
- 助行器
- 照護床
- 移位設備
- 其他長照相關輔具

平台可提供輔具建議、租借資訊、購買資訊、補助導引與 Provider 推薦。

# 12. TRANSPORTATION / 長照交通

長照交通使用既有 `Kareocar`。

Kareocar 在 Kareo 中屬於 External Service。

正式網址：`https://kareocar.netlify.app/`

MVP 只做外部連結導流。

禁止：

- iframe
- 內嵌 Kareocar
- 共用 Backend
- 共用 Database
- 共用登入
- 重做派車功能

# 13. Kareocar 使用流程

```text
CareNeedProfile
↓
TRANSPORTATION
↓
顯示長照交通服務
↓
「前往 Kareocar」
↓
https://kareocar.netlify.app/
↓
開新分頁
```

# 14. MVP User Flow

```text
Homepage
↓
開始免費評估
↓
閱讀並同意服務說明 / Disclaimer / Privacy
↓
Assessment
↓
Care Need Profile
↓
初步照護建議
↓
Service Recommendation
↓
Top 3 Provider
```

使用者可以：

- 查看 Provider
- 我要媒合
- 前往 Google Maps 查看更多
- TRANSPORTATION → Kareocar

最後提醒聯絡 1966 或所在地長期照顧管理中心進行正式評估。

# 15. Assessment 的目的

Assessment 不直接決定哪一家商家最好。

Assessment 只負責判斷：這個使用者可能需要什麼服務？

輸出 CareNeedProfile，例如：

```json
{
  "careNeeds": ["HOME_CARE", "ASSISTIVE_DEVICE", "TRANSPORTATION"],
  "priority": ["HOME_CARE", "TRANSPORTATION", "ASSISTIVE_DEVICE"]
}
```

# 16. AI 的責任

**MVP 決策（2026-09-23，MVP_DECISIONS D-01 方案 B）：MVP 不使用 AI／LLM。** Assessment 由確定性規則引擎產生（`docs/ASSESSMENT_RULES.md`），以控制成本並避免健康資料送往外部服務。以下為未來若引入 AI 時的責任範圍；引入前須重新決策並修訂本節。

AI 可以負責：

- 理解使用者描述
- 協助初步需求判斷
- 整理 Care Need Profile
- 整理使用者看得懂的結果
- 解釋可能需要哪些服務
- 使用目前有效的 Knowledge 回答制度問題

# 17. AI 不負責挑商家

禁止 LLM 自己決定三家公司。

正確流程：

```text
Assessment
↓
CareNeedProfile
↓
Recommendation Engine
↓
Provider Database
↓
Top 3
```

# 18. Provider Database

Provider Database 是 Provider 資料的 Source of Truth。

Google Maps 不是 Provider Database。

Provider 至少包含：ID、名稱、類型、地址、縣市、行政區、經緯度、電話、Website、Google Maps URL、服務類型、服務範圍、狀態、verified。

# 19. 地址與服務區域分離

必須區分 Provider Address 與 Provider Service Area。

例如商家地址在台北市中山區，但服務範圍包含新北市三重區，仍然可以推薦給三重區使用者。

# 20. Top 3 Recommendation

每種服務最多推薦 3 家。

只有 2 家符合就回傳 2 家；沒有符合則顯示 Empty State，不得直接 Error。

# 21. 有精確位置時

如果使用者提供 GPS、Latitude / Longitude 或可定位的完整地址：

```text
Eligible Provider
↓
Service Type Match
↓
Service Area Match
↓
Distance
↓
Top 3
```

# 22. 只有行政區時

例如新北市三重區：

```text
Eligible Provider
↓
Service Type Match
↓
Service Area Match
↓
Stable Rotation
↓
Top 3
```

不得宣稱「距離最近的三家」。

# 23. Stable Rotation

禁止使用純 Random。

同一位使用者同一天重新整理時，不要每次看到不同商家。

Seed 概念可使用：

```text
sessionId + district + date
```

不同日期可以輪替。

# 24. 完全沒有位置時

可以完成 Assessment、Care Need Profile 與服務建議，但不能宣稱「附近商家」。

應提醒使用者提供縣市／行政區後可以取得更適合的推薦。

# 25. Google Maps

Google Maps 用途：查看目前位置、Provider、距離、導航與更多單位。

平台可以整理 Google Maps List，但 Provider Database 仍然是正式 Source of Truth；Google Maps 只是 View / Navigation Layer。

# 26. Provider Result 顯示

至少顯示：Provider 名稱、Service Type、地區、推薦原因、Distance（若有）、詳細資料、Google Maps、我要媒合。

# 27. 推薦原因必須可解釋

禁止只顯示 Score。

至少要有：

```json
[
  "服務範圍包含三重區",
  "提供您需要的居家照顧服務"
]
```

如果有精確距離，可以加入「距離約 1.8 公里」。

# 28. 我要媒合

使用者按「我要媒合」後建立 Lead。

平台需記錄：Assessment、Service、Provider、Session 與 Lead Status。

# 29. Lead Status

```text
NEW
CONTACTED
ACCEPTED
CLOSED
CANCELLED
```

# 30. 使用者登入

MVP 不強迫登入，優先使用 sessionId。

未來需要保存歷史、跨裝置或查看媒合進度時，再建立正式 User Account。

# 31. Disclaimer / 免責聲明

Assessment 開始前，使用者必須明確同意。

建議使用 Clickwrap：

```text
[ ] 我已閱讀並同意平台服務說明與免責聲明
```

# 32. Consent 紀錄

至少保存：

```text
sessionId
disclaimerVersion
privacyVersion
termsVersion
acceptedAt
```

條款重大更新時，應要求重新同意。

# 33. 平台結果必須使用「預估」

平台不得寫「您符合長照資格」，應寫「依目前提供資訊，您可能符合相關長照服務資格」。

不得寫「您已核定 CMS 第 X 級」，應寫「目前僅能進行初步需求預估」。

# 34. 必須持續提醒正式評估

至少出現在 Assessment 前、Assessment Result、補助資訊、Provider Recommendation 與 Footer。

核心提醒：

```text
本平台提供的結果僅為初步預估，
不代表正式長照資格、長照等級或補助核定結果。

實際資格、服務內容與補助，
仍應由 1966 或所在地長期照顧管理中心進行正式評估確認。
```

# 35. 非醫療診斷

平台不提供疾病診斷、醫療診斷、治療決策或緊急醫療判斷。

涉及醫療問題時，應尋求合格醫療專業人員。

# 36. Privacy 與 Disclaimer 分開

Disclaimer 不是 Privacy Notice。

如果平台收集照護需求、行動能力、健康相關資訊或聯絡資料，必須另外提供 Privacy Notice / 個資告知。

# 37. Data Minimization

MVP 只收完成功能真正需要的資料。

不要因為未來可能有用就先收身分證、完整病歷、診斷書、金融資料或非必要健康資料。

**2026-09-24 變更（MVP_DECISIONS D-17）**：Assessment 新增選填題「是否領有身心障礙證明」（是／否／不確定）。只收這一個是否題，不收障礙類別、等級或證明文件。回答「是」時，結果頁另外說明可能適用的身心障礙福利補助（例如醫療輔具、地方輔具加碼），並標明與長照給付分開申請；金額依官方規定按身分別（低收入戶／中低收入戶／一般戶）列出上限，不宣稱核定。

**2026-09-24 變更（D-17a）**：Assessment 再新增選填題「家庭經濟身分」（低收入戶／中低收入戶／領有中低收入老人生活津貼或身心障礙者生活補助／以上皆非／不確定）。使用者選擇後，結果頁依官方規定**估算該使用者自己的**長照自付比例與金額範例、身障補助上限；不確定時照舊並列各身分。估算一律標示「依您自選身分的估算，實際以主管機關認定與照管專員核定為準」，仍不宣稱核定。此項取代 J-002-r4 原先「不計算個人金額」的限制（Jerry 決定）。

# 38. Knowledge Database

平台建立 Long-Term Care Knowledge Base。

目的：讓 Assessment 與補助預估使用目前有效資料，避免把政策寫死在 Code、Prompt 或完全依賴 LLM 記憶。

# 39. Knowledge 內容

至少管理：長照資格、給付制度、自付比例、居家服務、喘息、輔具、交通、居家醫療／護理、補助、申請流程、中央制度、臺北市制度、新北市制度。

# 40. Knowledge Official Sources

MVP 僅允許官方白名單。

中央：衛生福利部、1966 / 長照專區、全國法規資料庫。

地方：臺北市政府、新北市政府。

**Jerry 指定資料夾（2026-09-24 變更，MVP_DECISIONS D-15）**：Google 雲端硬碟「Kareo／2.網頁架構補充資料」資料夾（folder id `1h3pDfDYOy1Qo4OOiP9duUJ4DUK0NJ6Fh`）內、由 Jerry 放入的文件，可作為知識來源。條件：

- 只限這一個資料夾；其他雲端硬碟、網站或檔案仍不得作為來源。
- 每個檔案須逐一登錄於 Source Registry（檔案 ID、名稱、原發布機關、內容雜湊），未登錄者不得使用。
- 文件真實性與版本由 Jerry 負責；紀錄仍須經 NEEDS_REVIEW → Jerry 審核 → APPROVED → PUBLISHED，不因來自此資料夾而免審。
- 同一內容若官方網站有公開版本，優先引用官方網址。

# 41. 非官方網站

禁止自動把部落格、Facebook、LINE、一般新聞、SEO 文章或商業網站當正式 Assessment Knowledge。§40 的 Jerry 指定資料夾是唯一例外，且只限該資料夾中已登錄的檔案。

# 42. Knowledge 自動更新

每天 00:10，Timezone = Asia/Taipei。

```text
Official Source
↓
Crawler
↓
Snapshot
↓
Content Hash
↓
Compare
↓
Detect Change
↓
KnowledgeChange
↓
Review
↓
Publish
```

# 43. Knowledge 不得自動上線

Crawler 發現制度改變，不能直接修改 Production Rule。

必須：

```text
DISCOVERED
↓
NEEDS_REVIEW
↓
Jerry / Admin Review
↓
APPROVED
↓
PUBLISHED
```

只有 PUBLISHED 可以被正式 Assessment 使用。

# 44. Knowledge Version

每次正式更新建立版本，例如：

```text
KB-2026-09-14-001
```

每一筆 Assessment 必須記錄當時使用的 knowledgeVersion。

# 45. Knowledge 必須保存來源

每筆正式 Knowledge 至少保存：title、category、jurisdiction、sourceAuthority、sourceUrl、publishedAt、effectiveFrom、effectiveTo、fetchedAt、lastVerifiedAt、contentHash、version、status。

# 46. Jurisdiction / 適用地區

至少：

```text
TAIWAN
TAIPEI
NEW_TAIPEI
```

台北市地方補助不能套用給新北市使用者。

# 47. 公告日與生效日分離

必須區分 publishedAt 與 effectiveFrom。

例如 6 月公告、7 月 1 日生效，6 月期間不能提前把新制當成目前有效制度。

# 48. Knowledge Conflict

如果不同官方來源看起來互相衝突，禁止 AI 自己判斷。

標記 CONFLICT / NEEDS_REVIEW，交由 Jerry / Admin 判斷。

# 49. Crawler Failure

如果官方網站抓取失敗，不得清空 Knowledge、刪除舊資料或使用半套新資料。

系統繼續使用 Last Published Knowledge Version。

# 50. AI Knowledge Rule

MVP 由規則引擎只引用 Current Published Knowledge 的已核准內容（ASSESSMENT_RULES §6）。未來若引入 AI：

AI 回答資格、補助、制度、申請相關問題時，優先使用 Current Published Knowledge，而不是模型內建記憶。

# 51. AI 不確定時

如果 Knowledge 不足，AI 不得猜。

應回答：

```text
目前平台資料不足以做出可靠預估，
建議聯絡 1966 或所在地長期照顧管理中心確認。
```

# 52. Knowledge DB 與 Provider DB 分離

Knowledge DB 回答「目前制度怎麼規定？」

Provider DB 回答「可以找誰？」

兩者不能混在同一套資料表邏輯裡。

# 53. MVP 首頁

首頁主要 CTA：

```text
開始免費長照評估
```

避免第一頁塞專業代碼、大量法規、CMS 術語或過多制度資訊。

核心目標是讓第一次接觸長照的人知道下一步該怎麼做。

# 54. MVP 核心畫面

至少：

1. Homepage / 首頁
2. Consent / 同意與免責
3. Assessment / 初步評估
4. Assessment Result / 初評結果
5. Service Recommendation / 服務建議
6. Provider Top 3 / 前三家推薦
7. Provider Detail / 商家詳細
8. Lead Form / 我要媒合
9. Google Maps CTA
10. Kareocar CTA

# 55. MVP 不做

第一階段不做：

- Consumer Payment
- Consumer Subscription
- 使用者付費
- 完整 Provider CRM
- 完整 ERP
- Kareocar 內嵌
- 長照車派車
- 正式政府資格核定
- 正式 CMS 等級認定
- 自動批准補助
- AI 自己挑 Provider
- 未審核 Knowledge 自動上線
- 大量敏感醫療資料儲存

# 56. MVP 成功條件

不是功能越多越好，而是驗證這條路徑：

```text
使用者進站
↓
完成 Assessment
↓
理解自己的可能需求
↓
查看 Provider
↓
點擊 Google Maps / 我要媒合 / Kareocar
↓
產生有效行動
```

# 57. Product Source of Truth

本文件是最高層產品需求規格。

優先順序：

```text
PRODUCT_SPEC.md
↓
ARCHITECTURE.md
↓
DATA_MODEL.md
↓
API_CONTRACT.md
↓
GIT_RULES.md
↓
TASK
↓
Code
```

# 58. Change Rule

重大產品改動必須：

```text
提出 Change
↓
Jerry Review
↓
修改 PRODUCT_SPEC.md
↓
同步修改相關 Spec
↓
建立新的 Task
↓
才能修改正式功能
```

禁止先改 Code 之後再補 Spec。

# 59. Golden Rule

所有功能都必須符合：

```text
Free for User
免費使用

Preliminary Assessment
初步預估

Official Knowledge
官方資料優先

Explainable Recommendation
推薦原因可解釋

Central Integration
Jerry 中心整合
```
