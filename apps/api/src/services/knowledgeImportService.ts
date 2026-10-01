import type { KnowledgeRepository } from "../repositories/types.js";
import type {
  KnowledgeCategory,
  KnowledgeImportMode,
  KnowledgeRecord,
  KnowledgeRecordStatus,
  ContentPackImportReport,
  Jurisdiction,
  RawContentPack,
  RawContentPackRecord,
} from "../types/index.js";
import { generateId, nowTaipeiISOString } from "../lib/response.js";
import { computeContentFingerprint } from "./contentFingerprint.js";
import { computePackFingerprint } from "./packFingerprint.js";

// ===== 依 docs/knowledge/source-registry.md 解析白名單來源（Jerry 維護，B-008 只讀取，不修改）=====

export interface RegistrySource {
  authority: string;
  jurisdiction: string;
  url: string;
  active: boolean;
}

export function parseSourceRegistry(markdown: string): Map<string, RegistrySource> {
  const map = new Map<string, RegistrySource>();
  for (const line of markdown.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;
    const cells = trimmed.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
    if (cells.length < 8) continue;
    const idMatch = cells[0].match(/^`(SRC-[A-Z0-9-]+)`$/);
    if (!idMatch) continue;
    const authority = cells[2].replace(/`/g, "");
    const jurisdiction = cells[3].replace(/`/g, "");
    const url = cells[4];
    const active = cells[7].toLowerCase() === "true";
    map.set(idMatch[1], { authority, jurisdiction, url, active });
  }
  return map;
}

// ===== 逐欄位驗證（依 contracts/knowledge/content-pack.schema.json v1.0）=====

const CATEGORIES: KnowledgeCategory[] = [
  "ELIGIBILITY",
  "BENEFIT",
  "COPAY",
  "ASSISTIVE_DEVICE",
  "TRANSPORTATION",
  "RESPITE",
  "HOME_CARE",
  "HOME_MEDICAL_NURSING",
  "APPLICATION",
  "OTHER",
];
const JURISDICTIONS: Jurisdiction[] = ["TAIWAN", "TAIPEI", "NEW_TAIPEI"];
// KAREO_DRIVE（D-15，2026-09-24 核准）：Jerry 指定資料夾來源，不是官方網站；URL 規則不同於其他來源。
const AUTHORITIES = ["MOHW", "LAW", "TAIPEI_GOV", "NEW_TAIPEI_GOV", "KAREO_DRIVE"];
const RECORD_STATUSES = ["NEEDS_REVIEW", "APPROVED", "REJECTED", "CONFLICT"];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const CONTENT_HASH = /^sha256:[0-9a-f]{64}$/;
const SOURCE_URL = /^https:\/\/([a-z0-9-]+\.)*(gov\.tw|gov\.taipei)\//;
const KAREO_DRIVE_URL = /^https:\/\/drive\.google\.com\/file\/d\/[A-Za-z0-9_-]+\//;
const RECORD_ID = /^KR-\d{4}-\d{3}$/;
const SOURCE_ID = /^SRC-[A-Z0-9-]+$/;

function isOneOf<T extends string>(v: unknown, allowed: readonly T[]): v is T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v);
}
function isNonEmptyString(v: unknown, maxLength?: number): v is string {
  return typeof v === "string" && v.trim().length > 0 && (maxLength === undefined || v.length <= maxLength);
}

interface RecordValidationResult {
  ok: boolean;
  reasons: string[];
  value?: Omit<KnowledgeRecord, "id" | "createdAt" | "updatedAt" | "status" | "version">;
  packDecision?: "NEEDS_REVIEW" | "APPROVED" | "REJECTED" | "CONFLICT";
}

