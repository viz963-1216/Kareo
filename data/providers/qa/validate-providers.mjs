// Kareo Provider Validation Gate (TASK-A-004)
//
// Usage:
//   node data/providers/qa/validate-providers.mjs                # formal dataset in data/providers/staging
//   node data/providers/qa/validate-providers.mjs <datasetDir>   # providers.json / provider-services.json / provider-service-areas.json
//   node data/providers/qa/validate-providers.mjs <providers-invalid.json>
//        # legacy fixture mode: sibling provider-services-invalid.json / provider-service-areas-invalid.json
//
// Exit code: 0 = PASS (no errors), 1 = FAIL (any error, including unreadable input).
//
// Rules follow docs/DATA_MODEL.md §17–19, §32 and the B-004 import validator
// (apps/api/src/services/providerImportService.ts). Anything B-004 rejects must fail here too.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FILE_NAMES = {
  providers: "providers.json",
  services: "provider-services.json",
  serviceAreas: "provider-service-areas.json",
};

// DATA_MODEL §17: Provider Type allows OTHER.
const PROVIDER_TYPES = new Set([
  "HOME_CARE",
  "HOME_MEDICAL_NURSING",
  "ASSISTIVE_DEVICE",
  "OTHER",
]);

// DATA_MODEL §18: ProviderService.serviceType has only the three services (no OTHER).
const PROVIDER_SERVICE_TYPES = new Set([
  "HOME_CARE",
  "HOME_MEDICAL_NURSING",
  "ASSISTIVE_DEVICE",
]);

const PROVIDER_STATUSES = new Set(["ACTIVE", "INACTIVE", "UNKNOWN"]);

function resolveFiles(target) {
  if (!target) {
    const dir = path.resolve(__dirname, "../staging");
    return {
      providers: path.join(dir, FILE_NAMES.providers),
      services: path.join(dir, FILE_NAMES.services),
      serviceAreas: path.join(dir, FILE_NAMES.serviceAreas),
    };
  }

  const resolved = path.resolve(target);

  if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
    return {
      providers: path.join(resolved, FILE_NAMES.providers),
      services: path.join(resolved, FILE_NAMES.services),
      serviceAreas: path.join(resolved, FILE_NAMES.serviceAreas),
    };
  }

  const dir = path.dirname(resolved);
  return {
    providers: resolved,
    services: path.join(dir, "provider-services-invalid.json"),
    serviceAreas: path.join(dir, "provider-service-areas-invalid.json"),
  };
}

const files = resolveFiles(process.argv[2]);

const errors = [];
const warnings = [];

function describeRecord(index, record) {
  if (index === null) {
    return "";
  }

  const parts = [];

  if (record && typeof record === "object") {
    if (record.id !== undefined) parts.push(`id=${JSON.stringify(record.id)}`);
    if (record.providerId !== undefined) {
      parts.push(`providerId=${JSON.stringify(record.providerId)}`);
    }
  }

  return ` record #${index}${parts.length ? ` (${parts.join(", ")})` : ""}`;
}

function addError(file, index, record, field, message) {
  const fieldText = field ? ` field "${field}"` : "";
  errors.push(
    `[${path.basename(file)}]${describeRecord(index, record)}${fieldText}: ${message}`,
  );
}

function addWarning(message) {
  warnings.push(message);
}

function show(value) {
  return value === undefined ? "undefined" : JSON.stringify(value);
}

function loadJson(filePath) {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

    if (!Array.isArray(data)) {
      addError(filePath, null, null, null, "root value must be an array.");
      return [];
    }

    return data;
  } catch (error) {
    addError(
      filePath,
      null,
      null,
      null,
      `unable to read or parse JSON - ${error.message}`,
    );
    return [];
  }
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidUrl(value) {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value !== "string") {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidPhone(value) {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value !== "string") {
    return false;
  }

  return /^[0-9()+\-–—\s、轉#]+$/.test(value);
}

function isValidCoordinate(value, min, max) {
  if (value === null || value === undefined) {
    return true;
  }

  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
  );
}

