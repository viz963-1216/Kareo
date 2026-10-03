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
  RecommendationCandidateQuery,
  RecommendationRepository,
  SessionRepository,
} from "./types.js";
import type { InMemoryLeadRepository } from "./inMemoryLeadRepository.js";
import { AppError } from "../errors/AppError.js";
import type {
  Assessment,
  CareNeedProfile,
  Consent,
  CreatedSession,
  CreateConsentInput,
  DeletionRun,
  Provider,
  ProviderDetailResponse,
  ProviderService,
  ProviderServiceArea,
  RecommendationItem,
  RecommendationRun,
  Session,
} from "../types/index.js";
import { generateId, nowTaipeiISOString } from "../lib/response.js";
import { computeExpiresAt, generateSessionToken, hashSessionToken } from "../services/sessionSecurityService.js";

const OPEN_LEAD_STATUSES = ["NEW", "CONTACTED", "ACCEPTED"];

// TASK-B-011b：同意撤回／使用者刪除需要立即取消該 session 尚未終態的 Lead 並清空聯絡欄位
// （PRIVACY_AND_RETENTION §3.3、§6.1）。Supabase 版以單一 RPC 在一個交易內完成（migration 0019
// request_session_deletion／withdraw_consent）；記憶體版比照 InMemoryAdminKnowledgeRepository
// 持有 InMemoryKnowledgeRepository 參照的既有模式，用建構子注入的 leadRepo 模擬同樣的級聯效果
// （選填：不傳入時沿用舊行為，不影響既有不涉及 Lead 的測試）。
function cancelOpenLeadsForSession(leadRepo: InMemoryLeadRepository, sessionId: string, reasonCode: string, now: string): number {
  let cancelled = 0;
  for (const lead of leadRepo.leads) {
    if (lead.sessionId !== sessionId) continue;
    if (!OPEN_LEAD_STATUSES.includes(lead.status)) {
      // 終態 Lead 不改狀態、不寫事件，但聯絡欄位同樣立即清空（同 migration 的 SQL 行為）。
      if (lead.contactName !== null || lead.contactPhone !== null) {
        lead.contactName = null;
        lead.contactPhone = null;
        lead.updatedAt = now;
      }
      continue;
    }
    const fromStatus = lead.status;
    lead.status = "CANCELLED";
    lead.statusReason = reasonCode;
    lead.contactName = null;
    lead.contactPhone = null;
    lead.closedAt = now;
    lead.updatedAt = now;
    leadRepo.statusEvents.push({
      id: generateId("LSE"),
      leadId: lead.id,
      fromStatus,
      toStatus: "CANCELLED",
      reasonCode,
      note: null,
      operatorId: null,
      createdAt: now,
    });
    cancelled += 1;
  }
  return cancelled;
}

export class InMemorySessionRepository implements SessionRepository {
  readonly sessions: Session[] = [];
  readonly deletionRuns: DeletionRun[] = [];
  // 測試用：token 只在建立當下回傳，記憶體版額外保留雜湊對照表供 findByTokenHash 使用。
  private readonly tokenHashBySessionId = new Map<string, string>();

  constructor(
    private readonly leadRepo?: InMemoryLeadRepository,
    private readonly consentRepo?: InMemoryConsentRepository
  ) {}

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

  async requestDeletion(sessionId: string, now: string): Promise<{ updated: boolean; leadsCancelled: number }> {
    const session = this.sessions.find((s) => s.id === sessionId && s.status === "ACTIVE");
    if (!session) return { updated: false, leadsCancelled: 0 };
    session.status = "DELETION_REQUESTED";
    session.updatedAt = now;
    const leadsCancelled = this.leadRepo ? cancelOpenLeadsForSession(this.leadRepo, sessionId, "USER_DELETED", now) : 0;
    return { updated: true, leadsCancelled };
  }

