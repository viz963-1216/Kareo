import { describe, it, expect } from "vitest";
import { createAdminSession, hashAdminToken, requireAdminSession } from "../src/services/adminAuthService.js";
import { hashOperatorKey } from "../src/services/internalOperatorService.js";
import {
  decideKnowledgeRecord,
  dismissKnowledgeChange,
  getAdminKnowledgeStatus,
  listAdminChanges,
  listAdminRecords,
  listRestorableVersions,
  withdrawKnowledgeVersion,
} from "../src/services/adminKnowledgeService.js";
import { InMemoryKnowledgeRepository } from "../src/repositories/inMemoryKnowledgeRepository.js";
import { InMemoryAdminKnowledgeRepository } from "../src/repositories/inMemoryAdminKnowledgeRepository.js";
import type { InternalOperator, KnowledgeChange, KnowledgeRecord } from "../src/types/index.js";

function operator(overrides: Partial<InternalOperator> = {}): InternalOperator {
  return {
    id: "OP-001",
    displayName: "Jerry",
    roles: ["KNOWLEDGE_PUBLISHER"],
    keyHash: hashOperatorKey("correct-key"),
    active: true,
    createdAt: "2026-09-24T00:00:00+08:00",
    revokedAt: null,
    ...overrides,
  };
}

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
    contentFingerprint: "sha256:" + "f".repeat(64),
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

function change(overrides: Partial<KnowledgeChange> = {}): KnowledgeChange {
  return {
    id: "KC-001",
    knowledgeRecordId: "KREC-001",
    oldContentHash: "sha256:" + "a".repeat(64),
    newContentHash: "sha256:" + "b".repeat(64),
    oldContent: "old",
    newContent: "new",
    aiSummary: null,
    status: "NEEDS_REVIEW",
    detectedAt: "2026-09-29T10:00:00+08:00",
    reviewedAt: null,
    reviewedBy: null,
    ...overrides,
  };
}

function buildFixture() {
  const knowledge = new InMemoryKnowledgeRepository();
  const admin = new InMemoryAdminKnowledgeRepository(knowledge);
  admin.operators.push(operator());
  return { knowledge, admin };
}

