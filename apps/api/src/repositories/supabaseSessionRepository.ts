import { getSupabaseClient } from "./supabaseClient.js";
import type { SessionRepository } from "./types.js";
import type { Session } from "../types/index.js";
import { AppError } from "../errors/AppError.js";
import { generateId, nowTaipeiISOString } from "../lib/response.js";

export class SupabaseSessionRepository implements SessionRepository {
  async createSession(): Promise<Session> {
    const client = getSupabaseClient();
    const now = nowTaipeiISOString();
    const session: Session = { id: generateId("SES"), createdAt: now, updatedAt: now };

    const { error } = await client.from("sessions").insert({
      id: session.id,
      created_at: session.createdAt,
      updated_at: session.updatedAt,
    });

    if (error) {
      throw new AppError("INTERNAL_ERROR", "無法建立 Session，請稍後再試。");
    }

    return session;
  }

  async exists(sessionId: string): Promise<boolean> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("sessions")
      .select("id")
      .eq("id", sessionId)
      .maybeSingle();

    if (error) {
      throw new AppError("INTERNAL_ERROR", "無法確認 Session 狀態，請稍後再試。");
    }

    return data !== null;
  }
}
