import { describe, it, expect } from "vitest";
import { createSession } from "../src/services/sessionService.js";
import { InMemorySessionRepository } from "../src/repositories/inMemoryRepositories.js";
import { hashSessionToken } from "../src/services/sessionSecurityService.js";

describe("Session", () => {
  it("creates a session successfully", async () => {
    const repo = new InMemorySessionRepository();
    const session = await createSession(repo);

    expect(session.id).toMatch(/^SES-/);
    expect(session.createdAt).toBeTruthy();
    expect(repo.sessions).toHaveLength(1);
  });

  it("returns a response shape matching API_CONTRACT.md v0.2 (sessionId, sessionToken, createdAt, expiresAt)", async () => {
    const repo = new InMemorySessionRepository();
    const session = await createSession(repo);
    const responseData = {
      sessionId: session.id,
      sessionToken: session.sessionToken,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    };

    expect(responseData).toEqual({
      sessionId: expect.any(String),
      sessionToken: expect.any(String),
      createdAt: expect.any(String),
      expiresAt: expect.any(String),
    });
  });

  // 依 ARCHITECTURE §20.1：至少 256 bits（32 bytes）密碼學隨機值，base64url 編碼後至少 43 字元。
  it("issues a token with at least 256 bits of entropy (not Math.random)", async () => {
    const repo = new InMemorySessionRepository();
    const session = await createSession(repo);

    expect(session.sessionToken.length).toBeGreaterThanOrEqual(43);
    expect(session.sessionToken).toMatch(/^[A-Za-z0-9_-]+$/); // base64url

    const other = await createSession(repo);
    expect(other.sessionToken).not.toBe(session.sessionToken);
  });

  it("stores only the token hash — the repository never exposes the plaintext token again after creation", async () => {
    const repo = new InMemorySessionRepository();
    const session = await createSession(repo);

    const found = await repo.findByTokenHash(hashSessionToken(session.sessionToken));
    expect(found?.id).toBe(session.id);
    // Session（非 CreatedSession）型別上就不存在 sessionToken 欄位，findByTokenHash 不會回傳明文。
    expect((found as unknown as Record<string, unknown>).sessionToken).toBeUndefined();
  });

  it("a wrong token never matches a different session's hash", async () => {
    const repo = new InMemorySessionRepository();
    const session = await createSession(repo);

    const found = await repo.findByTokenHash(hashSessionToken("a-completely-different-token"));
    expect(found).toBeNull();
    void session;
  });
});