describe("adminAuthService", () => {
  it("createAdminSession succeeds for an active KNOWLEDGE_PUBLISHER operator and requireAdminSession accepts the resulting token", async () => {
    const { admin } = buildFixture();
    const { adminToken, expiresAt } = await createAdminSession(admin, { operatorId: "OP-001", operatorKey: "correct-key" });
    expect(adminToken).toBeTruthy();
    expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now());

    const resolved = await requireAdminSession(admin, adminToken);
    expect(resolved.id).toBe("OP-001");
  });

  it("createAdminSession rejects a wrong operatorKey or unknown operatorId with SESSION_INVALID", async () => {
    const { admin } = buildFixture();
    await expect(createAdminSession(admin, { operatorId: "OP-001", operatorKey: "wrong" })).rejects.toMatchObject({
      code: "SESSION_INVALID",
    });
    await expect(createAdminSession(admin, { operatorId: "OP-UNKNOWN", operatorKey: "correct-key" })).rejects.toMatchObject({
      code: "SESSION_INVALID",
    });
  });

  it("createAdminSession rejects an operator without KNOWLEDGE_PUBLISHER with FORBIDDEN", async () => {
    const { admin } = buildFixture();
    admin.operators[0].roles = ["LEAD_OPERATOR"];
    await expect(createAdminSession(admin, { operatorId: "OP-001", operatorKey: "correct-key" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("requireAdminSession rejects a missing/invalid/expired token with SESSION_INVALID", async () => {
    const { admin } = buildFixture();
    await expect(requireAdminSession(admin, undefined)).rejects.toMatchObject({ code: "SESSION_INVALID" });
    await expect(requireAdminSession(admin, "bogus")).rejects.toMatchObject({ code: "SESSION_INVALID" });

    admin.adminSessions.push({
      id: "ADMSES-1",
      operatorId: "OP-001",
      expiresAt: "2020-01-01T00:00:00+08:00",
      createdAt: "2019-01-01T00:00:00+08:00",
      tokenHash: hashAdminToken("expired-token"),
    });
    await expect(requireAdminSession(admin, "expired-token")).rejects.toMatchObject({ code: "SESSION_INVALID" });
  });
});

describe("getAdminKnowledgeStatus / listAdminChanges / listAdminRecords", () => {
  it("returns null published version and null lastCrawlerRun when nothing has happened yet", async () => {
    const { admin } = buildFixture();
    expect(await getAdminKnowledgeStatus(admin)).toEqual({ publishedVersion: null, publishedAt: null, lastCrawlerRun: null });
  });

  it("lists NEEDS_REVIEW changes and records, deriving sourceId from the underlying record", async () => {
    const { knowledge, admin } = buildFixture();
    knowledge.records.push(record());
    knowledge.changes.push(change());

    const changes = await listAdminChanges(admin, undefined);
    expect(changes).toEqual([
      expect.objectContaining({ id: "KC-001", sourceId: "SRC-LAW-001", status: "NEEDS_REVIEW" }),
    ]);

    const records = await listAdminRecords(admin, "NEEDS_REVIEW");
    expect(records).toEqual([expect.objectContaining({ id: "KREC-001", status: "NEEDS_REVIEW" })]);
  });

  it("rejects a status query other than NEEDS_REVIEW with VALIDATION_ERROR", async () => {
    const { admin } = buildFixture();
    await expect(listAdminChanges(admin, "APPROVED")).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(listAdminRecords(admin, "PUBLISHED")).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});

describe("decideKnowledgeRecord", () => {
  it("approves a NEEDS_REVIEW record with a matching content fingerprint", async () => {
    const { knowledge, admin } = buildFixture();
    knowledge.records.push(record());

    const result = await decideKnowledgeRecord(admin, "OP-001", "KREC-001", {
      decision: "APPROVED",
      reason: "已核對原文，數字一致。",
      expectedContentFingerprint: "sha256:" + "f".repeat(64),
      confirm: true,
    });

    expect(result.record.status).toBe("APPROVED");
    expect(result.review).toMatchObject({ decision: "APPROVED", reviewedBy: "OP-001" });
    expect(knowledge.records[0].status).toBe("APPROVED");
    expect(admin.auditEvents).toHaveLength(1);
    expect(admin.auditEvents[0]).toMatchObject({ action: "KNOWLEDGE_RECORD_APPROVED", targetType: "KNOWLEDGE_RECORD", targetId: "KREC-001" });
  });

  it("rejects a record with decision REJECTED", async () => {
    const { knowledge, admin } = buildFixture();
    knowledge.records.push(record());
    const result = await decideKnowledgeRecord(admin, "OP-001", "KREC-001", {
      decision: "REJECTED",
      reason: "數字對不上原文。",
      expectedContentFingerprint: "sha256:" + "f".repeat(64),
      confirm: true,
    });
    expect(result.record.status).toBe("REJECTED");
    expect(admin.auditEvents[0].action).toBe("KNOWLEDGE_RECORD_REJECTED");
  });

  it("throws NOT_FOUND for an unknown record id", async () => {
    const { admin } = buildFixture();
    await expect(
      decideKnowledgeRecord(admin, "OP-001", "KREC-MISSING", {
        decision: "APPROVED",
        reason: "r",
        expectedContentFingerprint: "sha256:" + "f".repeat(64),
        confirm: true,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(admin.auditEvents).toHaveLength(0);
  });

  it("throws INVALID_STATUS_TRANSITION when the record has already been decided", async () => {
    const { knowledge, admin } = buildFixture();
    knowledge.records.push(record({ status: "APPROVED" }));
    await expect(
      decideKnowledgeRecord(admin, "OP-001", "KREC-001", {
        decision: "APPROVED",
        reason: "r",
        expectedContentFingerprint: "sha256:" + "f".repeat(64),
        confirm: true,
      })
    ).rejects.toMatchObject({ code: "INVALID_STATUS_TRANSITION" });
    expect(admin.auditEvents).toHaveLength(0);
  });

  it("throws KNOWLEDGE_STATE_CHANGED when expectedContentFingerprint no longer matches (content changed since the operator's screen loaded)", async () => {
    const { knowledge, admin } = buildFixture();
    knowledge.records.push(record({ contentFingerprint: "sha256:" + "9".repeat(64) }));
    await expect(
      decideKnowledgeRecord(admin, "OP-001", "KREC-001", {
        decision: "APPROVED",
        reason: "r",
        expectedContentFingerprint: "sha256:" + "f".repeat(64),
        confirm: true,
      })
    ).rejects.toMatchObject({ code: "KNOWLEDGE_STATE_CHANGED" });
    expect(knowledge.records[0].status).toBe("NEEDS_REVIEW");
    expect(admin.auditEvents).toHaveLength(0);
  });

  it("rejects missing reason, missing expectedContentFingerprint, confirm !== true, and a bad decision value with VALIDATION_ERROR", async () => {
    const { knowledge, admin } = buildFixture();
    knowledge.records.push(record());
    const base = { decision: "APPROVED", reason: "r", expectedContentFingerprint: "sha256:" + "f".repeat(64), confirm: true };
    await expect(decideKnowledgeRecord(admin, "OP-001", "KREC-001", { ...base, reason: "" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(decideKnowledgeRecord(admin, "OP-001", "KREC-001", { ...base, expectedContentFingerprint: undefined })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(decideKnowledgeRecord(admin, "OP-001", "KREC-001", { ...base, confirm: false })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(decideKnowledgeRecord(admin, "OP-001", "KREC-001", { ...base, decision: "MAYBE" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});

describe("dismissKnowledgeChange", () => {
  it("dismisses a NEEDS_REVIEW change", async () => {
    const { knowledge, admin } = buildFixture();
    knowledge.records.push(record());
    knowledge.changes.push(change());

    const result = await dismissKnowledgeChange(admin, "OP-001", "KC-001", {
      reason: "只有頁尾更新日期與排版變動，條文與金額未變。",
      confirm: true,
    });

    expect(result.change.status).toBe("DISMISSED");
    expect(knowledge.changes[0].status).toBe("DISMISSED");
    expect(knowledge.changes[0].reviewedBy).toBe("OP-001");
    expect(admin.auditEvents[0]).toMatchObject({ action: "KNOWLEDGE_CHANGE_DISMISSED", targetType: "KNOWLEDGE_CHANGE", targetId: "KC-001" });
  });

  it("throws NOT_FOUND for an unknown change id and INVALID_STATUS_TRANSITION when already processed", async () => {
    const { knowledge, admin } = buildFixture();
    await expect(dismissKnowledgeChange(admin, "OP-001", "KC-MISSING", { reason: "r", confirm: true })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    knowledge.changes.push(change({ status: "DISMISSED" }));
    await expect(dismissKnowledgeChange(admin, "OP-001", "KC-001", { reason: "r", confirm: true })).rejects.toMatchObject({
      code: "INVALID_STATUS_TRANSITION",
    });
  });
});

describe("listRestorableVersions / withdrawKnowledgeVersion", () => {
  async function publishTwoVersions(knowledge: InMemoryKnowledgeRepository) {
    knowledge.records.push(record({ id: "A", status: "APPROVED", title: "A", ruleData: { type: "T_A" } }));
    await knowledge.publishVersion({ versionId: "KB-1", recordIds: ["A"], createdBy: "x", approvedBy: "y", notes: null });
    knowledge.records.push(record({ id: "B", status: "APPROVED", packRecordId: "KR-B", title: "B", ruleData: { type: "T_B" } }));
    await knowledge.publishVersion({ versionId: "KB-2", recordIds: ["B"], createdBy: "x", approvedBy: "y", notes: null });
  }

  it("lists KB-1 as restorable after KB-2 supersedes it (never withdrawn, has snapshot, no expired records)", async () => {
    const { knowledge, admin } = buildFixture();
    await publishTwoVersions(knowledge);

    const result = await listRestorableVersions(admin);
    expect(result.currentVersion).toMatchObject({ versionId: "KB-2" });
    expect(result.versions.map((v) => v.versionId)).toEqual(["KB-1"]);
  });

  it("excludes a version whose snapshot contains an expired record", async () => {
    const { knowledge, admin } = buildFixture();
    knowledge.records.push(
      record({ id: "A", status: "APPROVED", title: "A", ruleData: { type: "T_A" }, effectiveTo: "2020-01-01" })
    );
    await knowledge.publishVersion({ versionId: "KB-1", recordIds: ["A"], createdBy: "x", approvedBy: "y", notes: null });
    knowledge.records.push(record({ id: "B", status: "APPROVED", packRecordId: "KR-B", title: "B", ruleData: { type: "T_B" } }));
    await knowledge.publishVersion({ versionId: "KB-2", recordIds: ["B"], createdBy: "x", approvedBy: "y", notes: null });

    const result = await listRestorableVersions(admin);
    expect(result.versions).toEqual([]);
  });

  it("excludes a version that was itself previously withdrawn from", async () => {
    const { knowledge, admin } = buildFixture();
    await publishTwoVersions(knowledge);
    // KB-2 withdrawn back to KB-1 -> KB-1 becomes PUBLISHED again, KB-2 becomes the withdrawn ARCHIVED one.
    await knowledge.withdrawCurrentVersion({ reason: "r", withdrawnBy: "OP-001", republishVersionId: "KB-1" });

    const result = await listRestorableVersions(admin);
    expect(result.currentVersion).toMatchObject({ versionId: "KB-1" });
    // KB-2 was withdrawn (withdrawnAt set) so it must not appear as a restorable target.
    expect(result.versions.map((v) => v.versionId)).not.toContain("KB-2");
  });

  it("withdraws the current version and republishes a restorable one, writing an audit event", async () => {
    const { knowledge, admin } = buildFixture();
    await publishTwoVersions(knowledge);

    const result = await withdrawKnowledgeVersion(admin, "OP-001", {
      withdrawVersionId: "KB-2",
      republishVersionId: "KB-1",
      reason: "KB-2 的生效日有誤，先回到上一版。",
      confirm: true,
    });

    expect(result).toMatchObject({ withdrawnVersionId: "KB-2", republishedVersionId: "KB-1", withdrawnBy: "OP-001" });
    expect(knowledge.versions.find((v) => v.id === "KB-1")!.status).toBe("PUBLISHED");
    expect(admin.auditEvents.some((e) => e.action === "KNOWLEDGE_VERSION_WITHDRAWN")).toBe(true);
  });

  it("withdraws without republishing (republishVersionId: null)", async () => {
    const { knowledge, admin } = buildFixture();
    await publishTwoVersions(knowledge);
    const result = await withdrawKnowledgeVersion(admin, "OP-001", {
      withdrawVersionId: "KB-2",
      republishVersionId: null,
      reason: "沒有可信的上一版。",
      confirm: true,
    });
    expect(result.republishedVersionId).toBeNull();
    expect(knowledge.versions.some((v) => v.status === "PUBLISHED")).toBe(false);
  });

  it("throws KNOWLEDGE_STATE_CHANGED when withdrawVersionId no longer matches the current PUBLISHED version", async () => {
    const { knowledge, admin } = buildFixture();
    await publishTwoVersions(knowledge);
    await expect(
      withdrawKnowledgeVersion(admin, "OP-001", { withdrawVersionId: "KB-1", republishVersionId: null, reason: "r", confirm: true })
    ).rejects.toMatchObject({ code: "KNOWLEDGE_STATE_CHANGED" });
  });

  it("rejects republishVersionId equal to withdrawVersionId, a missing republishVersionId field, and missing/invalid reason/confirm with VALIDATION_ERROR", async () => {
    const { knowledge, admin } = buildFixture();
    await publishTwoVersions(knowledge);
    await expect(
      withdrawKnowledgeVersion(admin, "OP-001", { withdrawVersionId: "KB-2", republishVersionId: "KB-2", reason: "r", confirm: true })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(
      withdrawKnowledgeVersion(admin, "OP-001", { withdrawVersionId: "KB-2", reason: "r", confirm: true })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(
      withdrawKnowledgeVersion(admin, "OP-001", { withdrawVersionId: "KB-2", republishVersionId: null, reason: "", confirm: true })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(
      withdrawKnowledgeVersion(admin, "OP-001", { withdrawVersionId: "KB-2", republishVersionId: null, reason: "r", confirm: false })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
