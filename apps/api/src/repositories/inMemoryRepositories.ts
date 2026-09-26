// 測試用 Fake Repository：實作與 Supabase Repository 相同的介面，
// 讓 Service / Function 層可在沒有真實 Supabase 連線的情況下被測試。
// 不得用於 Production。
import type {
  AssessmentRepository,
  ConsentRepository,
  CreateAssessmentRecord,
  ProviderDatasetWrite,
  ProviderDatasetWriteCounts,
  ProviderRepository,
  SessionRepository,
} from "./types.js";
import { AppError } from "../errors/AppError.js";
import type {
  Assessment,
  CareNeedProfile,
  Consent,
  CreatedSession,
  CreateConsentInput,
  Provider,
  ProviderDetailResponse,
  ProviderService,
  ProviderServiceArea,
  Session,
} from "../types/index.js";
import { generateId, nowTaipeiISOString } from "../lib/response.js";
import { computeExpiresAt, generateSessionToken, hashSessionToken } from "../services/sessionSecurityService.js";

export class InMemorySessionRepository implements SessionRepository {
  readonly sessions: Session[] = [];
  // 測試用：token 只在建立當下回傳，記憶體版額外保留雜湊對照表供 findByTokenHash 使用。
  private readonly tokenHashBySessionId = new Map<string, string>();

  async createSession(): Promise<CreatedSession> {
    const now = nowTaipeiISOString();
    const nowDate = new Date();
    const sessionToken = generateSessionToken();
    const session: Session = {
      id: generateId("SES"),
      createdAt: now,
      updatedAt: now,
      lastSeenAt: null,
      expiresAt: computeExpiresAt(nowDate, nowDate).toISOString(),
      status: "ACTIVE",
      deletedAt: null,
    };
    this.sessions.push(session);
    this.tokenHashBySessionId.set(session.id, hashSessionToken(sessionToken));
    return { ...session, sessionToken };
  }

  async findByTokenHash(tokenHash: string): Promise<Session | null> {
    for (const session of this.sessions) {
      if (this.tokenHashBySessionId.get(session.id) === tokenHash) return { ...session };
    }
    return null;
  }

  async touchSession(sessionId: string, updates: { lastSeenAt: string; expiresAt: string }): Promise<void> {
    const session = this.sessions.find((s) => s.id === sessionId);
    if (!session) throw new AppError("INTERNAL_ERROR", "找不到要更新的 Session。");
    session.lastSeenAt = updates.lastSeenAt;
    session.expiresAt = updates.expiresAt;
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
      withdrawnAt: null,
    };
    this.consents.push(consent);
    return consent;
  }

  async findLatestBySession(sessionId: string): Promise<Consent | null> {
    const matches = this.consents
      .filter((c) => c.sessionId === sessionId && c.withdrawnAt === null)
      .sort((a, b) => (a.acceptedAt < b.acceptedAt ? 1 : -1));
    return matches[0] ?? null;
  }
}

export class InMemoryAssessmentRepository implements AssessmentRepository {
  readonly assessments: Assessment[] = [];
  readonly careNeedProfiles: CareNeedProfile[] = [];
  // 測試用：模擬交易失敗（兩張表都不寫入，同 create_assessment_with_profile 的回滾行為）。
  failNextCreate = false;

  async createAssessment(
    input: CreateAssessmentRecord
  ): Promise<{ assessment: Assessment; careNeedProfile: CareNeedProfile }> {
    if (this.failNextCreate) {
      this.failNextCreate = false;
      throw new AppError("INTERNAL_ERROR", "無法建立 Assessment，請稍後再試。");
    }
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

  // 測試用：記錄呼叫次數，並可指定讓某一張表的寫入失敗。
  atomicWriteCalls = 0;
  failOnTable: "providers" | "services" | "serviceAreas" | null = null;

  // 模擬單一交易：先在副本上寫入三張表，全部成功才替換正式資料；任一步失敗則正式資料完全不變。
  async importDatasetAtomically(dataset: ProviderDatasetWrite): Promise<ProviderDatasetWriteCounts> {
    this.atomicWriteCalls += 1;

    const providers = [...this.providers];
    const services = [...this.services];
    const serviceAreas = [...this.serviceAreas];

    upsertById(providers, dataset.providers);
    if (this.failOnTable === "providers") throw new AppError("INTERNAL_ERROR", "模擬寫入失敗：providers");
    upsertById(services, dataset.services);
    if (this.failOnTable === "services") throw new AppError("INTERNAL_ERROR", "模擬寫入失敗：provider_services");
    upsertById(serviceAreas, dataset.serviceAreas);
    if (this.failOnTable === "serviceAreas")
      throw new AppError("INTERNAL_ERROR", "模擬寫入失敗：provider_service_areas");

    this.providers.splice(0, this.providers.length, ...providers);
    this.services.splice(0, this.services.length, ...services);
    this.serviceAreas.splice(0, this.serviceAreas.length, ...serviceAreas);

    return {
      providers: dataset.providers.length,
      providerServices: dataset.services.length,
      providerServiceAreas: dataset.serviceAreas.length,
    };
  }
}

function upsertById<T extends { id: string }>(target: T[], rows: T[]): void {
  for (const row of rows) {
    const idx = target.findIndex((x) => x.id === row.id);
    if (idx >= 0) target[idx] = row;
    else target.push(row);
  }
}
