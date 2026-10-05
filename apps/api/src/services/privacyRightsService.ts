import { hashOperatorKey, requireOperator } from './internalOperatorService.js';
import { validateCreateAssessmentInput } from './assessmentService.js';
import { taipeiDate } from '../assessment/knowledgeSnapshot.js';
import type { PrivacyRepository, PrivacyOperationResult } from '../repositories/supabasePrivacyRepository.js';
import type { LeadRepository } from '../repositories/types.js';
import type { PublishedKnowledgeResolver } from '../adapters/knowledgeVersionResolver.js';
import type { CareAssessmentAIAdapter } from '../adapters/aiAdapter.js';

const ACTIONS = ['EXPORT','CORRECT_CONTACT','CORRECT_ASSESSMENT','STOP','DELETE'] as const;
const ref = (v: unknown, pattern: RegExp) => typeof v === 'string' && pattern.test(v);
export function validatePrivacyRequest(raw: unknown, now: Date): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('PRIVACY_INVALID_REQUEST');
  const q = raw as Record<string, unknown>;
  const received = typeof q.receivedAt === 'string' ? Date.parse(q.receivedAt) : NaN;
  const verified = typeof q.verifiedAt === 'string' ? Date.parse(q.verifiedAt) : NaN;
  if (!ref(q.requestId,/^PRQ-[A-Z0-9_-]{1,92}$/) || !ACTIONS.includes(q.action as typeof ACTIONS[number])
    || !Number.isFinite(received) || !Number.isFinite(verified) || received>verified || verified>now.getTime()+5000 || verified<now.getTime()-7*86400000
    || !['ORIGINAL_CONTACT_CONFIRMED','AUTHORIZED_PROXY_CONFIRMED'].includes(q.verificationMethod as string)
    || !ref(q.verificationRef,/^[A-Z0-9_-]{5,120}$/)
    || (q.proxyAuthorityRef!=null && !ref(q.proxyAuthorityRef,/^[A-Z0-9_-]{5,120}$/))
    || (q.verificationMethod==='AUTHORIZED_PROXY_CONFIRMED' && !ref(q.proxyAuthorityRef,/^[A-Z0-9_-]{5,120}$/))
    || (!ref(q.sessionId,/^[A-Za-z0-9_-]{1,120}$/) && !ref(q.leadId,/^[A-Za-z0-9_-]{1,120}$/))) throw new Error('PRIVACY_VERIFICATION_REQUIRED');
  // The private request may contain correction values, but callers cannot inject
  // an operator/key, computed profile or another RPC action through it.
  return { requestId:q.requestId, action:q.action, receivedAt:q.receivedAt, verifiedAt:q.verifiedAt,
    verificationMethod:q.verificationMethod, verificationRef:q.verificationRef, proxyAuthorityRef:q.proxyAuthorityRef ?? null,
    ...(q.sessionId===undefined?{}:{sessionId:q.sessionId}), ...(q.leadId===undefined?{}:{leadId:q.leadId}),
    ...(q.assessmentId===undefined?{}:{assessmentId:q.assessmentId}), correction:q.correction };
}
export interface PrivacyRightsDeps {
  operatorRepo: Pick<LeadRepository,'findOperatorById'>; privacyRepo: PrivacyRepository;
  knowledgeResolver: PublishedKnowledgeResolver; engine: CareAssessmentAIAdapter;
}
export async function executePrivacyRight(deps: PrivacyRightsDeps, request: unknown, operatorId: unknown, key: unknown, now=new Date()): Promise<PrivacyOperationResult> {
  const operator = await requireOperator(deps.operatorRepo,operatorId,key,'DATA_STEWARD');
  const q = validatePrivacyRequest(request,now);
  const auth = {operatorId:operator.id,operatorKeyHash:hashOperatorKey(key as string)};
  if (q.action==='CORRECT_ASSESSMENT' || q.action==='CORRECT_CONTACT') {
    const context = await deps.privacyRepo.process({...q,...auth,action:'CONTEXT',requestId:q.requestId+'-CTX',correction:undefined});
    const sessionId = context.data?.sessionId;
    if (!context.data || typeof sessionId!=='string' || (q.action==='CORRECT_ASSESSMENT' && context.data.status!=='ACTIVE')) throw new Error('PRIVACY_STATE_CHANGED');
    if (q.action==='CORRECT_CONTACT') {
      const c = q.correction as {name?:unknown;phone?:unknown} | undefined;
      if (!c || typeof c.name!=='string' || c.name.trim().length<1 || c.name.trim().length>30 || typeof c.phone!=='string' || !/^(09\d{8}|0\d{1,2}-?\d{6,8})$/.test(c.phone)) throw new Error('PRIVACY_INVALID_CORRECTION');
      const lead = (context.data.leads as Array<{id:string;updatedAt:string}>).find(l=>l.id===q.leadId);
      if (!lead) throw new Error('PRIVACY_TARGET_MISMATCH');
      return deps.privacyRepo.process({...q,...auth,sessionId,correction:undefined,contactName:c.name.trim(),contactPhone:c.phone,expectedUpdatedAt:lead.updatedAt});
    }
    const row = (context.data.assessments as Array<{id:string;updatedAt:string}>).find(a=>a.id===q.assessmentId);
    if (!row) throw new Error('PRIVACY_TARGET_MISMATCH');
    const input = validateCreateAssessmentInput(q.correction);
    if (input.sessionId!==sessionId) throw new Error('PRIVACY_TARGET_MISMATCH');
    const knowledge=await deps.knowledgeResolver.resolvePublishedKnowledge();
    if (!knowledge) throw new Error('KNOWLEDGE_UNAVAILABLE');
    const generated=await deps.engine.generateCareNeedProfile(input,{knowledge,today:taipeiDate(now)});
    return deps.privacyRepo.process({...q,...auth,sessionId,correction:undefined,expectedUpdatedAt:row.updatedAt,
      assessment:{...input,knowledgeVersion:knowledge.version,rulesVersion:generated.rulesVersion,ruleTrace:generated.ruleTrace},profile:generated.profile});
  }
  return deps.privacyRepo.process({...q,...auth,correction:undefined});
}
