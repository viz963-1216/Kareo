# TASK-A-002 Provider Dataset Validation Report

> Submission Version: A-002-r1
> Scope: Taipei City / New Taipei City

## QA Findings

### NTPC-HC-003 — Service Area District Missing

- Provider: 台灣全齡長照股份有限公司附設新北市私立禾薪居家長照機構
- Official source service area: 新北市
- District-level service area: Not provided by source
- Action: ProviderServiceArea not created
- Reason: Do not infer service area from provider address
- Status: Pending more specific official source

## Validation Status

- Provider JSON syntax: PASS
- Unknown service areas are not guessed: PASS
- Final full-dataset validation: PENDING

### TP-HMN-001 — Service Area District Missing

- Provider: 台灣基督長老教會馬偕醫療財團法人附設馬偕居家護理所
- Provider Type: HOME_MEDICAL_NURSING
- Official source: 臺北市政府衛生局居家護理機構名單
- District-level service area: Not provided by source
- Action: ProviderServiceArea not created
- Reason: Provider address must not be used to infer service area
- Status: Pending more specific official source

### TP-HMN-002 — Service Area District Missing

- Provider: 臺北市立聯合醫院附設陽明居家護理所
- Provider Type: HOME_MEDICAL_NURSING
- Official source: 臺北市政府衛生局居家護理機構名單
- District-level service area: Not provided by source
- Action: ProviderServiceArea not created
- Reason: Provider address must not be used to infer service area
- Status: Pending more specific official source

### TP-HMN-003 — Service Area District Missing

- Provider: 國立臺灣大學醫學院附設醫院北護分院附設居家護理所
- Provider Type: HOME_MEDICAL_NURSING
- Official source: 臺北市政府衛生局居家護理機構名單
- District-level service area: Not provided by source
- Action: ProviderServiceArea not created
- Reason: Provider address must not be used to infer service area
- Status: Pending more specific official source

### TP-AD-001 — Provider-specific Service Area Not Available

- Provider: 晨玉有限公司
- Provider Type: ASSISTIVE_DEVICE
- Official source: 臺北市政府社會局長照輔具特約服務門市資料
- Program-level service area: 臺北市轄內各行政區
- Provider-specific district-level service area: Not provided by source
- Action: ProviderServiceArea not created
- Reason: Program-level coverage must not be assumed to equal an individual provider's service area
- Status: Pending provider-specific official evidence

### TP-AD-002 — Provider-specific Service Area Not Available

- Provider: 諾貝兒寶貝股份有限公司內湖分公司
- Provider Type: ASSISTIVE_DEVICE
- Official source: 臺北市政府社會局長照輔具特約服務門市資料
- Program-level service area: 臺北市轄內各行政區
- Provider-specific district-level service area: Not provided by source
- Action: ProviderServiceArea not created
- Reason: Program-level coverage must not be assumed to equal an individual provider's service area
- Status: Pending provider-specific official evidence

### TP-AD-003 — Provider-specific Service Area Not Available

- Provider: 可能設計有限公司
- Provider Type: ASSISTIVE_DEVICE
- Official source: 臺北市政府社會局長照輔具特約服務門市資料
- Program-level service area: 臺北市轄內各行政區
- Provider-specific district-level service area: Not provided by source
- Action: ProviderServiceArea not created
- Reason: Program-level coverage must not be assumed to equal an individual provider's service area
- Status: Pending provider-specific official evidence

### NTPC-AD-001 — Provider-specific Service Area Not Available

- Provider: 弘采介護有限公司
- Provider Type: ASSISTIVE_DEVICE
- Official source: 新北市長照輔具／無障礙服務特約廠商清冊
- Provider address: 新北市新店區中正路501-6號4樓(吉成特區)
- Provider-specific district-level service area: Not provided by source
- Action: ProviderServiceArea not created
- Reason: Provider address must not be used to infer service area
- Status: Pending provider-specific official evidence

