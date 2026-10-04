// TASK-B-014：GET /api/v1/knowledge/records，依 docs/API_CONTRACT.md §13a（v0.6，D-19 Q3）。
// 公開端點，不需要 session；只讀查詢，不做個人化（PRODUCT_SPEC §14c）。
//
// 「目前版本」與「有效期間」判斷刻意重用既有共用邏輯，不另寫一套：
// - 目前版本：getKnowledgeStatus()（knowledgeService.ts），沒有 PUBLISHED 版本時統一回 KNOWLEDGE_UNAVAILABLE。
// - 有效期間：isEffectiveOn()／taipeiToday()（assessment/knowledgeSnapshot.ts、knowledgeService.ts），
//   跟 Assessment 的 KnowledgeView 用同一套日期比較規則（ASSESSMENT_RULES §6.1）。
// - 發布機關顯示：AUTHORITY_LABELS（assessment/rules.ts）＋ KAREO_DRIVE 走 ruleData.issuer
//   （同 summaryComposer.ts 的 sourceName() 模式），但 ruleData 本身絕不出現在回應裡。
import type { KnowledgeRepository } from "../repositories/types.js";
import type {
  Jurisdiction,
  KnowledgeCategory,
  KnowledgeRecordsAppliedFilters,
  KnowledgeRecordsResponse,
  PublicKnowledgeRecordItem,
  PublicKnowledgeSnapshotRecord,
} from "../types/index.js";
import { AppError } from "../errors/AppError.js";
import { getKnowledgeStatus, taipeiToday } from "./knowledgeService.js";
import { isEffectiveOn } from "../assessment/knowledgeSnapshot.js";
import { AUTHORITY_LABELS } from "../assessment/rules.js";

const JURISDICTIONS: Jurisdiction[] = ["TAIWAN", "TAIPEI", "NEW_TAIPEI"];
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
const KNOWN_PARAMS = new Set(["jurisdiction", "category", "page", "pageSize"]);

const NOTICE_DEFAULT =
  "以下為 Kareo 已審核發布的長照制度與補助資訊摘要，內容可能隨主管機關公告調整。實際資格、服務內容與補助，仍應由 1966 或所在地長期照顧管理中心正式評估確認。";
const NOTICE_EMPTY = "目前沒有符合條件的已發布資訊。可調整篩選條件，或聯絡 1966 長照專線洽詢。";

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

interface ParsedQuery {
  jurisdiction: Jurisdiction | null;
  category: KnowledgeCategory | null;
  page: number;
  pageSize: number;
}

// query 的每個值都是字串（Netlify queryStringParameters）或 undefined；不接受陣列或其他型態。
function parseQuery(query: Record<string, unknown> | null | undefined): ParsedQuery {
  const q = query ?? {};

  for (const key of Object.keys(q)) {
    if (!KNOWN_PARAMS.has(key)) {
      throw new AppError("VALIDATION_ERROR", "查詢條件包含不支援的欄位。");
    }
  }

  const raw = (key: string): string | undefined => {
    const v = q[key];
    return typeof v === "string" ? v : undefined;
  };

  const jurisdictionRaw = raw("jurisdiction");
  if (jurisdictionRaw !== undefined && !isOneOf(jurisdictionRaw, JURISDICTIONS)) {
    throw new AppError("VALIDATION_ERROR", "適用地區只能是 TAIWAN、TAIPEI 或 NEW_TAIPEI。");
  }
  const jurisdiction = (jurisdictionRaw as Jurisdiction | undefined) ?? null;

  const categoryRaw = raw("category");
  if (categoryRaw !== undefined && !isOneOf(categoryRaw, CATEGORIES)) {
    throw new AppError("VALIDATION_ERROR", "資訊類別不正確，請重新選擇。");
  }
  const category = (categoryRaw as KnowledgeCategory | undefined) ?? null;

  const pageRaw = raw("page");
  let page = 1;
  if (pageRaw !== undefined) {
    const n = Number(pageRaw);
    if (!Number.isInteger(n) || n < 1) {
      throw new AppError("VALIDATION_ERROR", "page 必須是大於等於 1 的整數。");
    }
    page = n;
  }

  const pageSizeRaw = raw("pageSize");
  let pageSize = 20;
  if (pageSizeRaw !== undefined) {
    const n = Number(pageSizeRaw);
    if (!Number.isInteger(n) || n < 1 || n > 50) {
      throw new AppError("VALIDATION_ERROR", "每頁筆數需介於 1 到 50。");
    }
    pageSize = n;
  }

  return { jurisdiction, category, page, pageSize };
}

