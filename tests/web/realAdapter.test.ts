// J-003: failure handling of the real API adapter (apps/web/src/api/realAdapter.ts).
// Runs under Node's test runner with type stripping: node --experimental-strip-types --test "tests/**/*.test.*"
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { ApiError, configureRealApi, getSessionAuth, realApi } from "../../apps/web/src/api/realAdapter.ts";

type Call = { url: string; method: string; headers: Record<string, string>; body?: string };
type Reply = (call: Call, signal: AbortSignal) => Promise<unknown> | unknown;

const store = new Map<string, string>();
Object.defineProperty(globalThis, "sessionStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  },
});

let calls: Call[] = [];
let replies: Reply[] = [];

function respond(status: number, body: string | null): Reply {
  return () => new Response(body, { status, headers: { "Content-Type": "application/json" } });
}
const json = (status: number, value: unknown) => respond(status, JSON.stringify(value));

globalThis.fetch = (async (url: string, init: RequestInit) => {
  const call: Call = {
    url,
    method: String(init.method),
    headers: { ...(init.headers as Record<string, string>) },
    body: init.body as string | undefined,
  };
  calls.push(call);
  const reply = replies.shift();
  assert.ok(reply, `unexpected request ${call.method} ${url}`);
  return reply(call, init.signal as AbortSignal);
}) as typeof fetch;

const consent = { sessionId: "SES-1", disclaimerVersion: "1", privacyVersion: "1", termsVersion: "1", accepted: true as const };

async function rejectsWith(promise: Promise<unknown>, code: string, status?: number) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ApiError, `expected ApiError, got ${String(error)}`);
    assert.equal(error.code, code);
    if (status !== undefined) assert.equal(error.status, status);
    assert.ok(error.message.length > 0);
    return true;
  });
}

beforeEach(() => {
  store.clear();
  calls = [];
  replies = [];
  configureRealApi({ requireSessionToken: false });
});

test("returns data from a 2xx success envelope", async () => {
  replies.push(json(200, { success: true, data: { consentId: "CON-1", acceptedAt: "t" } }));
  assert.deepEqual(await realApi.acceptConsent(consent), { consentId: "CON-1", acceptedAt: "t" });
});

test("HTTP error status with an error envelope keeps the contract code and status", async () => {
  replies.push(json(503, { success: false, error: { code: "KNOWLEDGE_UNAVAILABLE", message: "x" } }));
  await rejectsWith(realApi.acceptConsent(consent), "KNOWLEDGE_UNAVAILABLE", 503);
});

test("non-2xx status is an error even if the body claims success", async () => {
  replies.push(json(500, { success: true, data: { consentId: "CON-1" } }));
  await rejectsWith(realApi.acceptConsent(consent), "INVALID_RESPONSE", 500);
});

test("non-JSON error page (e.g. 502 from the platform) becomes HTTP_ERROR", async () => {
  replies.push(respond(502, "<html>Bad gateway</html>"));
  await rejectsWith(realApi.acceptConsent(consent), "HTTP_ERROR", 502);
});

test("null, empty and malformed envelopes on 200 become INVALID_RESPONSE", async () => {
  for (const body of ["null", "", "[]", '{"success":"yes"}', '{"success":true}', '{"success":true,"data":null}', '{"success":false}']) {
    replies.push(respond(200, body));
    await rejectsWith(realApi.acceptConsent(consent), "INVALID_RESPONSE", 200);
  }
});

test("unknown error code falls back to the server message", async () => {
  replies.push(json(409, { success: false, error: { code: "IDEMPOTENCY_CONFLICT", message: "內容不同" } }));
  await assert.rejects(realApi.acceptConsent(consent), { code: "IDEMPOTENCY_CONFLICT", message: "內容不同", status: 409 });
});

test("network failure becomes NETWORK", async () => {
  replies.push(() => Promise.reject(new TypeError("fetch failed")));
  await rejectsWith(realApi.acceptConsent(consent), "NETWORK", 0);
});