// Validates each record and returns the number of errors it produced.
function validateRecords(file, records, validate) {
  const results = [];

  records.forEach((record, index) => {
    const before = errors.length;

    if (record === null || typeof record !== "object" || Array.isArray(record)) {
      addError(file, index, null, null, "record must be a JSON object.");
    } else {
      validate(record, index);
    }

    results.push({ record, index, ok: errors.length === before });
  });

  return results;
}

function checkRequiredString(file, index, record, field) {
  if (!isNonEmptyString(record[field])) {
    addError(
      file,
      index,
      record,
      field,
      `required non-empty string (got ${show(record[field])}).`,
    );
    return false;
  }

  return true;
}

// DATA_MODEL §32: IDs may use a debug prefix (PROV-/PSV-/PSA-) or UUID; the format is
// therefore a non-empty string without whitespace.
function checkId(file, index, record) {
  if (!checkRequiredString(file, index, record, "id")) {
    return;
  }

  if (!/^\S+$/.test(record.id)) {
    addError(
      file,
      index,
      record,
      "id",
      `must not contain whitespace (got ${show(record.id)}).`,
    );
  }
}

function checkBoolean(file, index, record, field) {
  if (typeof record[field] !== "boolean") {
    addError(
      file,
      index,
      record,
      field,
      `must be boolean true/false (got ${show(record[field])}).`,
    );
  }
}

// Uniqueness is per table (each table's id is its own primary key).
function checkDuplicateIds(file, records) {
  const firstIndex = new Map();

  records.forEach((record, index) => {
    if (!record || typeof record !== "object" || !isNonEmptyString(record.id)) {
      return;
    }

    if (firstIndex.has(record.id)) {
      addError(
        file,
        index,
        record,
        "id",
        `duplicate id (first used by record #${firstIndex.get(record.id)}).`,
      );
      return;
    }

    firstIndex.set(record.id, index);
  });
}

function checkProviderReference(file, index, record, providerIds, validProviderIds) {
  if (!checkRequiredString(file, index, record, "providerId")) {
    return;
  }

  if (!providerIds.has(record.providerId)) {
    addError(
      file,
      index,
      record,
      "providerId",
      `references missing Provider ${show(record.providerId)}.`,
    );
  } else if (!validProviderIds.has(record.providerId)) {
    addError(
      file,
      index,
      record,
      "providerId",
      `references Provider ${show(record.providerId)} that failed validation.`,
    );
  }
}

console.log("=== Kareo Provider Validation Gate ===");
console.log("");

const providers = loadJson(files.providers);
const services = loadJson(files.services);
const serviceAreas = loadJson(files.serviceAreas);

console.log(`Providers: ${providers.length}`);
console.log(`Provider Services: ${services.length}`);
console.log(`Provider Service Areas: ${serviceAreas.length}`);
console.log("");

// --- Provider (DATA_MODEL §17) ---

