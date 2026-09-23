import { describe, it, expect } from "vitest";
import {
  approveRecords,
  getKnowledgeStatus,
  generateKnowledgeVersionId,
  publishVersion,
  withdrawVersion,
} from "../src/services/knowledgeService.js";
import { InMemoryKnowledgeRepository } from "../src/repositories/inMemoryKnowledgeRepository.js";
import { AppError } from "../src/errors/AppError.js";
import type { KnowledgeRecord } from "../src/types/index.js";

function record(overrides: Partial<KnowledgeRecord> = {}): KnowledgeRecord {
  return {
    id: "KREC-001",
    sourceId: "SRC-LAW-001",
    title: "長照服務對象",
    category: "ELIGIBILITY",
    jurisdiction: "TAIWAN",
    sourceUrl: "https://law.moj.gov.tw/x",
    publishedAt: "2026-06-19",
    effectiveFrom: "2026-07-01",
    effectiveTo: null,
    fetchedAt: "2026-09-23T10:00:00+08:00",
    lastVerifiedAt: "2026-09-23T10:00:00+08:00",
    contentHash: "sha256:" + "a".repeat(64),
    status: "NEEDS_REVIEW",
    version: null,
    rawText: "text",
    summary: "summary",
    ruleData: {},
    createdAt: "2026-09-23T10:00:00+08:00",
    updatedAt: "2026-09-23T10:00:00+08:00",
    packId: "KP-2026-09-23-001",
    packRecordId: "KR-2026-001",
    ...overrides,
  };
}

describe("generateKnowledgeVersionId", () => {
  it("matches the KB-YYYY-MM-DD-NNN pattern required by contracts/knowledge/content-pack.schema.json", () => {
    expect(generateKnowledgeVersionId(new Date("2026-09-23T02:00:00Z"))).toMatch(/^KB-\d{4}-\d{2}-\d{2}-\d{3}$/);
  });

  it("uses the Asia/Taipei date, not UTC", () => {
    // 2026-09-23 23:30 UTC = 2026-09-24 07:30 Taipei
    expect(generateKnowledgeVersionId(new Date("2026-09-23T23:30:00Z"))).toMatch(/^KB-2026-09-24-\d{3}$/);
  });
});

describe("getKnowledgeStatus", () => {
  it("throws KNOWLEDGE_UNAVAILABLE when there is no PUBLISHED version (no fake version number)", async () => {
    const repo = new InMemoryKnowledgeRepository();
    await expect(getKnowledgeStatus(repo)).rejects.toMatchObject({ code: "KNOWLEDGE_UNAVAILABLE" });
  });

  it("returns the published version status once one exists", async () => {
    const repo = new InMemoryKnowledgeRepository();
    repo.records.push(record({ status: "APPROVED" }));
    const { versionId } = await publishVersion(repo, {
      recordIds: ["KREC-001"],
      createdBy: "B-008",
      approvedBy: "Jerry",
    });

    const status = await getKnowledgeStatus(repo);
    expect(status.version).toBe(versionId);
    expect(status.notice).toContain("1966");
  });
});

