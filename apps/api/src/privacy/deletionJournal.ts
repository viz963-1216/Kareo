import { createHash } from 'node:crypto';
export type DeletionAction = 'CONSENT_WITHDRAWN' | 'USER_DELETED';
export interface DeletionReceipt { schemaVersion:1; projectRef:string; sessionId:string; action:DeletionAction; requestedAt:string }
export interface DeletionJournal {
  readonly projectRef:string;
  record(sessionId:string,action:DeletionAction,requestedAt:string):Promise<DeletionReceipt>;
  readAll():Promise<DeletionReceipt[]>;
}
export function validateReceipt(raw:unknown,projectRef:string,now=new Date()):DeletionReceipt {
  if (!raw || typeof raw!=='object' || Array.isArray(raw)) throw new Error('DELETION_JOURNAL_INVALID');
  const r=raw as Record<string,unknown>;
  if (Object.keys(r).sort().join(',')!=='action,projectRef,requestedAt,schemaVersion,sessionId'
    || r.schemaVersion!==1 || r.projectRef!==projectRef || !/^[a-z0-9]{20}$|^LOCAL-SYNTHETIC$/.test(projectRef)
    || typeof r.sessionId!=='string' || !/^[A-Za-z0-9_-]{1,120}$/.test(r.sessionId)
    || !['CONSENT_WITHDRAWN','USER_DELETED'].includes(r.action as string)
    || typeof r.requestedAt!=='string' || !Number.isFinite(Date.parse(r.requestedAt))
    || Date.parse(r.requestedAt)>now.getTime()+5000) throw new Error('DELETION_JOURNAL_INVALID');
  return r as unknown as DeletionReceipt;
}
export function receiptKey(r:Pick<DeletionReceipt,'projectRef'|'sessionId'|'action'>):string {
  return 'intents/'+createHash('sha256').update(r.projectRef+'\0'+r.sessionId+'\0'+r.action).digest('hex');
}
