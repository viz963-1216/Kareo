// A-003 coordinate / service-area evidence gate.
//
// Usage:
//   node data/providers/qa/verify-coordinates.mjs            # check data/providers
//   node data/providers/qa/verify-coordinates.mjs --write    # regenerate report sections
//   node data/providers/qa/verify-coordinates.mjs <root>     # root containing staging/ and qa/
//
// Checks that every non-null coordinate is backed by qa/a-003-evidence.json, that evidence
// matches the Provider (ID, name, address, address-point record, conversion), that the pending
// list matches what is still missing, and that the generated sections in the QA reports equal
// the statistics recomputed from the data.
//
// Exit code: 0 = PASS, 1 = FAIL.
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkEvidence,
  computeCoverage,
  computeStats,
  loadDataset,
  renderSections,
  syncReports,
} from "./lib/a-003-coverage.mjs";

const args = process.argv.slice(2);
const write = args.includes("--write");
const root = path.resolve(
  args.find((arg) => !arg.startsWith("--")) ??
    path.join(path.dirname(fileURLToPath(import.meta.url)), ".."),
);

let errors;
try {
  const dataset = loadDataset(root);
  const { errors: evidenceErrors, verifiedIds, pendingById, settingAreaKeys, unofficialIds } =
    checkEvidence(dataset);
  const coverage = computeCoverage(dataset, verifiedIds, settingAreaKeys, unofficialIds);
  const sections = renderSections(dataset, verifiedIds, coverage, pendingById, unofficialIds);
  // Never write reports from data that fails the evidence checks.
  const reportErrors = syncReports(root, sections, { write: write && evidenceErrors.length === 0 });
  errors = [...evidenceErrors, ...reportErrors];

  const stats = computeStats(dataset, verifiedIds, coverage, unofficialIds);
  console.log({
    providers: stats.providers,
    serviceAreas: stats.serviceAreas,
    nonNullCoordinates: stats.nonNullCoordinates,
    verifiedCoordinates: stats.verifiedCoordinates,
    unofficialCoordinates: stats.unofficialCoordinates,
    pendingCoordinates: stats.pendingCoordinates,
    missingServiceArea: stats.missingServiceArea,
    groups: stats.groups,
    readyDistanceGroups: stats.readyGroups.map((g) => `${g.serviceType}|${g.city}|${g.district}`),
  });
} catch (error) {
  errors = [`unable to run checks - ${error.message}`];
}

if (errors.length > 0) {
  for (const error of errors) console.log(`ERROR: ${error}`);
  console.log(`RESULT: FAIL (${errors.length} errors)`);
  process.exitCode = 1;
} else {
  console.log(write ? "RESULT: PASS (reports regenerated)" : "RESULT: PASS");
}
