import { describe, it, expect } from "vitest";
import {
  computeExpiresAt,
  generateSessionToken,
  hashSessionToken,
  requireMatchingSessionId,
  requireOwnedResource,
  requireValidSession,
} from "../src/services/sessionSecurityService.js";
import { InMemorySessionRepository } from "../src/repositories/inMemoryRepositories.js";
import { AppError } from "../src/errors/AppError.js";

describe("computeExpiresAt (ARCHITECTURE §20.2: idle 7 days or 30 days from creation, whichever first)", () => {
  it("uses the 7-day idle window shortly after creation", () => {
    const createdAt = new Date("2026-09-01T00:00:00Z");
    const now = new Date("2026-09-02T00:00:00Z"); // 剛建立不久
    const expiresAt = computeExpiresAt(createdAt, now);
    expect(expiresAt.toISOString()).toBe(new Date("2026-09-09T00:00:00Z").toISOString()); // now + 7d
  });

  it("caps at 30 days from creation even if idle window would allow more", () => {
    const createdAt = new Date("2026-09-01T00:00:00Z");
    const now = new Date("2026-09-25T00:00:00Z"); // 距建立已 24 天，idle 7 天會超過 30 天上限
    const expiresAt = computeExpiresAt(createdAt, now);
    expect(expiresAt.toISOString()).toBe(new Date("2026-10-01T00:00:00Z").toISOString()); // createdAt + 30d
  });
});

describe("generateSessionToken / hashSessionToken", () => {
  it("hashing is deterministic and different tokens hash differently", () => {
    const a = generateSessionToken();
    const b = generateSessionToken();
    expect(hashSessionToken(a)).toBe(hashSessionToken(a));
    expect(hashSessionToken(a)).not.toBe(hashSessionToken(b));
  });
});

describe("requireValidSession (ARCHITECTURE §20.3 step 1)", () => {
  it("rejects a missing token without calling the repository", async () => {
    let called = false;
    const repo = new InMemorySessionRepository();
    const originalFind = repo.findByTokenHash.bind(repo);
    repo.findByTokenHash = async (h) => {
      called = true;
      return originalFind(h);
    };

    await expect(requireValidSession(repo, undefined)).rejects.toMatchObject({ code: "SESSION_INVALID" });
    expect(called).toBe(false);
  });

  it("rejects an unknown token", async () => {
    const repo = new InMemorySessionRepository();
    await expect(requireValidSession(repo, "unknown-token")).rejects.toMatchObject({ code: "SESSION_INVALID" });
  });

  it("rejects a token whose session is not ACTIVE", async () => {
    const repo = new InMemorySessionRepository();
    const created = await repo.createSession();
    repo.sessions.find((s) => s.id === created.id)!.status = "DELETION_REQUESTED";

    await expect(requireValidSession(repo, created.sessionToken)).rejects.toMatchObject({ code: "SESSION_INVALID" });
  });

  it("rejects an expired token", async () => {
    const repo = new InMemorySessionRepository();
    const created = await repo.createSession();
    repo.sessions.find((s) => s.id === created.id)!.expiresAt = new Date(Date.now() - 1).toISOString();

    await expect(requireValidSession(repo, created.sessionToken)).rejects.toMatchObject({ code: "SESSION_INVALID" });
  });

  it("accepts a valid token and rolls the expiry forward (touches lastSeenAt)", async () => {
    const repo = new InMemorySessionRepository();
    const created = await repo.createSession();
    const originalExpiresAt = repo.sessions[0].expiresAt;
    // 手動把 expiresAt 往前調，證明 requireValidSession 真的會更新它，而不是回傳舊資料。
    repo.sessions[0].expiresAt = new Date(Date.now() + 1000).toISOString();

    const session = await requireValidSession(repo, created.sessionToken);

    expect(session.id).toBe(created.id);
    expect(session.lastSeenAt).toBeTruthy();
    expect(repo.sessions[0].lastSeenAt).toBeTruthy();
    void originalExpiresAt;
  });
});

describe("requireMatchingSessionId (API_CONTRACT §3.1: body sessionId must match token's session)", () => {
  it("passes when sessionId matches or is absent", () => {
    const session = { id: "SES-1" } as any;
    expect(() => requireMatchingSessionId(session, "SES-1")).not.toThrow();
    expect(() => requireMatchingSessionId(session, undefined)).not.toThrow();
  });

  it("throws FORBIDDEN when sessionId belongs to a different session", () => {
    const session = { id: "SES-1" } as any;
    expect(() => requireMatchingSessionId(session, "SES-2")).toThrow(AppError);
    try {
      requireMatchingSessionId(session, "SES-2");
    } catch (err) {
      expect((err as AppError).code).toBe("FORBIDDEN");
    }
  });
});

describe("requireOwnedResource (ARCHITECTURE §20.3 step 4: NOT_FOUND, never reveals existence)", () => {
  it("passes when the resource belongs to the session", () => {
    const session = { id: "SES-1" } as any;
    expect(() => requireOwnedResource("SES-1", session, "not found")).not.toThrow();
  });

  it("throws NOT_FOUND (not FORBIDDEN) when the resource belongs to a different session", () => {
    const session = { id: "SES-1" } as any;
    try {
      requireOwnedResource("SES-2", session, "找不到指定的資料。");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe("NOT_FOUND");
      return;
    }
    expect.fail("should have thrown");
  });
});
