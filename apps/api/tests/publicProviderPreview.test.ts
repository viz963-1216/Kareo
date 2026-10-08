import providerRows from '../../../data/providers/staging/providers.json';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { publicProviderApi as api, previewRotationHash } from '../../web/src/publicData/providerPreview';
import { stableRotationHash } from '../src/services/recommendationService';
import type { AssessmentRequest } from '../../web/src/types/api';

async function assess(overrides: Partial<AssessmentRequest> = {}) {
  const session = await api.createSession();
  const request: AssessmentRequest = { sessionId: session.sessionId, ageRange: '75_84',
    location: { precision:'DISTRICT',city:'新北市',district:'三重區',lat:null,lng:null },
    livingSituation:'WITH_FAMILY',caregiverSituation:'FAMILY_LIMITED',mobilityLevel:'NEEDS_ASSISTANCE',dailyLivingLevel:'PARTIAL_ASSISTANCE',
    needs:{homeCare:'YES',medicalNursing:'NO',assistiveDevice:'YES',transportation:'NO'}, freeText:'',...overrides };
  return api.submitAssessment(request);
}
beforeEach(() => { api.reset(); vi.setSystemTime(new Date('2026-10-08T02:00:00Z')); });
describe('public real records and actual rule engine; no contract mock fixtures', () => {
  it('explicit NO wins over functional impairment and changes the result', async () => {
    const yes = await assess();
    expect(yes.careNeedProfile.careNeeds).toEqual(['HOME_CARE','ASSISTIVE_DEVICE']);
    expect(yes.knowledgeVersion).toBe('KB-2026-09-24-001');
    const no = await assess({mobilityLevel:'BEDRIDDEN',needs:{homeCare:'NO',medicalNursing:'NO',assistiveDevice:'NO',transportation:'NO'}});
    expect(no.careNeedProfile.careNeeds).toEqual([]);
    expect(no.careNeedProfile.summary).not.toBe(yes.careNeedProfile.summary);
    await expect(api.getRecommendation({assessmentId:no.assessmentId,serviceType:'HOME_CARE'})).rejects.toThrow('未包含');
  });
  it('district changes select the actual service area, never a fixed scenario', async () => {
    let a = await assess();
    let r = await api.getRecommendation({assessmentId:a.assessmentId,serviceType:'HOME_CARE'});
    expect(r.providers.map(p=>p.id).sort()).toEqual(['NTPC-HC-003','NTPC-HC-004','NTPC-HC-005']);
    const again = await api.getRecommendation({assessmentId:a.assessmentId,serviceType:'HOME_CARE'});
    expect(again.providers).toEqual(r.providers);
    a = await assess({location:{precision:'DISTRICT',city:'新北市',district:'土城區',lat:null,lng:null}});
    r = await api.getRecommendation({assessmentId:a.assessmentId,serviceType:'HOME_CARE'});
    expect(r.providers).toHaveLength(1);
    expect(r.providers[0].id).toBe('NTPC-HC-005');
    a = await assess({location:{precision:'DISTRICT',city:'新北市',district:'坪林區',lat:null,lng:null}});
    r = await api.getRecommendation({assessmentId:a.assessmentId,serviceType:'HOME_CARE'});
    expect(r.providers).toEqual([]);
  });
  it('only an explicitly sourced vendor is eligible for device delivery; unknown areas stay queryable', async () => {
    const a = await assess();
    const r = await api.getRecommendation({assessmentId:a.assessmentId,serviceType:'ASSISTIVE_DEVICE'});
    expect(r.providers.map(p=>p.id)).toEqual(['NTPC-AD-010']);
    expect(r.providers[0].name).toBe('亞德醫材生活館');
    expect(r.rankingType).toBe('DISTRICT_ROTATION');
    expect(r.providers[0].distanceKm).toBeNull();
    const shops = await api.getProviders({serviceType:'ASSISTIVE_DEVICE',page:1,pageSize:20});
    expect(shops.totalCount).toBe(providerRows.filter(p=>p.type==='ASSISTIVE_DEVICE').length);
    expect(shops.items.filter(p=>p.id!=='NTPC-AD-010').every(p=>p.serviceAreaStatus==='UNCONFIRMED')).toBe(true);
    expect((await api.getProvider('NTPC-AD-010'))?.contractRegions).toEqual([]);
  });
  it('all real resources are listed and centres never enter recommendation', async () => {
    const resources = await api.getProviders({page:1,pageSize:50});
    expect(resources.totalCount).toBe(providerRows.length);
    expect(resources.items.some(p=>/MOCK|示範機構|測試單位/.test(p.id+' '+p.name))).toBe(false);
    const centers = await api.getProviders({resourceCategory:'ASSISTIVE_DEVICE_CENTER',page:1,pageSize:20});
    expect(centers.totalCount).toBe(providerRows.filter(p=>p.resourceCategory==='ASSISTIVE_DEVICE_CENTER').length);
    expect(centers.items.every(p=>p.services.length===0)).toBe(true);
    const detail = await api.getProvider('NTPC-HC-003');
    expect(detail?.name).toContain('長照');
    expect(detail?.googleMapsUrl).toMatch(/^https:\/\/www.google.com\/maps\//);
    expect(await api.getProvider('PROV-MOCK-001')).toBeNull();
  });
  it('published knowledge filters do not leak another jurisdiction', async () => {
    const records = await api.getKnowledgeRecords({jurisdiction:'NEW_TAIPEI',page:1,pageSize:20});
    expect(records.totalCount).toBeGreaterThan(0);
    expect(records.items.every(r=>r.jurisdiction==='NEW_TAIPEI')).toBe(true);
    expect(records.items.every(r=>r.source.url?.startsWith('https://'))).toBe(true);
    expect(records.knowledgeVersion).toBe('KB-2026-09-24-001');
  });
  it('rejects out of scope locations, stale analyses and precise GPS', async () => {
    await expect(assess({location:{precision:'DISTRICT',city:'桃園市',district:'桃園區',lat:null,lng:null}})).rejects.toThrow('僅支援');
    await expect(assess({location:{precision:'DISTRICT',city:'臺北市',district:'三重區',lat:null,lng:null}})).rejects.toThrow('不屬於');
    await expect(assess({location:{precision:'GPS',city:'臺北市',district:'大安區',lat:25,lng:121}})).rejects.toThrow('精確定位');
    const a=await assess(); api.reset();
    await expect(api.getRecommendation({assessmentId:a.assessmentId,serviceType:'HOME_CARE'})).rejects.toThrow('先完成');
  });
  it('browser hashing agrees with the actual backend rotation seed', async () => {
    const seed=['session','新北市','三重區','2026-10-08','NTPC-HC-003'];
    expect(await previewRotationHash(seed)).toBe(stableRotationHash(seed));
    expect(await previewRotationHash(['session','臺北市',null,'2026-10-08','TP-HC-001'])).toBe(stableRotationHash(['session','臺北市',null,'2026-10-08','TP-HC-001']));
  });
});

describe('official catalogue filters and center services', () => {
  it('SMART_TECH is the four current official stores, with current official addresses', async () => {
    const r = await api.getProviders({assistiveProgram:'SMART_TECH',pageSize:50});
    expect(r.totalCount).toBe(4);
    expect(r.items.map(p=>p.name).sort()).toEqual(['維思感創股份有限公司','益康儀器有限公司','康澄國際股份有限公司','點通科技股份有限公司'].sort());
    expect(r.items.find(p=>p.name==='益康儀器有限公司')?.address).toBe('臺北市中正區開封街一段60號');
    expect(r.appliedFilters.assistiveProgram).toBe('SMART_TECH');
    expect(r.items.every(p=>p.publicInfo?.assistivePrograms.includes('SMART_TECH'))).toBe(true);
  });
  it('classification never creates delivery coverage and invalid combinations fail', async () => {
    await expect(api.getProviders({assistiveProgram:'SMART_TECH',serviceType:'HOME_CARE'})).rejects.toThrow();
    await expect(api.getProviders({assistiveProgram:'PURCHASE',resourceCategory:'ASSISTIVE_DEVICE_CENTER'})).rejects.toThrow();
    const r = await api.getProviders({assistiveProgram:'PURCHASE',city:'臺北市',district:'中正區',areaFilter:'SERVICE_AREA',pageSize:50});
    expect(r.items).toEqual([]);
  });
  it('branches show sourced public services while remaining outside recommendation', async () => {
    const p = await api.getProvider('NTPC-ARC-B10');
    expect(p?.city).toBe('臺北市');expect(p?.district).toBe('南港區');
    expect(p?.services).toEqual([]);expect(p?.publicInfo?.publicServices).toContain('部分時段輔具評估（需預約）');
    expect(p?.publicInfo?.notice).toContain('不辦理補助核定');
  });
  it('new Taipei districts actually enter lookup and recommendation, blank/uncontracted entries do not', async () => {
    const r = await api.getProviders({serviceType:'HOME_CARE',city:'臺北市',district:'北投區',areaFilter:'SERVICE_AREA',pageSize:50});
    expect(r.totalCount).toBeGreaterThan(10);
    expect(r.items.some(p=>p.id==='TP-HC-198')).toBe(false);
    const a = await assess({location:{precision:'DISTRICT',city:'臺北市',district:'北投區',lat:null,lng:null}});
    const top = await api.getRecommendation({assessmentId:a.assessmentId,serviceType:'HOME_CARE'});
    expect(top.providers).toHaveLength(3);
    const details = await Promise.all(top.providers.map(p=>api.getProvider(p.id)));
    expect(details.every(p=>p?.serviceAreas.some(a=>a.city==='臺北市' && a.district==='北投區'))).toBe(true);
  });
});