test("timeout while waiting for headers becomes TIMEOUT", { timeout: 2000 }, async () => {
  configureRealApi({ requireSessionToken: false, timeoutMs: 20 });
  replies.push((_call, signal) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
  }));
  await rejectsWith(realApi.acceptConsent(consent), "TIMEOUT", 0);
});

test("timeout also covers reading the response body", { timeout: 2000 }, async () => {
  configureRealApi({ requireSessionToken: false, timeoutMs: 20 });
  replies.push((_call, signal) => ({
    ok: true,
    status: 200,
    text: () => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    }),
  }));
  await rejectsWith(realApi.acceptConsent(consent), "TIMEOUT", 0);
});

test("new session replaces the previous token and later requests send only the new one", async () => {
  store.set("kareo.sessionToken", "OLD-TOKEN");
  replies.push(json(200, { success: true, data: { sessionId: "SES-2", createdAt: "t", sessionToken: "NEW-TOKEN" } }));
  const session = await realApi.createSession();
  assert.deepEqual(session, { sessionId: "SES-2", createdAt: "t" });
  assert.equal(calls[0].headers["X-Kareo-Session-Token"], undefined, "POST /session is public and must not send a token");
  assert.equal(getSessionAuth(), "TOKEN");

  replies.push(json(200, { success: true, data: { consentId: "CON-2", acceptedAt: "t" } }));
  await realApi.acceptConsent({ ...consent, sessionId: "SES-2" });
  assert.equal(calls[1].headers["X-Kareo-Session-Token"], "NEW-TOKEN");
});

test("failed session creation does not leave the previous session's token behind", async () => {
  store.set("kareo.sessionToken", "OLD-TOKEN");
  replies.push(json(500, { success: false, error: { code: "INTERNAL_ERROR", message: "x" } }));
  await rejectsWith(realApi.createSession(), "INTERNAL_ERROR", 500);
  assert.equal(store.get("kareo.sessionToken"), undefined);

  replies.push(json(200, { success: true, data: { consentId: "CON", acceptedAt: "t" } }));
  await realApi.acceptConsent(consent);
  assert.equal(calls[1].headers["X-Kareo-Session-Token"], undefined);
});

test("session without token is rejected when the contract requires tokens", async () => {
  configureRealApi({ requireSessionToken: true });
  replies.push(json(200, { success: true, data: { sessionId: "SES-3", createdAt: "t" } }));
  await rejectsWith(realApi.createSession(), "SESSION_TOKEN_MISSING");
  assert.equal(store.size, 0);
});

test("session without token is reported as unprotected when tokens are not yet required", async () => {
  replies.push(json(200, { success: true, data: { sessionId: "SES-4", createdAt: "t" } }));
  const warn = console.warn;
  const warnings: unknown[] = [];
  console.warn = (...args: unknown[]) => void warnings.push(args);
  try {
    await realApi.createSession();
  } finally {
    console.warn = warn;
  }
  assert.equal(getSessionAuth(), "NONE");
  assert.equal(warnings.length, 1);
});

test("protected request without a token fails locally when tokens are required", async () => {
  configureRealApi({ requireSessionToken: true });
  await rejectsWith(realApi.acceptConsent(consent), "SESSION_INVALID", 0);
  assert.equal(calls.length, 0, "must not call the API without a token");
});

test("SESSION_INVALID from the server clears the stored token", async () => {
  store.set("kareo.sessionToken", "EXPIRED");
  replies.push(json(401, { success: false, error: { code: "SESSION_INVALID", message: "x" } }));
  await rejectsWith(realApi.submitAssessment({} as never), "SESSION_INVALID", 401);
  assert.equal(store.get("kareo.sessionToken"), undefined);
});

test("session response missing sessionId is invalid", async () => {
  replies.push(json(200, { success: true, data: { createdAt: "t", sessionToken: "T" } }));
  await rejectsWith(realApi.createSession(), "INVALID_RESPONSE");
  assert.equal(store.size, 0);
});
