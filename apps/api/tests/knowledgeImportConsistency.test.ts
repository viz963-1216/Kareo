// B-012-r7: import/backfill must not register a pack that contradicts legacy DB records.
// Exercise the real service/CLI entry points with synthetic data; never connect to Supabase.
import { describe, expect, it } from "vitest";
import { InMemoryKnowledgeRepository } from "../src/repositories/inMemoryKnowledgeRepository.js";
import { InMemoryAdminKnowledgeRepository } from "../src/repositories/inMemoryAdminKnowledgeRepository.js";
import { importContentPack, parseSourceRegistry } from "../src/services/knowledgeImportService.js";
import { runImportKnowledgePackCli } from "../src/scripts/importKnowledgePack.js";
import { runBackfillCli, runBackfillContentPacks } from "../src/scripts/backfillContentPacks.js";
import { hashOperatorKey } from "../src/services/internalOperatorService.js";
import type { InternalOperator, KnowledgeImportMode, KnowledgeRecordStatus, RawContentPack, RawContentPackRecord } from "../src/types/index.js";

const REGISTRY = `
| sourceId | 名稱 | authority | jurisdiction | sourceUrl | 版本 | 擷取狀態 | active |
|---|---|---|---|---|---|---|---|
| \`SRC-LAW-001\` | 合成來源 | LAW | TAIWAN | https://law.moj.gov.tw/x | v1 | OK | true |
`;
const registry = parseSourceRegistry(REGISTRY);
const AS_OPERATOR = { mode: "commit" as const, importedBy: "OP-PUBLISHER" };
const review = { reviewedBy: "Jerry", reviewedAt: "2026-10-03T09:00:00+08:00", decision: "APPROVED", notes: null };
const rejectedReview = { ...review, decision: "REJECTED", notes: "合成拒收原因" };
const modes: KnowledgeImportMode[] = ["dry-run", "commit"];
const states: KnowledgeRecordStatus[] = ["NEEDS_REVIEW", "APPROVED", "PUBLISHED"];

function record(recordId = "KR-2026-001") {
  return {
    recordId, category: "ELIGIBILITY", jurisdiction: "TAIWAN", title: `合成內容 ${recordId}`,
    source: { sourceId: "SRC-LAW-001", authority: "LAW", url: "https://law.moj.gov.tw/x",
      fetchedAt: "2026-09-23T10:00:00+08:00", contentHash: `sha256:${"a".repeat(64)}` },
    publishedAt: "2026-06-19", effectiveFrom: "2026-07-01", effectiveTo: null,
    lastVerifiedAt: "2026-09-23T10:00:00+08:00", excerpt: "合成原文", summary: "合成摘要",
    ruleData: { minAge: 65 }, status: "APPROVED", review,
  };
}

function pack(records: RawContentPackRecord[] = [record()]): RawContentPack {
  return {
    packId: "KP-2026-10-04-901", formatVersion: "1.0", createdAt: "2026-10-03T09:00:00+08:00",
    createdBy: "Jerry", sourceRegistryVersion: "SR-2026-10-03-01", status: "APPROVED", review,
    intendedKnowledgeVersion: "KB-2026-10-04-901", records,
  };
}

async function seed(state: KnowledgeRecordStatus, records: RawContentPackRecord[] = [record()], legacy = true) {
  const repo = new InMemoryKnowledgeRepository();
  const imported = await importContentPack(repo, pack(records), registry, AS_OPERATOR);
  expect(imported.recordsRejected).toEqual([]);
  expect(repo.records).toHaveLength(records.length);
  if (state === "PUBLISHED") {
    await repo.approveRecords(repo.records.map((r) => ({ id: r.id, expectedContentFingerprint: r.contentFingerprint })));
    await repo.publishVersion({ versionId: "KB-2026-10-03-901", recordIds: repo.records.map((r) => r.id),
      createdBy: "OP-PUBLISHER", approvedBy: "Jerry", notes: null });
  } else {
    for (const r of repo.records) r.status = state;
  }
  if (legacy) repo.contentPacks.length = 0;
  return repo;
}

function snapshot(repo: InMemoryKnowledgeRepository) {
  return structuredClone({ records: repo.records, packs: repo.contentPacks, reviews: repo.reviewEvents,
    versions: repo.versions, members: repo.versionRecords });
}

