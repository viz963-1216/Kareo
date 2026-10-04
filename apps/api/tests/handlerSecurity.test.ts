import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../src/errors/AppError.js";
import * as auth from "../src/services/adminAuthService.js";
import * as admin from "../src/services/adminKnowledgeService.js";
import { InMemoryRateLimitRepository } from "../src/repositories/inMemoryRepositories.js";
import { SupabaseRateLimitRepository } from "../src/repositories/supabaseRateLimitRepository.js";
import { handler as login } from "../src/functions/adminSession.js";
import { handler as publish } from "../src/functions/adminKnowledgePublish.js";
import { handler as withdraw } from "../src/functions/adminKnowledgeWithdraw.js";
import { handler as decision } from "../src/functions/adminKnowledgeRecordDecision.js";
import { handler as dismiss } from "../src/functions/adminKnowledgeChangeDismiss.js";
import { handler as status } from "../src/functions/adminKnowledgeStatus.js";
import { handler as records } from "../src/functions/adminKnowledgeRecords.js";
import { handler as changes } from "../src/functions/adminKnowledgeChanges.js";
import { handler as preview } from "../src/functions/adminKnowledgePublishPreview.js";
import { handler as restorable } from "../src/functions/adminKnowledgeRestorableVersions.js";
import { handler as providers } from "../src/functions/providers.js";
import { handler as knowledge } from "../src/functions/knowledgeRecords.js";
import { enforceAdminOperatorLimit } from "../src/services/adminRequestSecurity.js";
import { hashForRateLimitKey } from "../src/services/rateLimitService.js";
import { SupabaseProviderRepository } from "../src/repositories/supabaseProviderRepository.js";
import { SupabaseKnowledgeRepository } from "../src/repositories/supabaseKnowledgeRepository.js";

const headers = { "x-nf-client-connection-ip": "203.0.113.17", "x-kareo-admin-token": "synthetic-admin-token" };
const event = { httpMethod: "POST", headers, body: "{}" };
const writes = [publish, withdraw, decision, dismiss];
const reads = [status, records, changes, preview, restorable];
afterEach(() => vi.restoreAllMocks());
function persistentCounter() {
  const memory = new InMemoryRateLimitRepository();
  return vi.spyOn(SupabaseRateLimitRepository.prototype, "checkAndIncrement").mockImplementation(input => memory.checkAndIncrement(input));
}

describe("handler security before business operations", () => {
  it.each([login, ...writes])("UTF-8 oversized body returns 413 before parse/auth/DB (%#)", async handler => {
    const counter = vi.spyOn(SupabaseRateLimitRepository.prototype, "checkAndIncrement");
    const response = await handler({ ...event, body: "中".repeat(5500) });
    expect(response.statusCode).toBe(413);
    expect(JSON.parse(response.body).error.code).toBe("PAYLOAD_TOO_LARGE");
    expect(response.headers["Cache-Control"]).toBe("no-store");
    expect(counter).not.toHaveBeenCalled();
  });
  it("counts wrong login credentials; attempt 21 returns 429 without auth or creation", async () => {
    const counter = persistentCounter();
    const create = vi.spyOn(auth, "createAdminSession").mockRejectedValue(new AppError("SESSION_INVALID", "invalid"));
    for (let i = 0; i < 20; i++) expect((await login(event)).statusCode).toBe(401);
    const blocked = await login(event);
    expect(blocked.statusCode).toBe(429);
    expect(Number(blocked.headers["Retry-After"])).toBeGreaterThan(0);
    expect(blocked.headers["Cache-Control"]).toBe("no-store");
    expect(create).toHaveBeenCalledTimes(20);
    expect(counter.mock.calls[0][0].key).toBe(`ADMIN_SESSION:${hashForRateLimitKey("203.0.113.17")}`);
  });
  it.each([...reads, ...writes])("admin IP quota checked before auth (%#)", async handler => {
    vi.spyOn(SupabaseRateLimitRepository.prototype, "checkAndIncrement").mockResolvedValue({ allowed: false, retryAfterSeconds: 120 });
    const authenticate = vi.spyOn(auth, "requireAdminSession");
    const response = await handler({ ...event, httpMethod: reads.includes(handler as typeof status) ? "GET" : "POST" });
    expect(response.statusCode).toBe(429);
    expect(response.headers["Retry-After"]).toBe("120");
    expect(response.headers["Cache-Control"]).toBe("no-store");
    expect(authenticate).not.toHaveBeenCalled();
  });
  it("write quota persists per operator, separately from reads; another operator and a new window are unaffected", async () => {
    const repo = new InMemoryRateLimitRepository();
    const now = "2026-10-04T12:00:00+08:00";
    for (let i = 0; i < 60; i++) await enforceAdminOperatorLimit("OP-SYNTHETIC", true, repo, now);
    await expect(enforceAdminOperatorLimit("OP-SYNTHETIC", true, repo, now)).rejects.toMatchObject({ code: "RATE_LIMITED" });
    await expect(enforceAdminOperatorLimit("OP-OTHER", true, repo, now)).resolves.toBeUndefined();
    await expect(enforceAdminOperatorLimit("OP-SYNTHETIC", false, repo, now)).resolves.toBeUndefined();
    await expect(enforceAdminOperatorLimit("OP-SYNTHETIC", true, repo, "2026-10-04T13:00:01+08:00")).resolves.toBeUndefined();
  });
  it.each(writes)("operator quota prevents each mutation after successful auth (%#)", async handler => {
    const counter = vi.spyOn(SupabaseRateLimitRepository.prototype, "checkAndIncrement").mockImplementation(async input => ({ allowed: !input.key.startsWith("ADMIN_WRITE:"), retryAfterSeconds: 45 }));
    vi.spyOn(auth, "requireAdminSession").mockResolvedValue({ id: "OP-SYNTHETIC" } as Awaited<ReturnType<typeof auth.requireAdminSession>>);
    const names = ["publishKnowledgeVersion", "withdrawKnowledgeVersion", "decideKnowledgeRecord", "dismissKnowledgeChange"] as const;
    const spies = names.map(name => vi.spyOn(admin, name));
    const response = await handler(event);
    expect(response.statusCode).toBe(429);
    expect(response.headers["Retry-After"]).toBe("45");
    expect(counter.mock.calls.map(([input]) => input.key)).toEqual([`ADMIN_REQUEST:${hashForRateLimitKey("203.0.113.17")}`, `ADMIN_WRITE:${hashForRateLimitKey("OP-SYNTHETIC")}`]);
    spies.forEach(spy => expect(spy).not.toHaveBeenCalled());
  });
  it.each([providers, knowledge])("public request 121 returns 429 before resource I/O; separate IP unaffected (%#)", async handler => {
    delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    persistentCounter();
    const providerRead = vi.spyOn(SupabaseProviderRepository.prototype, "findActiveProvidersForLookup");
    const knowledgeRead = vi.spyOn(SupabaseKnowledgeRepository.prototype, "getCurrentPublishedStatus");
    for (let i = 0; i < 120; i++) expect((await handler({ httpMethod: "GET", headers })).statusCode).toBe(500);
    const calls = [providerRead.mock.calls.length, knowledgeRead.mock.calls.length];
    const response = await handler({ httpMethod: "GET", headers });
    expect(response.statusCode).toBe(429);
    expect(Number(response.headers["Retry-After"])).toBeGreaterThan(0);
    expect([providerRead.mock.calls.length, knowledgeRead.mock.calls.length]).toEqual(calls);
    expect((await handler({ httpMethod: "GET", headers: { "x-nf-client-connection-ip": "203.0.113.18" } })).statusCode).toBe(500);
  });
});
