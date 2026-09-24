import type { AgeRange, CareNeed, CaregiverSituation, CreateAssessmentInput } from "../types/index.js";
import { isEffectiveOn, type KnowledgeSnapshotRecord, type KnowledgeView } from "./knowledgeSnapshot.js";
import {
  ASSISTIVE_GROUP_LABELS,
  AUTHORITY_LABELS,
  BENEFIT_ITEM_LABELS,
  CARE_NEED_LABELS,
  CITY_JURISDICTION,
  COPAY_CATEGORY_LABELS,
  CRITERIA_LABELS,
  HOTLINE_DAY_LABELS,
  PERIOD_LABELS,
  TRANSPORT_PURPOSE_LABELS,
} from "./rules.js";

// 依 ASSESSMENT_RULES §6（RULES-2026-09-23-r2）組成 summary。
// - 只使用 §6 的模板文字；{} 內的值只從 KnowledgeView（同一個 PUBLISHED 版本的快照）讀取。
// - 某句所需的紀錄缺少、未生效、已過期、衝突或格式不符 → 省略該句，不使用預設值或其他縣市資料。
// - 本檔不得出現任何政策數值（金額、比率、年齡門檻、分區、電話、服務時間）。
export interface SummaryComposition {
  lines: string[];
  templateIds: string[];
  knowledgeRecordIds: string[];
  nextStepAvailable: boolean; // S-NEXT 無法產生時，Service 必須回 KNOWLEDGE_UNAVAILABLE（§6.1）
}

interface Sentence {
  templateId: string;
  text: string;
  records: KnowledgeSnapshotRecord[];
}

type BenefitItem = "CARE_AND_PROFESSIONAL" | "RESPITE" | "ASSISTIVE_DEVICE_AND_HOME_MODIFICATION" | "TRANSPORTATION";

interface ItemSentence extends Sentence {
  item: BenefitItem;
  transportZone: string | null; // 只有能確定單一分區時才有值（S-SUB-COPAY 用）
}

const AGE_65_PLUS_RANGES: AgeRange[] = ["65_74", "75_84", "85_PLUS"];
const YOUNGER_RANGES: AgeRange[] = ["UNDER_50", "50_64"];
const RESPITE_CAREGIVERS: CaregiverSituation[] = ["FAMILY_AVAILABLE", "FAMILY_LIMITED"];

// ===== 格式工具 =====

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function formatAmount(n: number): string {
  const [intPart, decPart] = String(n).split(".");
  const withSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decPart ? `${withSep}.${decPart}` : withSep;
}

