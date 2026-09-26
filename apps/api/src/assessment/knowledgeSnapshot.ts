import type { CareNeed, CaregiverSituation, Jurisdiction, KnowledgeAuthority, KnowledgeCategory } from "../types/index.js";

// 一次 Assessment 使用的知識快照：只含「同一個 PUBLISHED KnowledgeVersion」的紀錄。
// 由 resolver 一次讀出並凍結，整個評估過程只讀這份快照，避免途中版本切換造成內容與 knowledgeVersion 不一致。
export interface KnowledgeSnapshotRecord {
  id: string; // KnowledgeRecord.id（寫入 ruleTrace）
  packRecordId: string; // 內容包 recordId（例如 KR-2026-004），S-SUB-SOURCE 依此排序
  title: string;
  category: KnowledgeCategory;
  jurisdiction: Jurisdiction;
  effectiveFrom: string; // YYYY-MM-DD
  effectiveTo: string | null;
  summary: string;
  ruleData: Record<string, unknown>;
  authority: KnowledgeAuthority | null; // knowledge_sources.authority
}

export interface KnowledgeSnapshot {
  version: string;
  records: readonly KnowledgeSnapshotRecord[];
}

export function freezeSnapshot(snapshot: KnowledgeSnapshot): KnowledgeSnapshot {
  return Object.freeze({
    version: snapshot.version,
    records: Object.freeze(snapshot.records.map((r) => deepFreeze({ ...r }))),
  });
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}

// 引擎只輸出不含使用者資料的診斷事件（不含 freeText、座標、token 或資料庫錯誤原文），由 Service 寫入 log。
export type EngineDiagnostic =
  | { event: "KNOWLEDGE_CONFLICT"; ruleDataType: string; jurisdiction: Jurisdiction; knowledgeVersion: string }
  | { event: "UNMAPPED_CODE"; ruleDataType: string; code: string; knowledgeVersion: string }
  | { event: "INVALID_RULE_DATA"; ruleDataType: string; knowledgeVersion: string };

// 日期比較一律用 Asia/Taipei 的 YYYY-MM-DD（ASSESSMENT_RULES §6.1）。
export function isEffectiveOn(effectiveFrom: unknown, effectiveTo: unknown, today: string): boolean {
  if (typeof effectiveFrom === "string" && effectiveFrom.slice(0, 10) > today) return false;
  if (typeof effectiveTo === "string" && effectiveTo.slice(0, 10) < today) return false;
  return true;
}

export function taipeiDate(now: Date): string {
  return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// 依 ruleData.type＋jurisdiction 查找（ASSESSMENT_RULES §6.4），不以 recordId 寫死。
export class KnowledgeView {
  constructor(
    private readonly snapshot: KnowledgeSnapshot,
    readonly today: string,
    private readonly diagnostics: EngineDiagnostic[]
  ) {}

  get version(): string {
    return this.snapshot.version;
  }

  private effective(): KnowledgeSnapshotRecord[] {
    return this.snapshot.records.filter((r) => isEffectiveOn(r.effectiveFrom, r.effectiveTo, this.today));
  }

  // 同一 type＋jurisdiction 有多筆有效紀錄 → 衝突：回 null（省略相關句子）並記錄診斷，不自行挑選。
  findOne(ruleDataType: string, jurisdiction: Jurisdiction): KnowledgeSnapshotRecord | null {
    const matches = this.effective().filter(
      (r) => r.jurisdiction === jurisdiction && r.ruleData?.type === ruleDataType
    );
    if (matches.length > 1) {
      this.diagnostics.push({ event: "KNOWLEDGE_CONFLICT", ruleDataType, jurisdiction, knowledgeVersion: this.version });
      return null;
    }
    return matches[0] ?? null;
  }

  // 地方紀錄（§6.3 S-LOCAL-INFO，RULES-2026-09-25-r7）：只讀與使用者縣市相同 jurisdiction、
  // ruleData.type 以 LOCAL_ 開頭（LOCAL_CENTER 除外）的紀錄，且與目前 careNeeds／caregiverSituation 相關：
  // LOCAL_TRANSPORT_RULES 只在含 TRANSPORTATION 時列入；LOCAL_ASSISTIVE_DEVICE_PROCESS、
  // LOCAL_AD_TOPUP、LOCAL_AD_TOPUP_PLAN（r6）只在含 ASSISTIVE_DEVICE 時列入；LOCAL_RESPITE_OPTIONS
  // （r6）只在含 HOME_CARE 且 caregiverSituation ∈ {FAMILY_AVAILABLE, FAMILY_LIMITED} 時列入；
  // LOCAL_APPLICATION 與其他未知的 LOCAL_ 類型一律列入（§6.4 只依 ruleData.type 判斷，不自行排除
  // 未列出的類型）。ruleData.requiresDisabilityCertificate = true 的紀錄（例如
  // LOCAL_DISABILITY_AD_TOPUP）不由本句處理，改由 §6.5 S-DIS-*。依 recordId 排序。
  findLocalInfo(
    jurisdiction: "TAIPEI" | "NEW_TAIPEI",
    careNeeds: readonly CareNeed[],
    caregiverSituation: CaregiverSituation
  ): KnowledgeSnapshotRecord[] {
    return this.effective()
      .filter((r) => {
        if (r.jurisdiction !== jurisdiction) return false;
        const type = r.ruleData?.type;
        if (typeof type !== "string" || !type.startsWith("LOCAL_") || type === "LOCAL_CENTER") return false;
        if (r.ruleData?.requiresDisabilityCertificate === true) return false;
        if (type === "LOCAL_TRANSPORT_RULES") return careNeeds.includes("TRANSPORTATION");
        if (type === "LOCAL_ASSISTIVE_DEVICE_PROCESS" || type === "LOCAL_AD_TOPUP" || type === "LOCAL_AD_TOPUP_PLAN") {
          return careNeeds.includes("ASSISTIVE_DEVICE");
        }
        if (type === "LOCAL_RESPITE_OPTIONS") {
          return careNeeds.includes("HOME_CARE") && (caregiverSituation === "FAMILY_AVAILABLE" || caregiverSituation === "FAMILY_LIMITED");
        }
        return true;
      })
      .sort((a, b) => a.packRecordId.localeCompare(b.packRecordId));
  }

  unmapped(ruleDataType: string, code: string): void {
    this.diagnostics.push({ event: "UNMAPPED_CODE", ruleDataType, code, knowledgeVersion: this.version });
  }

  invalid(ruleDataType: string): void {
    this.diagnostics.push({ event: "INVALID_RULE_DATA", ruleDataType, knowledgeVersion: this.version });
  }
}
