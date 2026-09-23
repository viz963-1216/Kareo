// 受保護的內部指令，依 contracts/knowledge/README.md §4：
// 「B-008 approve：只接受內容包中 decision = APPROVED 的紀錄」。
// 讀同一份內容包檔案，把 status=APPROVED 的紀錄（依 packId+recordId 對應回資料庫 id）核准。
// 用法：node dist/scripts/approveKnowledgePack.js <content-pack.json>
import { readFileSync } from "node:fs";
import { approveRecords } from "../services/knowledgeService.js";
import { SupabaseKnowledgeRepository } from "../repositories/supabaseKnowledgeRepository.js";
import type { RawContentPack, RawContentPackRecord } from "../types/index.js";

async function main(): Promise<number> {
  const packPath = process.argv[2];
  if (!packPath) {
    console.error("用法：<content-pack.json>");
    return 2;
  }

  const pack = JSON.parse(readFileSync(packPath, "utf-8")) as RawContentPack;
  const packId = pack.packId as string;
  const records = (pack.records as RawContentPackRecord[]) ?? [];
  const approvedRecordIds = new Set(
    records.filter((r) => r.status === "APPROVED").map((r) => r.recordId as string)
  );

  if (approvedRecordIds.size === 0) {
    console.log("內容包中沒有 status=APPROVED 的紀錄，沒有東西可以核准。");
    return 0;
  }

  const repo = new SupabaseKnowledgeRepository();
  const dbRecords = await repo.findRecordsByPackId(packId);
  const dbIds = dbRecords.filter((r) => approvedRecordIds.has(r.packRecordId)).map((r) => r.id);

  if (dbIds.length === 0) {
    console.error(`找不到對應的資料庫紀錄（packId=${packId}），請先執行 importKnowledgePack。`);
    return 1;
  }

  const result = await approveRecords(repo, dbIds);
  console.log(`Approved: ${result.approved.length}`);
  console.log(`Not approved (already approved / rejected / conflict / not found): ${result.notApproved.length}`);
  if (result.notApproved.length > 0) {
    console.log(JSON.stringify(result.notApproved, null, 2));
  }
  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    console.error("Approve failed:", err);
    process.exitCode = 1;
  });
