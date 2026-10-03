// TASK-B-011b：每日到期清理作業（PRIVACY_AND_RETENTION §6.3、DATA_MODEL §40）。
// D-05（2026-10-03 確認）四個保存期限時鐘：90 天閒置 session、180 天 Lead 聯絡欄位清空、
// 1 年 Lead 整筆刪除、3 年 Consent 整筆刪除。
import { describe, it, expect } from "vitest";
import { runRetentionCleanup } from "../src/services/retentionService.js";
import { InMemorySessionRepository, InMemoryConsentRepository } from "../src/repositories/inMemoryRepositories.js";
import { InMemoryLeadRepository } from "../src/repositories/inMemoryLeadRepository.js";
import type { Lead, Consent } from "../src/types/index.js";

function makeLead(overrides: Partial<Lead>): Lead {
  return {
    id: "LEAD-1",
    sessionId: "SES-1",
    assessmentId: "ASM-1",
    recommendationId: "REC-1",
    providerId: "PROV-1",
    serviceType: "HOME_CARE",
    contactName: "王小明",
    contactPhone: "0912345678",
    contactConsentAt: "2026-01-01T00:00:00+08:00",
    idempotencyKey: "IDEMP-1",
    status: "CLOSED",
    statusReason: null,
    assignedOperatorId: null,
    firstContactedAt: "2026-01-01T00:00:00+08:00",
    closedAt: "2026-01-01T00:00:00+08:00",
    createdAt: "2026-01-01T00:00:00+08:00",
    updatedAt: "2026-01-01T00:00:00+08:00",
    ...overrides,
  };
}

function makeConsent(overrides: Partial<Consent>): Consent {
  return {
    id: "CON-1",
    sessionId: "SES-1",
    disclaimerVersion: "v1",
    privacyVersion: "v1",
    termsVersion: "v1",
    acceptedAt: "2026-01-01T00:00:00+08:00",
    withdrawnAt: null,
    ...overrides,
  };
}

