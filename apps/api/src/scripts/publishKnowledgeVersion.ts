// 受保護的內部指令，依 contracts/knowledge/README.md §4、D-03、D-03-v2：
// 「B-008 publish：建立 KnowledgeVersion，該版本內所有紀錄 → PUBLISHED，
//   版本 → PUBLISHED，前一版被取代或已失效的紀錄 → SUPERSEDED，其餘前版紀錄帶入新版本」。
// 版號一律採用內容包的 intendedKnowledgeVersion（不再自行產生）；可一次傳入多個內容包，
// 全部必須是 APPROVED 狀態且 intendedKnowledgeVersion 相同。
//
// 用法：
//   node dist/scripts/publishKnowledgeVersion.js <createdBy> <approvedBy> [--notes=<text>] -- <pack1.json> [pack2.json ...]
//
// 只發布同一份內容包中目前資料庫狀態為 APPROVED 的紀錄（需先執行 approveKnowledgePack）。
import { readFileSync } from "node:fs";
import { publishVersion } from "../services/knowledgeService.js";
import { SupabaseKnowledgeRepository } from "../repositories/supabaseKnowledgeRepository.js";
import type { RawContentPack } from "../types/index.js";

function parseArgs(argv: string[]): { createdBy: string; approvedBy: string; notes: string | null; packPaths: string[] } | null {
  const sepIndex = argv.indexOf("--");
  if (sepIndex === -1) return null;
  const head = argv.slice(0, sepIndex);
  const packPaths = argv.slice(sepIndex + 1);
  if (packPaths.length === 0) return null;

  let createdBy: string | undefined;
  let approvedBy: string | undefined;
  let notes: string | null = null;
  const positional: string[] = [];
  for (const arg of head) {
    if (arg.startsWith("--notes=")) notes = arg.slice("--notes=".length);
    else positional.push(arg);
  }
  [createdBy, approvedBy] = positional;
  if (!createdBy || !approvedBy) return null;
  return { createdBy, approvedBy, notes, packPaths };
}

async function main(): Promise<number> {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed) {
    console.error("用法：<createdBy> <approvedBy> [--notes=<text>] -- <pack1.json> [pack2.json ...]");
    return 2;
  }
  const { createdBy, approvedBy, notes, packPaths } = parsed;

  const repo = new SupabaseKnowledgeRepository();
  const packs: Array<{ status: unknown; intendedKnowledgeVersion: unknown }> = [];
  const candidateRecords: Array<{ id: string; effectiveTo: string | null }> = [];

  for (const packPath of packPaths) {
    const pack = JSON.parse(readFileSync(packPath, "utf-8")) as RawContentPack;
    packs.push({ status: pack.status, intendedKnowledgeVersion: pack.intendedKnowledgeVersion });

    const packId = pack.packId as string;
    const dbRecords = await repo.findRecordsByPackId(packId);
    const approved = dbRecords.filter((r) => r.status === "APPROVED");
    if (approved.length === 0) {
      console.error(`packId=${packId} 目前沒有任何資料庫狀態為 APPROVED 的紀錄。`);
      return 1;
    }
    for (const r of approved) candidateRecords.push({ id: r.id, effectiveTo: r.effectiveTo });
  }

  try {
    const result = await publishVersion(repo, { packs, candidateRecords, createdBy, approvedBy, notes });
    console.log(`Published version: ${result.versionId}`);
    console.log(`Published records: ${result.publishedRecordCount}`);
    console.log(`Superseded records (replaced or expired): ${result.supersededRecordCount}`);
    console.log(`Carried forward from previous version: ${result.carriedForwardCount}`);
    if (result.excludedRecordIds.length > 0) {
      console.log(`Excluded (effectiveTo before publish date): ${result.excludedRecordIds.join(", ")}`);
    }
    return 0;
  } catch (err) {
    console.error("Publish failed:", err instanceof Error ? err.message : err);
    return 1;
  }
}

main()
  .then((code) => (process.exitCode = code))
  .catch((err) => {
    console.error("Publish failed:", err);
    process.exitCode = 1;
  });
