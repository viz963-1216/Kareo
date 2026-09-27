// Netlify Functions 一般會把 header 名稱正規化為小寫，但直接呼叫測試時可能用原始大小寫，
// 這裡兩種都接受，取第一個有值的。
export interface NetlifyEventHeaders {
  headers?: Record<string, string | undefined> | null;
}

export function getSessionTokenHeader(event: NetlifyEventHeaders): string | undefined {
  const headers = event.headers ?? {};
  return headers["x-kareo-session-token"] ?? headers["X-Kareo-Session-Token"];
}