describe("runRetentionCleanup", () => {
  it("dry-run reports the count without writing a DeletionRun record (D-05a: a pending request is already a candidate)", async () => {
    const repo = new InMemorySessionRepository();
    const created = await repo.createSession();
    await repo.requestDeletion(created.id, "2026-10-01T00:00:00+08:00");

    const run = await runRetentionCleanup(repo, { dryRun: true, operatorId: null, now: "2026-10-01T00:00:01+08:00" });

    expect(run.dryRun).toBe(true);
    expect(run.status).toBe("SUCCESS");
    expect(run.sessionsDeleted).toBe(1);
    expect(repo.deletionRuns).toHaveLength(0);
    expect(repo.sessions.find((s) => s.id === created.id)?.status).toBe("DELETION_REQUESTED"); // untouched
  });

  it("D-05a: a failed run is recorded FAILED and leaves the request pending; the next daily run finishes before deletionScheduledBefore", async () => {
    const repo = new InMemorySessionRepository();
    const created = await repo.createSession();
    const requestedAt = "2026-10-01T00:00:00+08:00";
    await repo.requestDeletion(created.id, requestedAt);
    const deadline = new Date(new Date(requestedAt).getTime() + 7 * 24 * 60 * 60 * 1000).getTime();

    const realRun = repo.runDeletionCleanup.bind(repo);
    repo.runDeletionCleanup = async () => {
      throw new Error("transient failure");
    };
    await expect(runRetentionCleanup(repo, { dryRun: false, operatorId: "OP-1", now: "2026-10-02T00:00:00+08:00" })).rejects.toThrow();
    expect(repo.deletionRuns.map((r) => r.status)).toEqual(["FAILED"]);
    expect(repo.sessions.find((s) => s.id === created.id)?.status).toBe("DELETION_REQUESTED");

    repo.runDeletionCleanup = realRun;
    const retryAt = "2026-10-03T00:00:00+08:00";
    const retry = await runRetentionCleanup(repo, { dryRun: false, operatorId: "OP-1", now: retryAt });

    expect(retry.sessionsDeleted).toBe(1);
    expect(new Date(retryAt).getTime()).toBeLessThan(deadline);
    expect(repo.sessions.find((s) => s.id === created.id)?.status).toBe("DELETED");
    expect(repo.deletionRuns.map((r) => r.status)).toEqual(["FAILED", "SUCCESS"]);
  });

  it("dry-run reports the count without actually transitioning sessions, once 7 days have elapsed", async () => {
    const repo = new InMemorySessionRepository();
    const created = await repo.createSession();
    await repo.requestDeletion(created.id, "2026-10-01T00:00:00+08:00");

    const run = await runRetentionCleanup(repo, { dryRun: true, operatorId: null, now: "2026-10-09T00:00:01+08:00" });

    expect(run.sessionsDeleted).toBe(1);
    expect(repo.deletionRuns).toHaveLength(0);
    expect(repo.sessions.find((s) => s.id === created.id)?.status).toBe("DELETION_REQUESTED"); // untouched
  });

  it("commit mode writes a SUCCESS DeletionRun and actually transitions eligible sessions", async () => {
    const repo = new InMemorySessionRepository();
    const created = await repo.createSession();
    await repo.requestDeletion(created.id, "2026-10-01T00:00:00+08:00");

    const run = await runRetentionCleanup(repo, { dryRun: false, operatorId: "OP-1", now: "2026-10-09T00:00:01+08:00" });

    expect(run.status).toBe("SUCCESS");
    expect(run.sessionsDeleted).toBe(1);
    expect(run.operatorId).toBe("OP-1");
    expect(repo.deletionRuns).toHaveLength(1);
    expect(repo.deletionRuns[0].id).toBe(run.id);
    expect(repo.sessions.find((s) => s.id === created.id)?.status).toBe("DELETED");
  });

  it("errorMessage never leaks the underlying exception's raw content", async () => {
    const repo = new InMemorySessionRepository();
    const originalRunCleanup = repo.runDeletionCleanup.bind(repo);
    repo.runDeletionCleanup = async () => {
      throw new Error("raw SQL detail: duplicate key value violates unique constraint sessions_pkey");
    };

    await expect(runRetentionCleanup(repo, { dryRun: false, operatorId: null, now: "2026-10-09T00:00:01+08:00" })).rejects.toThrow();
    expect(repo.deletionRuns).toHaveLength(1);
    expect(repo.deletionRuns[0].status).toBe("FAILED");
    expect(repo.deletionRuns[0].errorMessage).not.toContain("SQL");
    expect(repo.deletionRuns[0].errorMessage).not.toContain("sessions_pkey");

    void originalRunCleanup;
  });

  it("90-day idle ACTIVE session is swept even without an explicit deletion request", async () => {
    const repo = new InMemorySessionRepository();
    const created = await repo.createSession();
    const session = repo.sessions.find((s) => s.id === created.id)!;
    session.lastSeenAt = "2026-07-01T00:00:00+08:00"; // 遠早於 90 天前

    const dry = await runRetentionCleanup(repo, { dryRun: true, operatorId: null, now: "2026-10-09T00:00:00+08:00" });
    expect(dry.sessionsDeleted).toBe(1);
    expect(session.status).toBe("ACTIVE"); // dry-run 不變動

    const run = await runRetentionCleanup(repo, { dryRun: false, operatorId: "OP-1", now: "2026-10-09T00:00:00+08:00" });
    expect(run.sessionsDeleted).toBe(1);
    expect(session.status).toBe("DELETED");
  });

  it("90-day idle sweep does not touch a session recently seen", async () => {
    const repo = new InMemorySessionRepository();
    const created = await repo.createSession();
    const session = repo.sessions.find((s) => s.id === created.id)!;
    session.lastSeenAt = "2026-09-20T00:00:00+08:00"; // 遠未達 90 天

    const run = await runRetentionCleanup(repo, { dryRun: false, operatorId: null, now: "2026-10-09T00:00:00+08:00" });
    expect(run.sessionsDeleted).toBe(0);
    expect(session.status).toBe("ACTIVE");
  });

  it("180-day lead contact clear: clears contact fields but keeps the lead row", async () => {
    const leadRepo = new InMemoryLeadRepository();
    const lead = makeLead({ id: "LEAD-180", status: "CLOSED", closedAt: "2026-04-01T00:00:00+08:00" }); // 遠超過 180 天
    leadRepo.leads.push(lead);
    const repo = new InMemorySessionRepository(leadRepo);

    const run = await runRetentionCleanup(repo, { dryRun: false, operatorId: null, now: "2026-10-09T00:00:00+08:00" });

    expect(run.leadsContactCleared).toBe(1);
    expect(run.leadsDeleted).toBe(0);
    const stored = leadRepo.leads.find((l) => l.id === "LEAD-180");
    expect(stored).toBeDefined();
    expect(stored?.contactName).toBeNull();
    expect(stored?.contactPhone).toBeNull();
  });

  it("180-day lead contact clear is idempotent (already-cleared leads are not re-counted)", async () => {
    const leadRepo = new InMemoryLeadRepository();
    leadRepo.leads.push(
      makeLead({ id: "LEAD-CLEARED", status: "CLOSED", closedAt: "2026-04-01T00:00:00+08:00", contactName: null, contactPhone: null })
    );
    const repo = new InMemorySessionRepository(leadRepo);

    const run = await runRetentionCleanup(repo, { dryRun: false, operatorId: null, now: "2026-10-09T00:00:00+08:00" });
    expect(run.leadsContactCleared).toBe(0);
  });

  it("1-year lead deletion removes the lead row and its child events/idempotency records", async () => {
    const leadRepo = new InMemoryLeadRepository();
    const lead = makeLead({ id: "LEAD-1YR", status: "CANCELLED", closedAt: "2025-09-01T00:00:00+08:00" }); // 超過 1 年
    leadRepo.leads.push(lead);
    leadRepo.statusEvents.push({
      id: "EVT-1",
      leadId: "LEAD-1YR",
      fromStatus: "NEW",
      toStatus: "CANCELLED",
      reasonCode: null,
      note: null,
      operatorId: null,
      createdAt: "2025-09-01T00:00:00+08:00",
    });
    leadRepo.accessEvents.push({
      id: "ACC-1",
      leadId: "LEAD-1YR",
      operatorId: "OP-1",
      action: "REVEAL_CONTACT",
      createdAt: "2025-09-01T00:00:00+08:00",
    });
    leadRepo.idempotencyRecords.push({
      leadId: "LEAD-1YR",
      requestFingerprint: "fp",
      duplicate: false,
      sessionId: "SES-1",
      idempotencyKey: "IDEMP-1",
    });

    const repo = new InMemorySessionRepository(leadRepo);
    const run = await runRetentionCleanup(repo, { dryRun: false, operatorId: null, now: "2026-10-09T00:00:00+08:00" });

    expect(run.leadsDeleted).toBe(1);
    expect(leadRepo.leads.find((l) => l.id === "LEAD-1YR")).toBeUndefined();
    expect(leadRepo.statusEvents.find((e) => e.leadId === "LEAD-1YR")).toBeUndefined();
    expect(leadRepo.accessEvents.find((e) => e.leadId === "LEAD-1YR")).toBeUndefined();
    expect(leadRepo.idempotencyRecords.find((r) => r.leadId === "LEAD-1YR")).toBeUndefined();
  });

  it("re-running cleanup after a lead is already deleted does not double-count it", async () => {
    const leadRepo = new InMemoryLeadRepository();
    leadRepo.leads.push(makeLead({ id: "LEAD-1YR", status: "CLOSED", closedAt: "2025-09-01T00:00:00+08:00" }));
    const repo = new InMemorySessionRepository(leadRepo);

    const first = await runRetentionCleanup(repo, { dryRun: false, operatorId: null, now: "2026-10-09T00:00:00+08:00" });
    expect(first.leadsDeleted).toBe(1);

    const second = await runRetentionCleanup(repo, { dryRun: false, operatorId: null, now: "2026-10-09T00:00:00+08:00" });
    expect(second.leadsDeleted).toBe(0);
  });

  it("3-year consent deletion removes the consent row", async () => {
    const consentRepo = new InMemoryConsentRepository();
    consentRepo.consents.push(makeConsent({ id: "CON-3YR", acceptedAt: "2023-01-01T00:00:00+08:00" })); // 超過 3 年
    const repo = new InMemorySessionRepository(undefined, consentRepo);

    const dry = await runRetentionCleanup(repo, { dryRun: true, operatorId: null, now: "2026-10-09T00:00:00+08:00" });
    expect(dry.consentsDeleted).toBe(1);
    expect(consentRepo.consents).toHaveLength(1); // dry-run 不變動

    const run = await runRetentionCleanup(repo, { dryRun: false, operatorId: null, now: "2026-10-09T00:00:00+08:00" });
    expect(run.consentsDeleted).toBe(1);
    expect(consentRepo.consents.find((c) => c.id === "CON-3YR")).toBeUndefined();
  });

  it("consent not yet at the 3-year boundary is left untouched", async () => {
    const consentRepo = new InMemoryConsentRepository();
    consentRepo.consents.push(makeConsent({ id: "CON-RECENT", acceptedAt: "2026-09-01T00:00:00+08:00" }));
    const repo = new InMemorySessionRepository(undefined, consentRepo);

    const run = await runRetentionCleanup(repo, { dryRun: false, operatorId: null, now: "2026-10-09T00:00:00+08:00" });
    expect(run.consentsDeleted).toBe(0);
    expect(consentRepo.consents.find((c) => c.id === "CON-RECENT")).toBeDefined();
  });

  it("a single run reports and executes all four clocks together", async () => {
    const leadRepo = new InMemoryLeadRepository();
    const consentRepo = new InMemoryConsentRepository();
    const repo = new InMemorySessionRepository(leadRepo, consentRepo);

    const created = await repo.createSession();
    await repo.requestDeletion(created.id, "2026-10-01T00:00:00+08:00"); // 已請求刪除：下一次清理即處理（D-05a）

    leadRepo.leads.push(makeLead({ id: "LEAD-180", status: "CLOSED", closedAt: "2026-04-01T00:00:00+08:00" }));
    leadRepo.leads.push(makeLead({ id: "LEAD-1YR", status: "CANCELLED", closedAt: "2025-09-01T00:00:00+08:00" }));
    consentRepo.consents.push(makeConsent({ id: "CON-3YR", acceptedAt: "2023-01-01T00:00:00+08:00" }));

    const run = await runRetentionCleanup(repo, { dryRun: false, operatorId: "OP-1", now: "2026-10-09T00:00:01+08:00" });

    // 注意：LEAD-1YR 同時超過 180 天與 1 年門檻，依 migration 0019 的既有設計，兩個時鐘的篩選條件
    // 本就不互斥（180 天清空聯絡欄位 → 1 年整筆刪除依序執行），因此 leadsContactCleared 會同時
    // 計入 LEAD-180 與 LEAD-1YR 共 2 筆，leadsDeleted 只計入真正被刪除的 LEAD-1YR 1 筆。
    expect(run.sessionsDeleted).toBe(1);
    expect(run.leadsContactCleared).toBe(2);
    expect(run.leadsDeleted).toBe(1);
    expect(run.consentsDeleted).toBe(1);
    expect(repo.deletionRuns[0]).toMatchObject({
      sessionsDeleted: 1,
      leadsContactCleared: 2,
      leadsDeleted: 1,
      consentsDeleted: 1,
    });
  });
});
