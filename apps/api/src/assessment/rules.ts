import type { AssessmentNeedsInput, CareNeed, CreateAssessmentInput, IncomeCategory } from "../types/index.js";

// 依 docs/ASSESSMENT_RULES.md（RULES-2026-09-24-r5，SPEC-APPROVED 2026-09-24）。
// 本檔只放規則表本身（規則 ID、條件、關鍵字、分數、顯示文字對照），不放任何政策數值：
// 金額、比率、年齡門檻、分區、電話、服務時間一律從 PUBLISHED Knowledge 讀取（ASSESSMENT_RULES §6、§10）。
// 規則表修改時必須遞增 RULES_VERSION 並同步調整 tests/assessmentEngine.test.ts。
export const RULES_VERSION = "RULES-2026-09-25-r7";

// 同分時的固定順序（§5），也是 careNeeds 的輸出順序。
export const CARE_NEED_ORDER: readonly CareNeed[] = [
  "HOME_CARE",
  "HOME_MEDICAL_NURSING",
  "ASSISTIVE_DEVICE",
  "TRANSPORTATION",
];

export const NEED_FIELD: Record<CareNeed, keyof AssessmentNeedsInput> = {
  HOME_CARE: "homeCare",
  HOME_MEDICAL_NURSING: "medicalNursing",
  ASSISTIVE_DEVICE: "assistiveDevice",
  TRANSPORTATION: "transportation",
};

// 需求顯示名稱：r2 §6.2 沿用 r1 §6 的需求名稱（r2 未重列），與 contracts/mock/assessments/WITH-SUBSIDY-NEW_TAIPEI.json 一致。
export const CARE_NEED_LABELS: Record<CareNeed, string> = {
  HOME_CARE: "居家照顧",
  HOME_MEDICAL_NURSING: "居家醫療與護理",
  ASSISTIVE_DEVICE: "輔具與居家無障礙",
  TRANSPORTATION: "長照交通接送",
};

// ===== §3 結構化規則（只對 needs = UNKNOWN 的項目；UNKNOWN 欄位不觸發任何規則）=====

export interface StructuredRule {
  id: string;
  need: CareNeed;
  applies(input: CreateAssessmentInput): boolean;
}

const ASSISTED_MOBILITY = ["NEEDS_ASSISTANCE", "WHEELCHAIR", "BEDRIDDEN"];

export const STRUCTURED_RULES: readonly StructuredRule[] = [
  {
    id: "HC-R1",
    need: "HOME_CARE",
    applies: (i) => ["PARTIAL_ASSISTANCE", "HIGH_ASSISTANCE", "FULL_ASSISTANCE"].includes(i.dailyLivingLevel),
  },
  {
    // livingSituation = INSTITUTION 時不套用（本條件本身要求 ALONE，已自然排除）。
    id: "HC-R2",
    need: "HOME_CARE",
    applies: (i) => i.livingSituation === "ALONE" && ASSISTED_MOBILITY.includes(i.mobilityLevel),
  },
  {
    // 「dailyLivingLevel ≠ INDEPENDENT」不包含 UNKNOWN（§3：UNKNOWN 的欄位不觸發任何規則）。
    id: "HC-R3",
    need: "HOME_CARE",
    applies: (i) =>
      i.livingSituation !== "INSTITUTION" &&
      ["NO_CAREGIVER", "FAMILY_LIMITED"].includes(i.caregiverSituation) &&
      i.dailyLivingLevel !== "INDEPENDENT" &&
      i.dailyLivingLevel !== "UNKNOWN",
  },
  { id: "MN-R1", need: "HOME_MEDICAL_NURSING", applies: (i) => i.mobilityLevel === "BEDRIDDEN" },
  { id: "MN-R2", need: "HOME_MEDICAL_NURSING", applies: (i) => i.dailyLivingLevel === "FULL_ASSISTANCE" },
  { id: "AD-R1", need: "ASSISTIVE_DEVICE", applies: (i) => ASSISTED_MOBILITY.includes(i.mobilityLevel) },
  { id: "TR-R1", need: "TRANSPORTATION", applies: (i) => ["WHEELCHAIR", "BEDRIDDEN"].includes(i.mobilityLevel) },
];

