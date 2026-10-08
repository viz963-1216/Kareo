// Public records only. These are the reviewed Provider import dataset and a read-only
// export of the current PUBLISHED knowledge, not contract mock fixtures or live DB access.
import serviceDistricts from '../../../../contracts/reference/service-districts.json';
import infoRows from '../../../../data/providers/staging/provider-public-info.json';
import providerRows from '../../../../data/providers/staging/providers.json';
import serviceRows from '../../../../data/providers/staging/provider-services.json';
import areaRows from '../../../../data/providers/staging/provider-service-areas.json';
import contractRows from '../../../../data/providers/staging/provider-contract-regions.json';
import knowledge from '../../../../data/public-preview/published-knowledge.json';
import { RuleBasedAssessmentEngine } from '../../../api/src/assessment/ruleBasedAssessmentEngine';
import { taipeiDate, type KnowledgeSnapshot, type KnowledgeSnapshotRecord } from '../../../api/src/assessment/knowledgeSnapshot';
import { lookupProviders } from '../../../api/src/services/providerLookupService';
import type { ProviderRepository, RecommendationCandidateQuery } from '../../../api/src/repositories/types';
import type { Provider, CreateAssessmentInput } from '../../../api/src/types';
import type { AssessmentRequest, AssessmentResponse, KnowledgeRecordsRequest, KnowledgeRecordsResponse,
  ProviderDetail, RecommendationRequest, RecommendationResponse, ResourceLookupRequest, ResourceLookupResponse } from '../types/api';

type PublicProvider = Provider & { phone: string; googleMapsUrl: string };
if (providerRows.some(p => !p.phone || !p.googleMapsUrl)) throw new Error('公開機構資料不完整。');
const infoById = new Map(infoRows.map(row => [row.providerId, row.publicInfo]));
const providers = providerRows.map(p => ({ ...p, ...(infoById.has(p.id) ? { publicInfo: infoById.get(p.id) } : {}) })) as PublicProvider[];
const publicKnowledge = knowledge as unknown as { version: string; publishedAt: string; records: Array<KnowledgeSnapshotRecord & { lastVerifiedAt: string; source: { title: string; publisher: string; url: string | null } }> };
const snapshot = knowledge as unknown as KnowledgeSnapshot;
const allowedCities = ['臺北市', '新北市'];
const publicCandidates = providers.filter(p => p.status === 'ACTIVE' && (allowedCities.includes(p.city)
  || areaRows.some(a => a.providerId === p.id && a.active && allowedCities.includes(a.city)))).map(provider => ({
  provider: { ...provider, resourceCategory: provider.resourceCategory ?? 'SERVICE_PROVIDER' },
  services: serviceRows.filter(s => s.providerId === provider.id && s.active).map(s => s.serviceType) as ProviderDetail['services'],
  serviceAreas: areaRows.filter(a => a.providerId === provider.id && a.active).map(a => ({ city: a.city, district: a.district })),
  contractRegions: contractRows.filter(c => c.providerId === provider.id && c.active).map(c => ({ city: c.city, serviceType: c.serviceType })) as ProviderDetail['contractRegions'],
}));

