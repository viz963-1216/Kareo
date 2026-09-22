// 測試用 Fake Repository：實作與 Supabase Repository 相同的介面，
// 讓 Service / Function 層可在沒有真實 Supabase 連線的情況下被測試。
// 不得用於 Production。
import type {
  AssessmentRepository,
  ConsentRepository,
  CreateAssessmentRecord,
  ProviderRepository,
  SessionRepository,
} from "./types.js";
import type {
  Assessment,
  CareNeedProfile,
  Consent,
  CreateConsentInput,
  Provider,
  ProviderDetailResponse,
  ProviderService,
  ProviderServiceArea,
  Session,
} from "../types/index.js";
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

export class InMemoryProviderRepository implements ProviderRepository {
  readonly providers: Provider[] = [];
  readonly services: ProviderService[] = [];
  readonly serviceAreas: ProviderServiceArea[] = [];

  async findDetailById(providerId: string): Promise<ProviderDetailResponse | null> {
    const provider = this.providers.find((p) => p.id === providerId);
    if (!provider || provider.status !== "ACTIVE") return null;

    return {
      id: provider.id,
      name: provider.name,
      type: provider.type,
      address: provider.address,
      city: provider.city,
      district: provider.district,
      phone: provider.phone,
      website: provider.website,
      googleMapsUrl: provider.googleMapsUrl,
      verified: provider.verified,
      services: this.services
        .filter((s) => s.providerId === providerId && s.active)
        .map((s) => s.serviceType),
      serviceAreas: this.serviceAreas
        .filter((a) => a.providerId === providerId && a.active)
        .map((a) => ({ city: a.city, district: a.district })),
    };
  }

  async upsertProviders(providers: Provider[]): Promise<void> {
    for (const p of providers) {
      const idx = this.providers.findIndex((x) => x.id === p.id);
      if (idx >= 0) this.providers[idx] = p;
      else this.providers.push(p);
    }
  }

  async upsertProviderServices(services: ProviderService[]): Promise<void> {
    for (const s of services) {
      const idx = this.services.findIndex((x) => x.id === s.id);
      if (idx >= 0) this.services[idx] = s;
      else this.services.push(s);
    }
  }

  async upsertProviderServiceAreas(areas: ProviderServiceArea[]): Promise<void> {
    for (const a of areas) {
      const idx = this.serviceAreas.findIndex((x) => x.id === a.id);
      if (idx >= 0) this.serviceAreas[idx] = a;
      else this.serviceAreas.push(a);
    }
  }
}
