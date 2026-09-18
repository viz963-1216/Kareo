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
    };

    const { error } = await client.from("consents").insert({
      id: consent.id,
      session_id: consent.sessionId,
      disclaimer_version: consent.disclaimerVersion,
      privacy_version: consent.privacyVersion,
      terms_version: consent.termsVersion,
      accepted_at: consent.acceptedAt,
    });

    if (error) {
      throw new AppError("INTERNAL_ERROR", "無法建立 Consent，請稍後再試。");
    }

    return consent;
  }
}
