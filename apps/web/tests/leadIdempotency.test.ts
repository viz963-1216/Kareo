// C-005: retrying the same lead reuses its Idempotency-Key; changed content gets a new one (API_CONTRACT §3.3).
import assert from "node:assert/strict";
import { test } from "node:test";
import { createLeadIdempotency } from "../src/api/leadIdempotency.ts";

const lead = {
  sessionId: "SES-1",
  assessmentId: "ASM-1",
  recommendationId: "REC-1",
  providerId: "PROV-1",
  serviceType: "HOME_CARE" as const,
  contact: { name: "王先生", phone: "0912345678" },
  contactConsent: true as const,
};

test("same content → same key until settled; changed content or a settled lead → new key", () => {
  let n = 0;
  const keys = createLeadIdempotency(() => `key-${++n}`);
  assert.equal(keys.keyFor(lead), "key-1");
  assert.equal(keys.keyFor(structuredClone(lead)), "key-1", "retry after a failure reuses the key");
  assert.equal(keys.keyFor({ ...lead, contact: { ...lead.contact, phone: "0223456789" } }), "key-2");
  keys.settle();
  assert.equal(keys.keyFor(lead), "key-3");
});

test("default keys are UUIDs", () => {
  assert.match(createLeadIdempotency().keyFor(lead), /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
});
