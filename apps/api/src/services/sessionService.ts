import type { SessionRepository } from "../repositories/types.js";
import type { CreatedSession } from "../types/index.js";

export async function createSession(repo: SessionRepository): Promise<CreatedSession> {
  return repo.createSession();
}
