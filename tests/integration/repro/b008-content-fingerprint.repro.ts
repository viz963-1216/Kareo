// J-003 repro for B-008-r3 (commit 7b77e9c; hand-back H-3 second round). Copy to apps/api/tests/ as
// b008-content-fingerprint.test.ts and run:
//   cd apps/api && npx vitest run tests/b008-content-fingerprint.test.ts
// Expected on 7b77e9c: A, B and D FAIL (they state the required behaviour); F passes.
//
// B-008-r3 binds import idempotency and approval to `source.contentHash`. That is the hash of the official
// page／PDF, not of the reviewed Knowledge content: one source yields several records whose summary、ruleData
// and dates are written by a person. A change to those reviewed fields with the same source hash is treated
// as "the same content" (import skipped, approval accepted). The approve CLI also drops pack records that
// are missing from the database instead of failing.
import { describe, it, expect } from "vitest";
import { importContentPack, parseSourceRegistry } from "../src/services/knowledgeImportService.js";
import { approvePackRecords } from "../src/services/knowledgeService.js";
import { InMemoryKnowledgeRepository } from "../src/repositories/inMemoryKnowledgeRepository.js";
import type { RawContentPack } from "../src/types/index.js";

const REGISTRY = parseSourceRegistry(`
| sourceId | 名稱 | authority | jurisdiction | sourceUrl | 版本 | 擷取狀態 | active |
|---|---|---|---|---|---|---|---|
| \`SRC-LAW-001\` | 長照辦法 | \`LAW\` | \`TAIWAN\` | https://law.moj.gov.tw/x | v1 | OK | true |
`);
const SOURCE_HASH = "sha256:" + "a".repeat(64); // official source unchanged in every case

type Rec = { recordId: string; summary: string; ruleData: Record<string, unknown>; effectiveFrom: string };
function pack(records: Rec[], status: "NEEDS_REVIEW" | "APPROVED"): RawContentPack {
  const review = status === "APPROVED"
    ? { reviewedBy: "Jerry", reviewedAt: "2026-09-27T10:00:00+08:00", decision: "APPROVED", notes: null }
    : { reviewedBy: null, reviewedAt: null, decision: null, notes: null };
  return {
    packId: "KP-2026-09-27-901", formatVersion: "1.0", createdAt: "2026-09-27T09:00:00+08:00", createdBy: "Jerry",
    sourceRegistryVersion: "SR-2026-09-23-01", status, review, intendedKnowledgeVersion: status === "APPROVED" ? "KB-2026-09-27-001" : null,
    records: records.map((r) => ({
      recordId: r.recordId, category: "BENEFIT", jurisdiction: "TAIWAN", title: `synthetic ${r.recordId}`,
      source: { sourceId: "SRC-LAW-001", authority: "LAW", url: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=L0070059",
        fetchedAt: "2026-09-23T10:00:00+08:00", contentHash: SOURCE_HASH },
      publishedAt: "2026-06-19", effectiveFrom: r.effectiveFrom, effectiveTo: null, lastVerifiedAt: "2026-09-23T10:00:00+08:00",
      excerpt: "excerpt", summary: r.summary, ruleData: r.ruleData, status, review,
    })),
  } as RawContentPack;
}
const rec = (over: Partial<Rec> = {}): Rec => ({ recordId: "KR-2026-901", summary: "上限 100 元", ruleData: { type: "T", amount: 100 }, effectiveFrom: "2026-07-01", ...over });

// Same mapping as apps/api/src/scripts/approveKnowledgePack.ts on 7b77e9c.
async function approveLikeCli(repo: InMemoryKnowledgeRepository, p: RawContentPack) {
  const wanted = new Map((p.records as Array<{ recordId: string; status: string; source: { contentHash: string } }>)
    .filter((r) => r.status === "APPROVED").map((r) => [r.recordId, r.source.contentHash]));
  const candidates = (await repo.findRecordsByPackId(p.packId as string)).filter((r) => wanted.has(r.packRecordId))
    .map((r) => ({ dbId: r.id, packRecordId: r.packRecordId, dbContentHash: r.contentHash, expectedContentHash: wanted.get(r.packRecordId) as string }));
  const result = await approvePackRecords(repo, candidates);
  return { ...result, requested: wanted.size, considered: candidates.length };
}

describe("B-008 approval binds to the reviewed content, not only the official-source hash", () => {
  it("A. ruleData amount 100 → 200 with the same source hash is not the reviewed content", async () => {
    const repo = new InMemoryKnowledgeRepository();
    await importContentPack(repo, pack([rec()], "NEEDS_REVIEW"), REGISTRY, { mode: "commit" });
    const changed = pack([rec({ ruleData: { type: "T", amount: 200 }, summary: "上限 200 元" })], "APPROVED");
    await importContentPack(repo, changed, REGISTRY, { mode: "commit" });
    await approveLikeCli(repo, changed);
    const approved = repo.records.filter((r) => r.status === "APPROVED").map((r) => (r.ruleData as { amount: number }).amount);
    // Required: either the approved row carries amount 200 (the reviewed text) or nothing is approved.
    expect(approved.filter((a) => a !== 200)).toEqual([]);
  });

  it("B. only effectiveFrom changes: must be recognised as different content", async () => {
    const repo = new InMemoryKnowledgeRepository();
    await importContentPack(repo, pack([rec()], "NEEDS_REVIEW"), REGISTRY, { mode: "commit" });
    const changed = pack([rec({ effectiveFrom: "2027-01-01" })], "APPROVED");
    await importContentPack(repo, changed, REGISTRY, { mode: "commit" });
    await approveLikeCli(repo, changed);
    const approved = repo.records.filter((r) => r.status === "APPROVED").map((r) => r.effectiveFrom);
    expect(approved.filter((d) => d !== "2027-01-01")).toEqual([]);
  });

  it("D. the pack approves two records but the database has one: not a success", async () => {
    const repo = new InMemoryKnowledgeRepository();
    await importContentPack(repo, pack([rec()], "NEEDS_REVIEW"), REGISTRY, { mode: "commit" });
    const two = pack([rec(), rec({ recordId: "KR-2026-902" })], "APPROVED");
    const r = await approveLikeCli(repo, two);
    // Required: the missing record is reported (non-zero exit / explicit error). Today it is never considered.
    expect({ requested: r.requested, accountedFor: r.approved.length + r.notApproved.length + r.contentMismatched.length }).toEqual({ requested: 2, accountedFor: 2 });
  });

  it("F. key order alone does not change the content", async () => {
    const repo = new InMemoryKnowledgeRepository();
    await importContentPack(repo, pack([rec({ ruleData: { type: "T", amount: 100 } })], "NEEDS_REVIEW"), REGISTRY, { mode: "commit" });
    const reordered = pack([rec({ ruleData: { amount: 100, type: "T" } })], "APPROVED");
    const report = await importContentPack(repo, reordered, REGISTRY, { mode: "commit" });
    await approveLikeCli(repo, reordered);
    expect(report.recordsRejected).toEqual([]);
    expect(repo.records.filter((r) => r.status === "APPROVED")).toHaveLength(1);
  });
});
