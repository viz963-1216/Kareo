// PRIVACY_AND_RETENTION §6.3「需授權角色執行」：清理 CLI 正式入口 runCleanupCli 的授權測試。
// 必須 --operator-id ＋ 環境變數 KAREO_OPERATOR_KEY，且操作者有效並具 DATA_STEWARD 角色；
// 驗證在任何資料庫讀寫之前執行（dry-run 也一樣），deletion_runs.operator_id 記驗證通過的操作者。
import { describe, it, expect, vi } from "vitest";
import { runCleanupCli, type CleanupCliDeps } from "../src/scripts/cleanupExpiredData.js";
import { hashOperatorKey } from "../src/services/internalOperatorService.js";
import { InMemorySessionRepository } from "../src/repositories/inMemoryRepositories.js";
import { InMemoryLeadRepository } from "../src/repositories/inMemoryLeadRepository.js";
import type { InternalOperator, InternalOperatorRole } from "../src/types/index.js";

const OPERATOR_KEY = "test-only-operator-key";
const WITH_KEY = { KAREO_OPERATOR_KEY: OPERATOR_KEY };
const REQUESTED_AT = "2026-10-01T00:00:00+08:00";
const RUN_AT = "2026-10-02T00:00:00+08:00";

function operator(over: Partial<InternalOperator> = {}): InternalOperator {
  return {
    id: "OP-STEWARD",
    displayName: "Test steward",
    roles: ["DATA_STEWARD"] as InternalOperatorRole[],
    keyHash: hashOperatorKey(OPERATOR_KEY),
    active: true,
    createdAt: "2026-10-01T00:00:00+08:00",
    revokedAt: null,
    ...over,
  };
}

async function setup(op: InternalOperator | null = operator()) {
  const sessionRepo = new InMemorySessionRepository();
  const created = await sessionRepo.createSession();
  await sessionRepo.requestDeletion(created.id, REQUESTED_AT);
  const operatorRepo = new InMemoryLeadRepository();
  if (op) operatorRepo.operators.push(op);
  const runCleanup = vi.spyOn(sessionRepo, "runDeletionCleanup");
  const logs: string[] = [];
  const errors: string[] = [];
  const deps: CleanupCliDeps = { sessionRepo, operatorRepo, log: (m) => logs.push(m), error: (m) => errors.push(m) };
  return { sessionRepo, sessionId: created.id, runCleanup, deps, logs, errors };
}