describe("approveRecords", () => {
  it("approves NEEDS_REVIEW records and reports which ids were not approved", async () => {
    const repo = new InMemoryKnowledgeRepository();
    repo.records.push(record({ id: "KREC-001", status: "NEEDS_REVIEW" }));
    repo.records.push(record({ id: "KREC-002", status: "REJECTED", packRecordId: "KR-2026-002" }));

    const result = await approveRecords(repo, ["KREC-001", "KREC-002", "KREC-DOES-NOT-EXIST"]);

    expect(result.approved).toEqual(["KREC-001"]);
    expect(result.notApproved.sort()).toEqual(["KREC-002", "KREC-DOES-NOT-EXIST"]);
  });

  it("rejects an empty or non-array recordIds", async () => {
    const repo = new InMemoryKnowledgeRepository();
    await expect(approveRecords(repo, [])).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(approveRecords(repo, "not-an-array")).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});

describe("publishVersion", () => {
  it("rejects publishing when a recordId is not currently APPROVED (no auto-approve on publish)", async () => {
    const repo = new InMemoryKnowledgeRepository();
    repo.records.push(record({ status: "NEEDS_REVIEW" }));

    await expect(
      publishVersion(repo, { recordIds: ["KREC-001"], createdBy: "x", approvedBy: "y" })
    ).rejects.toMatchObject({ code: "INTERNAL_ERROR" });
  });

  it("publishing a new version supersedes the previous PUBLISHED version and its records", async () => {
    const repo = new InMemoryKnowledgeRepository();
    repo.records.push(record({ id: "KREC-001", status: "APPROVED" }));
    const first = await publishVersion(repo, { recordIds: ["KREC-001"], createdBy: "x", approvedBy: "y" });

    repo.records.push(record({ id: "KREC-002", status: "APPROVED", packRecordId: "KR-2026-002" }));
    const second = await publishVersion(repo, { recordIds: ["KREC-002"], createdBy: "x", approvedBy: "y" });

    expect(second.supersededRecordCount).toBe(1);
    expect(repo.versions.find((v) => v.id === first.versionId)?.status).toBe("ARCHIVED");
    expect(repo.records.find((r) => r.id === "KREC-001")?.status).toBe("SUPERSEDED");
    expect(repo.records.find((r) => r.id === "KREC-002")?.status).toBe("PUBLISHED");
    // 同一時間只能有一個 PUBLISHED 版本
    expect(repo.versions.filter((v) => v.status === "PUBLISHED")).toHaveLength(1);
  });

  it("write failure leaves no partial state: neither the new version nor record status changes are kept", async () => {
    const repo = new InMemoryKnowledgeRepository();
    repo.records.push(record({ status: "APPROVED" }));
    repo.failNextPublish = true;

    await expect(
      publishVersion(repo, { recordIds: ["KREC-001"], createdBy: "x", approvedBy: "y" })
    ).rejects.toMatchObject({ code: "INTERNAL_ERROR" });

    expect(repo.versions).toHaveLength(0);
    expect(repo.records[0].status).toBe("APPROVED");
  });
});

describe("withdrawVersion", () => {
  it("withdrawing without a republish target leaves no PUBLISHED version (-> KNOWLEDGE_UNAVAILABLE)", async () => {
    const repo = new InMemoryKnowledgeRepository();
    repo.records.push(record({ status: "APPROVED" }));
    await publishVersion(repo, { recordIds: ["KREC-001"], createdBy: "x", approvedBy: "y" });

    const result = await withdrawVersion(repo, { reason: "官方勘誤", withdrawnBy: "Jerry" });

    expect(result.republishedVersionId).toBeNull();
    await expect(getKnowledgeStatus(repo)).rejects.toMatchObject({ code: "KNOWLEDGE_UNAVAILABLE" });
    expect(repo.versions[0].status).toBe("ARCHIVED");
  });

  it("records the withdrawal reason and operator, and republishes the given previous version", async () => {
    const repo = new InMemoryKnowledgeRepository();
    repo.records.push(record({ id: "KREC-001", status: "APPROVED" }));
    const first = await publishVersion(repo, { recordIds: ["KREC-001"], createdBy: "x", approvedBy: "y" });

    repo.records.push(record({ id: "KREC-002", status: "APPROVED", packRecordId: "KR-2026-002" }));
    await publishVersion(repo, { recordIds: ["KREC-002"], createdBy: "x", approvedBy: "y" });

    const result = await withdrawVersion(repo, {
      reason: "第二版有誤",
      withdrawnBy: "Jerry",
      republishVersionId: first.versionId,
    });

    expect(result.republishedVersionId).toBe(first.versionId);
    expect(repo.versions.find((v) => v.id === first.versionId)?.status).toBe("PUBLISHED");
    expect(repo.records.find((r) => r.id === "KREC-001")?.status).toBe("PUBLISHED");
    const status = await getKnowledgeStatus(repo);
    expect(status.version).toBe(first.versionId);
  });

  it("rejects when there is nothing PUBLISHED to withdraw", async () => {
    const repo = new InMemoryKnowledgeRepository();
    await expect(withdrawVersion(repo, { reason: "x", withdrawnBy: "y" })).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
    });
  });
});