// ===== §4 關鍵字規則（needs = UNKNOWN 且結構化規則未觸發時）=====

export interface KeywordRule {
  id: string;
  need: CareNeed;
  keywords: readonly string[];
}

export const KEYWORD_RULES: readonly KeywordRule[] = [
  {
    id: "KW-HC",
    need: "HOME_CARE",
    keywords: ["洗澡", "沐浴", "如廁", "上廁所", "換尿布", "餵食", "吃飯要人", "穿衣", "白天沒人", "沒人照顧", "獨居", "照顧不來", "喘不過氣"],
  },
  {
    id: "KW-MN",
    need: "HOME_MEDICAL_NURSING",
    keywords: ["傷口", "換藥", "壓瘡", "褥瘡", "鼻胃管", "尿管", "導尿", "氣切", "抽痰", "管路", "打針", "胰島素", "造口"],
  },
  {
    id: "KW-AD",
    need: "ASSISTIVE_DEVICE",
    keywords: ["輪椅", "助行器", "拐杖", "扶手", "跌倒", "滑倒", "樓梯", "上下樓", "爬樓梯", "浴室", "洗澡椅", "便盆椅", "電動床", "氣墊床"],
  },
  {
    id: "KW-TR",
    need: "TRANSPORTATION",
    keywords: ["就醫", "回診", "看診", "看醫生", "洗腎", "透析", "復健", "去醫院"],
  },
];

export const NEGATION_WORDS: readonly string[] = ["不", "沒", "無", "不用", "不需", "不需要", "沒有", "已經不"];
export const NEGATION_WINDOW = 4;

// ===== §5 排序分數 =====

export const SCORE_USER_YES = 3;
export const SCORE_STRUCTURED = 2;
export const SCORE_KEYWORD = 1;

export function priorityBonus(need: CareNeed, i: CreateAssessmentInput): number {
  let bonus = 0;
  if (need === "HOME_CARE") {
    if (["HIGH_ASSISTANCE", "FULL_ASSISTANCE"].includes(i.dailyLivingLevel)) bonus += 2;
    if (["NO_CAREGIVER", "FAMILY_LIMITED"].includes(i.caregiverSituation) || i.livingSituation === "ALONE") bonus += 1;
  }
  if (need === "HOME_MEDICAL_NURSING" && i.mobilityLevel === "BEDRIDDEN") bonus += 2;
  if (need === "ASSISTIVE_DEVICE" && ["NEEDS_ASSISTANCE", "WHEELCHAIR"].includes(i.mobilityLevel)) bonus += 1;
  if (need === "TRANSPORTATION" && ["WHEELCHAIR", "BEDRIDDEN"].includes(i.mobilityLevel)) bonus += 1;
  return bonus;
}

// ===== §6 顯示文字對照（描述 code 的意義；code 本身、數值與生效日一律來自 Knowledge）=====

export const CRITERIA_LABELS: Record<string, string> = {
  AGE_65_PLUS: "年滿 65 歲",
  INDIGENOUS_AGE_55_PLUS: "具原住民身分且年滿 55 歲",
  DISABILITY_CERTIFICATE: "領有身心障礙證明",
  DEMENTIA: "有失智症",
  PAC_PROGRAM: "屬急性後期整合照護計畫收案對象",
};

export const PERIOD_LABELS: Record<string, string> = {
  MONTHLY_6M_POOL: "按月給付，以 6 個月為一期",
  EVERY_3_YEARS: "每 3 年給付一次",
  YEARLY: "每年給付一次",
};

export const TRANSPORT_PURPOSE_LABELS: Record<string, string> = {
  MEDICAL: "就醫",
  REHABILITATION: "復健",
  DIALYSIS: "透析治療",
};

