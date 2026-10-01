// TASK-B-011b：ARCHITECTURE §20.4 濫用限制。共用元件，呼叫端只需提供規則名稱與限流鍵的其中一段
// （session id 或 IP 雜湊），這裡負責組 key、呼叫 Repository，並在超過上限時拋出帶 Retry-After
// 的 RATE_LIMITED。IP 一律先雜湊再組 key，不把明文 IP 存進 rate_limit_counters（PRIVACY_AND_RETENTION §2）。
import { createHash } from "node:crypto";
import type { RateLimitRepository } from "../repositories/types.js";
import { AppError } from "../errors/AppError.js";

// 共用的雜湊函式：IP（ARCHITECTURE §20.4「只存雜湊」）與電話（LEAD_PHONE 規則的鍵）都用這個，
// 避免在 rate_limit_counters 裡留下任何可逆推回明文 IP 或電話的欄位（PRIVACY_AND_RETENTION §2）。
export function hashForRateLimitKey(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export interface RateLimitRule {
  name: string;
  limit: number;
  windowSeconds: number;
}

// 依 ARCHITECTURE §20.4 的規則表（上限為 D-04 建議值，Jerry 核准後生效）。
export const RATE_LIMIT_RULES = {
  CREATE_SESSION: { name: "CREATE_SESSION", limit: 20, windowSeconds: 3600 },
  CONSENT: { name: "CONSENT", limit: 10, windowSeconds: 3600 },
  ASSESSMENT: { name: "ASSESSMENT", limit: 3, windowSeconds: 3600 },
  RECOMMENDATION: { name: "RECOMMENDATION", limit: 30, windowSeconds: 3600 },
  PROVIDER_DETAIL: { name: "PROVIDER_DETAIL", limit: 60, windowSeconds: 3600 },
  LEAD: { name: "LEAD", limit: 5, windowSeconds: 86400 },
  LEAD_PHONE: { name: "LEAD_PHONE", limit: 3, windowSeconds: 86400 },
} as const satisfies Record<string, RateLimitRule>;

// keyPart：session id、IP 雜湊，或（LEAD_PHONE）電話雜湊；由呼叫端決定要用哪一種鍵。
export async function enforceRateLimit(
  repo: RateLimitRepository,
  rule: RateLimitRule,
  keyPart: string,
  now: string
): Promise<void> {
  const result = await repo.checkAndIncrement({
    key: `${rule.name}:${keyPart}`,
    windowSeconds: rule.windowSeconds,
    limit: rule.limit,
    now,
  });
  if (!result.allowed) {
    throw new AppError("RATE_LIMITED", "請求過於頻繁，請稍後再試。", { retryAfterSeconds: result.retryAfterSeconds ?? rule.windowSeconds });
  }
}
