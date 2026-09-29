import type { LeadRequest } from "../types/api";

// C-005 / API_CONTRACT §3.3: one Idempotency-Key per lead submission. Retrying the same content after a
// failure (network, timeout, 5xx) reuses the key, so the backend returns the original lead instead of
// creating a second one. Changing any field starts a new key. Kept in memory only (never storage/URL),
// and forgotten once the lead is accepted so contact details are not retained.

export interface LeadIdempotency {
  keyFor(request: LeadRequest): string;
  settle(): void;
}

export function createLeadIdempotency(newKey: () => string = () => globalThis.crypto.randomUUID()): LeadIdempotency {
  let pending: { fingerprint: string; key: string } | null = null;
  return {
    keyFor(request) {
      const fingerprint = JSON.stringify(request);
      if (pending?.fingerprint !== fingerprint) pending = { fingerprint, key: newKey() };
      return pending.key;
    },
    settle() {
      pending = null;
    },
  };
}