  async runDeletionCleanup(
    input: { now: string; dryRun: boolean }
  ): Promise<{ sessionsDeleted: number; leadsContactCleared: number; leadsDeleted: number; consentsDeleted: number }> {
    const nowMs = new Date(input.now).getTime();
    const day = 24 * 60 * 60 * 1000;

    // 1. session：已請求刪除／撤回者立即入選（D-05a：7 天是最遲完成期限，不是等待期）+ 90 天閒置（ACTIVE）聯集。
    const eligibleSessions = this.sessions.filter(
      (s) =>
        s.status === "DELETION_REQUESTED" ||
        (s.status === "ACTIVE" && nowMs - new Date(s.lastSeenAt ?? s.createdAt).getTime() >= 90 * day)
    );

    // 2. Lead 聯絡欄位清空：180 天（CLOSED/CANCELLED 且仍有聯絡欄位）。
    const leads = this.leadRepo?.leads ?? [];
    const eligibleContactClear = leads.filter(
      (l) =>
        (l.status === "CLOSED" || l.status === "CANCELLED") &&
        l.closedAt !== null &&
        nowMs - new Date(l.closedAt).getTime() >= 180 * day &&
        (l.contactName !== null || l.contactPhone !== null)
    );

    // 3. Lead 整筆刪除：1 年（CLOSED/CANCELLED）。
    const eligibleLeadDelete = leads.filter(
      (l) => (l.status === "CLOSED" || l.status === "CANCELLED") && l.closedAt !== null && nowMs - new Date(l.closedAt).getTime() >= 365 * day
    );

    // 4. Consent 整筆刪除：3 年。
    const consents = this.consentRepo?.consents ?? [];
    const eligibleConsentDelete = consents.filter((c) => nowMs - new Date(c.acceptedAt).getTime() >= 3 * 365 * day);

    if (input.dryRun) {
      return {
        sessionsDeleted: eligibleSessions.length,
        leadsContactCleared: eligibleContactClear.length,
        leadsDeleted: eligibleLeadDelete.length,
        consentsDeleted: eligibleConsentDelete.length,
      };
    }

    for (const session of eligibleSessions) {
      session.status = "DELETED";
      session.deletedAt = input.now;
      session.updatedAt = input.now;
      // 注意：Assessment／RecommendationRun 等資料的實際刪除（且排除曾建立 Lead 的 Assessment）
      // 由各自的 Repository 負責，記憶體版本的清理 CLI 測試只驗證 Session 狀態轉移本身，不在這裡
      // 跨 Repository 操作（同 Supabase 版把這些都放進同一個 RPC 不同，記憶體版的職責邊界維持
      // 各 Repository 自治，詳見 PR Known Issues）。
    }

    for (const lead of eligibleContactClear) {
      lead.contactName = null;
      lead.contactPhone = null;
      lead.updatedAt = input.now;
    }

    const leadDeleteIds = new Set(eligibleLeadDelete.map((l) => l.id));
    if (this.leadRepo && leadDeleteIds.size > 0) {
      // 先刪子表（lead_idempotency_records／lead_access_events／lead_status_events），再刪 leads 本體，
      // 對齊 migration 0019 run_deletion_cleanup 的刪除順序（避免外鍵參照殘留）。
      this.leadRepo.idempotencyRecords.splice(
        0,
        this.leadRepo.idempotencyRecords.length,
        ...this.leadRepo.idempotencyRecords.filter((r) => !leadDeleteIds.has(r.leadId))
      );
      this.leadRepo.accessEvents.splice(
        0,
        this.leadRepo.accessEvents.length,
        ...this.leadRepo.accessEvents.filter((e) => !leadDeleteIds.has(e.leadId))
      );
      this.leadRepo.statusEvents.splice(
        0,
        this.leadRepo.statusEvents.length,
        ...this.leadRepo.statusEvents.filter((e) => !leadDeleteIds.has(e.leadId))
      );
      this.leadRepo.leads.splice(0, this.leadRepo.leads.length, ...this.leadRepo.leads.filter((l) => !leadDeleteIds.has(l.id)));
    }

    const consentDeleteIds = new Set(eligibleConsentDelete.map((c) => c.id));
    if (this.consentRepo && consentDeleteIds.size > 0) {
      this.consentRepo.consents.splice(
        0,
        this.consentRepo.consents.length,
        ...this.consentRepo.consents.filter((c) => !consentDeleteIds.has(c.id))
      );
    }

    return {
      sessionsDeleted: eligibleSessions.length,
      leadsContactCleared: eligibleContactClear.length,
      leadsDeleted: eligibleLeadDelete.length,
      consentsDeleted: eligibleConsentDelete.length,
    };
  }

  async insertDeletionRun(run: DeletionRun): Promise<void> {
    this.deletionRuns.push(run);
  }
}

export class InMemoryConsentRepository implements ConsentRepository {
  readonly consents: Consent[] = [];

  constructor(
    private readonly sessionRepo?: InMemorySessionRepository,
    private readonly leadRepo?: InMemoryLeadRepository
  ) {}

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

