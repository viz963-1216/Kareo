import type { SessionRepository } from "../repositories/types.js";
import type { Session } from "../types/index.js";

export async function createSession(repo: SessionRepository): Promise<Session> {
  return repo.createSession();
}
