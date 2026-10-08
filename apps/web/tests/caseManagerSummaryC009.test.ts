import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildCaseManagerSummary,
  caseManagerSummaryText,
  CASE_MANAGER_QUESTIONS,
  FORMAL_ASSESSMENT_REMINDER,
} from "../src/summary/caseManagerSummary.ts";
import type { AssessmentResponse } from "../src/types/api.ts";

const fixtures = fileURLToPath(new URL("../../../contracts/mock/assessments/", import.meta.url));
const pagePath = fileURLToPath(new URL("../src/pages/ResultPage.tsx", import.meta.url));
const stylePath = fileURLToPath(new URL("../src/styles.css", import.meta.url));
const json = (path: string) => JSON.parse(readFileSync(path, "utf8"));

for (const file of ["WITH-SUBSIDY-NEW_TAIPEI.json", "WITH-DISABILITY-NEW_TAIPEI.json", "WITH-ESTIMATE-GENERAL-NEW_TAIPEI.json"]) {
  test(`${file} produces an exact, non-personal browser-only summary`, () => {
    const response = json(`${fixtures}${file}`).data as AssessmentResponse;
    const model = buildCaseManagerSummary(response, "2026年10月3日");
    const text = caseManagerSummaryText(model);
    assert.deepEqual(model.summaryLines, response.careNeedProfile.summary.split("\n").map((line) => line.trim()).filter(Boolean));
    assert.equal(model.knowledgeVersion, response.knowledgeVersion);
    for (const line of model.summaryLines) assert.ok(text.includes(`\n- ${line}\n`), "Copied policy detail remains a complete bullet, including conditions and source");
    for (const need of response.careNeedProfile.careNeeds) assert.ok(model.careNeeds.length > 0, need);
    for (const line of FORMAL_ASSESSMENT_REMINDER) assert.equal(text.split(line).length - 1, 2);
    for (const question of CASE_MANAGER_QUESTIONS) assert.equal(text.includes(question), true);
    for (const forbidden of ["姓名：", "電話：", "地址：", "座標：", "freeText", "latitude", "longitude"]) assert.equal(text.includes(forbidden), false);
  });
}

test("summary UI uses no API and no browser persistence", () => {
  const page = readFileSync(pagePath, "utf8");
  const summary = readFileSync(fileURLToPath(new URL("../src/summary/caseManagerSummary.ts", import.meta.url)), "utf8");
  assert.doesNotMatch(summary, /fetch\(|\bapi\.|localStorage|sessionStorage|indexedDB|document\.cookie/);
  assert.doesNotMatch(page, /localStorage|sessionStorage|indexedDB|document\.cookie/);
  assert.match(page, /navigator\.clipboard\.writeText\(caseManagerSummaryText\(summary\)\)/);
});

test("print action is browser-native and print CSS exposes only the summary", () => {
  const page = readFileSync(pagePath, "utf8");
  const css = readFileSync(stylePath, "utf8");
  assert.match(page, /window\.print\(\)/);
  assert.match(css, /@media print/);
  assert.match(css, /body \* \{ visibility: hidden/);
  assert.match(css, /\.case-manager-summary, \.case-manager-summary \* \{ visibility: visible/);
  assert.match(css, /\.summary-actions[^}]*display: none/);
});

test("copied text contains every section rendered by the summary view", () => {
  const response = json(`${fixtures}WITH-SUBSIDY-NEW_TAIPEI.json`).data as AssessmentResponse;
  const text = caseManagerSummaryText(buildCaseManagerSummary(response, "2026年10月3日"));
  for (const heading of ["可能需要的服務", "建議優先處理順序", "初步照護建議與補助說明", "建議詢問 1966／照管專員的問題"]) {
    assert.equal(text.includes(heading), true);
  }
});