describe("runCleanupCli authorization (PRIVACY_AND_RETENTION §6.3)", () => {
  const rejected: Array<{ label: string; flags: string[]; env: Record<string, string | undefined>; op?: InternalOperator | null; code: number }> = [
    { label: "missing --operator-id", flags: [], env: WITH_KEY, code: 1 },
    { label: "missing KAREO_OPERATOR_KEY", flags: ["--operator-id", "OP-STEWARD"], env: {}, code: 1 },
    { label: "wrong key", flags: ["--operator-id", "OP-STEWARD"], env: { KAREO_OPERATOR_KEY: "wrong" }, code: 1 },
    { label: "unknown operator", flags: ["--operator-id", "OP-NOBODY"], env: WITH_KEY, code: 1 },
    { label: "inactive operator", flags: ["--operator-id", "OP-STEWARD"], env: WITH_KEY, op: operator({ active: false }), code: 1 },
    { label: "revoked operator", flags: ["--operator-id", "OP-STEWARD"], env: WITH_KEY, op: operator({ revokedAt: "2026-10-01T12:00:00+08:00" }), code: 1 },
    { label: "operator without DATA_STEWARD", flags: ["--operator-id", "OP-STEWARD"], env: WITH_KEY, op: operator({ roles: ["LEAD_OPERATOR", "KNOWLEDGE_PUBLISHER"] }), code: 1 },
    { label: "key passed as an argument", flags: ["--operator-id", "OP-STEWARD", "--operator-key", OPERATOR_KEY], env: {}, code: 2 },
    { label: "old positional operator id (unauthenticated claim)", flags: ["OP-STEWARD"], env: WITH_KEY, code: 2 },
    { label: "--operator-id without a value", flags: ["--operator-id"], env: WITH_KEY, code: 2 },
  ];

  for (const mode of ["--commit", "--dry-run"] as const) {
    for (const c of rejected) {
      it(`${mode}: rejects before any database read or write — ${c.label}`, async () => {
        const { deps, runCleanup, sessionRepo, sessionId, errors } = await setup(c.op === undefined ? operator() : c.op);

        const code = await runCleanupCli([mode, ...c.flags], c.env, deps, RUN_AT);

        expect(code).toBe(c.code);
        expect(runCleanup).not.toHaveBeenCalled();
        expect(sessionRepo.deletionRuns).toHaveLength(0);
        expect(sessionRepo.sessions.find((s) => s.id === sessionId)?.status).toBe("DELETION_REQUESTED");
        expect(errors.join(" ")).not.toContain(OPERATOR_KEY);
      });
    }
  }

  it("requires exactly one of --dry-run / --commit", async () => {
    for (const argv of [["--operator-id", "OP-STEWARD"], ["--dry-run", "--commit", "--operator-id", "OP-STEWARD"]]) {
      const { deps, runCleanup } = await setup();
      expect(await runCleanupCli(argv, WITH_KEY, deps, RUN_AT)).toBe(2);
      expect(runCleanup).not.toHaveBeenCalled();
    }
  });

  it("--commit as an active DATA_STEWARD: deletes, and deletion_runs.operator_id is the verified operator", async () => {
    const { deps, sessionRepo, sessionId, logs } = await setup();

    const code = await runCleanupCli(["--commit", "--operator-id", "OP-STEWARD"], WITH_KEY, deps, RUN_AT);

    expect(code).toBe(0);
    expect(sessionRepo.sessions.find((s) => s.id === sessionId)?.status).toBe("DELETED");
    expect(sessionRepo.deletionRuns).toHaveLength(1);
    expect(sessionRepo.deletionRuns[0]).toMatchObject({ status: "SUCCESS", dryRun: false, operatorId: "OP-STEWARD", sessionsDeleted: 1 });
    expect(logs.join("\n")).toContain("Sessions deleted");
    expect(logs.join("\n")).not.toContain(OPERATOR_KEY);
  });

  it("--dry-run as an active DATA_STEWARD: reports the count, writes no deletion_runs row, changes no session", async () => {
    const { deps, sessionRepo, sessionId, logs } = await setup();

    const code = await runCleanupCli(["--dry-run", "--operator-id=OP-STEWARD"], WITH_KEY, deps, RUN_AT);

    expect(code).toBe(0);
    expect(logs.join("\n")).toContain("Mode: dry-run");
    expect(sessionRepo.deletionRuns).toHaveLength(0);
    expect(sessionRepo.sessions.find((s) => s.id === sessionId)?.status).toBe("DELETION_REQUESTED");
  });

  it("a failing run exits 1 after authorization, records FAILED and leaves the request pending for the next daily run", async () => {
    const { deps, sessionRepo, sessionId } = await setup();
    const real = sessionRepo.runDeletionCleanup.bind(sessionRepo);
    sessionRepo.runDeletionCleanup = async () => {
      throw new Error("transient");
    };

    await expect(runCleanupCli(["--commit", "--operator-id", "OP-STEWARD"], WITH_KEY, deps, RUN_AT)).rejects.toThrow();
    expect(sessionRepo.deletionRuns.map((r) => [r.status, r.operatorId])).toEqual([["FAILED", "OP-STEWARD"]]);
    expect(sessionRepo.sessions.find((s) => s.id === sessionId)?.status).toBe("DELETION_REQUESTED");

    sessionRepo.runDeletionCleanup = real;
    expect(await runCleanupCli(["--commit", "--operator-id", "OP-STEWARD"], WITH_KEY, deps, "2026-10-03T00:00:00+08:00")).toBe(0);
    expect(sessionRepo.sessions.find((s) => s.id === sessionId)?.status).toBe("DELETED");
  });
});

describe("cleanupExpiredData module entry", () => {
  it("importing the module does not run the CLI or connect to Supabase", async () => {
    vi.resetModules();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const exitCodeBefore = process.exitCode;

    await import("../src/scripts/cleanupExpiredData.js");
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(errorSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(exitCodeBefore);
    errorSpy.mockRestore();
    logSpy.mockRestore();
  });
});