export const COPAY_CATEGORY_LABELS: Record<string, string> = {
  "1": "第一類（低收入戶、中低收入戶等）",
  "2": "第二類",
  "3": "第三類（一般戶）",
};

export const AUTHORITY_LABELS: Record<string, string> = {
  LAW: "全國法規資料庫",
  MOHW: "衛生福利部",
  TAIPEI_GOV: "臺北市政府",
  NEW_TAIPEI_GOV: "新北市政府",
};

// 輔具組別顯示文字：r2 §6.4 未列出，取自 contracts/mock/assessments/WITH-SUBSIDY-NEW_TAIPEI.json（規格缺口，已於 PR 列出）。
export const ASSISTIVE_GROUP_LABELS: Record<string, string> = {
  GROUP_1: "第一組",
  GROUP_2: "第二組",
};

// S-SUB-* 項目句使用的給付項目名稱（即各模板開頭的文字，§6.3），S-SUB-COPAY 的「{第一個出現的項目}」沿用。
export const BENEFIT_ITEM_LABELS: Record<string, string> = {
  CARE_AND_PROFESSIONAL: "照顧及專業服務",
  RESPITE: "家庭照顧者喘息服務",
  ASSISTIVE_DEVICE_AND_HOME_MODIFICATION: "輔具及居家無障礙環境改善服務",
  TRANSPORTATION: "交通接送服務",
};

export const HOTLINE_DAY_LABELS: Record<string, string> = {
  Mon: "週一",
  Tue: "週二",
  Wed: "週三",
  Thu: "週四",
  Fri: "週五",
  Sat: "週六",
  Sun: "週日",
};

// MVP 服務縣市（API_CONTRACT v0.2.2 §8：city 只接受這兩個值）與 Knowledge jurisdiction 的對應。
export const CITY_JURISDICTION: Record<string, "TAIPEI" | "NEW_TAIPEI"> = {
  臺北市: "TAIPEI",
  新北市: "NEW_TAIPEI",
};

// §6.6 個人自付估算（r5，D-17a）身分對照表。ALLOWANCE 的長照身分別是「2」，但身障補助欄位沿用 GENERAL
// （§6.6 表格：incomeOrder 只有 LOW_INCOME／MIDDLE_LOW_INCOME／GENERAL 三欄，沒有 ALLOWANCE 專屬欄位）。
export const INCOME_CATEGORY_LABELS: Record<Exclude<IncomeCategory, "UNKNOWN">, string> = {
  LOW_INCOME: "低收入戶",
  MIDDLE_LOW_INCOME: "中低收入戶",
  ALLOWANCE: "領有中低收入老人生活津貼或身心障礙者生活補助",
  GENERAL: "一般戶",
};

export const INCOME_CATEGORY_COPAY_TIER: Record<Exclude<IncomeCategory, "UNKNOWN">, "1" | "2" | "3"> = {
  LOW_INCOME: "1",
  MIDDLE_LOW_INCOME: "1",
  ALLOWANCE: "2",
  GENERAL: "3",
};

export const INCOME_CATEGORY_DISABILITY_FIELD: Record<Exclude<IncomeCategory, "UNKNOWN">, "LOW_INCOME" | "MIDDLE_LOW_INCOME" | "GENERAL"> = {
  LOW_INCOME: "LOW_INCOME",
  MIDDLE_LOW_INCOME: "MIDDLE_LOW_INCOME",
  ALLOWANCE: "GENERAL",
  GENERAL: "GENERAL",
};

// §6.6 計算規則 1：自付金額＝額度 × 比率，FLOOR（無條件捨去）。
export function floorByRate(amount: number, ratePercent: number): number {
  return Math.floor((amount * ratePercent) / 100);
}

// §7 固定 warnings。文字依 API_CONTRACT §15（高於 ASSESSMENT_RULES 的規格順位）；兩份文件文字不一致已於 PR 列出。
export const MANDATORY_WARNINGS: readonly string[] = [
  "本結果僅為初步預估。",
  "實際資格、長照等級與補助仍需由正式長照評估確認。",
];
