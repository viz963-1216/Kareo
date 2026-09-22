import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fixturePath = process.argv[2];
const stagingDir = path.resolve(__dirname, "../staging");

const fixtureDir = fixturePath
  ? path.dirname(path.resolve(fixturePath))
  : null;

const files = {
  providers: fixturePath
    ? path.resolve(fixturePath)
    : path.join(stagingDir, "providers.json"),

  services: fixtureDir
    ? path.join(fixtureDir, "provider-services-invalid.json")
    : path.join(stagingDir, "provider-services.json"),

  serviceAreas: fixtureDir
    ? path.join(fixtureDir, "provider-service-areas-invalid.json")
    : path.join(stagingDir, "provider-service-areas.json"),
};

const errors = [];
const warnings = [];

function addError(message) {
  errors.push(message);
}

function addWarning(message) {
  warnings.push(message);
}

function loadJson(filePath, label) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(content);

    if (!Array.isArray(data)) {
      addError(`${label}: root value must be an array.`);
      return [];
    }

    return data;
  } catch (error) {
    addError(`${label}: unable to read or parse JSON - ${error.message}`);
    return [];
  }
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function checkRequiredFields(record, fields, label) {
  for (const field of fields) {
    if (
      record[field] === undefined ||
      record[field] === null ||
      record[field] === ""
    ) {
      addError(`${label}: missing required field "${field}".`);
    }
  }
}

function checkDuplicateValues(records, field, label) {
  const seen = new Set();

  for (const record of records) {
    const value = record[field];

    if (value === undefined || value === null || value === "") {
      continue;
    }

    if (seen.has(value)) {
      addError(`${label}: duplicate ${field} "${value}".`);
    }

    seen.add(value);
  }
}

function isValidUrl(value) {
  if (value === null || value === undefined || value === "") {
    return true;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidPhone(value) {
  if (value === null || value === undefined || value === "") {
    return true;
  }

  if (typeof value !== "string") {
    return false;
  }

  return /^[0-9()+\-–—\s、轉#]+$/.test(value);
}

function validateCoordinate(value, min, max) {
  if (value === null || value === undefined) {
    return true;
  }

  return typeof value === "number" && value >= min && value <= max;
}

console.log("=== Kareo Provider Validation Gate ===");
console.log("");

const providers = loadJson(files.providers, "providers.json");
const services = loadJson(files.services, "provider-services.json");
const serviceAreas = loadJson(
  files.serviceAreas,
  "provider-service-areas.json",
);

console.log(`Providers: ${providers.length}`);
console.log(`Provider Services: ${services.length}`);
console.log(`Provider Service Areas: ${serviceAreas.length}`);
console.log("");

const providerIds = new Set(providers.map((provider) => provider.id));

const allowedProviderTypes = new Set([
  "HOME_CARE",
  "HOME_MEDICAL_NURSING",
  "ASSISTIVE_DEVICE",
]);

const allowedProviderStatuses = new Set([
  "ACTIVE",
  "INACTIVE",
  "UNKNOWN",
]);

for (const provider of providers) {
  const label = `Provider ${provider.id ?? "UNKNOWN"}`;

  checkRequiredFields(
    provider,
    ["id", "name", "type", "address", "city", "district", "status"],
    label,
  );

  if (
    provider.type !== undefined &&
    !allowedProviderTypes.has(provider.type)
  ) {
    addError(`${label}: invalid provider type "${provider.type}".`);
  }

  if (
    provider.status !== undefined &&
    !allowedProviderStatuses.has(provider.status)
  ) {
    addError(`${label}: invalid status "${provider.status}".`);
  }

  if (!validateCoordinate(provider.lat, -90, 90)) {
    addError(`${label}: invalid latitude "${provider.lat}".`);
  }

  if (!validateCoordinate(provider.lng, -180, 180)) {
    addError(`${label}: invalid longitude "${provider.lng}".`);
  }

  if (!isValidUrl(provider.website)) {
    addError(`${label}: invalid website URL "${provider.website}".`);
  }

  if (!isValidUrl(provider.googleMapsUrl)) {
    addError(
      `${label}: invalid Google Maps URL "${provider.googleMapsUrl}".`,
    );
  }

  if (!isValidPhone(provider.phone)) {
    addError(`${label}: invalid phone format "${provider.phone}".`);
  }

  if (
    isNonEmptyString(provider.address) &&
    isNonEmptyString(provider.city) &&
    !provider.address.includes(provider.city)
  ) {
    addError(
      `${label}: address does not contain city "${provider.city}".`,
    );
  }

  if (
    isNonEmptyString(provider.address) &&
    isNonEmptyString(provider.district) &&
    !provider.address.includes(provider.district)
  ) {
    addError(
      `${label}: address does not contain district "${provider.district}".`,
    );
  }
}

checkDuplicateValues(providers, "id", "Provider");

for (const service of services) {
  const label = `ProviderService ${service.providerId ?? "UNKNOWN"}`;

  checkRequiredFields(service, ["providerId", "serviceType"], label);

  if (
    service.providerId &&
    !providerIds.has(service.providerId)
  ) {
    addError(
      `${label}: references missing Provider "${service.providerId}".`,
    );
  }

  if (
    service.serviceType !== undefined &&
    !allowedProviderTypes.has(service.serviceType)
  ) {
    addError(
      `${label}: invalid serviceType "${service.serviceType}".`,
    );
  }
}

const providerServicePairs = new Set();

for (const service of services) {
  const pair = `${service.providerId}::${service.serviceType}`;

  if (providerServicePairs.has(pair)) {
    addError(`ProviderService: duplicate pair "${pair}".`);
  }

  providerServicePairs.add(pair);
}

for (const area of serviceAreas) {
  const label = `ProviderServiceArea ${area.id ?? "UNKNOWN"}`;

  checkRequiredFields(
    area,
    ["id", "providerId", "city", "district", "active"],
    label,
  );

  if (
    area.providerId &&
    !providerIds.has(area.providerId)
  ) {
    addError(
      `${label}: references missing Provider "${area.providerId}".`,
    );
  }

  if (typeof area.active !== "boolean") {
    addError(`${label}: "active" must be boolean.`);
  }
}

checkDuplicateValues(
  serviceAreas,
  "id",
  "ProviderServiceArea",
);

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