function validateRecord(raw: RawContentPackRecord, packId: string, registry: Map<string, RegistrySource>): RecordValidationResult {
  const reasons: string[] = [];

  if (!isNonEmptyString(raw.recordId) || !RECORD_ID.test(raw.recordId)) reasons.push("recordId 格式不合法（需為 KR-YYYY-NNN）");
  if (!isOneOf(raw.category, CATEGORIES)) reasons.push("category 不合法");
  if (!isOneOf(raw.jurisdiction, JURISDICTIONS)) reasons.push("jurisdiction 不合法");
  if (!isNonEmptyString(raw.title, 120)) reasons.push("title 缺漏或超過 120 字");

  const source = raw.source as Record<string, unknown> | undefined;
  if (typeof source !== "object" || source === null) {
    reasons.push("缺少 source");
  } else {
    if (!isNonEmptyString(source.sourceId) || !SOURCE_ID.test(source.sourceId)) reasons.push("source.sourceId 格式不合法");
    if (!isOneOf(source.authority, AUTHORITIES)) reasons.push("source.authority 不合法");
    if (source.authority === "KAREO_DRIVE") {
      if (!isNonEmptyString(source.url) || !KAREO_DRIVE_URL.test(source.url))
        reasons.push("source.url 格式不合法（KAREO_DRIVE 來源須為 https://drive.google.com/file/d/<fileId>/… 網址）");
    } else if (!isNonEmptyString(source.url) || !SOURCE_URL.test(source.url)) {
      reasons.push("source.url 不在白名單網域（僅允許 gov.tw / gov.taipei）");
    }
    if (!isNonEmptyString(source.fetchedAt) || !ISO_DATETIME.test(source.fetchedAt)) reasons.push("source.fetchedAt 格式不合法");
    if (!isNonEmptyString(source.contentHash) || !CONTENT_HASH.test(source.contentHash))
      reasons.push("source.contentHash 格式不合法（需為 sha256:<64 hex>）");

    // 依 contracts/knowledge/README.md §3 第 2 點：sourceId 必須存在於 source-registry.md 且 active=true。
    if (isNonEmptyString(source.sourceId)) {
      const entry = registry.get(source.sourceId);
      if (!entry) reasons.push(`source.sourceId ${source.sourceId} 不存在於 source-registry.md`);
      else if (!entry.active) reasons.push(`source.sourceId ${source.sourceId} 在 source-registry.md 中 active=false`);
      else if (isNonEmptyString(source.authority) && source.authority !== entry.authority)
        reasons.push(`source.authority 與 source-registry.md 登錄的 ${entry.authority} 不一致`);
    }
  }

  const publishedAt = raw.publishedAt;
  if (!(publishedAt === null || (isNonEmptyString(publishedAt) && ISO_DATE.test(publishedAt)))) reasons.push("publishedAt 格式不合法");
  if (!isNonEmptyString(raw.effectiveFrom) || !ISO_DATE.test(raw.effectiveFrom)) reasons.push("effectiveFrom 格式不合法");
  const effectiveTo = raw.effectiveTo;
  if (!(effectiveTo === null || (isNonEmptyString(effectiveTo) && ISO_DATE.test(effectiveTo)))) reasons.push("effectiveTo 格式不合法");
  if (!isNonEmptyString(raw.lastVerifiedAt) || !ISO_DATETIME.test(raw.lastVerifiedAt)) reasons.push("lastVerifiedAt 格式不合法");
  if (!isNonEmptyString(raw.excerpt, 4000)) reasons.push("excerpt 缺漏或超過 4000 字");
  if (!isNonEmptyString(raw.summary, 400)) reasons.push("summary 缺漏或超過 400 字");
  if (typeof raw.ruleData !== "object" || raw.ruleData === null || Array.isArray(raw.ruleData)) reasons.push("ruleData 必須是物件");
  if (!isOneOf(raw.status, RECORD_STATUSES)) reasons.push("status 不合法");

  const review = raw.review as Record<string, unknown> | undefined;
  if (typeof review !== "object" || review === null) {
    reasons.push("缺少 review");
  } else if (raw.status === "APPROVED") {
    if (!isNonEmptyString(review.reviewedBy)) reasons.push("status=APPROVED 時 review.reviewedBy 不得為空");
    if (!isNonEmptyString(review.reviewedAt) || !ISO_DATETIME.test(review.reviewedAt as string))
      reasons.push("status=APPROVED 時 review.reviewedAt 格式不合法");
  }

  if (reasons.length > 0) return { ok: false, reasons };

  const s = source as Record<string, unknown>;
  const now = nowTaipeiISOString();
  const fingerprintable = {
    sourceId: s.sourceId as string,
    sourceUrl: s.url as string,
    title: raw.title as string,
    category: raw.category as string,
    jurisdiction: raw.jurisdiction as string,
    publishedAt: publishedAt as string | null,
    effectiveFrom: raw.effectiveFrom as string,
    effectiveTo: effectiveTo as string | null,
    rawText: raw.excerpt as string,
    summary: raw.summary as string,
    ruleData: raw.ruleData as Record<string, unknown>,
  };
  return {
    ok: true,
    reasons: [],
    packDecision: raw.status as "NEEDS_REVIEW" | "APPROVED" | "REJECTED" | "CONFLICT",
    value: {
      sourceId: s.sourceId as string,
      title: raw.title as string,
      category: raw.category as KnowledgeCategory,
      jurisdiction: raw.jurisdiction as Jurisdiction,
      sourceUrl: s.url as string,
      publishedAt: publishedAt as string | null,
      effectiveFrom: raw.effectiveFrom as string,
      effectiveTo: effectiveTo as string | null,
      fetchedAt: s.fetchedAt as string,
      lastVerifiedAt: raw.lastVerifiedAt as string,
      contentHash: s.contentHash as string,
      contentFingerprint: computeContentFingerprint(fingerprintable),
      rawText: raw.excerpt as string,
      summary: raw.summary as string,
      ruleData: raw.ruleData as Record<string, unknown>,
      packId,
      packRecordId: raw.recordId as string,
    },
  };
}