function detail(id: string): ProviderDetail | null {
  const row = publicCandidates.find(c => c.provider.id === id);
  if (!row) return null;
  const { id: providerId, name, type, address, city, district, phone, website, googleMapsUrl, verified, resourceCategory } = row.provider;
  return structuredClone({ id: providerId, name, type, address, city, district, phone, website, googleMapsUrl, verified,
    resourceCategory, ...(row.provider.publicInfo ? { publicInfo: row.provider.publicInfo } : {}), services: row.services, serviceAreas: row.serviceAreas,
    serviceAreaStatus: row.serviceAreas.length ? 'VERIFIED' : 'UNCONFIRMED', contractRegions: row.contractRegions }) as ProviderDetail;
}
function eligible(query: RecommendationCandidateQuery): PublicProvider[] {
  return publicCandidates.filter(c => c.provider.resourceCategory === 'SERVICE_PROVIDER' && c.services.includes(query.serviceType)
    && c.serviceAreas.some(a => a.city === query.city && (!query.district || a.district === query.district))).map(c => c.provider);
}
const repo: ProviderRepository = {
  async findDetailById(id) { return detail(id); },
  async findActiveProvidersForLookup() { return structuredClone(publicCandidates); },
  async findEligibleForRecommendation(query) { return eligible(query); },
  async importDatasetAtomically() { throw new Error('Public preview is read-only'); },
};
const engine = new RuleBasedAssessmentEngine();
const assessments = new Map<string, { request: AssessmentRequest; careNeeds: string[] }>();
let sessionId: string | null = null;
const label = { HOME_CARE: '居家照顧', HOME_MEDICAL_NURSING: '居家醫療與護理', ASSISTIVE_DEVICE: '輔具' };

