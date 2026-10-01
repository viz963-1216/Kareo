// TASK-B-011b：每日到期清理作業（PRIVACY_AND_RETENTION §6.3、DATA_MODEL §40）。
import { describe, it, expect } from "vitest";
import { runRetentionCleanup } from "../src/services/retentionService.js";
import { InMemorySessionRepository } from "../src/repositories/inMemoryRepositories.js";

describe("runRetentionCleanup", () => {
  it("dry-run reports the count without writing a DeletionRun record (not yet 7 days elapsed)", async () => {
    const repo = new InMemorySessionRepository();
    const created = await repo.createSession();
    await repo.requestDeletion(created.id, "2026-10-01T00:00:00+08:00");

    const run = await runRetentionCleanup(repo, { dryRun: true, operatorId: null, now: "2026-10-01T00:00:01+08:00" });

    expect(run.dryRun).toBe(true);
    expect(run.status).toBe("SUCCESS");
    expect(run.sessionsDeleted).toBe(0);
    expect(repo.deletionRuns).toHaveLength(0);
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
});
