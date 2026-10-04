// Netlify Functions 一般會把 header 名稱正規化為小寫，但直接呼叫測試時可能用原始大小寫，
// 這裡兩種都接受，取第一個有值的。
export interface NetlifyEventHeaders {
  headers?: Record<string, string | undefined> | null;
}

export function getSessionTokenHeader(event: NetlifyEventHeaders): string | undefined {
  const headers = event.headers ?? {};
  return headers["x-kareo-session-token"] ?? headers["X-Kareo-Session-Token"];
}

// TASK-B-006：POST /api/v1/leads 必須帶 Idempotency-Key（API_CONTRACT §3.3）。
export function getIdempotencyKeyHeader(event: NetlifyEventHeaders): string | undefined {
  const headers = event.headers ?? {};
  return headers["idempotency-key"] ?? headers["Idempotency-Key"];
}

// TASK-B-012：/api/v1/admin/** 一律以 X-Kareo-Admin-Token 驗證，不使用 X-Kareo-Session-Token
// （API_CONTRACT §26.1、§3.1）。
export function getAdminTokenHeader(event: NetlifyEventHeaders): string | undefined {
  const headers = event.headers ?? {};
  return headers["x-kareo-admin-token"] ?? headers["X-Kareo-Admin-Token"];
}

// TASK-B-011b：ARCHITECTURE §20.4 IP 雜湊限流鍵。Netlify Functions 把實際用戶端 IP 放在
// x-nf-client-connection-ip；沒有這個值時（例如本機測試、非 Netlify 環境）退回標準的
// x-forwarded-for 第一段。只回傳字串供呼叫端雜湊，這裡不做雜湊（見 services/rateLimitService.ts）。
export function getClientIp(event: NetlifyEventHeaders): string | undefined {
  const headers = event.headers ?? {};
  const direct = headers["x-nf-client-connection-ip"];
  if (direct) return direct;
  const forwarded = headers["x-forwarded-for"];
  if (forwarded) return forwarded.split(",")[0]?.trim();
  return undefined;
}