### NTPC-AD-002 — Provider-specific Service Area Not Available

- Provider: 大瀚醫療儀器有限公司
- Provider Type: ASSISTIVE_DEVICE
- Official source: 新北市長照輔具／無障礙服務特約廠商清冊
- Provider address: 新北市板橋區校前街28號
- Provider-specific district-level service area: Not provided by source
- Action: ProviderServiceArea not created
- Reason: Provider address must not be used to infer service area
- Status: Pending provider-specific official evidence

### NTPC-AD-003 — Provider-specific Service Area Not Available

- Provider: 宏宇醫療器材行
- Provider Type: ASSISTIVE_DEVICE
- Official source: 新北市長照輔具／無障礙服務特約廠商清冊
- Provider address: 新北市板橋區南雅南路二段134號1樓
- Provider-specific district-level service area: Not provided by source
- Action: ProviderServiceArea not created
- Reason: Provider address must not be used to infer service area
- Status: Pending provider-specific official evidence

### NTPC-AD-004 — Provider-specific Service Area Not Available

- Provider: 吉評醫療器材股份有限公司
- Provider Type: ASSISTIVE_DEVICE
- Official source: 新北市長照輔具／無障礙服務特約廠商清冊
- Provider address: 新北市新店區安康路一段359-25號
- Provider-specific district-level service area: Not provided by source
- Action: ProviderServiceArea not created
- Reason: Provider address must not be used to infer service area
- Status: Pending provider-specific official evidence

### NTPC-AD-005 — Provider-specific Service Area Not Available

- Provider: 學府松藥局
- Provider Type: ASSISTIVE_DEVICE
- Official source: 新北市長照輔具／無障礙服務特約廠商清冊
- Provider address: 新北市土城區學府路一段38號
- Provider-specific district-level service area: Not provided by source
- Action: ProviderServiceArea not created
- Reason: Provider address must not be used to infer service area
- Status: Pending provider-specific official evidence

### NTPC-AD-006 — Provider-specific Service Area Not Available

- Provider: 兆謙益企業有限公司
- Provider Type: ASSISTIVE_DEVICE
- Official source: 新北市長照輔具／無障礙服務特約廠商清冊
- Provider address: 新北市林口區源泉街12號
- Provider-specific district-level service area: Not provided by source
- Action: ProviderServiceArea not created
- Reason: Provider address must not be used to infer service area
- Status: Pending provider-specific official evidence

### NTPC-AD-007 — Provider-specific Service Area Not Available

- Provider: 瑞康醫療器材有限公司
- Provider Type: ASSISTIVE_DEVICE
- Official source: 新北市長照輔具／無障礙服務特約廠商清冊
- Provider address: 新北市中和區圓通路295-1號
- Provider-specific district-level service area: Not provided by source
- Action: ProviderServiceArea not created
- Reason: Provider address must not be used to infer service area
- Status: Pending provider-specific official evidence

### NTPC-AD-008 — Provider-specific Service Area Not Available

- Provider: 鴻銘醫療儀器行
- Provider Type: ASSISTIVE_DEVICE
- Official source: 新北市長照輔具／無障礙服務特約廠商清冊
- Provider address: 新北市淡水區民生路47-2號
- Provider-specific district-level service area: Not provided by source
- Action: ProviderServiceArea not created
- Reason: Provider address must not be used to infer service area
- Status: Pending provider-specific official evidence

### NTPC-AD-009 — Provider-specific Service Area Not Available

- Provider: 美德耐股份有限公司雙和門市部
- Provider Type: ASSISTIVE_DEVICE
- Official source: 新北市長照輔具／無障礙服務特約廠商清冊
- Provider address: 新北市中和區中正路291號
- Provider-specific district-level service area: Not provided by source
- Action: ProviderServiceArea not created
- Reason: Provider address must not be used to infer service area
- Status: Pending provider-specific official evidence