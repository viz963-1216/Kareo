// Public records only. These are the reviewed Provider import dataset and a read-only
// export of the current PUBLISHED knowledge, not contract mock fixtures or live DB access.
import residenceCoordinates from '../../../../data/residence/provider-coordinates.json';
import { rankLocatedProviders } from './residenceRanking';
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
const providers = providerRows.map(p => ({ ...p,
  ...((p.lat === null || p.lng === null) && Object.hasOwn(residenceCoordinates,p.id)
    ? (() => { const point = (residenceCoordinates as Record<string,{lat:number;lng:number}>)[p.id]; return {lat:point.lat,lng:point.lng}; })() : {}), ...(infoById.has(p.id) ? { publicInfo: infoById.get(p.id) } : {}) })) as PublicProvider[];
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
    && (!query.district || (c.provider.city === query.city && c.provider.district === query.district))
    && (query.serviceType === 'ASSISTIVE_DEVICE'
      ? c.provider.city === query.city
      : c.serviceAreas.some(a => a.city === query.city && (!query.district || a.district === query.district)))).map(c => c.provider);
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
const recommendations = new Map<string, RecommendationResponse>();
const label = { HOME_CARE: '居家照顧', HOME_MEDICAL_NURSING: '居家醫療與護理', ASSISTIVE_DEVICE: '輔具' };

// Browser WebCrypto hashes a fresh random session/assessment seed. No location/health
// answer is sent over the network. No inferred districts or filler; each random session is a fresh district draw.
export async function previewRotationHash(parts: Array<string | null>): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(parts.filter(p => p !== null).join('|')));
  return Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
}
export const publicProviderApi = {
  reset() { assessments.clear(); recommendations.clear(); sessionId = null; },
  async createSession() {
    assessments.clear(); recommendations.clear(); sessionId = `LOCAL-${crypto.randomUUID()}`;
    return { sessionId, createdAt: new Date().toISOString() };
  },
  async acceptConsent(id: string) {
    if (!sessionId || id !== sessionId) throw new Error('請重新開始本機需求分析。');
    return { consentId: `LOCAL-NOTICE-${crypto.randomUUID()}`, acceptedAt: new Date().toISOString() };
  },
  async submitAssessment(request: AssessmentRequest): Promise<AssessmentResponse> {
    if (!sessionId || request.sessionId !== sessionId) throw new Error('請重新開始本機需求分析。');
    if (request.location.precision !== 'NONE' && !allowedCities.includes(request.location.city)) throw new Error('目前僅支援臺北市與新北市。');
    if (!['NONE', 'CITY', 'DISTRICT', 'EXACT'].includes(request.location.precision)) throw new Error('此版本不使用裝置 GPS 精確定位。');
    if (request.location.precision === 'EXACT' && (!Number.isFinite(request.location.lat) || !Number.isFinite(request.location.lng) || request.location.lat < 24 || request.location.lat > 26 || request.location.lng < 120 || request.location.lng > 123)) throw new Error('居住位置無效，請重新輸入。');
    if (['DISTRICT','EXACT'].includes(request.location.precision) && !serviceDistricts.cities.find(c => c.city === request.location.city)?.districts.includes(request.location.district ?? '')) throw new Error('行政區不屬於所選縣市。');
    // Free text/device GPS are disabled for this public, unsaved preview. Formal engine is reused,
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
    const key = `${request.assessmentId}|${request.serviceType}`;
    const previous = recommendations.get(key);
    if (previous) return structuredClone(previous);
    const candidates = eligible({ serviceType: request.serviceType, city: loc.city, district: loc.district });
    const storeVisit = request.serviceType === 'ASSISTIVE_DEVICE';
    const candidateLabel = storeVisit ? '輔具店面' : '居家單位（服務範圍已確認）';
    const visitNotice = storeVisit ? '此為就近到店詢問名單；到府服務、品項、租賃及補助資格需另洽商家確認。' : '';
    const located = loc.precision === 'EXACT' ? rankLocatedProviders({lat:loc.lat,lng:loc.lng},candidates) : [];
    const rankingType = located.length ? 'DISTANCE' : loc.precision === 'CITY' ? 'CITY_ROTATION' : 'DISTRICT_ROTATION';
    const ranked = await Promise.all(candidates.map(async provider => ({ provider, hash: await previewRotationHash([sessionId, request.assessmentId, loc.city, loc.district, provider.id]) })));
    ranked.sort((a,b) => a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : a.provider.id.localeCompare(b.provider.id));
    const selected = located.length ? located.slice(0,3) : ranked.slice(0,3).map(row => ({...row,distance:null}));
    const response: RecommendationResponse = { recommendationId: `LOCAL-REC-${crypto.randomUUID()}`, serviceType: request.serviceType, rankingType, locationPrecision: loc.precision,
      providers: selected.map(({provider, distance}, i) => ({ id: provider.id, name: provider.name, type: request.serviceType, address: provider.address, district: provider.district, phone: provider.phone, website: provider.website, googleMapsUrl: provider.googleMapsUrl, verified: provider.verified, rank: (i+1) as 1|2|3, distanceKm: distance === null ? null : Math.round(distance*10)/10,
        reasons: [...(storeVisit ? ['依輔具店面所在地提供資訊；到府服務需另洽商家。'] : [loc.district ? `服務範圍包含${loc.district}` : `服務範圍包含${loc.city}部分行政區`, `提供您需要的${label[request.serviceType]}服務`]), ...(provider.publicInfo?.notice?.includes("評鑑不合格") ? ["官方名冊列評鑑不合格，請向 1966 確認目前服務資格。"] : [])] })),
      notice: (candidates.length === 0 ? `目前未收錄所在地與您相同行政區的${candidateLabel}。可查詢同區公開資料；不補入其他行政區的單位。`
        : rankingType === 'DISTANCE' ? `只列出與居住地同縣市、同行政區的${storeVisit ? '輔具店面' : '單位'}，依居住地至機構的直線距離排序，非行車路程或到府時間。已定位 ${located.length}／${candidates.length} 家同區候選；${located.length < candidates.length ? '名次僅涵蓋已定位單位，其餘可由公開資源查詢查看。' : '依全部符合範圍且已定位的候選排序。'}門牌位置來源：臺北市／新北市政府民政局公開資料。`
        : rankingType === 'CITY_ROTATION' ? storeVisit ? '目前依店面所在縣市提供名單；請補充行政區，並非依距離排序。' : '目前只依縣市比對已確認的部分服務行政區；請補充行政區，並非依距離排序。'
        : `${loc.precision === 'EXACT' ? '同區候選尚無可確認座標，本次改用行政區隨機名單。' : ''}從所在地與您同縣市、同行政區的${candidateLabel}隨機挑選，同次評估保留首次名單，並非依距離排序。`) + visitNotice };
    recommendations.set(key,response);
    return structuredClone(response);
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
