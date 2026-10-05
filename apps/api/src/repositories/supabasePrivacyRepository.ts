import { getSupabaseClient } from './supabaseClient.js';

export interface PrivacyOperationResult {
  requestId: string; action: string; counts: Record<string, unknown>;
  data: Record<string, unknown> | null;
}
export interface PrivacyRepository {
  process(payload: Record<string, unknown>): Promise<PrivacyOperationResult>;
}
const SAFE_CODES = ['PRIVACY_UNAUTHORIZED','PRIVACY_VERIFICATION_REQUIRED','PRIVACY_REQUEST_ALREADY_USED','PRIVACY_TARGET_MISMATCH','PRIVACY_TARGET_NOT_FOUND','PRIVACY_STATE_CHANGED','PRIVACY_INVALID_CORRECTION'];
export class SupabasePrivacyRepository implements PrivacyRepository {
  async process(payload: Record<string, unknown>): Promise<PrivacyOperationResult> {
    const { data, error } = await getSupabaseClient().rpc('process_privacy_right', { payload });
    if (error) throw new Error(SAFE_CODES.find(c => error.message?.startsWith(c)) ?? 'PRIVACY_OPERATION_FAILED');
    if (!data || typeof data.requestId !== 'string' || data.action !== payload.action || !data.counts) throw new Error('PRIVACY_OPERATION_FAILED');
    if (payload.action==='EXPORT' && (typeof data.data?.session?.id!=='string'
      || ['consents','assessments','profiles','recommendations','recommendationItems','leads','leadEvents'].some(k=>!Array.isArray(data.data[k]))
      || Object.hasOwn(data.data.session,'token_hash'))) throw new Error('PRIVACY_OPERATION_FAILED');
    if (payload.action==='CONTEXT' && (typeof data.data?.sessionId!=='string' || !Array.isArray(data.data.assessments) || !Array.isArray(data.data.leads))) throw new Error('PRIVACY_OPERATION_FAILED');
    return data as PrivacyOperationResult;
  }
}
