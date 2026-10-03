// TASK-B-011b：ARCHITECTURE §20.4 持久化限流共用元件。
import { describe, it, expect } from "vitest";
import { enforceClientIpRateLimit, enforceRateLimit, hashForRateLimitKey, RATE_LIMIT_RULES } from "../src/services/rateLimitService.js";
import { errorResponse } from "../src/lib/response.js";
import { InMemoryRateLimitRepository } from "../src/repositories/inMemoryRepositories.js";

describe("hashForRateLimitKey", () => {
  it("hashes deterministically and never returns the plaintext input", () => {
    const h1 = hashForRateLimitKey("127.0.0.1");
    const h2 = hashForRateLimitKey("127.0.0.1");
    expect(h1).toBe(h2);
    expect(h1).not.toContain("127.0.0.1");
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("different inputs hash to different values", () => {
    expect(hashForRateLimitKey("a")).not.toBe(hashForRateLimitKey("b"));
  });
});

describe("enforceRateLimit", () => {
  it("allows requests up to the limit and blocks the one after, within the same window", async () => {
    const repo = new InMemoryRateLimitRepository();
    const rule = { name: "TEST_RULE", limit: 2, windowSeconds: 60 };
    const now = "2026-10-01T00:00:00+08:00";

    await expect(enforceRateLimit(repo, rule, "k1", now)).resolves.toBeUndefined();
    await expect(enforceRateLimit(repo, rule, "k1", now)).resolves.toBeUndefined();
    await expect(enforceRateLimit(repo, rule, "k1", now)).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });

  it("the RATE_LIMITED error carries a retryAfterSeconds for the Retry-After header", async () => {
    const repo = new InMemoryRateLimitRepository();
    const rule = { name: "TEST_RULE", limit: 1, windowSeconds: 60 };
    await enforceRateLimit(repo, rule, "k2", "2026-10-01T00:00:00+08:00");
    try {
      await enforceRateLimit(repo, rule, "k2", "2026-10-01T00:00:10+08:00");
      expect.fail("should have thrown");
    } catch (err) {
      expect((err as { retryAfterSeconds?: number }).retryAfterSeconds).toBeGreaterThan(0);
      expect((err as { retryAfterSeconds?: number }).retryAfterSeconds).toBeLessThanOrEqual(60);
    }
  });

  it("different keys under the same rule are tracked independently", async () => {
    const repo = new InMemoryRateLimitRepository();
    const rule = { name: "TEST_RULE", limit: 1, windowSeconds: 60 };
    const now = "2026-10-01T00:00:00+08:00";
    await enforceRateLimit(repo, rule, "session-A", now);
    await expect(enforceRateLimit(repo, rule, "session-B", now)).resolves.toBeUndefined();
  });

  it("the window resets after it expires, allowing further requests", async () => {
    const repo = new InMemoryRateLimitRepository();
    const rule = { name: "TEST_RULE", limit: 1, windowSeconds: 60 };
    await enforceRateLimit(repo, rule, "k3", "2026-10-01T00:00:00+08:00");
    await expect(enforceRateLimit(repo, rule, "k3", "2026-10-01T00:00:30+08:00")).rejects.toMatchObject({ code: "RATE_LIMITED" });
    await expect(enforceRateLimit(repo, rule, "k3", "2026-10-01T00:01:01+08:00")).resolves.toBeUndefined();
  });
});

describe("RATE_LIMIT_RULES (ARCHITECTURE §20.4)", () => {
  it("matches the documented limits", () => {
    expect(RATE_LIMIT_RULES.CREATE_SESSION).toMatchObject({ limit: 20, windowSeconds: 3600 });
    expect(RATE_LIMIT_RULES.CONSENT).toMatchObject({ limit: 10, windowSeconds: 3600 });
    expect(RATE_LIMIT_RULES.ASSESSMENT).toMatchObject({ limit: 3, windowSeconds: 3600 });
    expect(RATE_LIMIT_RULES.RECOMMENDATION).toMatchObject({ limit: 30, windowSeconds: 3600 });
    expect(RATE_LIMIT_RULES.PROVIDER_DETAIL).toMatchObject({ limit: 60, windowSeconds: 3600 });
    expect(RATE_LIMIT_RULES.PROVIDER_LOOKUP).toMatchObject({ limit: 120, windowSeconds: 3600 });
    expect(RATE_LIMIT_RULES.KNOWLEDGE_RECORDS).toMatchObject({ limit: 120, windowSeconds: 3600 });
    expect(RATE_LIMIT_RULES.LEAD).toMatchObject({ limit: 5, windowSeconds: 86400 });
    expect(RATE_LIMIT_RULES.LEAD_PHONE).toMatchObject({ limit: 3, windowSeconds: 86400 });
  });
});

// 供 B-012／B-013／B-014 的公開端點 handler 接用的共用入口（ARCHITECTURE §20.4 的 IP 雜湊限流）。
describe("enforceClientIpRateLimit", () => {
  const NOW = "2026-10-01T00:00:00+08:00";
  const eventFrom = (ip: string) => ({ headers: { "x-nf-client-connection-ip": ip } });

  for (const rule of [RATE_LIMIT_RULES.PROVIDER_LOOKUP, RATE_LIMIT_RULES.KNOWLEDGE_RECORDS]) {
    it(`${rule.name}: 120 requests per hour per client IP, the 121st is RATE_LIMITED (429) with Retry-After; another IP is unaffected`, async () => {
      const repo = new InMemoryRateLimitRepository();
      for (let i = 0; i < 120; i++) await enforceClientIpRateLimit(repo, rule, eventFrom("203.0.113.7"), NOW);

      const err = await enforceClientIpRateLimit(repo, rule, eventFrom("203.0.113.7"), "2026-10-01T00:10:00+08:00").catch((e) => e);
      expect(err).toMatchObject({ code: "RATE_LIMITED", statusCode: 429 });
      const response = errorResponse(err);
      expect(response.statusCode).toBe(429);
      expect(Number(response.headers?.["Retry-After"])).toBe(3000); // 視窗剩餘 50 分鐘

      await expect(enforceClientIpRateLimit(repo, rule, eventFrom("203.0.113.8"), NOW)).resolves.toBeUndefined();
      await expect(enforceClientIpRateLimit(repo, rule, eventFrom("203.0.113.7"), "2026-10-01T01:00:01+08:00")).resolves.toBeUndefined(); // 視窗過後重置
    });
  }

  it("the two public rules count separately for the same IP", async () => {
    const repo = new InMemoryRateLimitRepository();
    for (let i = 0; i < 120; i++) await enforceClientIpRateLimit(repo, RATE_LIMIT_RULES.PROVIDER_LOOKUP, eventFrom("203.0.113.9"), NOW);
    await expect(enforceClientIpRateLimit(repo, RATE_LIMIT_RULES.KNOWLEDGE_RECORDS, eventFrom("203.0.113.9"), NOW)).resolves.toBeUndefined();
  });

  it("stores only a hash of the IP in the counter key, never the plaintext; x-forwarded-for first hop is the fallback; no IP shares one 'unknown' bucket", async () => {
    const keys: string[] = [];
    const recording = {
      async checkAndIncrement(input: { key: string }) {
        keys.push(input.key);
        return { allowed: true, retryAfterSeconds: null };
      },
    };
    await enforceClientIpRateLimit(recording, RATE_LIMIT_RULES.PROVIDER_LOOKUP, eventFrom("198.51.100.1"), NOW);
    await enforceClientIpRateLimit(recording, RATE_LIMIT_RULES.PROVIDER_LOOKUP, { headers: { "x-forwarded-for": "198.51.100.2, 10.0.0.1" } }, NOW);
    await enforceClientIpRateLimit(recording, RATE_LIMIT_RULES.PROVIDER_LOOKUP, { headers: {} }, NOW);

    expect(keys).toEqual([
      `PROVIDER_LOOKUP:${hashForRateLimitKey("198.51.100.1")}`,
      `PROVIDER_LOOKUP:${hashForRateLimitKey("198.51.100.2")}`,
      `PROVIDER_LOOKUP:${hashForRateLimitKey("unknown")}`,
    ]);
    expect(keys.join(" ")).not.toMatch(/198\.51\.100/);
  });
});
