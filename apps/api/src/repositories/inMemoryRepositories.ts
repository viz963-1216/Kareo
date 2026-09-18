// 測試用 Fake Repository：實作與 Supabase Repository 相同的介面，
// 讓 Service / Function 層可在沒有真實 Supabase 連線的情況下被測試。
// 不得用於 Production。
import type { ConsentRepository, SessionRepository } from "./types.js";
import type { Consent, CreateConsentInput, Session } from "../types/index.js";
import { generateId, nowTaipeiISOString } from "../lib/response.js";

export class InMemorySessionRepository implements SessionRepository {
  readonly sessions: Session[] = [];

  async createSession(): Promise<Session> {
    const now = nowTaipeiISOString();
    const session: Session = { id: generateId("SES"), createdAt: now, updatedAt: now };
    this.sessions.push(session);
    return session;
  }
}

export class InMemoryConsentRepository implements ConsentRepository {
  readonly consents: Consent[] = [];

  async createConsent(input: CreateConsentInput): Promise<Consent> {
    const consent: Consent = {
      id: generateId("CON"),
      sessionId: input.sessionId,
      disclaimerVersion: input.disclaimerVersion,
      privacyVersion: input.privacyVersion,
      termsVersion: input.termsVersion,
      acceptedAt: nowTaipeiISOString(),
    };
    this.consents.push(consent);
    return consent;
  }
}
