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
import { AppError } from "../errors/AppError.js";
import { computeContentFingerprint } from "./contentFingerprint.js";
import { computePackFingerprint, computeRecordsFingerprint } from "./packFingerprint.js";

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

// 內容包層級驗證，匯入與回填（backfillContentPacks）共用同一份。依 contracts/knowledge/
// content-pack.schema.json 與 DATA_MODEL §26b：review 必填；status=APPROVED 時 review.reviewedBy
// 不得為空、reviewedAt 須為 ISO 時間、decision 必須是 APPROVED（不能只信 status 字串）。
export function validatePackShell(raw: RawContentPack): { reasons: string[] } {
  const reasons: string[] = [];
  const review = raw.review as Record<string, unknown> | null | undefined;
  if (typeof review !== "object" || review === null || Array.isArray(review)) {
    reasons.push("缺少內容包層級 review");
  } else if (raw.status === "APPROVED") {
    if (!isNonEmptyString(review.reviewedBy)) reasons.push("status=APPROVED 時內容包 review.reviewedBy 不得為空");
    if (!isNonEmptyString(review.reviewedAt) || !ISO_DATETIME.test(review.reviewedAt as string))
      reasons.push("status=APPROVED 時內容包 review.reviewedAt 格式不合法");
    if (review.decision !== "APPROVED") reasons.push("status=APPROVED 時內容包 review.decision 必須是 APPROVED");
  }
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

// 依 contracts/knowledge/README.md §1、§3 與 DATA_MODEL §26b（D-16c）：整批驗證，任一筆不合格就整批不寫入。
// - 已存在且審核內容指紋相同的 (packId, recordId) 視為已匯入，跳過但不算拒收（冪等）。
// - 已存在但內容不同：已提交內容不可改寫，不論內容包是否已登錄、紀錄是否已發布，一律整批拒收並列出
//   差異；修正必須以新 packId／recordId 提交、重新審核（不走「更正草稿再核准」的路徑）。
// - 內容包中 status=REJECTED 的紀錄不建立 KnowledgeRecord，但仍計入內容包指紋。
// - 匯入後資料庫狀態一律 NEEDS_REVIEW，除非偵測到與現有 PUBLISHED 紀錄衝突則標記 CONFLICT
//   （即使內容包本身已是 APPROVED，也不代表資料庫核准，見 README §3）。
export async function importContentPack(
  repo: KnowledgeRepository,
  raw: RawContentPack,
  registry: Map<string, RegistrySource>,
  // importedBy：DATA_MODEL §26b 的匯入證據＝已驗證的實際操作者 InternalOperator ID（由呼叫端以個人密鑰與
  // KNOWLEDGE_PUBLISHER 角色驗證後傳入）。dry-run 不寫入，可為 null；commit 必須提供。
  options: { mode: KnowledgeImportMode; importedBy: string | null }
): Promise<ContentPackImportReport> {
  if (options.mode === "commit" && !isNonEmptyString(options.importedBy)) {
    throw new AppError("FORBIDDEN", "commit 匯入需要已驗證的操作者身分。");
  }

  const shell = validatePackShell(raw);
  if (shell.reasons.length > 0) {
    return {
      mode: options.mode,
      written: false,
      packId: isNonEmptyString(raw.packId) ? raw.packId : null,
      recordsValid: 0,
      recordsRejected: [{ recordId: null, reasons: shell.reasons }],
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
    return { mode: options.mode, written: false, packId, recordsValid: 0, recordsRejected: rejections };
  }

  // DATA_MODEL §26b：已登錄的內容包身分固定，同一 packId 逐筆內容有任何改變一律拒絕（整批不寫入），
  // 必須以新 packId 提交；不論這次宣告的 status。匯入與回填使用相同紀錄集合（含 REJECTED）與算法。
  const intendedKnowledgeVersion = (raw.intendedKnowledgeVersion as string | null) ?? null;
  const packStatus = raw.status as string;
  const packReview = raw.review as Record<string, unknown>;
  const fingerprintInputs = validated.map((v) => ({
    recordId: v.value.packRecordId,
    contentFingerprint: v.value.contentFingerprint,
  }));
  const recordsFingerprint = computeRecordsFingerprint(fingerprintInputs);
  const existingPack = await repo.findContentPackById(packId);
  if (existingPack !== null && existingPack.recordsFingerprint !== recordsFingerprint) {
    return {
      mode: options.mode,
      written: false,
      packId,
      recordsValid: 0,
      recordsRejected: [
        {
          recordId: null,
          reasons: [`PACK_CONTENT_CHANGED：內容包 ${packId} 已登錄且內容已變更，同一 packId 不可改內容；請以新的 packId 提交。`],
        },
      ],
    };
  }

  // 已提交內容不可改寫（含尚未登錄 content_packs 的舊包）：同一 (packId, recordId) 已存在但審核內容
  // 指紋不同，一律拒收並列出差異，不更新既有紀錄。
  const existingRecords = await repo.findRecordsByPackId(packId);
  const existingByPackRecordId = new Map(existingRecords.map((r) => [r.packRecordId, r]));

  const toInsert: Array<{ value: (typeof validated)[number]["value"] }> = [];
  const contentChanged: ImportRecordRejection[] = [];
  const incomingRecordIds = new Set(validated.map((item) => item.value.packRecordId));

  // 未登錄舊包沒有 recordsFingerprint 可比較，仍須確認檔案沒有漏列既有 DB 紀錄。
  // 所有一致性檢查在 insertRecords/upsertContentPack 前完成，不讓新紀錄部分寫入。
  for (const existing of existingRecords) {
    if (!incomingRecordIds.has(existing.packRecordId)) {
      contentChanged.push({
        recordId: existing.packRecordId,
        reasons: [
          `PACK_RECORDS_MISMATCH：資料庫紀錄 ${existing.id}（${existing.packRecordId}）不在內容包檔案中；` +
            "檔案與資料庫不一致，請以新的 packId／recordId 提交並重新審核。",
        ],
      });
    }
  }

  for (const item of validated) {
    const existing = existingByPackRecordId.get(item.value.packRecordId);
    if (!existing) {
      // 全新拒收紀錄不建立，但既有紀錄不能因檔案宣告 REJECTED 而略過比對。
      if (item.packDecision !== "REJECTED") toInsert.push(item);
      continue;
    }
    if (existing.contentFingerprint !== item.value.contentFingerprint) {
      contentChanged.push({
        recordId: item.value.packRecordId,
        reasons: [
          `RECORD_CONTENT_CHANGED：資料庫紀錄 ${existing.id}（狀態 ${existing.status}）的內容指紋為 ${existing.contentFingerprint}，` +
            `本次為 ${item.value.contentFingerprint}。已提交內容不可改寫，請以新的 packId／recordId 提交並重新審核。`,
        ],
      });
      continue;
    }
    if (item.packDecision === "REJECTED" && existing.status !== "REJECTED") {
      contentChanged.push({
        recordId: item.value.packRecordId,
        reasons: [
          `RECORD_DECISION_MISMATCH：內容包將 ${item.value.packRecordId} 標為 REJECTED，` +
            `但資料庫紀錄 ${existing.id} 仍為 ${existing.status}；匯入不得自動改變審核或發布狀態，請先經正式審核／撤回流程處理。`,
        ],
      });
    }
    // 內容相同且沒有矛盾的拒收決定：冪等略過，保留既有狀態與發布證據。
  }

  if (contentChanged.length > 0) {
    return { mode: options.mode, written: false, packId, recordsValid: 0, recordsRejected: contentChanged };
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
    };
  }

  await repo.insertRecords(records);

  // DATA_MODEL §26b：內容包層級資料（含內容包 review 與匯入證據）在這裡登錄，Admin API 的
  // publish-preview／publish 直接從資料庫算出候選紀錄與 blockers（見 compute_publish_plan）。
  await repo.upsertContentPack({
    packId,
    formatVersion: raw.formatVersion as string,
    intendedKnowledgeVersion,
    sourceRegistryVersion: isNonEmptyString(raw.sourceRegistryVersion) ? raw.sourceRegistryVersion : null,
    status: packStatus,
    reviewedBy: isNonEmptyString(packReview.reviewedBy) ? packReview.reviewedBy : null,
    reviewedAt: isNonEmptyString(packReview.reviewedAt) ? packReview.reviewedAt : null,
    reviewDecision: isNonEmptyString(packReview.decision) ? packReview.decision : null,
    packFingerprint: computePackFingerprint(fingerprintInputs, intendedKnowledgeVersion, packStatus),
    recordsFingerprint,
    importedBy: options.importedBy as string,
  });

  return {
    mode: "commit",
    written: records.length > 0,
    packId,
    recordsValid: records.length,
    recordsRejected: [],
  };
}