function validatePackShell(raw: RawContentPack): { reasons: string[] } {
  const reasons: string[] = [];
  if (!isNonEmptyString(raw.packId) || !/^KP-\d{4}-\d{2}-\d{2}-\d{3}$/.test(raw.packId)) reasons.push("packId 格式不合法");
  if (raw.formatVersion !== "1.0") reasons.push("formatVersion 必須是 1.0");
  if (!isNonEmptyString(raw.createdAt) || !ISO_DATETIME.test(raw.createdAt)) reasons.push("createdAt 格式不合法");
  if (!isNonEmptyString(raw.createdBy)) reasons.push("createdBy 不得為空");
  if (!isNonEmptyString(raw.sourceRegistryVersion) || !/^SR-\d{4}-\d{2}-\d{2}-\d{2}$/.test(raw.sourceRegistryVersion))
    reasons.push("sourceRegistryVersion 格式不合法");
  if (!isOneOf(raw.status, ["NEEDS_REVIEW", "APPROVED", "REJECTED"])) reasons.push("pack status 不合法");
  // 依 contracts/knowledge/content-pack.schema.json：intendedKnowledgeVersion 只有 APPROVED 時
  // 才會填（null 是合法值，代表尚未決定版號）；APPROVED 時必填且格式須為 KB-YYYY-MM-DD-NNN。
  if (raw.intendedKnowledgeVersion !== null) {
    if (!isNonEmptyString(raw.intendedKnowledgeVersion) || !/^KB-\d{4}-\d{2}-\d{2}-\d{3}$/.test(raw.intendedKnowledgeVersion)) {
      reasons.push("intendedKnowledgeVersion 格式不合法（需為 KB-YYYY-MM-DD-NNN 或 null）");
    }
  } else if (raw.status === "APPROVED") {
    reasons.push("status=APPROVED 時 intendedKnowledgeVersion 不得為 null");
  }
  if (!Array.isArray(raw.records) || raw.records.length === 0) reasons.push("records 必須是非空陣列");
  return { reasons };
}

export interface ImportRecordRejection {
  recordId: string | null;
  reasons: string[];
}

