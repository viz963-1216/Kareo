import { getSupabaseClient } from "./supabaseClient.js";
import type { SessionRepository } from "./types.js";
import type { CreatedSession, DeletionRun, Session } from "../types/index.js";
import { AppError } from "../errors/AppError.js";
import { logDbError } from "../lib/dbErrorLog.js";
import { generateId, nowTaipeiISOString } from "../lib/response.js";
import { computeExpiresAt, generateSessionToken, hashSessionToken } from "../services/sessionSecurityService.js";

function fromRow(row: {
  id: string;
  created_at: string;
  updated_at: string;
  last_seen_at: string | null;
  expires_at: string;
  status: "ACTIVE" | "DELETION_REQUESTED" | "DELETED";
  deleted_at: string | null;
}): Session {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSeenAt: row.last_seen_at,
    expiresAt: row.expires_at,
    status: row.status,
    deletedAt: row.deleted_at,
  };
}

export class SupabaseSessionRepository implements SessionRepository {
  async createSession(): Promise<CreatedSession> {
    const client = getSupabaseClient();
    const now = nowTaipeiISOString();
    const nowDate = new Date();
    const sessionToken = generateSessionToken();
    const tokenHash = hashSessionToken(sessionToken);
    const expiresAt = computeExpiresAt(nowDate, nowDate).toISOString();

    const session: Session = {
      id: generateId("SES"),
      createdAt: now,
      updatedAt: now,
      lastSeenAt: null,
      expiresAt,
      status: "ACTIVE",
      deletedAt: null,
    };

    const { error } = await client.from("sessions").insert({
      id: session.id,
      created_at: session.createdAt,
      updated_at: session.updatedAt,
      token_hash: tokenHash,
      last_seen_at: null,
      expires_at: session.expiresAt,
      status: session.status,
    });

    if (error) {
      logDbError("sessions.insert", error);
      throw new AppError("INTERNAL_ERROR", "無法建立 Session，請稍後再試。");
    }

    return { ...session, sessionToken };
  }

  async findByTokenHash(tokenHash: string): Promise<Session | null> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("sessions")
      .select("id, created_at, updated_at, last_seen_at, expires_at, status, deleted_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (error) {
      logDbError("sessions.selectByTokenHash", error);
      throw new AppError("INTERNAL_ERROR", "無法確認 Session 狀態，請稍後再試。");
    }
    if (!data) return null;
    return fromRow(data);
  }

  async touchSession(sessionId: string, updates: { lastSeenAt: string; expiresAt: string }): Promise<void> {
    const client = getSupabaseClient();
    const { error } = await client
      .from("sessions")
      .update({ last_seen_at: updates.lastSeenAt, expires_at: updates.expiresAt })
      .eq("id", sessionId);

    if (error) {
      logDbError("sessions.touch", error);
      throw new AppError("INTERNAL_ERROR", "無法更新 Session 狀態，請稍後再試。");
    }
  }

  async requestDeletion(sessionId: string, now: string): Promise<{ updated: boolean; leadsCancelled: number }> {
    const client = getSupabaseClient();
    const { data, error } = await client.rpc("request_session_deletion", { payload: { sessionId, now } });
    if (error) {
      throw new AppError("INTERNAL_ERROR", "無法刪除 Session，請稍後再試。");
    }
    const r = data as { updated: boolean; leadsCancelled: number };
    return { updated: r.updated, leadsCancelled: r.leadsCancelled ?? 0 };
  }

  async runDeletionCleanup(input: {
    now: string;
    dryRun: boolean;
  }): Promise<{ sessionsDeleted: number; leadsContactCleared: number; leadsDeleted: number; consentsDeleted: number }> {
    const client = getSupabaseClient();
    const { data, error } = await client.rpc("run_deletion_cleanup", { payload: { now: input.now, dryRun: input.dryRun } });
    if (error) {
      throw new AppError("INTERNAL_ERROR", "無法執行清理作業，請稍後再試。");
    }
    const r = data as { sessionsDeleted: number; leadsContactCleared: number; leadsDeleted: number; consentsDeleted: number };
    return {
      sessionsDeleted: r.sessionsDeleted,
      leadsContactCleared: r.leadsContactCleared,
      leadsDeleted: r.leadsDeleted,
      consentsDeleted: r.consentsDeleted,
    };
  }

  async insertDeletionRun(run: DeletionRun): Promise<void> {
    const client = getSupabaseClient();
    const { error } = await client.from("deletion_runs").insert({
      id: run.id,
      started_at: run.startedAt,
      finished_at: run.finishedAt,
      dry_run: run.dryRun,
      status: run.status,
      sessions_deleted: run.sessionsDeleted,
      leads_contact_cleared: run.leadsContactCleared,
      leads_deleted: run.leadsDeleted,
      consents_deleted: run.consentsDeleted,
      error_message: run.errorMessage,
      operator_id: run.operatorId,
    });
    if (error) {
      throw new AppError("INTERNAL_ERROR", "無法寫入清理作業紀錄，請稍後再試。");
    }
  }
}
