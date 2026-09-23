// Regression tests for the Provider Validation Gate (TASK-A-004).
// Run: node --test data/providers/qa/tests/
// Uses temporary dataset directories only; never touches a database.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const validator = path.resolve(__dirname, "../validate-providers.mjs");
const stagingDir = path.resolve(__dirname, "../../staging");

function baseProvider(overrides = {}) {
  return {
    id: "TEST-PROV-001",
    name: "A-004 測試居家長照機構",
    type: "HOME_CARE",
    address: "臺北市中山區測試路1號",
    city: "臺北市",
    district: "中山區",
    lat: null,
    lng: null,
    phone: "02-0000-0000",
    website: null,
    googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=test",
    status: "ACTIVE",
    verified: true,
    ...overrides,
  };
}

function baseService(overrides = {}) {
  return {
    id: "PSV-TEST-PROV-001-HOME_CARE",
    providerId: "TEST-PROV-001",
    serviceType: "HOME_CARE",
    active: true,
    ...overrides,
  };
}

function baseArea(overrides = {}) {
  return {
    id: "TEST-PROV-001-SA-001",
    providerId: "TEST-PROV-001",
    city: "臺北市",
    district: "中山區",
    active: true,
    ...overrides,
  };
}

function runGate({
  providers = [baseProvider()],
  services = [baseService()],
  serviceAreas = [baseArea()],
} = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kareo-a004-"));

  try {
    fs.writeFileSync(path.join(dir, "providers.json"), JSON.stringify(providers));
    fs.writeFileSync(path.join(dir, "provider-services.json"), JSON.stringify(services));
    fs.writeFileSync(
      path.join(dir, "provider-service-areas.json"),
      JSON.stringify(serviceAreas),
    );

    const result = spawnSync(process.execPath, [validator, dir], { encoding: "utf8" });
    return { status: result.status, output: result.stdout + result.stderr };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function withoutField(record, field) {
  const copy = { ...record };
  delete copy[field];
  return copy;
}

function assertFails(result, pattern) {
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /RESULT: FAIL/);
  assert.match(result.output, pattern);
}

test("minimal valid dataset passes", () => {
  const result = runGate();
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /RESULT: PASS/);
});

test("ProviderService active=false is a valid record", () => {
  const result = runGate({ services: [baseService({ active: false })] });
  assert.equal(result.status, 0, result.output);
});

test("ProviderService missing id fails", () => {
  assertFails(
    runGate({ services: [withoutField(baseService(), "id")] }),
    /\[provider-services\.json\] record #0 .*field "id": required non-empty string/,
  );
});

test("ProviderService empty or whitespace id fails", () => {
  assertFails(runGate({ services: [baseService({ id: "" })] }), /field "id"/);
  assertFails(runGate({ services: [baseService({ id: "PSV 001" })] }), /field "id": must not contain whitespace/);
  assertFails(runGate({ services: [baseService({ id: 123 })] }), /field "id": required non-empty string \(got 123\)/);
});

test("ProviderService duplicate id fails", () => {
  const result = runGate({
    providers: [baseProvider(), baseProvider({ id: "TEST-PROV-002" })],
    services: [
      baseService(),
      baseService({ providerId: "TEST-PROV-002" }),
    ],
  });
  assertFails(result, /record #1 .*field "id": duplicate id \(first used by record #0\)/);
});

test("same id across different tables is allowed (uniqueness is per table)", () => {
  const result = runGate({ serviceAreas: [baseArea({ id: "PSV-TEST-PROV-001-HOME_CARE" })] });
  assert.equal(result.status, 0, result.output);
});

test("ProviderService missing active fails", () => {
  assertFails(
    runGate({ services: [withoutField(baseService(), "active")] }),
    /\[provider-services\.json\] record #0 .*field "active": must be boolean true\/false \(got undefined\)/,
  );
});

test("ProviderService non-boolean active fails", () => {
  for (const active of ["true", 1, 0, null, "false"]) {
    assertFails(
      runGate({ services: [baseService({ active })] }),
      /field "active": must be boolean/,
    );
  }
});

test("ProviderService unknown providerId fails", () => {
  assertFails(
    runGate({ services: [baseService({ providerId: "NOPE-001" })] }),
    /field "providerId": references missing Provider "NOPE-001"/,
  );
});

test("ProviderService referencing an invalid Provider fails", () => {
  assertFails(
    runGate({ providers: [baseProvider({ status: "BROKEN" })] }),
    /\[provider-services\.json\] .*field "providerId": references Provider "TEST-PROV-001" that failed validation/,
  );
});

test("ProviderService invalid serviceType fails, including OTHER and TRANSPORTATION", () => {
  for (const serviceType of ["OTHER", "TRANSPORTATION", "home_care", undefined]) {
    assertFails(
      runGate({ services: [baseService({ serviceType })] }),
      /field "serviceType": invalid serviceType/,
    );
  }
});

test("duplicate providerId/serviceType pair fails", () => {
  const result = runGate({ services: [baseService(), baseService({ id: "PSV-OTHER-ID" })] });
  assertFails(result, /duplicate providerId\/serviceType pair/);
});

test("Provider type OTHER passes (DATA_MODEL §17)", () => {
  const result = runGate({ providers: [baseProvider({ type: "OTHER" })] });
  assert.equal(result.status, 0, result.output);
});

test("Provider type TRANSPORTATION fails", () => {
  assertFails(
    runGate({ providers: [baseProvider({ type: "TRANSPORTATION" })] }),
    /\[providers\.json\] record #0 .*field "type": invalid Provider type "TRANSPORTATION"/,
  );
});

test("Provider verified must be boolean (same as B-004)", () => {
  assertFails(
    runGate({ providers: [withoutField(baseProvider(), "verified")] }),
    /field "verified": must be boolean/,
  );
});

test("ProviderServiceArea active=false passes and missing active fails", () => {
  assert.equal(runGate({ serviceAreas: [baseArea({ active: false })] }).status, 0);
  assertFails(
    runGate({ serviceAreas: [withoutField(baseArea(), "active")] }),
    /\[provider-service-areas\.json\] record #0 .*field "active"/,
  );
});

test("unreadable dataset fails with non-zero exit", () => {
  const result = spawnSync(process.execPath, [validator, path.join(os.tmpdir(), "kareo-a004-missing-dir", "x.json")], {
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /unable to read or parse JSON/);
});

test("formal ProviderService ids follow the reproducible rule PSV-{providerId}-{serviceType}", () => {
  const services = JSON.parse(
    fs.readFileSync(path.join(stagingDir, "provider-services.json"), "utf8"),
  );

  for (const service of services) {
    assert.equal(service.id, `PSV-${service.providerId}-${service.serviceType}`);
  }
});
