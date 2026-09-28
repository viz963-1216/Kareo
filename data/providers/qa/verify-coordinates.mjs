import fs from "node:fs";

const stagingDir = new URL("../staging/", import.meta.url);
const readJson = (file) =>
  JSON.parse(fs.readFileSync(new URL(file, stagingDir), "utf8"));

const evidence = [
  {
    providerId: "NTPC-HC-004",
    sourceDataset: "新北市門牌位置數值資料 11509",
    sourceUrl:
      "https://data.ntpc.gov.tw/api/datasets/d7b568ab-3819-40c8-a6e7-a6b199443101/csv/file",
    record:
      "65000,65000020,溪美里,010,福隆路,,,,４８號,299673.374200,2774565.5731000",
    sourceCrs: "EPSG:3826",
    x: 299673.3742,
    y: 2774565.5731,
    expected: { lat: 25.07852424, lng: 121.49241746 },
  },
  {
    providerId: "NTPC-HC-005",
    sourceDataset: "新北市門牌位置數值資料 11509",
    sourceUrl:
      "https://data.ntpc.gov.tw/api/datasets/d7b568ab-3819-40c8-a6e7-a6b199443101/csv/file",
    record:
      "65000,65000020,長江里,016,長元街,,,,１００之２號,300752.019217,2773265.3017167",
    sourceCrs: "EPSG:3826",
    x: 300752.019217,
    y: 2773265.3017167,
    expected: { lat: 25.06674961, lng: 121.50306191 },
  },
];

function twd97Tm2Zone121ToWgs84(x, y) {
  // EPSG:3826 (TWD97 / TM2 zone 121) inverse projection on GRS80.
  const a = 6378137;
  const b = 6356752.314245;
  const k0 = 0.9999;
  const falseEasting = 250000;
  const lon0 = (121 * Math.PI) / 180;
  const e = Math.sqrt(1 - (b * b) / (a * a));
  const ePrimeSquared = (e * e) / (1 - e * e);
  const e1 = (1 - Math.sqrt(1 - e * e)) / (1 + Math.sqrt(1 - e * e));
  const m = y / k0;
  const mu = m / (a * (1 - e ** 2 / 4 - (3 * e ** 4) / 64 - (5 * e ** 6) / 256));
  const fp =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);
  const sinFp = Math.sin(fp);
  const cosFp = Math.cos(fp);
  const tanFp = Math.tan(fp);
  const c1 = ePrimeSquared * cosFp ** 2;
  const t1 = tanFp ** 2;
  const n1 = a / Math.sqrt(1 - e * e * sinFp ** 2);
  const r1 = (a * (1 - e * e)) / (1 - e * e * sinFp ** 2) ** 1.5;
  const d = (x - falseEasting) / (n1 * k0);
  const lat =
    fp -
    (n1 * tanFp *
      (d ** 2 / 2 -
        ((5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * ePrimeSquared) * d ** 4) / 24 +
        ((61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * ePrimeSquared - 3 * c1 ** 2) *
          d ** 6) /
          720)) /
      r1;
  const lng =
    lon0 +
    (d -
      ((1 + 2 * t1 + c1) * d ** 3) / 6 +
      ((5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * ePrimeSquared + 24 * t1 ** 2) * d ** 5) /
        120) /
      cosFp;
  return { lat: (lat * 180) / Math.PI, lng: (lng * 180) / Math.PI };
}

const providers = readJson("providers.json");
const services = readJson("provider-services.json");
const areas = readJson("provider-service-areas.json");
const report = fs.readFileSync(
  new URL("verified-coordinates-report.md", import.meta.url),
  "utf8",
);
const providersById = new Map(providers.map((provider) => [provider.id, provider]));

for (const provider of providers) {
  const row = report
    .split("\n")
    .find((line) => line.startsWith(`| ${provider.id} |`));
  if (!row) throw new Error(`${provider.id}: verification report row is missing.`);
  const cells = row.split("|").map((cell) => cell.trim());
  if (cells[4] !== String(provider.lat) || cells[5] !== String(provider.lng)) {
    throw new Error(`${provider.id}: verification report coordinates differ from providers.json.`);
  }
}

for (const item of evidence) {
  const provider = providersById.get(item.providerId);
  if (!provider) throw new Error(`missing provider: ${item.providerId}`);
  const transformed = twd97Tm2Zone121ToWgs84(item.x, item.y);
  for (const key of ["lat", "lng"]) {
    if (Math.abs(transformed[key] - item.expected[key]) > 1e-8) {
      throw new Error(`${item.providerId}: ${key} conversion differs from recorded WGS84 value.`);
    }
    if (provider[key] !== item.expected[key]) {
      throw new Error(`${item.providerId}: providers.json ${key} differs from verified evidence.`);
    }
  }
}

const evidenceIds = new Set(evidence.map((item) => item.providerId));
for (const provider of providers) {
  const hasCoordinate = provider.lat !== null || provider.lng !== null;
  if (hasCoordinate && (provider.lat === null || provider.lng === null || !evidenceIds.has(provider.id))) {
    throw new Error(`${provider.id}: non-null coordinate lacks complete verified evidence.`);
  }
}

const activeServices = services.filter((service) => service.active);
const groups = new Map();
for (const area of areas.filter((item) => item.active)) {
  const provider = providersById.get(area.providerId);
  if (!provider || provider.status !== "ACTIVE") continue;
  for (const service of activeServices.filter((item) => item.providerId === area.providerId)) {
    const key = `${service.serviceType}|${area.city}|${area.district}`;
    const candidates = groups.get(key) ?? new Map();
    candidates.set(provider.id, provider);
    groups.set(key, candidates);
  }
}

const readyKeys = [
  "HOME_CARE|新北市|三重區",
  "HOME_CARE|新北市|土城區",
  "HOME_CARE|新北市|五股區",
  "HOME_CARE|新北市|新店區",
  "HOME_CARE|新北市|新莊區",
  "HOME_CARE|新北市|泰山區",
  "HOME_CARE|新北市|蘆洲區",
];
for (const key of readyKeys) {
  const candidates = [...(groups.get(key)?.values() ?? [])];
  const verified = candidates.filter((provider) => provider.lat !== null && provider.lng !== null);
  if (candidates.length === 0 || verified.length !== candidates.length) {
    throw new Error(`${key}: not a complete verified DISTANCE candidate group.`);
  }
}

for (const [key, candidateMap] of groups) {
  const [serviceType, city, district] = key.split("|");
  if (serviceType !== "HOME_CARE") continue;
  const candidates = [...candidateMap.values()];
  const verified = candidates.filter(
    (provider) => provider.lat !== null && provider.lng !== null,
  ).length;
  const status = verified === candidates.length ? "READY" : "BLOCKED";
  const expectedCoverage = `| ${serviceType} | ${city} | ${district} | ${verified}／${candidates.length} | ${status} |`;
  if (!report.includes(expectedCoverage)) {
    throw new Error(`${key}: verification report coverage differs from candidate data.`);
  }
}

const nonNullCoordinates = providers.filter(
  (provider) => provider.lat !== null && provider.lng !== null,
).length;
console.log({
  providers: providers.length,
  verifiedCoordinateProviders: nonNullCoordinates,
  evidenceRecords: evidence.length,
  readyDistanceGroups: readyKeys,
});
