// 測試專用的合成知識快照（FIXTURE，不是已核准或已發布的正式知識）。
// 內容直接讀取 contracts/knowledge/packs/KP-2026-09-23-001.json（目前全部 NEEDS_REVIEW），
// 只在自動測試中假設為 PUBLISHED，用來驗證模板組裝；任何正式環境都不會讀這個檔案。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { KnowledgeSnapshot, KnowledgeSnapshotRecord } from "../../src/assessment/knowledgeSnapshot.js";
import type { CreateAssessmentInput } from "../../src/types/index.js";

const PACK_PATH = fileURLToPath(new URL("../../../../contracts/knowledge/packs/KP-2026-09-23-001.json", import.meta.url));
// D-17（r4）身心障礙福利補助所需的兩筆真實已核准紀錄（KP-2026-09-24-003／004），
// 供 T25-T31 對照 contracts/mock/assessments/WITH-DISABILITY-NEW_TAIPEI.json 的逐字金額。
const DISABILITY_MED_PACK_PATH = fileURLToPath(
  new URL("../../../../contracts/knowledge/packs/KP-2026-09-24-004.json", import.meta.url)
);
const LOCAL_AD_TOPUP_PACK_PATH = fileURLToPath(
  new URL("../../../../contracts/knowledge/packs/KP-2026-09-24-003.json", import.meta.url)
);

interface PackRecord {
  recordId: string;
  title: string;
  category: KnowledgeSnapshotRecord["category"];
  jurisdiction: KnowledgeSnapshotRecord["jurisdiction"];
  effectiveFrom: string;
  effectiveTo: string | null;
  summary: string;
  ruleData: Record<string, unknown>;
  source: { authority: KnowledgeSnapshotRecord["authority"] };
}

export const FIXTURE_TODAY = "2026-09-24";
export const FIXTURE_VERSION = "KB-FIXTURE-001";

function loadPack(path: string): KnowledgeSnapshotRecord[] {
  const pack = JSON.parse(readFileSync(path, "utf8")) as { records: PackRecord[] };
  return pack.records.map((r) => ({
    id: `KREC-${r.recordId}`,
    packRecordId: r.recordId,
    title: r.title,
    category: r.category,
    jurisdiction: r.jurisdiction,
    effectiveFrom: r.effectiveFrom,
    effectiveTo: r.effectiveTo ?? null,
    summary: r.summary,
    ruleData: structuredClone(r.ruleData),
    authority: r.source.authority,
  }));
}

export function packRecords(): KnowledgeSnapshotRecord[] {
  return [
    ...loadPack(PACK_PATH),
    ...loadPack(DISABILITY_MED_PACK_PATH),
    ...loadPack(LOCAL_AD_TOPUP_PACK_PATH).filter((r) => r.ruleData.type === "LOCAL_DISABILITY_AD_TOPUP"),
  ];
}

export function fixtureSnapshot(
  mutate?: (records: KnowledgeSnapshotRecord[]) => KnowledgeSnapshotRecord[] | void,
  version = FIXTURE_VERSION
): KnowledgeSnapshot {
  const records = packRecords();
  const out = mutate ? mutate(records) ?? records : records;
  return { version, records: out };
}

export function byType(records: KnowledgeSnapshotRecord[], type: string): KnowledgeSnapshotRecord {
  const r = records.find((x) => x.ruleData.type === type);
  if (!r) throw new Error(`fixture has no ${type}`);
  return r;
}

export const baseInput: CreateAssessmentInput = {
  sessionId: "SES-SYNTHETIC-001",
  ageRange: "UNKNOWN",
  location: { city: null, district: null, precision: "NONE", lat: null, lng: null },
  livingSituation: "UNKNOWN",
  caregiverSituation: "UNKNOWN",
  mobilityLevel: "UNKNOWN",
  dailyLivingLevel: "UNKNOWN",
  needs: { homeCare: "UNKNOWN", medicalNursing: "UNKNOWN", assistiveDevice: "UNKNOWN", transportation: "UNKNOWN" },
  disabilityCertificate: "UNKNOWN",
  incomeCategory: "UNKNOWN",
  freeText: "",
};

export function input(
  overrides: Omit<Partial<CreateAssessmentInput>, "needs"> & { needs?: Partial<CreateAssessmentInput["needs"]> } = {}
): CreateAssessmentInput {
  return {
    ...baseInput,
    ...overrides,
    location: { ...baseInput.location, ...(overrides.location ?? {}) },
    needs: { ...baseInput.needs, ...(overrides.needs ?? {}) },
  };
}

export const ALL = (v: "YES" | "NO" | "UNKNOWN") => ({
  homeCare: v,
  medicalNursing: v,
  assistiveDevice: v,
  transportation: v,
});
