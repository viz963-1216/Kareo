// 受保護的內部指令（DATA_MODEL §26b、§26c）：讀 contracts/knowledge/packs/*.json（Jerry 所有，只讀），
// 針對 B-012 上線前就已經匯入的內容包：
//   1. 補登 content_packs（含內容包 review 與匯入證據），驗證規則與匯入共用 validatePackShell；
//   2. 補登既有已核准紀錄的逐筆審核證據（knowledge_record_review_events，source=CLI_PACK）。
//
// 安全性：
// - 這份檔案宣告的每一筆（非 REJECTED）紀錄，依內容算出的指紋都必須與資料庫目前內容一致，任何一筆
//   缺漏或不符，整個內容包都跳過並回報原因（不登錄跟資料庫現況不符的資料）。
// - 審核證據的審核人／時間取自已核准 JSON 的逐筆 review，不使用執行當下時間、不虛構新審閱；只補
//   資料庫中確實已核准（APPROVED／PUBLISHED／SUPERSEDED）的紀錄；同一紀錄同一內容指紋不重複寫入。
// - 不變更任何紀錄的狀態或內容（已發布紀錄維持原狀）。
//
// 用法（需先 npm run build；需要 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY）：
//   node dist/scripts/backfillContentPacks.js [contracts/knowledge/packs 目錄路徑]
// Exit code：0 = 全部登錄或沒有可登錄的內容包；1 = 有內容包被跳過（需要人工確認，非致命錯誤）。
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { computeContentFingerprint } from "../services/contentFingerprint.js";
import { computePackFingerprint, computeRecordsFingerprint, type PackFingerprintRecord } from "../services/packFingerprint.js";
import { validatePackShell } from "../services/knowledgeImportService.js";
import { SupabaseKnowledgeRepository } from "../repositories/supabaseKnowledgeRepository.js";
import { AppError } from "../errors/AppError.js";
import type { KnowledgeRepository } from "../repositories/types.js";
import type { KnowledgeRecord, RawContentPack, RawContentPackRecord } from "../types/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const APPROVED_IN_DATABASE: ReadonlyArray<KnowledgeRecord["status"]> = ["APPROVED", "PUBLISHED", "SUPERSEDED"];

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export interface BackfillOutcome {
  registered: string[];
  skipped: Array<{ packId: string; reasons: string[] }>;
  reviewEventsInserted: number;
  reviewEventsAlreadyPresent: number;
}

interface PendingReviewEvent {
  recordId: string;
  reviewedBy: string;
  reviewedAt: string;
  reason: string | null;
  contentFingerprint: string;
}