  async withdraw(sessionId: string, now: string): Promise<{ updated: boolean; leadsCancelled: number }> {
    const consent = await this.findLatestBySession(sessionId);
    if (!consent) return { updated: false, leadsCancelled: 0 };
    const stored = this.consents.find((c) => c.id === consent.id)!;
    stored.withdrawnAt = now;

    const session = this.sessionRepo?.sessions.find((s) => s.id === sessionId && s.status === "ACTIVE");
    if (session) {
      session.status = "DELETION_REQUESTED";
      session.updatedAt = now;
    }
    const leadsCancelled = this.leadRepo ? cancelOpenLeadsForSession(this.leadRepo, sessionId, "CONSENT_WITHDRAWN", now) : 0;
    return { updated: true, leadsCancelled };
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

  async findById(id: string): Promise<Assessment | null> {
    const found = this.assessments.find((a) => a.id === id);
    return found ? { ...found } : null;
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

  async findEligibleForRecommendation(query: RecommendationCandidateQuery): Promise<Provider[]> {
    const eligibleProviderIds = new Set(
      this.services.filter((s) => s.serviceType === query.serviceType && s.active).map((s) => s.providerId)
    );
    const areaMatchProviderIds = new Set(
      this.serviceAreas
        .filter((a) => a.active && a.city === query.city && (query.district === null || a.district === query.district))
        .map((a) => a.providerId)
    );
    return this.providers
      .filter(
        (p) =>
          p.status === "ACTIVE" && eligibleProviderIds.has(p.id) && areaMatchProviderIds.has(p.id)
      )
      .map((p) => ({ ...p }));
  }
}

export class InMemoryRecommendationRepository implements RecommendationRepository {
  readonly runs: RecommendationRun[] = [];
  readonly items: RecommendationItem[] = [];
  // 模擬單一交易：insertRun 只暫存，insertItems 才是真正的（唯一）commit 點；
  // insertItems 若拋出例外（含測試以 monkey-patch 整個方法模擬失敗），暫存的 run 不會進 this.runs。
  private pendingRun: RecommendationRun | null = null;

  async insertRun(run: RecommendationRun): Promise<void> {
    this.pendingRun = { ...run };
  }

  async insertItems(items: RecommendationItem[]): Promise<void> {
    if (!this.pendingRun) throw new AppError("INTERNAL_ERROR", "insertItems 呼叫前必須先呼叫 insertRun。");
    const run = this.pendingRun;
    this.pendingRun = null;
    this.runs.push(run);
    this.items.push(...items.map((i) => ({ ...i })));
  }

  async findRunWithItems(id: string): Promise<{ run: RecommendationRun; items: RecommendationItem[] } | null> {
    const run = this.runs.find((r) => r.id === id);
    if (!run) return null;
    return { run: { ...run }, items: this.items.filter((i) => i.recommendationRunId === id).map((i) => ({ ...i })) };
  }
}

// TASK-B-011b：ARCHITECTURE §20.4 持久化限流的記憶體版（供測試）。邏輯對齊 migration 0019
// check_rate_limit：視窗過期則重置為新視窗的第 1 次，否則遞增；呼叫端須自行序列化同一 key 的
// 併發呼叫（記憶體版本身單執行緒，不需要額外鎖）。
export class InMemoryRateLimitRepository {
  private readonly counters = new Map<string, { windowStart: number; count: number }>();

  async checkAndIncrement(input: { key: string; windowSeconds: number; limit: number; now: string }) {
    const nowMs = new Date(input.now).getTime();
    const existing = this.counters.get(input.key);
    let windowStart: number;
    let count: number;
    if (!existing || existing.windowStart + input.windowSeconds * 1000 <= nowMs) {
      windowStart = nowMs;
      count = 1;
    } else {
      windowStart = existing.windowStart;
      count = existing.count + 1;
    }
    this.counters.set(input.key, { windowStart, count });

    if (count > input.limit) {
      const expiresAt = windowStart + input.windowSeconds * 1000;
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((expiresAt - nowMs) / 1000)) };
    }
    return { allowed: true, retryAfterSeconds: null };
  }
}

function upsertById<T extends { id: string }>(target: T[], rows: T[]): void {
  for (const row of rows) {
    const idx = target.findIndex((x) => x.id === row.id);
    if (idx >= 0) target[idx] = row;
    else target.push(row);
  }
}
