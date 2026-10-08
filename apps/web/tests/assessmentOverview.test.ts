import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { assessmentOverview } from "../src/summary/assessmentOverview.ts";
import { buildCaseManagerSummary, careNeedLabels, caseManagerSummaryText } from "../src/summary/caseManagerSummary.ts";
import type { AssessmentResponse, CareNeed } from "../src/types/api.ts";

const fixture = JSON.parse(readFileSync(new URL("../../../contracts/mock/assessments/WITH-ESTIMATE-GENERAL-NEW_TAIPEI.json", import.meta.url), "utf8")).data as AssessmentResponse;
const needs: CareNeed[] = ["HOME_CARE", "HOME_MEDICAL_NURSING", "ASSISTIVE_DEVICE", "TRANSPORTATION"];

test("every combination of services stays within200 characters and names only assessed needs", () => {
  for (let mask = 0; mask < 16; mask++) {
    const selected = needs.filter((_, index) => (mask & (1 << index)) !== 0);
    const response = { ...fixture, careNeedProfile: { ...fixture.careNeedProfile, careNeeds: selected, priority: [...selected].reverse() } };
    const text = assessmentOverview(response);
    assert.ok(Array.from(text).length <= 200, `${mask}: ${Array.from(text).length}`);
    assert.match(text, /初步預估/);
    assert.match(text, /1966.*正式評估確認/);
    for (const need of selected) assert.ok(text.includes(careNeedLabels[need]));
    if (selected.length) assert.ok(text.includes(`優先與個管師討論${careNeedLabels[selected.at(-1)!]}`));
    else assert.match(text, /不代表沒有長照需求/);
  }
});

test("short overview does not truncate or replace full subsidy details in the case-manager handout", () => {
  const original = fixture.careNeedProfile.summary;
  const compact = assessmentOverview(fixture);
  const model = buildCaseManagerSummary(fixture, "2026年10月8日");
  const handout = caseManagerSummaryText(model);
  assert.equal(fixture.careNeedProfile.summary, original);
  assert.ok(handout.length > compact.length);
  for (const line of original.split("\n").map((part) => part.trim()).filter(Boolean)) assert.ok(handout.includes(`- ${line}`));
  assert.ok(handout.includes(fixture.knowledgeVersion));
  assert.doesNotMatch(compact, /[0-9][0-9,]* 元|[0-9]+%|已核定|您符合/);
});
