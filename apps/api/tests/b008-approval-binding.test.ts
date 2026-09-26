// J-003 repro for B-008 (hand-back, not a J-003 fix). Copy to apps/api/tests/ as <name>.test.ts and run:
//   cd apps/api && npx vitest run tests/b008-approval-binding.test.ts
// Expected today: FAIL (the test states the required behaviour).
//
// Required (contracts/knowledge/README §3–§4, MVP_DECISIONS D-02/D-03): an approval must apply to the exact
// content Jerry reviewed. Today importContentPack skips an already-imported (packId, recordId) even when its
// content changed, and approveKnowledgePack approves by (packId, recordId) only, so the database record that
// becomes APPROVED can be an older text than the one approved in the pack. This happened for real content:
// KP-2026-09-24-005 KR-2026-019〜021 were corrected (42cdc65 → e562b9e) after an earlier approval.
import { describe, it, expect } from "vitest";
import { importContentPack, parseSourceRegistry } from "../src/services/knowledgeImportService.js";
import { approveRecords } from "../src/services/knowledgeService.js";
import { InMemoryKnowledgeRepository } from "../src/repositories/inMemoryKnowledgeRepository.js";
import type { RawContentPack } from "../src/types/index.js";

const REGISTRY = parseSourceRegistry(`
| sourceId | 名稱 | authority | jurisdiction | sourceUrl | 版本 | 擷取狀態 | active |
|---|---|---|---|---|---|---|---|
| \`SRC-LAW-001\` | 長照辦法 | \`LAW\` | \`TAIWAN\` | https://law.moj.gov.tw/x | v1 | OK | true |
`);

function pack(summary: string, hashChar: string, status: "NEEDS_REVIEW" | "APPROVED"): RawContentPack {
  const review = status === "APPROVED"
    ? { reviewedBy: "Jerry", reviewedAt: "2026-09-25T10:00:00+08:00", decision: "APPROVED", notes: null }
    : { reviewedBy: null, reviewedAt: null, decision: null, notes: null };
  return {
    packId: "KP-2026-09-25-901", formatVersion: "1.0", createdAt: "2026-09-24T09:00:00+08:00", createdBy: "Jerry",
    sourceRegistryVersion: "SR-2026-09-23-01", status, review, intendedKnowledgeVersion: status === "APPROVED" ? "KB-2026-09-25-001" : null,
    records: [{
      recordId: "KR-2026-901", category: "ELIGIBILITY", jurisdiction: "TAIWAN", title: "synthetic",
      source: { sourceId: "SRC-LAW-001", authority: "LAW", url: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=L0070059",
        fetchedAt: "2026-09-23T10:00:00+08:00", contentHash: "sha256:" + hashChar.repeat(64) },
      publishedAt: "2026-06-19", effectiveFrom: "2026-07-01", effectiveTo: null, lastVerifiedAt: "2026-09-23T10:00:00+08:00",
      excerpt: "excerpt", summary, ruleData: { minAge: 65 }, status, review,
    }],
  } as RawContentPack;
}

describe("B-008 approval must bind to the reviewed content", () => {
  it("does not approve an older imported text when the pack approved a corrected text", async () => {
    const repo = new InMemoryKnowledgeRepository();
    await importContentPack(repo, pack("舊版摘要（有誤）", "a", "NEEDS_REVIEW"), REGISTRY, { mode: "commit" });

    // Corrected text, approved by Jerry, same (packId, recordId).
    const corrected = pack("修正後摘要", "b", "APPROVED");
    const reimport = await importContentPack(repo, corrected, REGISTRY, { mode: "commit" });

    // What approveKnowledgePack.ts does: map (packId, recordId) → db ids, approve.
    const ids = (await repo.findRecordsByPackId("KP-2026-09-25-901")).map((r) => r.id);
    await approveRecords(repo, ids);
    const approvedRows = repo.records.filter((r) => r.status === "APPROVED");

    // Required: the changed re-import is rejected or flagged for review, and nothing whose content differs
    // from the approved pack record becomes APPROVED. Today: re-import silently skipped, stale text approved.
    const stale = approvedRows.filter((r) => r.summary !== "修正後摘要" || r.contentHash !== "sha256:" + "b".repeat(64));
    expect({ reimportSilentlySkipped: !reimport.written && reimport.recordsRejected.length === 0, staleApprovedSummaries: stale.map((r) => r.summary) })
      .toEqual({ reimportSilentlySkipped: false, staleApprovedSummaries: [] });
  });
});
