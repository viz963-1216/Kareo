import { AppError } from '../errors/AppError.js';
import type { DeletionJournal, DeletionAction } from './deletionJournal.js';
// An omitted adapter is used only by existing isolated in-memory service tests.
// Every deployed handler and protected operational CLI supplies the real adapter.
export async function persistDeletionIntent(journal:DeletionJournal|undefined,sessionId:string,action:DeletionAction,now:string):Promise<string> {
  if (!journal) return now;
  try { return (await journal.record(sessionId,action,now)).requestedAt; }
  catch { throw new AppError('INTERNAL_ERROR','無法確認刪除請求紀錄，請稍後重試或聯絡客服。'); }
}
