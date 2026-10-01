import { getSupabaseClient } from "./supabaseClient.js";
import type { RateLimitRepository } from "./types.js";
import type { RateLimitCheckResult } from "../types/index.js";
import { AppError } from "../errors/AppError.js";

// TASK-B-011b：ARCHITECTURE §20.4 持久化限流。原子檢查＋遞增在 migration 0019 check_rate_limit
// 內以 pg_advisory_xact_lock 完成，這裡只負責呼叫 RPC。
export class SupabaseRateLimitRepository implements RateLimitRepository {
  async checkAndIncrement(input: { key: string; windowSeconds: number; limit: number; now: string }): Promise<RateLimitCheckResult> {
    const client = getSupabaseClient();
    const { data, error } = await client.rpc("check_rate_limit", {
      payload: { key: input.key, windowSeconds: input.windowSeconds, limit: input.limit, now: input.now },
    });
    if (error) {
      throw new AppError("INTERNAL_ERROR", "無法檢查限流狀態，請稍後再試。");
    }
    const r = data as { allowed: boolean; retryAfterSeconds?: number };
    return { allowed: r.allowed, retryAfterSeconds: r.retryAfterSeconds ?? null };
  }
}
