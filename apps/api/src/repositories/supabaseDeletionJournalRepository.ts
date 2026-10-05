import type { DeletionRun } from '../types/index.js';
import { getSupabaseClient } from './supabaseClient.js';
import type { DeletionReceipt } from '../privacy/deletionJournal.js';
export interface DeletionReplayInput {projectRef:string;receipts:DeletionReceipt[];operatorId:string;operatorKeyHash:string}
export interface DeletionReplayRepository {
  replay(input:DeletionReplayInput):Promise<{receiptsRead:number;sessionsMarked:number;sessionsAbsent:number}>;
  replayAndCleanup(input:DeletionReplayInput & {cleanup:{now:string;dryRun:boolean;runId:string;operatorId:string|null}}):Promise<DeletionRun>;
}
export class SupabaseDeletionJournalRepository implements DeletionReplayRepository {
  async replayAndCleanup(input:Parameters<DeletionReplayRepository['replayAndCleanup']>[0]):Promise<DeletionRun> {
    const {data,error}=await getSupabaseClient().rpc('replay_deletion_receipts',{payload:input});
    if (error || data?.deletionRun?.status!=='SUCCESS' || data.deletionRun.id!==input.cleanup.runId) throw new Error('DELETION_REPLAY_FAILED');
    return data.deletionRun as DeletionRun;
  }
  async replay(input:Parameters<DeletionReplayRepository['replay']>[0]) {
    const {data,error}=await getSupabaseClient().rpc('replay_deletion_receipts',{payload:input});
    if (error || !data || data.receiptsRead!==input.receipts.length || !Number.isInteger(data.sessionsMarked) || !Number.isInteger(data.sessionsAbsent)) throw new Error('DELETION_REPLAY_FAILED');
    return data as {receiptsRead:number;sessionsMarked:number;sessionsAbsent:number};
  }
}
