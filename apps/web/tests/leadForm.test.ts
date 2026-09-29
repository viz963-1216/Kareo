// C-005: Lead form validation (API_CONTRACT §12, PRIVACY_AND_RETENTION §3.4).
import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizePhone, validateLeadForm } from "../src/lead/leadForm.ts";

const valid = { name: "王先生", phone: "0912-345-678", contactConsent: true };

test("valid mobile and landline numbers pass", () => {
  assert.deepEqual(validateLeadForm(valid), {});
  assert.deepEqual(validateLeadForm({ ...valid, phone: "(02) 1234 5678" }), {});
  assert.equal(normalizePhone("0912-345 678"), "0912345678");
});

test("contact consent is required and never implied", () => {
  assert.ok(validateLeadForm({ ...valid, contactConsent: false }).contactConsent);
});

test("missing or invalid name and phone are reported per field", () => {
  const errors = validateLeadForm({ name: "  ", phone: "12345", contactConsent: true });
  assert.ok(errors.name);
  assert.ok(errors.phone);
  assert.ok(validateLeadForm({ ...valid, name: "王".repeat(31) }).name);
  assert.ok(validateLeadForm({ ...valid, phone: "" }).phone);
  assert.ok(validateLeadForm({ ...valid, phone: "0912abc678" }).phone);
});
