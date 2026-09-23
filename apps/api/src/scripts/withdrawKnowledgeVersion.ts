// 受保護的內部指令，依 contracts/knowledge/README.md §5（撤回）。
// 用法：node dist/scripts/withdrawKnowledgeVersion.js <reason> <withdrawnBy> [republishVersionId]
// 不指定 republishVersionId 時，撤回後系統回到「無 PUBLISHED 版本」，Assessment 依 contract 回 KNOWLEDGE_UNAVAILABLE。
import { withdrawVersion } from "../services/knowledgeService.js";
import { SupabaseKnowledgeRepository } from "../repositories/supabaseKnowledgeRepository.js";

async function main(): Promise<number> {
  const [reason, withdrawnBy, republishVersionId] = process.argv.slice(2);
  if (!reason || !withdrawnBy) {
    console.error("用法：<reason> <withdrawnBy> [republishVersionId]");
    return 2;
  }

  const result = await withdrawVersion(new SupabaseKnowledgeRepository(), {
    reason,
    withdrawnBy,
    republishVersionId: republishVersionId ?? null,
  });

  if (result.republishedVersionId) {
    console.log(`Withdrawn. Republished previous version: ${result.republishedVersionId}`);
  } else {
    console.log("Withdrawn. No version republished — system now has NO PUBLISHED version (KNOWLEDGE_UNAVAILABLE).");
  }
  return 0;
}

main()
  .then((code) => (process.exitCode = code))
  .catch((err) => {
    console.error("Withdraw failed:", err);
    process.exitCode = 1;
  });
