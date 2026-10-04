import type { NetlifyEventHeaders } from "../lib/headers.js";
import { nowTaipeiISOString } from "../lib/response.js";
import { SupabaseRateLimitRepository } from "../repositories/supabaseRateLimitRepository.js";
import type { RateLimitRepository } from "../repositories/types.js";
import { enforceClientIpRateLimit, enforceRateLimit, hashForRateLimitKey, RATE_LIMIT_RULES } from "./rateLimitService.js";

// All login attempts count, including wrong credentials. Authenticated quotas are bound
// to the operator, so issuing another short-lived token does not reset the allowance.
export async function enforceAdminIpLimit(
  event: NetlifyEventHeaders,
  login = false,
  repo: RateLimitRepository = new SupabaseRateLimitRepository(),
  now = nowTaipeiISOString()
): Promise<void> {
  await enforceClientIpRateLimit(repo, login ? RATE_LIMIT_RULES.ADMIN_SESSION : RATE_LIMIT_RULES.ADMIN_REQUEST, event, now);
}

export async function enforceAdminOperatorLimit(
  operatorId: string,
  write: boolean,
  repo: RateLimitRepository = new SupabaseRateLimitRepository(),
  now = nowTaipeiISOString()
): Promise<void> {
  await enforceRateLimit(repo, write ? RATE_LIMIT_RULES.ADMIN_WRITE : RATE_LIMIT_RULES.ADMIN_READ, hashForRateLimitKey(operatorId), now);
}