const providerResults = validateRecords(files.providers, providers, (provider, index) => {
  const file = files.providers;

  checkId(file, index, provider);

  for (const field of ["name", "address", "city", "district"]) {
    checkRequiredString(file, index, provider, field);
  }

  if (!PROVIDER_TYPES.has(provider.type)) {
    addError(file, index, provider, "type", `invalid Provider type ${show(provider.type)}.`);
  }

  if (!PROVIDER_STATUSES.has(provider.status)) {
    addError(file, index, provider, "status", `invalid status ${show(provider.status)}.`);
  }

  checkBoolean(file, index, provider, "verified");

  if (!isValidCoordinate(provider.lat, -90, 90)) {
    addError(file, index, provider, "lat", `invalid latitude ${show(provider.lat)}.`);
  }

  if (!isValidCoordinate(provider.lng, -180, 180)) {
    addError(file, index, provider, "lng", `invalid longitude ${show(provider.lng)}.`);
  }

  if (!isValidUrl(provider.website)) {
    addError(file, index, provider, "website", `invalid URL ${show(provider.website)}.`);
  }

  if (!isValidUrl(provider.googleMapsUrl)) {
    addError(
      file,
      index,
      provider,
      "googleMapsUrl",
      `invalid URL ${show(provider.googleMapsUrl)}.`,
    );
  }

  if (!isValidPhone(provider.phone)) {
    addError(file, index, provider, "phone", `invalid phone format ${show(provider.phone)}.`);
  }

  if (
    isNonEmptyString(provider.address) &&
    isNonEmptyString(provider.city) &&
    !provider.address.includes(provider.city)
  ) {
    addError(
      file,
      index,
      provider,
      "city",
      `address does not contain city ${show(provider.city)}.`,
    );
  }

  if (
    isNonEmptyString(provider.address) &&
    isNonEmptyString(provider.district) &&
    !provider.address.includes(provider.district)
  ) {
    addError(
      file,
      index,
      provider,
      "district",
      `address does not contain district ${show(provider.district)}.`,
    );
  }
});

checkDuplicateIds(files.providers, providers);

const providerIds = new Set(
  providers
    .filter((provider) => provider && isNonEmptyString(provider.id))
    .map((provider) => provider.id),
);

// Same as B-004: children may only reference Providers that pass validation.
const validProviderIds = new Set(
  providerResults
    .filter((result) => result.ok)
    .map((result) => result.record.id),
);

// --- ProviderService (DATA_MODEL §18) ---

validateRecords(files.services, services, (service, index) => {
  const file = files.services;

  checkId(file, index, service);
  checkProviderReference(file, index, service, providerIds, validProviderIds);

  if (!PROVIDER_SERVICE_TYPES.has(service.serviceType)) {
    addError(
      file,
      index,
      service,
      "serviceType",
      `invalid serviceType ${show(service.serviceType)}.`,
    );
  }

  checkBoolean(file, index, service, "active");
});

checkDuplicateIds(files.services, services);

const providerServicePairs = new Map();

services.forEach((service, index) => {
  if (
    !service ||
    typeof service !== "object" ||
    !isNonEmptyString(service.providerId) ||
    !isNonEmptyString(service.serviceType)
  ) {
    return;
  }

  const pair = `${service.providerId}::${service.serviceType}`;

  if (providerServicePairs.has(pair)) {
    addError(
      files.services,
      index,
      service,
      "serviceType",
      `duplicate providerId/serviceType pair "${pair}" (first used by record #${providerServicePairs.get(pair)}).`,
    );
    return;
  }

  providerServicePairs.set(pair, index);
});

// --- ProviderServiceArea (DATA_MODEL §19) ---

validateRecords(files.serviceAreas, serviceAreas, (area, index) => {
  const file = files.serviceAreas;

  checkId(file, index, area);
  checkProviderReference(file, index, area, providerIds, validProviderIds);
  checkRequiredString(file, index, area, "city");
  checkRequiredString(file, index, area, "district");
  checkBoolean(file, index, area, "active");
});

checkDuplicateIds(files.serviceAreas, serviceAreas);

console.log("=== Validation Result ===");

if (warnings.length > 0) {
  console.log("");
  console.log(`Warnings (${warnings.length}):`);

  for (const warning of warnings) {
    console.log(`WARN: ${warning}`);
  }
}

if (errors.length > 0) {
  console.log("");
  console.log(`Errors (${errors.length}):`);

  for (const error of errors) {
    console.log(`ERROR: ${error}`);
  }

  console.log("");
  console.log("RESULT: FAIL");

  process.exitCode = 1;
} else {
  console.log("");
  console.log("Errors: 0");
  console.log("RESULT: PASS");

  process.exitCode = 0;
}
