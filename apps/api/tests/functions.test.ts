import { describe, it, expect, beforeEach } from "vitest";
import { handler as sessionHandler } from "../src/functions/session.js";
import { handler as consentHandler } from "../src/functions/consent.js";

// 這裡刻意不設定 SUPABASE_* 環境變數，驗證：
// 1) 沒有真實 DB 連線時，Function 不會 crash 或洩漏原始錯誤，而是回傳安全的 INTERNAL_ERROR
// 2) 沒有任何 Secret 被寫死在程式碼或測試中（本檔案全程未出現任何真實金鑰）
describe("Function handlers (no live Supabase configured)", () => {
  beforeEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("session handler rejects non-POST method", async () => {
    const res = await sessionHandler({ httpMethod: "GET" });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("INVALID_REQUEST");
  });

  it("session handler returns safe INTERNAL_ERROR when Supabase is not configured", async () => {
    const res = await sessionHandler({ httpMethod: "POST" });
    const body = JSON.parse(res.body);

    // 訊息可以提示「哪個環境變數沒設定」（開發除錯用），
    // 但不得包含任何實際 Secret 值（例如 JWT-like Service Role Key 內容）或原始 Stack Trace。
    expect(res.statusCode).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(body)).not.toMatch(/eyJ[a-zA-Z0-9_-]{10,}/); // JWT-like secret pattern
    expect(JSON.stringify(body)).not.toMatch(/at\s+\w+\s+\(.*:\d+:\d+\)/); // stack trace pattern
  });

  it("consent handler rejects invalid JSON body", async () => {
    const res = await consentHandler({ httpMethod: "POST", body: "{not-json" });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("INVALID_REQUEST");
  });

  it("consent handler returns VALIDATION_ERROR before touching Supabase when accepted=false", async () => {
    const res = await consentHandler({
      httpMethod: "POST",
      body: JSON.stringify({
        sessionId: "SES-TEST0001",
        disclaimerVersion: "1.0",
        privacyVersion: "1.0",
        termsVersion: "1.0",
        accepted: false,
      }),
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("VALIDATION_ERROR");
  });
});
