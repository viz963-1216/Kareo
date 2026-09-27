import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { buildAssessmentRequest, defaultAssessmentForm } from "../src/assessment/assessmentRequest.ts";
import { assessmentMockScenario, MOCK_STATES } from "../src/api/mockScenarios.ts";

const district = { precision: "DISTRICT", city: "新北市", district: "三重區", lat: null, lng: null } as const;

test("new assessment fields have explicit UNKNOWN defaults", () => {
  assert.equal(defaultAssessmentForm.disabilityCertificate, "UNKNOWN");
  assert.equal(defaultAssessmentForm.incomeCategory, "UNKNOWN");
  const changed = { ...defaultAssessmentForm, disabilityCertificate: "YES" as const, incomeCategory: "GENERAL" as const };
  assert.notDeepEqual(changed, defaultAssessmentForm);
  assert.deepEqual(
    { disabilityCertificate: defaultAssessmentForm.disabilityCertificate, incomeCategory: defaultAssessmentForm.incomeCategory },
    { disabilityCertificate: "UNKNOWN", incomeCategory: "UNKNOWN" },
  );
});

test("the restart path restores defaultAssessmentForm instead of retaining prior answers", () => {
  const appSource = readFileSync(fileURLToPath(new URL("../src/App.tsx", import.meta.url)), "utf8");
  assert.match(appSource, /const clearState\s*=\s*useCallback\(\(\)\s*=>\s*\{[\s\S]*?setForm\(defaultAssessmentForm\)/);
  assert.match(appSource, /restart\(\)[\s\S]*?clearState\(\)/);
});

test("payload always includes sessionId and both new fields, including unanswered values", () => {
  const payload = buildAssessmentRequest("SES-1", { ...defaultAssessmentForm, freeText: "  note  " }, district);
  assert.equal(payload.sessionId, "SES-1");
  assert.equal(payload.disabilityCertificate, "UNKNOWN");
  assert.equal(payload.incomeCategory, "UNKNOWN");
  assert.equal(payload.freeText, "note");
});

test("all disability and income enum choices are preserved in the payload", () => {
  for (const disabilityCertificate of ["YES", "NO", "UNKNOWN"] as const) {
    assert.equal(buildAssessmentRequest("SES-1", { ...defaultAssessmentForm, disabilityCertificate }, district).disabilityCertificate, disabilityCertificate);
  }
  for (const incomeCategory of ["LOW_INCOME", "MIDDLE_LOW_INCOME", "ALLOWANCE", "GENERAL", "UNKNOWN"] as const) {
    assert.equal(buildAssessmentRequest("SES-1", { ...defaultAssessmentForm, incomeCategory }, district).incomeCategory, incomeCategory);
  }
});

test("mock selects whole disability and estimate fixtures without inventing unsupported combinations", () => {
  const base = { hasCareNeeds: true, city: "新北市", district: "三重區" };
  assert.equal(assessmentMockScenario({ ...base, disabilityCertificate: "YES", incomeCategory: "GENERAL" }), "estimate-general-new-taipei");
  assert.equal(assessmentMockScenario({ ...base, disabilityCertificate: "YES", incomeCategory: "LOW_INCOME" }), "disability-new-taipei");
  assert.equal(assessmentMockScenario({ ...base, disabilityCertificate: "NO", incomeCategory: "GENERAL" }), "subsidy-new-taipei");
  assert.equal(assessmentMockScenario({ ...base, disabilityCertificate: "UNKNOWN", incomeCategory: "UNKNOWN" }), "subsidy-new-taipei");
  assert.equal(assessmentMockScenario({ ...base, hasCareNeeds: false }), "empty");
});

test("duplicate lead is an explicit mock acceptance state", () => {
  assert.ok(MOCK_STATES.includes("duplicate"));
});
