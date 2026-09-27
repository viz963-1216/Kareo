import { getSupabaseClient } from "./supabaseClient.js";
import type { SessionRepository } from "./types.js";
import type { CreatedSession, Session } from "../types/index.js";
import { AppError } from "../errors/AppError.js";
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
      throw new AppError("INTERNAL_ERROR", "無法更新 Session 狀態，請稍後再試。");
    }
  }
}
