// 測試用 Fake Repository：實作與 Supabase Repository 相同的介面，
// 讓 Service / Function 層可在沒有真實 Supabase 連線的情況下被測試。
// 不得用於 Production。
import type {
  AssessmentRepository,
  ConsentRepository,
  CreateAssessmentRecord,
  SessionRepository,
} from "./types.js";
import type { Assessment, CareNeedProfile, Consent, CreateConsentInput, Session } from "../types/index.js";
import { generateId, nowTaipeiISOString } from "../lib/response.js";

export class InMemorySessionRepository implements SessionRepository {
  readonly sessions: Session[] = [];

  async createSession(): Promise<Session> {
    const now = nowTaipeiISOString();
    const session: Session = { id: generateId("SES"), createdAt: now, updatedAt: now };
    this.sessions.push(session);
    return session;
  }

  async exists(sessionId: string): Promise<boolean> {
    return this.sessions.some((s) => s.id === sessionId);
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

  async findLatestBySession(sessionId: string): Promise<Consent | null> {
    const matches = this.consents
      .filter((c) => c.sessionId === sessionId)
      .sort((a, b) => (a.acceptedAt < b.acceptedAt ? 1 : -1));
    return matches[0] ?? null;
  }
}

export class InMemoryAssessmentRepository implements AssessmentRepository {
  readonly assessments: Assessment[] = [];
  readonly careNeedProfiles: CareNeedProfile[] = [];

  async createAssessment(
    input: CreateAssessmentRecord
  ): Promise<{ assessment: Assessment; careNeedProfile: CareNeedProfile }> {
    const now = nowTaipeiISOString();
    const assessment: Assessment = { ...input.assessment, id: generateId("ASM"), createdAt: now, updatedAt: now };
    const careNeedProfile: CareNeedProfile = {
      ...input.careNeedProfile,
      id: generateId("CNP"),
      assessmentId: assessment.id,
      createdAt: now,
    };
    this.assessments.push(assessment);
    this.careNeedProfiles.push(careNeedProfile);
    return { assessment, careNeedProfile };
  }
}