describe("B-012: immutable legacy pack import", () => {
  for (const state of states) for (const mode of modes) {
    it(`${mode}: changed content marked REJECTED cannot bypass comparison of a ${state} record`, async () => {
      const repo = await seed(state);
      const before = snapshot(repo);
      const report = await importContentPack(repo, pack([{ ...record(), summary: "改過的摘要", status: "REJECTED", review: rejectedReview }]),
        registry, { mode, importedBy: "OP-PUBLISHER" });
      expect(report.recordsRejected.some((r) => r.recordId === "KR-2026-001" && r.reasons.join(" ").includes("RECORD_CONTENT_CHANGED"))).toBe(true);
      expect(report.written).toBe(false);
      expect(snapshot(repo)).toEqual(before);
    });

    it(`${mode}: unchanged content marked REJECTED cannot silently contradict a ${state} DB record`, async () => {
      const repo = await seed(state);
      const before = snapshot(repo);
      const report = await importContentPack(repo, pack([{ ...record(), status: "REJECTED", review: rejectedReview }]),
        registry, { mode, importedBy: "OP-PUBLISHER" });
      expect(report.recordsRejected.some((r) => r.recordId === "KR-2026-001" && r.reasons.join(" ").includes("RECORD_DECISION_MISMATCH"))).toBe(true);
      expect(snapshot(repo)).toEqual(before);
    });
  }

  for (const mode of modes) {
    it(`${mode}: an omitted DB record rejects the whole pack, including an otherwise valid new record`, async () => {
      const repo = await seed("PUBLISHED", [record(), record("KR-2026-002")]);
      const before = snapshot(repo);
      const report = await importContentPack(repo, pack([record(), record("KR-2026-003")]), registry, { mode, importedBy: "OP-PUBLISHER" });
      expect(report.recordsRejected.some((r) => r.recordId === "KR-2026-002" && r.reasons.join(" ").includes("PACK_RECORDS_MISMATCH"))).toBe(true);
      expect(snapshot(repo)).toEqual(before);
    });

    it(`${mode}: a changed rejected record prevents inserting the other new record`, async () => {
      const repo = await seed("APPROVED");
      const before = snapshot(repo);
      const report = await importContentPack(repo, pack([
        record("KR-2026-002"), { ...record(), summary: "改過的摘要", status: "REJECTED", review: rejectedReview },
      ]), registry, { mode, importedBy: "OP-PUBLISHER" });
      expect(report.recordsRejected).not.toHaveLength(0);
      expect(snapshot(repo)).toEqual(before);
    });
  }

  it("a contradictory rejected file entry cannot enable publication of the old approved record", async () => {
    const repo = await seed("APPROVED");
    const admin = new InMemoryAdminKnowledgeRepository(repo);
    expect((await admin.computePublishPlan()).canPublish).toBe(false);
    await importContentPack(repo, pack([{ ...record(), summary: "改過的摘要", status: "REJECTED", review: rejectedReview }]), registry, AS_OPERATOR);
    const plan = await admin.computePublishPlan();
    expect(plan.canPublish).toBe(false);
    expect(plan.newRecords).toEqual([]);
    expect(repo.contentPacks).toEqual([]);
    expect(admin.auditEvents).toEqual([]);
  });

  it("a registered pack cannot hide a rejection by leaving its content fingerprint unchanged", async () => {
    const repo = await seed("APPROVED", [record()], false);
    const before = snapshot(repo);
    const report = await importContentPack(repo, pack([{ ...record(), status: "REJECTED", review: rejectedReview }]), registry, AS_OPERATOR);
    expect(report.recordsRejected).not.toHaveLength(0);
    expect(snapshot(repo)).toEqual(before);
  });

  for (const state of states) {
    it(`identical legacy ${state} records can be registered without changing their content, state or snapshots`, async () => {
      const repo = await seed(state);
      const before = snapshot(repo);
      const report = await importContentPack(repo, pack(), registry, AS_OPERATOR);
      expect(report.recordsRejected).toEqual([]);
      expect(report.recordsValid).toBe(0);
      expect(repo.contentPacks).toHaveLength(1);
      expect({ ...snapshot(repo), packs: [] }).toEqual(before);
    });
  }

  it("a new REJECTED record is fingerprinted but is not inserted or made publishable", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const incoming = pack([record(), { ...record("KR-2026-002"), status: "REJECTED", review: rejectedReview }]);
    const report = await importContentPack(repo, incoming, registry, AS_OPERATOR);
    expect(report.recordsRejected).toEqual([]);
    expect(repo.records.map((r) => r.packRecordId)).toEqual(["KR-2026-001"]);
    expect(repo.records[0].status).toBe("NEEDS_REVIEW");
    const firstFingerprint = repo.contentPacks[0].recordsFingerprint;
    await importContentPack(repo, incoming, registry, AS_OPERATOR);
    expect(repo.contentPacks[0].recordsFingerprint).toBe(firstFingerprint);
    expect(repo.records).toHaveLength(1);
  });

  it("an already REJECTED DB record with identical content remains rejected on registration", async () => {
    const repo = await seed("REJECTED");
    const before = snapshot(repo);
    const report = await importContentPack(repo, pack([{ ...record(), status: "REJECTED", review: rejectedReview }]), registry, AS_OPERATOR);
    expect(report.recordsRejected).toEqual([]);
    expect({ ...snapshot(repo), packs: [] }).toEqual(before);
    expect((await new InMemoryAdminKnowledgeRepository(repo).computePublishPlan()).canPublish).toBe(false);
  });
});

