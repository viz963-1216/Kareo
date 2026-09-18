import type { Consent, CreateConsentInput, Session } from "../types/index.js";

// Repository Boundary：Service 層只依賴這些介面，不直接依賴 Supabase SDK，
// 確保業務邏輯（Consent 檢查等）不會被 Supabase 自動 API 繞過。
export interface SessionRepository {
  createSession(): Promise<Session>;
}

export interface ConsentRepository {
  createConsent(input: CreateConsentInput): Promise<Consent>;
}