function sortKey(r: PublicKnowledgeSnapshotRecord): [number, number, string] {
  return [JURISDICTIONS.indexOf(r.jurisdiction), CATEGORIES.indexOf(r.category), r.id];
}

function compareSortKey(a: [number, number, string], b: [number, number, string]): number {
  if (a[0] !== b[0]) return a[0] - b[0];
  if (a[1] !== b[1]) return a[1] - b[1];
  return a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : 0;
}

// KAREO_DRIVE 來源顯示 ruleData.issuer（原發布機關）；缺 issuer 時退回 Source Registry 的來源名稱，
// 避免 publisher 開天窗（同 summaryComposer.ts sourceName() 的 KAREO_DRIVE 特例，但這裡不能略過整句，
// 必須保證欄位一定有值）。其餘 authority 一律用 AUTHORITY_LABELS 的固定對照表（API_CONTRACT §13a 文字）。
function toPublicItem(r: PublicKnowledgeSnapshotRecord): PublicKnowledgeRecordItem {
  const isDrive = r.authority === "KAREO_DRIVE";
  const publisher = isDrive ? r.issuer ?? r.sourceName : r.authority ? AUTHORITY_LABELS[r.authority] ?? r.sourceName : r.sourceName;
  const url = isDrive ? null : r.sourceUrl;

  return {
    id: r.id,
    title: r.title,
    category: r.category,
    jurisdiction: r.jurisdiction,
    summary: r.summary,
    effectiveFrom: r.effectiveFrom,
    effectiveTo: r.effectiveTo,
    publishedAt: r.publishedAt,
    lastVerifiedAt: r.lastVerifiedAt,
    source: {
      title: r.sourceName,
      publisher,
      url,
    },
  };
}

export async function getKnowledgeRecords(
  repo: KnowledgeRepository,
  query: Record<string, unknown> | null | undefined
): Promise<KnowledgeRecordsResponse> {
  const filters = parseQuery(query);

  // 目前版本：沒有 PUBLISHED 版本時 getKnowledgeStatus 統一拋 KNOWLEDGE_UNAVAILABLE，不自行另判斷。
  const status = await getKnowledgeStatus(repo);
  const records = await repo.findPublicKnowledgeRecords(status.version);

  const today = taipeiToday();
  let effective = records.filter((r) => isEffectiveOn(r.effectiveFrom, r.effectiveTo, today));

  if (filters.jurisdiction !== null) effective = effective.filter((r) => r.jurisdiction === filters.jurisdiction);
  if (filters.category !== null) effective = effective.filter((r) => r.category === filters.category);

  effective.sort((a, b) => compareSortKey(sortKey(a), sortKey(b)));

  const totalCount = effective.length;
  const start = (filters.page - 1) * filters.pageSize;
  const items = effective.slice(start, start + filters.pageSize).map(toPublicItem);

  const appliedFilters: KnowledgeRecordsAppliedFilters = {
    jurisdiction: filters.jurisdiction,
    category: filters.category,
    page: filters.page,
    pageSize: filters.pageSize,
  };

  return {
    knowledgeVersion: status.version,
    publishedAt: status.publishedAt,
    items,
    page: filters.page,
    pageSize: filters.pageSize,
    totalCount,
    appliedFilters,
    notice: totalCount === 0 ? NOTICE_EMPTY : NOTICE_DEFAULT,
  };
}

// Cheap validation precedes persistent rate-limit/lookup I/O. No query values are logged.
export function validateLookupQuery(query: Record<string, unknown> | null | undefined): void {
  parseQuery(query);
}
