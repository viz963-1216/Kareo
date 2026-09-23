// 受保護的內部指令，依 contracts/knowledge/README.md §4：
// 「B-008 publish：建立 KnowledgeVersion，該版本內所有紀錄 → PUBLISHED，
//   版本 → PUBLISHED，前一個 PUBLISHED 版本 → ARCHIVED（其紀錄 → SUPERSEDED）」。
// 用法：node dist/scripts/publishKnowledgeVersion.js <content-pack.json> <createdBy> <approvedBy> [notes]
// 只發布同一份內容包中目前資料庫狀態為 APPROVED 的紀錄（需先執行 approveKnowledgePack）。
import { readFileSync } from "node:fs";
import { publishVersion } from "../services/knowledgeService.js";
import { SupabaseKnowledgeRepository } from "../repositories/supabaseKnowledgeRepository.js";
import type { RawContentPack } from "../types/index.js";

async function main(): Promise<number> {
  const [packPath, createdBy, approvedBy, notes] = process.argv.slice(2);
  if (!packPath || !createdBy || !approvedBy) {
    console.error("用法：<content-pack.json> <createdBy> <approvedBy> [notes]");
    return 2;
  }

  const pack = JSON.parse(readFileSync(packPath, "utf-8")) as RawContentPack;
  const packId = pack.packId as string;

  const repo = new SupabaseKnowledgeRepository();
  const dbRecords = await repo.findRecordsByPackId(packId);
  const approvedIds = dbRecords.filter((r) => r.status === "APPROVED").map((r) => r.id);

  if (approvedIds.length === 0) {
    console.error(`packId=${packId} 目前沒有任何資料庫狀態為 APPROVED 的紀錄，沒有東西可以發布。`);
    return 1;
  }

  const result = await publishVersion(repo, { recordIds: approvedIds, createdBy, approvedBy, notes: notes ?? null });
  console.log(`Published version: ${result.versionId}`);
  console.log(`Published records: ${result.publishedRecordCount}`);
  console.log(`Superseded records (previous version): ${result.supersededRecordCount}`);
  return 0;
}

main()
  .then((code) => (process.exitCode = code))
  .catch((err) => {
    console.error("Publish failed:", err);
    process.exitCode = 1;
  });