describe("B-012: backfill cannot bypass import consistency", () => {
  for (const state of states) for (const changed of [false, true]) {
    it(`skips a ${state} record declared REJECTED (${changed ? "changed" : "identical"} content), with no audit or snapshot changes`, async () => {
      const repo = await seed(state);
      const before = snapshot(repo);
      const incoming = pack([{ ...record(), summary: changed ? "改過的摘要" : record().summary, status: "REJECTED", review: rejectedReview }]);
      const outcome = await runBackfillContentPacks(repo, [incoming], { importedBy: "OP-PUBLISHER" });
      expect(outcome.registered).toEqual([]);
      expect(outcome.skipped).toHaveLength(1);
      expect(outcome.skipped[0].reasons.join(" ")).toContain("KR-2026-001");
      expect(snapshot(repo)).toEqual(before);
    });
  }

  it("backfills a matching rejected DB record without inventing an approval event", async () => {
    const repo = await seed("REJECTED");
    const before = snapshot(repo);
    const outcome = await runBackfillContentPacks(repo, [pack([{ ...record(), status: "REJECTED", review: rejectedReview }])],
      { importedBy: "OP-PUBLISHER" });
    expect(outcome.skipped).toEqual([]);
    expect(outcome.registered).toHaveLength(1);
    expect(outcome.reviewEventsInserted).toBe(0);
    expect({ ...snapshot(repo), packs: [] }).toEqual(before);
  });
});

describe("B-012: consistency failures return nonzero through the actual CLIs", () => {
  const key = "synthetic-consistency-test-key";
  const operator: InternalOperator = { id: "OP-PUBLISHER", displayName: "Synthetic operator",
    roles: ["KNOWLEDGE_PUBLISHER"], keyHash: hashOperatorKey(key), active: true,
    createdAt: "2026-10-03T09:00:00+08:00", revokedAt: null };
  const operatorRepo = { findOperatorById: async (id: string) => id === operator.id ? operator : null };
  const incoming = pack([{ ...record(), status: "REJECTED", review: rejectedReview }]);

  it("import CLI refuses the contradictory pack without writes", async () => {
    const repo = await seed("APPROVED");
    const before = snapshot(repo);
    const code = await runImportKnowledgePackCli(["--commit", "--operator-id", operator.id, "/pack.json", "/registry.md"],
      { KAREO_OPERATOR_KEY: key }, { knowledgeRepo: repo, operatorRepo,
        readFile: (path) => path === "/pack.json" ? JSON.stringify(incoming) : REGISTRY, log: () => {}, error: () => {} });
    expect(code).toBe(1);
    expect(snapshot(repo)).toEqual(before);
  });

  it("backfill CLI refuses the contradictory pack without writes", async () => {
    const repo = await seed("APPROVED");
    const before = snapshot(repo);
    const code = await runBackfillCli(["--operator-id", operator.id, "/packs"], { KAREO_OPERATOR_KEY: key },
      { knowledgeRepo: repo, operatorRepo, loadPacks: () => [incoming], log: () => {}, error: () => {} });
    expect(code).toBe(1);
    expect(snapshot(repo)).toEqual(before);
  });
});