// 「a」「a或b」「a、b或c」
function joinOr(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join("、")}或${items[items.length - 1]}`;
}

// 數值可以是純數字，或帶自己生效日的 { amount, effectiveFrom, effectiveTo }；未生效者視為不存在（§6.3 呈現規則 1）。
function effectiveNumber(value: unknown, today: string): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (isRecord(value) && typeof value.amount === "number" && Number.isFinite(value.amount)) {
    return isEffectiveOn(value.effectiveFrom, value.effectiveTo, today) ? value.amount : null;
  }
  return null;
}

function effectiveNumberEntries(map: unknown, today: string): Array<[string, number]> {
  if (!isRecord(map)) return [];
  const out: Array<[string, number]> = [];
  for (const [key, value] of Object.entries(map)) {
    const n = effectiveNumber(value, today);
    if (n !== null) out.push([key, n]);
  }
  return out;
}

// 「Mon-Fri HH:MM-HH:MM,HH:MM-HH:MM」→「週一至週五 H:MM–HH:MM、H:MM–HH:MM」（§6.4）；無法解析回 null（省略括號內容）。
export function formatHotlineHours(hours: unknown): string | null {
  if (typeof hours !== "string") return null;
  const day = "(Mon|Tue|Wed|Thu|Fri|Sat|Sun)";
  const range = "\\d{2}:\\d{2}-\\d{2}:\\d{2}";
  const match = new RegExp(`^${day}-${day} (${range}(?:,${range})*)$`).exec(hours.trim());
  if (!match) return null;
  const time = (t: string) => t.replace(/^0(\d)/, "$1");
  const ranges = match[3].split(",").map((r) => {
    const [from, to] = r.split("-");
    return `${time(from)}–${time(to)}`;
  });
  return `${HOTLINE_DAY_LABELS[match[1]]}至${HOTLINE_DAY_LABELS[match[2]]} ${ranges.join("、")}`;
}

// ===== Composer =====

export function composeSummary(
  input: CreateAssessmentInput,
  priority: CareNeed[],
  view: KnowledgeView
): SummaryComposition {
  const today = view.today;
  const sentences: Sentence[] = [];
  const hotline = readHotline(view);

  // S-NEEDS／S-NONE
  if (priority.length > 0) {
    const [first, ...rest] = priority.map((n) => CARE_NEED_LABELS[n]);
    const text =
      rest.length > 0
        ? `依您目前提供的資訊，可能優先需要${first}，也可能需要${rest.join("、")}。`
        : `依您目前提供的資訊，可能優先需要${first}。`;
    sentences.push({ templateId: "S-NEEDS", text, records: [] });
  } else if (hotline) {
    sentences.push({
      templateId: "S-NONE",
      text: `依您目前提供的資訊，尚未看出明確的長照服務需求。若狀況改變或仍有疑問，建議撥打 ${hotline.number} 詢問。`,
      records: [hotline.record],
    });
  }

  // S-INSTITUTION
  if (input.livingSituation === "INSTITUTION" && hotline) {
    sentences.push({
      templateId: "S-INSTITUTION",
      text: `目前居住於機構者，部分居家服務可能不適用，建議先與機構或 ${hotline.number} 確認。`,
      records: [hotline.record],
    });
  }

  // S-ELIG-*
  const elig = eligibilitySentence(input.ageRange, view, today);
  if (elig) sentences.push(elig);

  // S-SUB-*
  sentences.push(...subsidySentences(input, priority, view, today));

  // S-LOCAL-*
  sentences.push(...localSentences(input, view, hotline));

  // S-NEXT
  let nextStepAvailable = false;
  if (hotline) {
    const hours = formatHotlineHours(hotline.hours);
    sentences.push({
      templateId: "S-NEXT",
      text: hours
        ? `下一步可撥打長照專線 ${hotline.number}（${hours}）申請到府評估。`
        : `下一步可撥打長照專線 ${hotline.number}申請到府評估。`,
      records: [hotline.record],
    });
    nextStepAvailable = true;
  }

  const recordIds = new Set<string>();
  for (const s of sentences) for (const r of s.records) recordIds.add(r.id);

  return {
    lines: sentences.map((s) => s.text),
    templateIds: sentences.map((s) => s.templateId),
    knowledgeRecordIds: [...recordIds].sort(),
    nextStepAvailable,
  };
}

interface Hotline {
  number: string;
  hours: unknown;
  record: KnowledgeSnapshotRecord;
}

function readHotline(view: KnowledgeView): Hotline | null {
  const record = view.findOne("APPLICATION_CHANNELS", "TAIWAN");
  if (!record) return null;
  const hotline = record.ruleData.hotline;
  if (!isRecord(hotline) || !isNonEmptyString(hotline.number)) {
    view.invalid("APPLICATION_CHANNELS");
    return null;
  }
  return { number: hotline.number, hours: hotline.hours, record };
}

function eligibilitySentence(ageRange: AgeRange, view: KnowledgeView, today: string): Sentence | null {
  const record = view.findOne("ELIGIBILITY_ANY_OF", "TAIWAN");
  if (!record) return null;
  const criteria = record.ruleData.criteria;
  if (!Array.isArray(criteria)) {
    view.invalid("ELIGIBILITY_ANY_OF");
    return null;
  }

  // criteria 有自己的 effectiveFrom 且晚於今天 → 不列入；對照表沒有的 code → 省略並記錄（§6.2、T22）。
  const codes: string[] = [];
  for (const c of criteria) {
    if (!isRecord(c) || !isNonEmptyString(c.code)) continue;
    if (!isEffectiveOn(c.effectiveFrom, c.effectiveTo, today)) continue;
    if (!(c.code in CRITERIA_LABELS)) {
      view.unmapped("ELIGIBILITY_ANY_OF", c.code);
      continue;
    }
    codes.push(c.code);
  }

  if (AGE_65_PLUS_RANGES.includes(ageRange)) {
    if (!codes.includes("AGE_65_PLUS")) return null;
    return {
      templateId: "S-ELIG-AGE",
      text: "依年齡，可能符合長照服務的申請條件，實際仍需經照管專員評估。",
      records: [record],
    };
  }
  if (YOUNGER_RANGES.includes(ageRange)) {
    const others = codes.filter((c) => c !== "AGE_65_PLUS").map((c) => CRITERIA_LABELS[c]);
    if (others.length === 0) return null;
    return {
      templateId: "S-ELIG-OTHER",
      text: `若${joinOr(others)}，也可能符合申請條件，實際仍需經照管專員評估。`,
      records: [record],
    };
  }
  if (codes.length === 0) return null;
  return {
    templateId: "S-ELIG-UNKNOWN",
    text: `是否符合申請條件，需依${joinOr(codes.map((c) => CRITERIA_LABELS[c]))}等情況由照管專員評估。`,
    records: [record],
  };
}

// ===== S-SUB-*（§6.3）=====

function subsidySentences(
  input: CreateAssessmentInput,
  priority: CareNeed[],
  view: KnowledgeView,
  today: string
): Sentence[] {
  const itemsRecord = view.findOne("BENEFIT_ITEMS", "TAIWAN");
  if (!itemsRecord) return [];
  const items = itemsRecord.ruleData.items;
  if (!Array.isArray(items)) {
    view.invalid("BENEFIT_ITEMS");
    return [];
  }
  const amountsRecord = view.findOne("BENEFIT_AMOUNTS", "TAIWAN");
  const periodsRecord = view.findOne("BENEFIT_PERIODS", "TAIWAN");
  const has = (need: CareNeed) => priority.includes(need);

  const periodLabel = (item: BenefitItem): string | null => {
    if (!periodsRecord) return null;
    const code = periodsRecord.ruleData[item];
    if (!isNonEmptyString(code)) return null;
    if (!(code in PERIOD_LABELS)) {
      view.unmapped("BENEFIT_PERIODS", code);
      return null;
    }
    return PERIOD_LABELS[code];
  };

  const itemSentences: ItemSentence[] = [];

  // S-SUB-CARE
  if ((has("HOME_CARE") || has("HOME_MEDICAL_NURSING")) && items.includes("CARE_AND_PROFESSIONAL") && amountsRecord) {
    const levels = effectiveNumberEntries(amountsRecord.ruleData.careAndProfessionalMonthly, today).filter(([k]) =>
      /^\d+$/.test(k)
    );
    const period = periodLabel("CARE_AND_PROFESSIONAL");
    if (levels.length > 0 && period) {
      const levelNums = levels.map(([k]) => Number(k));
      const amounts = levels.map(([, v]) => v);
      itemSentences.push({
        templateId: "S-SUB-CARE",
        item: "CARE_AND_PROFESSIONAL",
        transportZone: null,
        text: `照顧及專業服務：每月額度依核定等級約 ${formatAmount(Math.min(...amounts))} 至 ${formatAmount(
          Math.max(...amounts)
        )} 元（第 ${Math.min(...levelNums)} 至第 ${Math.max(...levelNums)} 級），${period}。`,
        records: [itemsRecord, amountsRecord, periodsRecord as KnowledgeSnapshotRecord],
      });
    }
  }

  // S-SUB-RESPITE
  if (
    has("HOME_CARE") &&
    RESPITE_CAREGIVERS.includes(input.caregiverSituation) &&
    items.includes("RESPITE") &&
    amountsRecord
  ) {
    const amounts = effectiveNumberEntries(amountsRecord.ruleData.respiteYearly, today).map(([, v]) => v);
    if (amounts.length > 0) {
      itemSentences.push({
        templateId: "S-SUB-RESPITE",
        item: "RESPITE",
        transportZone: null,
        text: `家庭照顧者喘息服務：每年額度依核定等級約 ${formatAmount(Math.min(...amounts))} 至 ${formatAmount(
          Math.max(...amounts)
        )} 元。`,
        records: [itemsRecord, amountsRecord],
      });
    }
  }

  // S-SUB-AD
  if (has("ASSISTIVE_DEVICE") && items.includes("ASSISTIVE_DEVICE_AND_HOME_MODIFICATION") && amountsRecord) {
    const groups: string[] = [];
    for (const [code, amount] of effectiveNumberEntries(amountsRecord.ruleData.assistiveDevice3Years, today).sort(
      ([a], [b]) => a.localeCompare(b)
    )) {
      if (!(code in ASSISTIVE_GROUP_LABELS)) {
        view.unmapped("BENEFIT_AMOUNTS", code);
        continue;
      }
      groups.push(`${ASSISTIVE_GROUP_LABELS[code]} ${formatAmount(amount)} 元`);
    }
    const period = periodLabel("ASSISTIVE_DEVICE_AND_HOME_MODIFICATION");
    if (groups.length > 0 && period) {
      itemSentences.push({
        templateId: "S-SUB-AD",
        item: "ASSISTIVE_DEVICE_AND_HOME_MODIFICATION",
        transportZone: null,
        // 模板「為 {各組額度}」的空白是佔位符間距；依 WITH-SUBSIDY-NEW_TAIPEI Mock 的呈現，中文字之間不留空白。
        text: `輔具及居家無障礙環境改善服務：${period}，額度依核定組別為${groups.join("、")}。`,
        records: [itemsRecord, amountsRecord, periodsRecord as KnowledgeSnapshotRecord],
      });
    }
  }

  // S-SUB-TR
  if (has("TRANSPORTATION") && items.includes("TRANSPORTATION") && amountsRecord) {
    const tr = transportationSentence(input, itemsRecord, amountsRecord, view, today);
    if (tr) itemSentences.push(tr);
  }

  if (itemSentences.length === 0) return [];

  const out: Sentence[] = [];

  // S-SUB-INTRO
  const levelRecord = view.findOne("LEVEL_RANGE", "TAIWAN");
  if (levelRecord) {
    const min = levelRecord.ruleData.benefitEligibleMin;
    if (typeof min === "number" && Number.isInteger(min)) {
      out.push({
        templateId: "S-SUB-INTRO",
        text: `若經照管專員評估為長照需要等級第 ${min} 級以上，依官方規定可能可使用下列長照給付；以下為官方公告的規則與上限，不是您的核定結果。`,
        records: [levelRecord],
      });
    } else {
      view.invalid("LEVEL_RANGE");
    }
  }

  out.push(...itemSentences);

  // S-SUB-COPAY
  const copay = copaySentence(itemSentences, view, today);
  if (copay) out.push(copay);

  // S-SUB-SOURCE：S-SUB-* 實際引用的每一筆紀錄（依 recordId 去重、排序）
  const cited = new Map<string, KnowledgeSnapshotRecord>();
  for (const s of out) for (const r of s.records) cited.set(r.id, r);
  const sources = [...cited.values()].sort((a, b) => a.packRecordId.localeCompare(b.packRecordId));
  const labels = sources.map((r) => (r.authority ? AUTHORITY_LABELS[r.authority] : undefined));
  if (labels.every((l): l is string => typeof l === "string")) {
    out.push({
      templateId: "S-SUB-SOURCE",
      text: `以上制度與金額依據：${sources
        .map((r, i) => `${labels[i]}〈${r.title}〉（${r.effectiveFrom} 起適用）`)
        .join("、")}；平台知識版本 ${view.version}。`,
      records: [],
    });
  } else {
    view.invalid("SOURCE_AUTHORITY");
  }

  out.push({
    templateId: "S-SUB-DISCLAIMER",
    text: "實際長照等級、給付額度與自付金額，須經照管專員評估核定後才確定。",
    records: [],
  });

  return out;
}

function transportationSentence(
  input: CreateAssessmentInput,
  itemsRecord: KnowledgeSnapshotRecord,
  amountsRecord: KnowledgeSnapshotRecord,
  view: KnowledgeView,
  today: string
): ItemSentence | null {
  const purposesRaw = itemsRecord.ruleData.transportationPurposes;
  if (!Array.isArray(purposesRaw)) return null;
  const purposes: string[] = [];
  for (const p of purposesRaw) {
    if (!isNonEmptyString(p)) continue;
    if (!(p in TRANSPORT_PURPOSE_LABELS)) {
      view.unmapped("BENEFIT_ITEMS", p);
      continue;
    }
    purposes.push(TRANSPORT_PURPOSE_LABELS[p]);
  }
  if (purposes.length === 0) return null;

  const byZone = new Map(effectiveNumberEntries(amountsRecord.ruleData.transportationMonthlyByZone, today));
  const records = [itemsRecord, amountsRecord];
  let description: string;
  let transportZone: string | null = null;

  const { precision, city, district } = input.location;
  if (precision === "NONE" || !city) {
    const amounts = [...byZone.values()];
    if (amounts.length === 0) return null;
    description = `每月額度依居住地分區為 ${formatAmount(Math.min(...amounts))} 至 ${formatAmount(
      Math.max(...amounts)
    )} 元，提供縣市與行政區後可確認所屬分區`;
  } else {
    const zoneRecord = view.findOne("TRANSPORT_ZONE", "TAIWAN");
    if (!zoneRecord) return null;
    const zones = zoneRecord.ruleData.zones;
    const cityZones = isRecord(zones) ? zones[city] : undefined;
    if (!isRecord(cityZones) || (typeof cityZones.default !== "number" && typeof cityZones.default !== "string")) {
      return null; // 知識沒有該縣市的分區 → 省略，不以其他縣市代替
    }
    const defaultZone = String(cityZones.default);
    const overrides = isRecord(cityZones.overrides) ? cityZones.overrides : {};
    records.push(zoneRecord);

    if (district) {
      const override = overrides[district];
      const zone = typeof override === "number" || typeof override === "string" ? String(override) : defaultZone;
      const amount = byZone.get(zone);
      if (amount === undefined) return null;
      description = `${city}${district}屬交通接送第 ${zone} 區，每月額度 ${formatAmount(amount)} 元`;
      transportZone = zone;
    } else {
      const defaultAmount = byZone.get(defaultZone);
      if (defaultAmount === undefined) return null;
      const exceptionZones = [...new Set(Object.values(overrides).map(String))]
        .filter((z) => z !== defaultZone)
        .sort();
      if (exceptionZones.length === 0) {
        description = `${city}屬交通接送第 ${defaultZone} 區，每月額度 ${formatAmount(defaultAmount)} 元`;
        transportZone = defaultZone;
      } else {
        const parts: string[] = [];
        for (const z of exceptionZones) {
          const amount = byZone.get(z);
          if (amount === undefined) return null;
          parts.push(`第 ${z} 區（每月 ${formatAmount(amount)} 元）`);
        }
        description = `${city}多數行政區屬第 ${defaultZone} 區（每月 ${formatAmount(
          defaultAmount
        )} 元），部分行政區屬${parts.join("、")}，提供行政區後可確認`;
      }
    }
  }

  return {
    templateId: "S-SUB-TR",
    item: "TRANSPORTATION",
    transportZone,
    text: `交通接送服務：${description}，限用於${joinOr(purposes)}。`,
    records,
  };
}

function copaySentence(itemSentences: ItemSentence[], view: KnowledgeView, today: string): Sentence | null {
  const record = view.findOne("COPAY_RATES", "TAIWAN");
  if (!record) return null;
  const { rates, unit } = record.ruleData;
  if (!isRecord(rates) || unit !== "PERCENT") {
    view.invalid("COPAY_RATES");
    return null;
  }

  // 「例如{第一個出現的項目}」：交通接送的比率依分區，只有能確定單一分區時才可作為例子，否則改用下一個項目。
  for (const s of itemSentences) {
    let itemRates = rates[s.item];
    if (s.item === "TRANSPORTATION") {
      if (!s.transportZone || !isRecord(itemRates)) continue;
      itemRates = itemRates[`ZONE_${s.transportZone}`];
    }
    const entries = effectiveNumberEntries(itemRates, today).sort(([a], [b]) => a.localeCompare(b));
    const parts: string[] = [];
    for (const [category, rate] of entries) {
      const label = COPAY_CATEGORY_LABELS[category];
      if (!label) {
        view.unmapped("COPAY_RATES", category);
        continue;
      }
      parts.push(`${label}${label.endsWith("）") ? "" : " "}${rate}%`);
    }
    if (parts.length === 0) continue;
    return {
      templateId: "S-SUB-COPAY",
      text: `使用長照服務需依長照身分別自付部分費用，比率依服務項目不同，例如${BENEFIT_ITEM_LABELS[s.item]}：${parts.join(
        "、"
      )}。身分別由主管機關認定。`,
      records: [record],
    };
  }
  return null;
}

// ===== S-LOCAL-*（§6.3 規則 4：臺北市、新北市地方制度分開，缺少時不以另一縣市代替）=====

function localSentences(input: CreateAssessmentInput, view: KnowledgeView, hotline: Hotline | null): Sentence[] {
  const { precision, city } = input.location;
  if (precision === "NONE" || !city) {
    return [
      {
        templateId: "S-LOCAL-NOCITY",
        text: "各縣市另有地方補助與服務資源，提供居住縣市後可查看；目前平台收錄臺北市、新北市。",
        records: [],
      },
    ];
  }

  const jurisdiction = CITY_JURISDICTION[city];
  if (!jurisdiction) return [];
  const out: Sentence[] = [];

  const subsidies = view.findLocalSubsidies(jurisdiction);
  const renderable = subsidies.filter((r) => r.authority && AUTHORITY_LABELS[r.authority] && isNonEmptyString(r.summary));
  if (renderable.length > 0) {
    for (const r of renderable) {
      out.push({
        templateId: "S-LOCAL-SUBSIDY",
        text: `${city}地方補助：${r.summary.trim().replace(/。$/, "")}（依據：${AUTHORITY_LABELS[r.authority as string]}〈${
          r.title
        }〉，${r.effectiveFrom} 起適用）。`,
        records: [r],
      });
    }
  } else if (hotline) {
    out.push({
      templateId: "S-LOCAL-MISSING",
      text: `${city}的地方補助資訊目前尚未收錄於平台，請洽 ${hotline.number} 或${city}長期照顧管理中心確認；平台不會以其他縣市的規定代替。`,
      records: [hotline.record],
    });
  }

  const center = view.findOne("LOCAL_CENTER", jurisdiction);
  if (center) {
    const { address, phone } = center.ruleData;
    if (isNonEmptyString(address) && isNonEmptyString(phone)) {
      out.push({
        templateId: "S-LOCAL-CENTER",
        text: `${city}長期照顧管理中心：${address}，電話 ${phone}。`,
        records: [center],
      });
    } else {
      view.invalid("LOCAL_CENTER");
    }
  }

  return out;
}
