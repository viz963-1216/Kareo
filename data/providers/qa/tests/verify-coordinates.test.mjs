// Regression tests for the A-003 coordinate / service-area evidence gate.
// Run: node --test 'data/providers/qa/tests/*.test.mjs'
// Each test copies the real dataset, evidence and reports into a temporary root, applies one
// realistic mistake, and expects verify-coordinates.mjs to fail for that reason.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { checkEvidence, computeCoverage, REPORT_SECTIONS } from "../lib/a-003-coverage.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const providersRoot = path.resolve(__dirname, "../..");
const gate = path.resolve(__dirname, "../verify-coordinates.mjs");

const COPIED_FILES = [
  "staging/providers.json",
  "staging/provider-services.json",
  "staging/provider-service-areas.json",
  "qa/a-003-evidence.json",
  ...Object.keys(REPORT_SECTIONS),
];

function runGate(mutate = () => {}, args = []) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "kareo-a003-"));
  try {
    for (const file of COPIED_FILES) {
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      fs.copyFileSync(path.join(providersRoot, file), path.join(root, file));
    }
    const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
    const writeJson = (file, data) => fs.writeFileSync(path.join(root, file), JSON.stringify(data));
    const readText = (file) => fs.readFileSync(path.join(root, file), "utf8");
    const writeText = (file, text) => fs.writeFileSync(path.join(root, file), text);
    mutate({ readJson, writeJson, readText, writeText });
    const result = spawnSync(process.execPath, [gate, root, ...args], { encoding: "utf8" });
    return { status: result.status, output: result.stdout + result.stderr, readText };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const EVIDENCE = "qa/a-003-evidence.json";
const PROVIDERS = "staging/providers.json";
const AREAS = "staging/provider-service-areas.json";
const REPORT = "qa/verified-coordinates-report.md";

function loadRealDataset() {
  const read = (file) => JSON.parse(fs.readFileSync(path.join(providersRoot, file), "utf8"));
  return {
    providers: read(PROVIDERS),
    services: read("staging/provider-services.json"),
    areas: read(AREAS),
    evidence: read(EVIDENCE),
  };
}

test("current dataset, evidence and reports pass", () => {
  const { status, output } = runGate();
  assert.equal(status, 0, output);
  assert.match(output, /RESULT: PASS/);
});

test("a wrong count in a report summary fails", () => {
  const { status, output } = runGate(({ readText, writeText }) => {
    const text = readText(REPORT);
    const changed = text.replace(/有完整驗證證據的座標：(\d+)/, (_, n) => `有完整驗證證據的座標：${Number(n) + 1}`);
    assert.notEqual(changed, text);
    writeText(REPORT, changed);
  });
  assert.equal(status, 1);
  assert.match(output, /section "summary" differs from the data/);
});

test("a wrong READY status in the coverage table fails", () => {
  const { status, output } = runGate(({ readText, writeText }) => {
    const text = readText(REPORT);
    const changed = text.replace(
      /(\| HOME_CARE \| 臺北市 \| 萬華區 \|[^\n]*?)READY/,
      "$1BLOCKED（缺座標）",
    );
    assert.notEqual(changed, text);
    writeText(REPORT, changed);
  });
  assert.equal(status, 1);
  assert.match(output, /section "coverage" differs from the data/);
});

test("removing the evidence for a non-null coordinate fails", () => {
  const { status, output } = runGate(({ readJson, writeJson }) => {
    const evidence = readJson(EVIDENCE);
    evidence.coordinates = evidence.coordinates.filter((item) => item.providerId !== "NTPC-HC-003");
    writeJson(EVIDENCE, evidence);
  });
  assert.equal(status, 1);
  assert.match(output, /NTPC-HC-003: non-null coordinate has no verified evidence/);
});

test("a coordinate without any evidence fails", () => {
  const { status, output } = runGate(({ readJson, writeJson }) => {
    // NTPC-AD-004 keeps its coordinate but loses its unofficial-coordinate record.
    const evidence = readJson(EVIDENCE);
    evidence.unofficialCoordinates = [];
    writeJson(EVIDENCE, evidence);
  });
  assert.equal(status, 1);
  assert.match(output, /NTPC-AD-004: non-null coordinate has no verified evidence/);
});

test("evidence attached to the wrong Provider ID fails", () => {
  const { status, output } = runGate(({ readJson, writeJson }) => {
    const evidence = readJson(EVIDENCE);
    const a = evidence.coordinates.find((item) => item.providerId === "NTPC-HC-004");
    const b = evidence.coordinates.find((item) => item.providerId === "NTPC-HC-005");
    [a.providerId, b.providerId] = [b.providerId, a.providerId];
    writeJson(EVIDENCE, evidence);
  });
  assert.equal(status, 1);
  assert.match(output, /NTPC-HC-004: evidence name differs from providers\.json/);
  assert.match(output, /NTPC-HC-004: providers\.json lat differs from the verified evidence value/);
});

test("a coordinate that differs from the evidence value fails", () => {
  const { status, output } = runGate(({ readJson, writeJson }) => {
    const providers = readJson(PROVIDERS);
    providers.find((item) => item.id === "NTPC-AD-002").lng += 0.0001;
    writeJson(PROVIDERS, providers);
  });
  assert.equal(status, 1);
  assert.match(output, /NTPC-AD-002: providers\.json lng differs from the verified evidence value/);
});

test("an evidence value not reproduced by converting the source record fails", () => {
  const { status, output } = runGate(({ readJson, writeJson }) => {
    const evidence = readJson(EVIDENCE);
    const item = evidence.coordinates.find((entry) => entry.providerId === "NTPC-HC-001");
    item.coordinate.x += 50;
    item.coordinate.record = item.coordinate.record.replace(/,[^,]+,([^,]+)$/, `,${item.coordinate.x},$1`);
    writeJson(EVIDENCE, evidence);
  });
  assert.equal(status, 1);
  assert.match(output, /NTPC-HC-001: lng is not reproduced by EPSG:3826 conversion/);
});

test("an address-point record for a different house number fails", () => {
  const { status, output } = runGate(({ readJson, writeJson }) => {
    const evidence = readJson(EVIDENCE);
    const item = evidence.coordinates.find((entry) => entry.providerId === "NTPC-HC-002");
    item.coordinate.record = item.coordinate.record.replace("１５５號", "１５７號");
    writeJson(EVIDENCE, evidence);
  });
  assert.equal(status, 1);
  assert.match(output, /NTPC-HC-002: address-point record "文化路157號" does not match the Provider address/);
});

test("evidence without an official identity check fails", () => {
  const { status, output } = runGate(({ readJson, writeJson }) => {
    const evidence = readJson(EVIDENCE);
    evidence.coordinates.find((entry) => entry.providerId === "NTPC-AD-006").identity = [];
    writeJson(EVIDENCE, evidence);
  });
  assert.equal(status, 1);
  assert.match(output, /NTPC-AD-006: missing identity evidence/);
});

test("removing service areas backed by an official source fails", () => {
  const { status, output } = runGate(({ readJson, writeJson }) => {
    writeJson(AREAS, readJson(AREAS).filter((area) => area.providerId !== "NTPC-HC-003"));
  });
  assert.equal(status, 1);
  assert.match(output, /NTPC-HC-003: ProviderServiceArea \(none\) differs from evidence/);
  assert.match(output, /NTPC-HC-003: pending list "serviceArea" does not match the data/);
});

test("a Provider without a coordinate must be on the pending list", () => {
  const { status, output } = runGate(({ readJson, writeJson }) => {
    const providers = readJson(PROVIDERS);
    const provider = providers.find((item) => item.id === "NTPC-AD-004");
    provider.lat = null;
    provider.lng = null;
    writeJson(PROVIDERS, providers);
    const evidence = readJson(EVIDENCE);
    evidence.unofficialCoordinates = [];
    writeJson(EVIDENCE, evidence);
  });
  assert.equal(status, 1);
  assert.match(output, /NTPC-AD-004: pending list "coordinate" does not match the evidence state/);
});

test("--write regenerates reports but refuses when evidence checks fail", () => {
  const fixed = runGate(({ readText, writeText }) => {
    const text = readText(REPORT);
    const changed = text.replace(/仍無座標：\d+/, "仍無座標：9");
    assert.notEqual(changed, text);
    writeText(REPORT, changed);
  }, ["--write"]);
  assert.equal(fixed.status, 0, fixed.output);
  assert.match(fixed.output, /RESULT: PASS \(reports regenerated\)/);

  const refused = runGate(({ readJson, writeJson }) => {
    const providers = readJson(PROVIDERS);
    providers.find((item) => item.id === "NTPC-AD-004").lat = 24.98;
    writeJson(PROVIDERS, providers);
  }, ["--write"]);
  assert.equal(refused.status, 1);
  assert.match(refused.output, /NTPC-AD-004: providers\.json lat differs from the unofficial coordinate/);
});

test("a non-null coordinate without evidence never makes a group READY", () => {
  const dataset = loadRealDataset();
  // TP-HC-001 keeps its lat/lng but loses its evidence.
  dataset.evidence.coordinates = dataset.evidence.coordinates.filter(
    (item) => item.providerId !== "TP-HC-001",
  );
  const { verifiedIds } = checkEvidence(dataset);
  const { groups } = computeCoverage(dataset, verifiedIds);
  const wanhua = groups.find((g) => g.serviceType === "HOME_CARE" && g.district === "萬華區");
  assert.equal(wanhua.status, "BLOCKED_MISSING_COORDINATE");
  assert.ok(wanhua.missing.includes("TP-HC-001"));
});

test("a Provider with unknown service areas blocks READY for its service type", () => {
  const dataset = loadRealDataset();
  // NTPC-HC-003 has a verified coordinate; without its areas it is a possible hidden candidate.
  dataset.areas = dataset.areas.filter((area) => area.providerId !== "NTPC-HC-003");
  const { verifiedIds } = checkEvidence(dataset);
  const { groups, byType } = computeCoverage(dataset, verifiedIds);
  const sanchong = groups.find((g) => g.serviceType === "HOME_CARE" && g.district === "三重區");
  assert.equal(sanchong.candidates.length, 2);
  assert.equal(sanchong.status, "BLOCKED_UNKNOWN_SERVICE_AREA");
  const homeCare = groups.filter((g) => g.serviceType === "HOME_CARE");
  assert.equal(homeCare.filter((g) => g.status === "READY").length, 0);
  assert.deepEqual(byType.find((t) => t.serviceType === "HOME_CARE").unknownArea, ["NTPC-HC-003"]);
});

test("evidence that fails a check does not count as verified", () => {
  const dataset = loadRealDataset();
  dataset.providers.find((item) => item.id === "TP-HC-010").lat += 0.001;
  const { errors, verifiedIds } = checkEvidence(dataset);
  assert.ok(errors.some((e) => e.startsWith("TP-HC-010: providers.json lat differs")));
  assert.ok(!verifiedIds.has("TP-HC-010"));
  const { groups } = computeCoverage(dataset, verifiedIds);
  const wanhua = groups.find((g) => g.serviceType === "HOME_CARE" && g.district === "萬華區");
  assert.equal(wanhua.status, "BLOCKED_MISSING_COORDINATE");
});

test("partially known service areas keep the whole service type out of READY", () => {
  const dataset = loadRealDataset();
  // Without TP-HMN-001's areas, it could be a hidden candidate in any district.
  dataset.areas = dataset.areas.filter((area) => area.providerId !== "TP-HMN-001");
  const { verifiedIds } = checkEvidence(dataset);
  const { groups } = computeCoverage(dataset, verifiedIds);
  const nursing = groups.filter((g) => g.serviceType === "HOME_MEDICAL_NURSING");
  assert.ok(nursing.length > 0);
  assert.ok(nursing.every((g) => g.status === "BLOCKED_UNKNOWN_SERVICE_AREA"));
});

test("an unofficial coordinate counts for coverage but never as verified", () => {
  const dataset = loadRealDataset();
  const { verifiedIds, settingAreaKeys, unofficialIds } = checkEvidence(dataset);
  assert.ok(unofficialIds.has("NTPC-AD-004"));
  assert.ok(!verifiedIds.has("NTPC-AD-004"));
  const coverage = computeCoverage(dataset, verifiedIds, settingAreaKeys, unofficialIds);
  const devices = coverage.byType.find((type) => type.serviceType === "ASSISTIVE_DEVICE");
  assert.equal(devices.groups, 0);
  assert.equal(devices.ready, 0);
  assert.ok(devices.unknownArea.includes("NTPC-AD-004"));
});

test("an unofficial coordinate without an UNOFFICIAL_COORDINATE decision fails", () => {
  const { status, output } = runGate(({ readJson, writeJson }) => {
    const evidence = readJson(EVIDENCE);
    evidence.decisions.find((item) => item.decisionId === "DEC-A003-07").settingType = "DATA_CORRECTION";
    writeJson(EVIDENCE, evidence);
  });
  assert.equal(status, 1);
  assert.match(output, /NTPC-AD-004: unofficial coordinate needs an UNOFFICIAL_COORDINATE decision/);
});

test("an unofficial coordinate cannot sit on a Provider with verified evidence", () => {
  const { status, output } = runGate(({ readJson, writeJson }) => {
    const evidence = readJson(EVIDENCE);
    const provider = readJson(PROVIDERS).find((item) => item.id === "TP-HC-001");
    evidence.unofficialCoordinates.push({
      ...evidence.unofficialCoordinates[0],
      providerId: "TP-HC-001",
      name: provider.name,
      address: provider.address,
      lat: provider.lat,
      lng: provider.lng,
    });
    writeJson(EVIDENCE, evidence);
  });
  assert.equal(status, 1);
  assert.match(output, /TP-HC-001: has both verified evidence and an unofficial coordinate/);
});

test("service-area evidence must reference a recorded decision", () => {
  const { status, output } = runGate(({ readJson, writeJson }) => {
    const evidence = readJson(EVIDENCE);
    evidence.serviceAreas[0].decisionId = "DEC-NOT-RECORDED";
    writeJson(EVIDENCE, evidence);
  });
  assert.equal(status, 1);
  assert.match(output, /decision DEC-NOT-RECORDED is not recorded/);
});

test("a conditional service-region cannot create recommendation areas", () => {
  const { status, output } = runGate(({ readJson, writeJson }) => {
    const areas = readJson(AREAS);
    areas.push({
      id: "PSA-TP-AD-001-臺北市-中山區",
      providerId: "TP-AD-001",
      city: "臺北市",
      district: "中山區",
      active: true,
    });
    writeJson(AREAS, areas);
  });
  assert.equal(status, 1);
  assert.match(output, /TP-AD-001: conditional service-region must not also create active ProviderServiceArea rows/);
});

test("a conditional service-region must reference a recorded decision", () => {
  const { status, output } = runGate(({ readJson, writeJson }) => {
    const evidence = readJson(EVIDENCE);
    evidence.conditionalServiceRegions.find((item) => item.providerId === "TP-AD-001").decisionId = "DEC-NOT-RECORDED";
    writeJson(EVIDENCE, evidence);
  });
  assert.equal(status, 1);
  assert.match(output, /TP-AD-001: decision DEC-NOT-RECORDED is not recorded/);
});

test("a wrong service-area-basis count in the report fails", () => {
  const { status, output } = runGate(({ readText, writeText }) => {
    const text = readText(REPORT);
    const changed = text.replace("| HOME_CARE | 23 | 61 | 0 | 84 |", "| HOME_CARE | 24 | 60 | 0 | 84 |");
    assert.notEqual(changed, text);
    writeText(REPORT, changed);
  });
  assert.equal(status, 1);
  assert.match(output, /section "service-area-basis" differs from the data/);
});

test("conditional service-regions never generate recommendation candidates", () => {
  const dataset = loadRealDataset();
  const { verifiedIds, settingAreaKeys } = checkEvidence(dataset);
  const { groups, byType } = computeCoverage(dataset, verifiedIds, settingAreaKeys);
  const nursing = groups.filter((g) => g.serviceType === "HOME_MEDICAL_NURSING");
  assert.ok(nursing.every((group) => group.status === "BLOCKED_UNKNOWN_SERVICE_AREA"));
  assert.equal(groups.filter((group) => group.serviceType === "ASSISTIVE_DEVICE").length, 0);
  assert.equal(byType.find((type) => type.serviceType === "ASSISTIVE_DEVICE").ready, 0);
});
