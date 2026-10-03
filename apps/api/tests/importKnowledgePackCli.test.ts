// D-16c（contracts/knowledge/README §3 第 7–8 點）：正式匯入入口 runImportKnowledgePackCli 的負向測試。
// --commit 必須以 --operator-id 加上既有個人密鑰（KAREO_OPERATOR_KEY）通過 KNOWLEDGE_PUBLISHER 驗證，
// 缺身分、缺／錯密鑰、停用、撤銷、無角色時，在讀取內容包與任何寫入之前拒絕；dry-run 不需要身分。
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { runImportKnowledgePackCli, type ImportCliDeps } from "../src/scripts/importKnowledgePack.js";
import { hashOperatorKey } from "../src/services/internalOperatorService.js";
import { InMemoryKnowledgeRepository } from "../src/repositories/inMemoryKnowledgeRepository.js";
import type { InternalOperator, InternalOperatorRole } from "../src/types/index.js";

const PACK_PATH = "../../contracts/knowledge/packs/KP-2026-09-23-001.json";
const REGISTRY_PATH = "../../docs/knowledge/source-registry.md";
const OPERATOR_KEY = "test-only-operator-key";

function operator(over: Partial<InternalOperator> = {}): InternalOperator {
  return {
    id: "OP-PUBLISHER",
    displayName: "Test publisher",
    roles: ["KNOWLEDGE_PUBLISHER"] as InternalOperatorRole[],
    keyHash: hashOperatorKey(OPERATOR_KEY),
    active: true,
    createdAt: "2026-10-01T00:00:00+08:00",
    revokedAt: null,
    ...over,
  };
}

function cliDeps(repo: InMemoryKnowledgeRepository, op: InternalOperator | null = operator()) {
  const readFile = vi.fn((p: string) => readFileSync(p, "utf-8"));
  const logs: string[] = [];
  const errors: string[] = [];
  const deps: ImportCliDeps = {
    knowledgeRepo: repo,
    operatorRepo: { findOperatorById: async (id: string) => (op && op.id === id ? op : null) },
    readFile,
    log: (m) => logs.push(m),
    error: (m) => errors.push(m),
  };
  return { deps, readFile, logs, errors };
}

const WITH_KEY = { KAREO_OPERATOR_KEY: OPERATOR_KEY };
const COMMIT_AS_PUBLISHER = ["--commit", "--operator-id", "OP-PUBLISHER", PACK_PATH, REGISTRY_PATH];

describe("runImportKnowledgePackCli (formal entry, D-16c)", () => {
  const rejectedCases: Array<{ label: string; argv: string[]; env: Record<string, string | undefined>; op?: InternalOperator | null; code: number }> = [
    { label: "--commit without --operator-id", argv: ["--commit", PACK_PATH, REGISTRY_PATH], env: WITH_KEY, code: 1 },
    { label: "missing KAREO_OPERATOR_KEY", argv: COMMIT_AS_PUBLISHER, env: {}, code: 1 },
    { label: "wrong key", argv: COMMIT_AS_PUBLISHER, env: { KAREO_OPERATOR_KEY: "wrong" }, code: 1 },
    { label: "unknown operator", argv: ["--commit", "--operator-id", "OP-NOBODY", PACK_PATH, REGISTRY_PATH], env: WITH_KEY, code: 1 },
    { label: "inactive operator", argv: COMMIT_AS_PUBLISHER, env: WITH_KEY, op: operator({ active: false }), code: 1 },
    { label: "revoked operator", argv: COMMIT_AS_PUBLISHER, env: WITH_KEY, op: operator({ revokedAt: "2026-10-02T00:00:00+08:00" }), code: 1 },
    { label: "operator without KNOWLEDGE_PUBLISHER", argv: COMMIT_AS_PUBLISHER, env: WITH_KEY, op: operator({ roles: ["LEAD_OPERATOR", "DATA_STEWARD"] }), code: 1 },
    { label: "key passed as an argument", argv: [...COMMIT_AS_PUBLISHER, "--operator-key", OPERATOR_KEY], env: {}, code: 2 },
    { label: "--operator-id without a value", argv: ["--commit", PACK_PATH, "--operator-id"], env: WITH_KEY, code: 2 },
    { label: "both --dry-run and --commit", argv: ["--dry-run", ...COMMIT_AS_PUBLISHER], env: WITH_KEY, code: 2 },
  ];
  for (const c of rejectedCases) {
    it(`rejects before reading the pack or writing: ${c.label}`, async () => {
      const repo = new InMemoryKnowledgeRepository();
      const { deps, readFile, errors } = cliDeps(repo, c.op === undefined ? operator() : c.op);

      const code = await runImportKnowledgePackCli(c.argv, c.env, deps);

      expect(code).toBe(c.code);
      expect(readFile).not.toHaveBeenCalled();
      expect(repo.records).toHaveLength(0);
      expect(repo.contentPacks).toHaveLength(0);
      expect(errors.join(" ")).not.toContain(OPERATOR_KEY); // 密鑰不進 log
    });
  }

  it("a verified KNOWLEDGE_PUBLISHER commits with importedBy = operator ID; a rerun by another operator keeps the first", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const { deps, logs } = cliDeps(repo);

    expect(await runImportKnowledgePackCli(COMMIT_AS_PUBLISHER, WITH_KEY, deps)).toBe(0);
    const first = { ...(await repo.findContentPackById("KP-2026-09-23-001"))! };
    expect(first.importedBy).toBe("OP-PUBLISHER");
    expect(repo.records.length).toBeGreaterThan(0);
    expect(logs.join("\n")).not.toContain(OPERATOR_KEY);

    const second = cliDeps(repo, operator({ id: "OP-OTHER" }));
    expect(await runImportKnowledgePackCli(["--commit", "--operator-id=OP-OTHER", PACK_PATH, REGISTRY_PATH], WITH_KEY, second.deps)).toBe(0);
    expect(await repo.findContentPackById("KP-2026-09-23-001")).toEqual(first);
  });

  it("dry-run needs no operator, writes nothing and creates no audit", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const { deps, logs } = cliDeps(repo, null);

    const code = await runImportKnowledgePackCli(["--dry-run", PACK_PATH, REGISTRY_PATH], {}, deps);

    expect(code).toBe(0);
    expect(logs.join("\n")).toContain("NO DATA WRITTEN");
    expect(repo.records).toHaveLength(0);
    expect(repo.contentPacks).toHaveLength(0);
    expect(repo.reviewEvents).toHaveLength(0);
  });
});

describe("importKnowledgePack module entry", () => {
  it("importing the module does not run the CLI", async () => {
    vi.resetModules();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const exitCodeBefore = process.exitCode;

    await import("../src/scripts/importKnowledgePack.js");
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(errorSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(exitCodeBefore);
    errorSpy.mockRestore();
    logSpy.mockRestore();
  });
});
