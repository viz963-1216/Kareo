// 受保護的內部指令，依 B-012-r3（Jerry 指示 2）：
// 「提供回填指令：讀 contracts/knowledge/packs/*.json，逐筆比對資料庫內容指紋，一致才登錄。」
//
// 本工具只「讀」contracts/knowledge/packs/*.json（Jerry 所有，B 不得修改），針對這個 B-012 功能
// 上線前就已經匯入的舊內容包，補登 content_packs 中繼資料（intendedKnowledgeVersion／
// sourceRegistryVersion／status／packFingerprint），讓 Admin API 的 compute_publish_plan 能正確
// 算出候選紀錄與 PACK_NOT_APPROVED blocker。
//
// 安全性：只有在這份 pack 檔案宣告的每一筆（非 REJECTED）記錄，其依內容算出的指紋都跟資料庫目前
// 該筆記錄的 content_fingerprint 完全一致時，才登錄這個 pack；任何一筆缺漏或指紋不符，整個 pack
// 都跳過並回報原因（不得登錄跟資料庫現況不符的中繼資料）。
//
// 用法（需先 npm run build；需要 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY）：
//   node dist/scripts/backfillContentPacks.js [contracts/knowledge/packs 目錄路徑]
// Exit code：0 = 全部登錄或沒有可登錄的 pack；1 = 有 pack 因不一致被跳過（需要人工確認，非致命錯誤）。
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { computeContentFingerprint } from "../services/contentFingerprint.js";
import { computePackFingerprint } from "../services/packFingerprint.js";
import { SupabaseKnowledgeRepository } from "../repositories/supabaseKnowledgeRepository.js";
import type { KnowledgeRepository } from "../repositories/types.js";
import type { RawContentPack, RawContentPackRecord } from "../types/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export interface BackfillOutcome {
  registered: string[];
  skipped: Array<{ packId: string; reasons: string[] }>;
}

// 核心邏輯抽出供測試直接呼叫（不需要真的讀檔／建立 Supabase client）。
export async function runBackfillContentPacks(
  repo: KnowledgeRepository,
  packs: RawContentPack[]
): Promise<BackfillOutcome> {
  const registered: string[] = [];
  const skipped: Array<{ packId: string; reasons: string[] }> = [];

  for (const raw of packs) {
    const packId = raw.packId as string;
    const reasons: string[] = [];
    const rawRecords = (raw.records as RawContentPackRecord[]) ?? [];
    const dbRecords = await repo.findRecordsByPackId(packId);
    const dbByPackRecordId = new Map(dbRecords.map((r) => [r.packRecordId, r]));

    const fingerprintable: Array<{ recordId: string; contentFingerprint: string }> = [];
    for (const r of rawRecords) {
      if (r.status === "REJECTED") continue; // 拒收的記錄從未建立 KnowledgeRecord，不參與比對。
      const recordId = r.recordId as string;
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
      fingerprintable.push({ recordId, contentFingerprint: computed });
    }

    if (reasons.length > 0) {
      skipped.push({ packId, reasons });
      continue;
    }
    if (fingerprintable.length === 0) {
      skipped.push({ packId, reasons: ["沒有任何可比對的記錄（可能全部是 REJECTED）"] });
      continue;
    }

    const intendedKnowledgeVersion = (raw.intendedKnowledgeVersion as string | null) ?? null;
    const packFingerprint = computePackFingerprint(fingerprintable, intendedKnowledgeVersion ?? "", raw.status as string);
    await repo.upsertContentPack({
      packId,
      intendedKnowledgeVersion,
      sourceRegistryVersion: isNonEmptyString(raw.sourceRegistryVersion) ? raw.sourceRegistryVersion : null,
      status: raw.status as string,
      packFingerprint,
    });
    registered.push(packId);
  }

  return { registered, skipped };
}

async function main(): Promise<number> {
  const packsDir = process.argv[2] ?? path.resolve(__dirname, "../../../../contracts/knowledge/packs");
  const files = readdirSync(packsDir).filter((f) => f.endsWith(".json"));
  const packs = files.map((f) => JSON.parse(readFileSync(path.join(packsDir, f), "utf-8")) as RawContentPack);

  const outcome = await runBackfillContentPacks(new SupabaseKnowledgeRepository(), packs);

  console.log(`Registered: ${outcome.registered.length}`);
  if (outcome.registered.length > 0) console.log(outcome.registered.join(", "));
  console.log(`Skipped (inconsistent with database, need manual review): ${outcome.skipped.length}`);
  if (outcome.skipped.length > 0) console.log(JSON.stringify(outcome.skipped, null, 2));

  return outcome.skipped.length > 0 ? 1 : 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exitCode = 1;
  });
