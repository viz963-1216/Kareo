// C-005: real adapter additions — lead headers, session deletion/withdrawal, and success payloads that do
// not match API_CONTRACT v0.2.2 are rejected instead of being shown as a successful result.
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { ApiError, configureRealApi, realApi } from "../src/api/realAdapter.ts";

type Call = { url: string; method: string; headers: Record<string, string>; body?: string };

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
let replies: unknown[] = [];
globalThis.fetch = (async (url: string, init: RequestInit) => {
  calls.push({ url, method: String(init.method), headers: { ...(init.headers as Record<string, string>) }, body: init.body as string | undefined });
  const [status, body] = replies.shift() as [number, unknown];
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}) as typeof fetch;

const ok = (data: unknown) => [200, { success: true, data }];

async function rejectsWith(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (error: unknown) => error instanceof ApiError && error.code === code);
}

async function startSession() {
  replies.push(ok({ sessionId: "SES-1", sessionToken: "tok-1", createdAt: "t" }));
  await realApi.createSession();
  calls = [];
}

const lead = {
  sessionId: "SES-1",
  assessmentId: "ASM-1",
  recommendationId: "REC-1",
  providerId: "PROV-1",
  serviceType: "HOME_CARE" as const,
  contact: { name: "王先生", phone: "0912345678" },
  contactConsent: true as const,
};

const assessment = {
  assessmentId: "ASM-1",
  knowledgeVersion: "KB-1",
  careNeedProfile: { id: "CNP-1", careNeeds: ["HOME_CARE"], priority: ["HOME_CARE"], summary: "a\nb", warnings: ["本結果僅為初步預估。"] },
};

const recommendation = {
  recommendationId: "REC-1",
  serviceType: "HOME_CARE",
  rankingType: "DISTRICT_ROTATION",
  locationPrecision: "DISTRICT",
  providers: [{ id: "P1", name: "n", type: "HOME_CARE", address: "a", district: "d", phone: "p", website: null, googleMapsUrl: "u", verified: false, rank: 1, distanceKm: null, reasons: ["r"] }],
  notice: "x",
};

beforeEach(() => {
  store.clear();
  calls = [];
  replies = [];
  configureRealApi({ requireSessionToken: true });
});

test("createLead posts to /leads with the session token and the given Idempotency-Key", async () => {
  await startSession();
  replies.push(ok({ leadId: "LEAD-1", status: "NEW", createdAt: "t", duplicate: false }));
  const response = await realApi.createLead(lead, "11111111-1111-4111-8111-111111111111");
  assert.equal(response.leadId, "LEAD-1");
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].url, "/api/v1/leads");
  assert.equal(calls[0].headers["X-Kareo-Session-Token"], "tok-1");
  assert.equal(calls[0].headers["Idempotency-Key"], "11111111-1111-4111-8111-111111111111");
  assert.deepEqual(JSON.parse(calls[0].body ?? ""), lead);
});

test("a lead success without the contract fields is not treated as sent", async () => {
  await startSession();
  replies.push(ok({ leadId: "LEAD-1" }));
  await rejectsWith(realApi.createLead(lead, "k"), "INVALID_RESPONSE");
});

test("lead endpoint not deployed yet surfaces NOT_FOUND, never a mock success", async () => {
  await startSession();
  replies.push([404, { success: false, error: { code: "NOT_FOUND", message: "x" } }]);
  await rejectsWith(realApi.createLead(lead, "k"), "NOT_FOUND");
});

test("deleteSession drops the token only after the server confirms", async () => {
  await startSession();
  replies.push([500, { success: false, error: { code: "INTERNAL_ERROR", message: "x" } }]);
  await rejectsWith(realApi.deleteSession(), "INTERNAL_ERROR");
  assert.equal(store.get("kareo.sessionToken"), "tok-1");

  replies.push(ok({ sessionId: "SES-1", status: "DELETION_REQUESTED", deletionScheduledBefore: "2026-10-01T00:00:00+08:00" }));
  const deletion = await realApi.deleteSession();
  assert.equal(calls.at(-1)?.method, "DELETE");
  assert.equal(deletion.status, "DELETION_REQUESTED");
  assert.equal(store.has("kareo.sessionToken"), false);
});

test("withdrawConsent calls /consent/withdraw and drops the token", async () => {
  await startSession();
  replies.push(ok({ withdrawnAt: "t", sessionStatus: "DELETION_REQUESTED" }));
  await realApi.withdrawConsent();
  assert.equal(calls[0].url, "/api/v1/consent/withdraw");
  assert.equal(store.has("kareo.sessionToken"), false);
});

test("forgetLocalSession clears only the local credential and sends nothing", async () => {
  await startSession();
  realApi.forgetLocalSession();
  assert.equal(store.has("kareo.sessionToken"), false);
  assert.equal(calls.length, 0);
});

test("assessment success must match the contract (no fake success on malformed data)", async () => {
  await startSession();
  replies.push(ok(assessment));
  assert.equal((await realApi.submitAssessment({} as never)).assessmentId, "ASM-1");
  for (const broken of [
    { ...assessment, knowledgeVersion: "" },
    { ...assessment, careNeedProfile: { ...assessment.careNeedProfile, warnings: [] } },
    { ...assessment, careNeedProfile: { ...assessment.careNeedProfile, careNeeds: ["SOMETHING_ELSE"] } },
    { ...assessment, careNeedProfile: { ...assessment.careNeedProfile, summary: 1 } },
  ]) {
    replies.push(ok(broken));
    await rejectsWith(realApi.submitAssessment({} as never), "INVALID_RESPONSE");
  }
});

test("recommendation success must carry a known rankingType and well-formed providers", async () => {
  await startSession();
  replies.push(ok(recommendation));
  assert.equal((await realApi.getRecommendation({ assessmentId: "ASM-1", serviceType: "HOME_CARE" })).providers.length, 1);
  replies.push(ok({ ...recommendation, providers: [] }));
  assert.equal((await realApi.getRecommendation({ assessmentId: "ASM-1", serviceType: "HOME_CARE" })).providers.length, 0);
  for (const broken of [
    { ...recommendation, rankingType: "NEAREST" },
    { ...recommendation, locationPrecision: undefined },
    { ...recommendation, providers: [{ ...recommendation.providers[0], distanceKm: "1.8" }] },
  ]) {
    replies.push(ok(broken));
    await rejectsWith(realApi.getRecommendation({ assessmentId: "ASM-1", serviceType: "HOME_CARE" }), "INVALID_RESPONSE");
  }
});
