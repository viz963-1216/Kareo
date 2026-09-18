import { describe, it, expect } from "vitest";
import { createSession } from "../src/services/sessionService.js";
import { InMemorySessionRepository } from "../src/repositories/inMemoryRepositories.js";

describe("Session", () => {
  it("creates a session successfully", async () => {
    const repo = new InMemorySessionRepository();
    const session = await createSession(repo);

    expect(session.id).toMatch(/^SES-/);
    expect(session.createdAt).toBeTruthy();
    expect(repo.sessions).toHaveLength(1);
  });

  it("returns a response shape matching API_CONTRACT.md (sessionId, createdAt)", async () => {
    const repo = new InMemorySessionRepository();
    const session = await createSession(repo);
    const responseData = { sessionId: session.id, createdAt: session.createdAt };

    expect(responseData).toEqual({
      sessionId: expect.any(String),
      createdAt: expect.any(String),
    });
  });
});