// 依 contracts/knowledge/README.md §3：整批驗證，任一筆不合格就整批不寫入；
// 已存在且內容雜湊相同的 (packId, recordId) 視為已匯入，跳過但不算拒收（冪等，重複匯入不產生重複紀錄）。
// 已存在但內容雜湊不同（B-008-r3，J-003 H-2）：不可靜默略過——核准必須綁定實際被審核的內容，不能只
// 靠 (packId, recordId) 或 status 判斷。尚未 PUBLISHED 的紀錄會更新內容並強制回 NEEDS_REVIEW，即使
// 內容包本身已是 APPROVED（核准仍要走獨立的 approveKnowledgePack 步驟，讀取「這次」的內容）；已經
// PUBLISHED 的歷史紀錄不可被匯入覆寫，回報為拒收（需要走新版本發布流程，不得竄改已發布歷史）。
// 內容包中 status=REJECTED 的紀錄不建立 KnowledgeRecord（沒有值得再審的內容）。
// 匯入後資料庫狀態一律 NEEDS_REVIEW，除非偵測到與現有 PUBLISHED 紀錄衝突則標記 CONFLICT
// （即使內容包本身已是 APPROVED，也不代表資料庫核准，見 README §3 第 4 點）。
export async function importContentPack(
  repo: KnowledgeRepository,
  raw: RawContentPack,
  registry: Map<string, RegistrySource>,
  options: { mode: KnowledgeImportMode }
): Promise<ContentPackImportReport> {
  const shell = validatePackShell(raw);
  if (shell.reasons.length > 0) {
    return {
      mode: options.mode,
      written: false,
      packId: isNonEmptyString(raw.packId) ? raw.packId : null,
      recordsValid: 0,
      recordsRejected: [{ recordId: null, reasons: shell.reasons }],
      recordsCorrected: 0,
    };
  }

  const packId = raw.packId as string;
  const rawRecords = raw.records as RawContentPackRecord[];

  const rejections: ImportRecordRejection[] = [];
  const validated: Array<{
    value: Omit<KnowledgeRecord, "id" | "createdAt" | "updatedAt" | "status" | "version">;
    packDecision: "NEEDS_REVIEW" | "APPROVED" | "REJECTED" | "CONFLICT";
  }> = [];

  for (const r of rawRecords) {
    const result = validateRecord(r, packId, registry);
    if (!result.ok || !result.value || !result.packDecision) {
      rejections.push({ recordId: isNonEmptyString(r.recordId) ? r.recordId : null, reasons: result.reasons });
      continue;
    }
    validated.push({ value: result.value, packDecision: result.packDecision });
  }

  if (rejections.length > 0) {
    return { mode: options.mode, written: false, packId, recordsValid: 0, recordsRejected: rejections, recordsCorrected: 0 };
  }

  // TASK-B-012-r3（Jerry 指示 2）：「同一 packId 重新匯入：只有在每筆內容指紋都不變時，才可把
  // 狀態從 NEEDS_REVIEW 升為 APPROVED；內容有變一律拒絕，必須使用新 packId」——這條規則保護的是
  // 「已經登錄為 APPROVED（可發布）的內容」不被同一個 packId 的後續匯入悄悄置換。只有在資料庫裡
  // 已登錄的 pack 本身就是 APPROVED、且這次匯入的指紋跟它不同時才拒絕。pack 還在 NEEDS_REVIEW
  // 階段（不論這次匯入要不要直接核准為 APPROVED）的逐筆更正，仍依 B-008/B-008-r3（J-003 H-2）
  // 既有行為進行，不受此檢查影響——否則「審核時發現內容有誤、更正後直接核准」這個既有、已經過
  // J-003 驗收的正常流程會被完全擋死（更正必然改變指紋）。
  const intendedKnowledgeVersion = (raw.intendedKnowledgeVersion as string | null) ?? null;
  const packStatus = raw.status as string;
  const newPackFingerprint = computePackFingerprint(
    validated.map((v) => ({ recordId: v.value.packRecordId, contentFingerprint: v.value.contentFingerprint })),
    intendedKnowledgeVersion ?? "",
    packStatus
  );
  const existingPack = await repo.findContentPackById(packId);
  if (existingPack && existingPack.status === "APPROVED" && existingPack.packFingerprint !== newPackFingerprint) {
    return {
      mode: options.mode,
      written: false,
      packId,
      recordsValid: 0,
      recordsRejected: [
        {
          recordId: null,
          reasons: [`packId ${packId} 已登錄過不同內容，不可用同一個 packId 以 APPROVED 狀態覆寫；請使用新的 packId 重新匯入。`],
        },
      ],
      recordsCorrected: 0,
    };
  }

  // 找出這個 packId 目前資料庫裡已有的紀錄（含內容），依 packRecordId 建索引，用來判斷
  // 「全新」／「內容相同（略過）」／「內容不同（更正）」／「已發布不可覆寫（拒收）」。
  const existingRecords = await repo.findRecordsByPackId(packId);
  const existingByPackRecordId = new Map(existingRecords.map((r) => [r.packRecordId, r]));

  const toInsert: Array<{ value: (typeof validated)[number]["value"] }> = [];
  const toCorrect: Array<{ id: string; value: (typeof validated)[number]["value"] }> = [];
  const publishedConflicts: ImportRecordRejection[] = [];

  for (const item of validated) {
    if (item.packDecision === "REJECTED") continue; // 內容包本身標記拒收，不建立也不更新任何紀錄。
    const existing = existingByPackRecordId.get(item.value.packRecordId);
    if (!existing) {
      toInsert.push(item);
      continue;
    }
    if (existing.contentFingerprint === item.value.contentFingerprint) {
      continue; // 審核內容指紋相同，冪等略過（同一來源仍可能對應不同 contentHash 的重新擷取，
      // 但只要實質內容一樣就不算變更；反過來 contentHash 不變但指紋不同也視為變更，見下方 toCorrect）。
    }
    if (existing.status === "PUBLISHED") {
      publishedConflicts.push({
        recordId: item.value.packRecordId,
        reasons: [`此紀錄（資料庫 id ${existing.id}）已發布於正式版本，不可用匯入覆寫已發布的歷史內容；需要走新版本發布流程。`],
      });
      continue;
    }
    toCorrect.push({ id: existing.id, value: item.value });
  }

  if (publishedConflicts.length > 0) {
    // 缺筆／部分失敗不得回報全部成功：本次匯入整批不寫入，讓操作者先解決已發布紀錄的處理方式。
    return { mode: options.mode, written: false, packId, recordsValid: 0, recordsRejected: publishedConflicts, recordsCorrected: 0 };
  }

  const records: KnowledgeRecord[] = [];
  for (const item of toInsert) {
    const existingPublished = await repo.findPublishedByKey(item.value.jurisdiction, item.value.category, item.value.title);
    const status: KnowledgeRecordStatus =
      existingPublished && existingPublished.contentFingerprint !== item.value.contentFingerprint ? "CONFLICT" : "NEEDS_REVIEW";
    const now = nowTaipeiISOString();
    records.push({ ...item.value, id: generateId("KREC"), status, version: null, createdAt: now, updatedAt: now });
  }

  if (options.mode === "dry-run") {
    return {
      mode: "dry-run",
      written: false,
      packId,
      recordsValid: records.length,
      recordsRejected: [],
      recordsCorrected: toCorrect.length,
    };
  }

  await repo.insertRecords(records);
  for (const item of toCorrect) {
    await repo.updateRecordContent(item.id, item.value);
  }

  // TASK-B-012-r3：內容包層級中繼資料（intendedKnowledgeVersion／status／指紋）在這裡登錄，
  // 讓 Admin API 的 publish-preview／publish 可以直接從資料庫算出候選紀錄與 blockers，
  // 不再需要操作者手動指定 pack 檔案路徑（見 compute_publish_plan）。
  await repo.upsertContentPack({
    packId,
    intendedKnowledgeVersion,
    sourceRegistryVersion: isNonEmptyString(raw.sourceRegistryVersion) ? raw.sourceRegistryVersion : null,
    status: packStatus,
    packFingerprint: newPackFingerprint,
  });

  return {
    mode: "commit",
    written: records.length > 0 || toCorrect.length > 0,
    packId,
    recordsValid: records.length,
    recordsRejected: [],
    recordsCorrected: toCorrect.length,
  };
}