// Browser WebCrypto implements the same SHA-256 seed used by B-005. No location/health
// answer is sent over the network. No coordinates, inferred districts or random filler.
export async function previewRotationHash(parts: Array<string | null>): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(parts.filter(p => p !== null).join('|')));
  return Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
}
export const publicProviderApi = {
  reset() { assessments.clear(); sessionId = null; },
  async createSession() {
    assessments.clear(); sessionId = `LOCAL-${crypto.randomUUID()}`;
    return { sessionId, createdAt: new Date().toISOString() };
  },
  async acceptConsent(id: string) {
    if (!sessionId || id !== sessionId) throw new Error('請重新開始本機需求分析。');
    return { consentId: `LOCAL-NOTICE-${crypto.randomUUID()}`, acceptedAt: new Date().toISOString() };
  },
  async submitAssessment(request: AssessmentRequest): Promise<AssessmentResponse> {
    if (!sessionId || request.sessionId !== sessionId) throw new Error('請重新開始本機需求分析。');
    if (request.location.precision !== 'NONE' && !allowedCities.includes(request.location.city)) throw new Error('目前僅支援臺北市與新北市。');
    if (!['NONE', 'CITY', 'DISTRICT'].includes(request.location.precision)) throw new Error('此版本不使用精確定位。');
    if (request.location.precision === 'DISTRICT' && !serviceDistricts.cities.find(c => c.city === request.location.city)?.districts.includes(request.location.district)) throw new Error('行政區不屬於所選縣市。');
    // Free text/GPS are disabled for this public, unsaved preview. Formal engine is reused,
    // including explicit NO precedence, UNKNOWN rules, priority and jurisdiction-specific summaries.
    const input: CreateAssessmentInput = { ...request, freeText: '', disabilityCertificate: request.disabilityCertificate ?? 'UNKNOWN', incomeCategory: request.incomeCategory ?? 'UNKNOWN' };
    const result = await engine.generateCareNeedProfile(input, { knowledge: snapshot, today: taipeiDate(new Date()) });
    const assessmentId = `LOCAL-ASSESSMENT-${crypto.randomUUID()}`;
    assessments.set(assessmentId, { request: structuredClone({ ...request, freeText: '' }), careNeeds: [...result.profile.careNeeds] });
    return { assessmentId, knowledgeVersion: snapshot.version, careNeedProfile: { id: `LOCAL-PROFILE-${crypto.randomUUID()}`, ...result.profile } };
  },
  async getProvider(id: string): Promise<ProviderDetail | null> { return detail(id); },
  async getProviders(request: ResourceLookupRequest): Promise<ResourceLookupResponse> {
    const query = Object.fromEntries(Object.entries(request).filter(([,v]) => v !== undefined && v !== null).map(([k,v]) => [k,String(v)]));
    return await lookupProviders(repo, query) as ResourceLookupResponse;
  },
  async getRecommendation(request: RecommendationRequest): Promise<RecommendationResponse> {
    const assessment = assessments.get(request.assessmentId);
    if (!assessment || !sessionId) throw new Error('請先完成本機需求分析。');
    if (!Object.hasOwn(label, request.serviceType)) throw new Error('不支援的服務類別。');
    if (!assessment.careNeeds.includes(request.serviceType)) throw new Error('這次需求分析未包含這項服務。');
    const loc = assessment.request.location;
    if (loc.precision === 'NONE') return { recommendationId: `LOCAL-REC-${crypto.randomUUID()}`, serviceType: request.serviceType, rankingType: 'NO_LOCATION', locationPrecision: 'NONE', providers: [], notice: '未提供位置，請補充縣市或行政區後查詢服務單位。' };
    const rankingType = loc.precision === 'CITY' ? 'CITY_ROTATION' : 'DISTRICT_ROTATION';
    const candidates = eligible({ serviceType: request.serviceType, city: loc.city, district: loc.district });
    const ranked = await Promise.all(candidates.map(async provider => ({ provider, hash: await previewRotationHash([sessionId, loc.city, rankingType === 'CITY_ROTATION' ? null : loc.district, taipeiDate(new Date()), provider.id]) })));
    ranked.sort((a,b) => a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0);
    return { recommendationId: `LOCAL-REC-${crypto.randomUUID()}`, serviceType: request.serviceType, rankingType, locationPrecision: loc.precision,
      providers: ranked.slice(0,3).map(({provider}, i) => ({ id: provider.id, name: provider.name, type: request.serviceType, address: provider.address, district: provider.district, phone: provider.phone, website: provider.website, googleMapsUrl: provider.googleMapsUrl, verified: provider.verified, rank: (i+1) as 1|2|3, distanceKm: null,
        reasons: [loc.district ? `服務範圍包含${loc.district}` : `服務範圍包含${loc.city}部分行政區`, `提供您需要的${label[request.serviceType]}服務`, ...(provider.publicInfo?.notice?.includes("評鑑不合格") ? ["官方名冊列評鑑不合格，請向 1966 確認目前服務資格。"] : [])] })),
      notice: candidates.length === 0 ? '目前未收錄已確認能服務這個地區的單位。仍可查詢所在地商家與官方資源；不以未知服務範圍補足家數。' : rankingType === 'CITY_ROTATION' ? '目前只依縣市比對已確認的部分服務行政區；請補充行政區，並非依距離排序。' : '依已確認服務範圍比對您選擇的行政區，同一天內順序固定，並非依距離排序。' };
  },
  async getKnowledgeRecords(filters: KnowledgeRecordsRequest): Promise<KnowledgeRecordsResponse> {
    const today = taipeiDate(new Date());
    const records = publicKnowledge.records.filter(r => r.effectiveFrom <= today && (!r.effectiveTo || r.effectiveTo >= today) && (!filters.jurisdiction || r.jurisdiction === filters.jurisdiction) && (!filters.category || r.category === filters.category));
    const publisher: Record<string,string> = { LAW:'全國法規資料庫', MOHW:'衛生福利部', TAIPEI_GOV:'臺北市政府', NEW_TAIPEI_GOV:'新北市政府' };
    return { knowledgeVersion: snapshot.version, publishedAt: publicKnowledge.publishedAt, page: filters.page, pageSize: filters.pageSize, totalCount: records.length,
      items: records.slice((filters.page-1)*filters.pageSize, filters.page*filters.pageSize).map(r => ({ id:r.id,title:r.title,category:r.category,jurisdiction:r.jurisdiction,summary:r.summary,effectiveFrom:r.effectiveFrom,effectiveTo:r.effectiveTo,publishedAt:publicKnowledge.publishedAt,lastVerifiedAt:r.lastVerifiedAt,source:{...r.source,publisher:publisher[r.source.publisher] ?? r.source.publisher} })) as KnowledgeRecordsResponse['items'],
      appliedFilters:{...filters,jurisdiction:filters.jurisdiction??null,category:filters.category??null}, notice:'已發布知識的公開快照；實際資格與補助仍應由 1966 或照管中心正式評估確認。' };
  },
};
