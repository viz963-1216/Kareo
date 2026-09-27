import { getSupabaseClient } from "./supabaseClient.js";
import type { ConsentRepository } from "./types.js";
import type { Consent, CreateConsentInput } from "../types/index.js";
import { AppError } from "../errors/AppError.js";
import { generateId, nowTaipeiISOString } from "../lib/response.js";

export class SupabaseConsentRepository implements ConsentRepository {
  async createConsent(input: CreateConsentInput): Promise<Consent> {
    const client = getSupabaseClient();
    const acceptedAt = nowTaipeiISOString();
    const consent: Consent = {
      id: generateId("CON"),
      sessionId: input.sessionId,
      disclaimerVersion: input.disclaimerVersion,
      privacyVersion: input.privacyVersion,
      termsVersion: input.termsVersion,
      acceptedAt,
      withdrawnAt: null,
    };

    const { error } = await client.from("consents").insert({
      id: consent.id,
      session_id: consent.sessionId,
      disclaimer_version: consent.disclaimerVersion,
      privacy_version: consent.privacyVersion,
      terms_version: consent.termsVersion,
      accepted_at: consent.acceptedAt,
      withdrawn_at: null,
    });

    if (error) {
      throw new AppError("INTERNAL_ERROR", "無法建立 Consent，請稍後再試。");
    }

    return consent;
  }

  // 依 DATA_MODEL.md v0.2：「有效 Consent」要求 withdrawnAt 為空，這裡直接在查詢排除已撤回的紀錄，
  // 不讓呼叫端誤把已撤回的舊 Consent 當成目前有效。
  async findLatestBySession(sessionId: string): Promise<Consent | null> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("consents")
      .select("id, session_id, disclaimer_version, privacy_version, terms_version, accepted_at, withdrawn_at")
      .eq("session_id", sessionId)
      .is("withdrawn_at", null)
      .order("accepted_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new AppError("INTERNAL_ERROR", "無法確認 Consent 狀態，請稍後再試。");
    }
    if (!data) return null;

    return {
      id: data.id,
      sessionId: data.session_id,
      disclaimerVersion: data.disclaimer_version,
      privacyVersion: data.privacy_version,
      termsVersion: data.terms_version,
      acceptedAt: data.accepted_at,
      withdrawnAt: data.withdrawn_at,
    };
  }
}
