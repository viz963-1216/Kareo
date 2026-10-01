import { describe, it, expect } from "vitest";
import { hashOperatorKey, requireOperator } from "../src/services/internalOperatorService.js";
import { InMemoryLeadRepository } from "../src/repositories/inMemoryLeadRepository.js";
import type { InternalOperator } from "../src/types/index.js";

function operator(overrides: Partial<InternalOperator> = {}): InternalOperator {
  return {
    id: "OP-001",
    displayName: "蘇子傑",
    roles: ["LEAD_OPERATOR"],
    keyHash: hashOperatorKey("correct-key"),
    active: true,
    createdAt: "2026-09-24T00:00:00+08:00",
    revokedAt: null,
    ...overrides,
  };
}

describe("requireOperator", () => {
  it("returns the operator when id, key and role all match", async () => {
    const repo = new InMemoryLeadRepository();
    repo.operators.push(operator());
    const result = await requireOperator(repo, "OP-001", "correct-key", "LEAD_OPERATOR");
    expect(result.id).toBe("OP-001");
  });

  it("rejects a missing operatorId or key with SESSION_INVALID", async () => {
    const repo = new InMemoryLeadRepository();
    repo.operators.push(operator());
    await expect(requireOperator(repo, undefined, "correct-key", "LEAD_OPERATOR")).rejects.toMatchObject({
      code: "SESSION_INVALID",
    });
    await expect(requireOperator(repo, "OP-001", undefined, "LEAD_OPERATOR")).rejects.toMatchObject({
      code: "SESSION_INVALID",
    });
  });

  it("rejects an unknown operatorId with SESSION_INVALID", async () => {
    const repo = new InMemoryLeadRepository();
    await expect(requireOperator(repo, "OP-UNKNOWN", "correct-key", "LEAD_OPERATOR")).rejects.toMatchObject({
      code: "SESSION_INVALID",
    });
  });

  it("rejects an inactive operator with SESSION_INVALID", async () => {
    const repo = new InMemoryLeadRepository();
    repo.operators.push(operator({ active: false }));
    await expect(requireOperator(repo, "OP-001", "correct-key", "LEAD_OPERATOR")).rejects.toMatchObject({
      code: "SESSION_INVALID",
    });
  });

  it("rejects a revoked operator with SESSION_INVALID", async () => {
    const repo = new InMemoryLeadRepository();
    repo.operators.push(operator({ revokedAt: "2026-09-25T00:00:00+08:00" }));
    await expect(requireOperator(repo, "OP-001", "correct-key", "LEAD_OPERATOR")).rejects.toMatchObject({
      code: "SESSION_INVALID",
    });
  });

  it("rejects a wrong key with SESSION_INVALID", async () => {
    const repo = new InMemoryLeadRepository();
    repo.operators.push(operator());
    await expect(requireOperator(repo, "OP-001", "wrong-key", "LEAD_OPERATOR")).rejects.toMatchObject({
      code: "SESSION_INVALID",
    });
  });

  it("rejects an operator without the required role with FORBIDDEN", async () => {
    const repo = new InMemoryLeadRepository();
    repo.operators.push(operator({ roles: ["KNOWLEDGE_PUBLISHER"] }));
    await expect(requireOperator(repo, "OP-001", "correct-key", "LEAD_OPERATOR")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