export async function runBackfillContentPacks(repo: KnowledgeRepository, packs: RawContentPack[]): Promise<BackfillOutcome> {
  const outcome: BackfillOutcome = { registered: [], skipped: [], reviewEventsInserted: 0, reviewEventsAlreadyPresent: 0 };

  for (const raw of packs) {
    const packId = isNonEmptyString(raw.packId) ? raw.packId : "(invalid packId)";
    const reasons = [...validatePackShell(raw).reasons];
    if (reasons.length > 0) {
      outcome.skipped.push({ packId, reasons });
      continue;
    }

    const rawRecords = raw.records as RawContentPackRecord[];
    const dbByPackRecordId = new Map((await repo.findRecordsByPackId(packId)).map((r) => [r.packRecordId, r]));
    const fingerprintInputs: PackFingerprintRecord[] = [];
    const pendingEvents: PendingReviewEvent[] = [];

    for (const r of rawRecords) {
      const recordId = r.recordId as string;
      if (r.status === "REJECTED") continue; // 拒收的紀錄從未建立 KnowledgeRecord，不參與比對與指紋。
      const dbRecord = dbByPackRecordId.get(recordId);
      if (!dbRecord) {
        reasons.push(`${recordId}: 資料庫中找不到對應紀錄`);
        continue;
      }
      const source = r.source as Record<string, unknown>;
      let computed: string;
      try {
        computed = computeContentFingerprint({
          sourceId: source.sourceId as string,
          sourceUrl: source.url as string,
          title: r.title as string,
          category: r.category as string,
          jurisdiction: r.jurisdiction as string,
          publishedAt: (r.publishedAt as string | null) ?? null,
          effectiveFrom: r.effectiveFrom as string,
          effectiveTo: (r.effectiveTo as string | null) ?? null,
          rawText: r.excerpt as string,
          summary: r.summary as string,
          ruleData: r.ruleData as Record<string, unknown>,
        });
      } catch {
        reasons.push(`${recordId}: 無法從內容算出指紋（欄位缺漏或格式不合法）`);
        continue;
      }
      if (computed !== dbRecord.contentFingerprint) {
        reasons.push(`${recordId}: 內容指紋與資料庫現況不符（檔案與資料庫已經不一致）`);
        continue;
      }
      fingerprintInputs.push({ recordId, contentFingerprint: computed, packStatus: r.status as string });

      if (r.status !== "APPROVED" || !APPROVED_IN_DATABASE.includes(dbRecord.status)) continue;
      const review = r.review as Record<string, unknown> | undefined;
      if (!review || !isNonEmptyString(review.reviewedBy) || !isNonEmptyString(review.reviewedAt) || !ISO_DATETIME.test(review.reviewedAt)) {
        reasons.push(`${recordId}: 紀錄為 APPROVED 但逐筆 review 不完整，無法補登審核證據`);
        continue;
      }
      pendingEvents.push({
        recordId: dbRecord.id,
        reviewedBy: review.reviewedBy,
        reviewedAt: review.reviewedAt,
        reason: isNonEmptyString(review.notes) ? review.notes : null,
        contentFingerprint: computed,
      });
    }

    if (reasons.length === 0 && fingerprintInputs.length === 0) reasons.push("沒有任何可比對的紀錄（可能全部是 REJECTED）");
    if (reasons.length > 0) {
      outcome.skipped.push({ packId, reasons });
      continue;
    }

    const intendedKnowledgeVersion = (raw.intendedKnowledgeVersion as string | null) ?? null;
    const status = raw.status as string;
    const review = raw.review as Record<string, unknown>;
    try {
      await repo.upsertContentPack({
        packId,
        formatVersion: raw.formatVersion as string,
        intendedKnowledgeVersion,
        sourceRegistryVersion: isNonEmptyString(raw.sourceRegistryVersion) ? raw.sourceRegistryVersion : null,
        status,
        reviewedBy: isNonEmptyString(review.reviewedBy) ? review.reviewedBy : null,
        reviewedAt: isNonEmptyString(review.reviewedAt) ? review.reviewedAt : null,
        reviewDecision: isNonEmptyString(review.decision) ? review.decision : null,
        packFingerprint: computePackFingerprint(fingerprintInputs, intendedKnowledgeVersion, status),
        recordsFingerprint: computeRecordsFingerprint(fingerprintInputs),
        importedBy: "CLI:backfillContentPacks",
      });
    } catch (err) {
      if (err instanceof AppError && err.message.includes("PACK_CONTENT_CHANGED")) {
        outcome.skipped.push({ packId, reasons: [err.message] });
        continue;
      }
      throw err;
    }
    outcome.registered.push(packId);

    for (const event of pendingEvents) {
      const { inserted } = await repo.backfillRecordReviewEvent(event);
      if (inserted) outcome.reviewEventsInserted += 1;
      else outcome.reviewEventsAlreadyPresent += 1;
    }
  }

  return outcome;
}

async function main(): Promise<number> {
  const packsDir = process.argv[2] ?? path.resolve(__dirname, "../../../../contracts/knowledge/packs");
  const files = readdirSync(packsDir).filter((f) => f.endsWith(".json"));
  const packs = files.map((f) => JSON.parse(readFileSync(path.join(packsDir, f), "utf-8")) as RawContentPack);

  const outcome = await runBackfillContentPacks(new SupabaseKnowledgeRepository(), packs);

  console.log(`Registered: ${outcome.registered.length}`);
  if (outcome.registered.length > 0) console.log(outcome.registered.join(", "));
  console.log(`Review events inserted: ${outcome.reviewEventsInserted}, already present: ${outcome.reviewEventsAlreadyPresent}`);
  console.log(`Skipped (inconsistent with database, need manual review): ${outcome.skipped.length}`);
  if (outcome.skipped.length > 0) console.log(JSON.stringify(outcome.skipped, null, 2));

  return outcome.skipped.length > 0 ? 1 : 0;
}

// 只有直接執行本檔時才跑 CLI；被測試或其他模組 import 時不得自動連線 Supabase。
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err) => {
      console.error("Backfill failed:", err);
      process.exitCode = 1;
    });
}
