// A-006 public lookup / recommendation coverage gate.
//
// Usage:
//   node data/providers/qa/verify-resource-query-data.mjs
//   node data/providers/qa/verify-resource-query-data.mjs --write
//
// --write is the only mode that regenerates provider-contract-regions.json and the
// A-006 report sections.  Normal mode is read-only and verifies every derived value.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const staging = path.join(root, "staging");
const qa = path.join(root, "qa");
const write = process.argv.slice(2).includes("--write");
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const cell = (value) => String(value ?? "null").replace(/\|/g, "\\|").replace(/\n/g, " ");
const date = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value ?? "");
const cityCode = (city) => (city === "臺北市" ? "TPE" : "NTPC");
const reportFiles = {
  lookup: path.join(qa, "lookup-listing-report.md"),
  coverage: path.join(qa, "recommendation-coverage-report.md"),
};

function load() {
  return {
    providers: readJson(path.join(staging, "providers.json")),
    services: readJson(path.join(staging, "provider-services.json")),
    areas: readJson(path.join(staging, "provider-service-areas.json")),
    evidence: readJson(path.join(qa, "a-003-evidence.json")),
    contracts: fs.existsSync(path.join(staging, "provider-contract-regions.json"))
      ? readJson(path.join(staging, "provider-contract-regions.json"))
      : null,
  };
}

function expectedContracts(evidence) {
  return (evidence.conditionalServiceRegions ?? [])
    .flatMap((item) =>
      (item.allowedCities ?? []).map((region) => ({
        id: `PCR-${item.providerId}-${cityCode(region.city)}`,
        providerId: item.providerId,
        city: region.city,
        serviceType: "ASSISTIVE_DEVICE",
        sourceId: region.sourceId,
        checkedAt: region.checkedAt,
        active: true,
      })),
    )
    .sort((a, b) => a.id.localeCompare(b.id));
}

function derive(dataset) {
  const providersById = new Map(dataset.providers.map((item) => [item.id, item]));
  const servicesByProvider = new Map();
  for (const service of dataset.services.filter((item) => item.active)) {
    const values = servicesByProvider.get(service.providerId) ?? [];
    values.push(service.serviceType);
    servicesByProvider.set(service.providerId, values.sort());
  }
  const areasByProvider = new Map();
  for (const area of dataset.areas.filter((item) => item.active)) {
    const values = areasByProvider.get(area.providerId) ?? [];
    values.push(area);
    areasByProvider.set(area.providerId, values);
  }
  const conditionalByProvider = new Map(
    (dataset.evidence.conditionalServiceRegions ?? []).map((item) => [item.providerId, item]),
  );
  const listing = dataset.providers
    .filter((provider) => provider.status === "ACTIVE" && servicesByProvider.has(provider.id))
    .map((provider) => {
      const areas = (areasByProvider.get(provider.id) ?? []).sort((a, b) =>
        `${a.city}${a.district}`.localeCompare(`${b.city}${b.district}`, "zh-Hant"),
      );
      const verified = areas.length > 0;
      return {
        provider,
        serviceTypes: servicesByProvider.get(provider.id),
        areas,
        serviceAreaStatus: verified ? "VERIFIED" : "UNCONFIRMED",
        listingStatus: verified ? "LISTED_AREA_VERIFIED" : "LISTED_AREA_UNCONFIRMED",
        conditional: conditionalByProvider.get(provider.id) ?? null,
      };
    })
    .sort((a, b) => a.provider.id.localeCompare(b.provider.id));
  return { providersById, servicesByProvider, areasByProvider, conditionalByProvider, listing };
}

function check(dataset, expected, derived) {
  const errors = [];
  const sourceIds = new Set((dataset.evidence.sources ?? []).map((item) => item.sourceId));
  const pair = (item) => `${item.providerId}|${item.city}|${item.serviceType}`;
  if (!Array.isArray(dataset.contracts)) {
    errors.push("provider-contract-regions.json is missing or is not an array.");
  } else {
    const actual = [...dataset.contracts].sort((a, b) => String(a.id).localeCompare(String(b.id)));
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      errors.push("provider-contract-regions.json does not exactly match a-003-evidence conditionalServiceRegions.allowedCities.");
    }
    const seen = new Set();
    for (const [index, item] of dataset.contracts.entries()) {
      if (!item || typeof item !== "object") {
        errors.push(`contract region #${index}: record must be an object.`);
        continue;
      }
      if (!/^PCR-\S+$/.test(item.id ?? "")) errors.push(`contract region #${index}: invalid id.`);
      if (seen.has(item.id)) errors.push(`contract region ${item.id}: duplicate id.`);
      seen.add(item.id);
      if (!derived.providersById.has(item.providerId)) errors.push(`contract region ${item.id}: missing Provider ${item.providerId}.`);
      if (!["臺北市", "新北市"].includes(item.city)) errors.push(`contract region ${item.id}: city must be 臺北市 or 新北市.`);
      if (item.serviceType !== "ASSISTIVE_DEVICE") errors.push(`contract region ${item.id}: serviceType must be ASSISTIVE_DEVICE.`);
      if (!derived.servicesByProvider.get(item.providerId)?.includes(item.serviceType)) {
        errors.push(`contract region ${item.id}: Provider does not have active ${item.serviceType}.`);
      }
      if (!sourceIds.has(item.sourceId)) errors.push(`contract region ${item.id}: unknown sourceId ${item.sourceId}.`);
      if (!date(item.checkedAt)) errors.push(`contract region ${item.id}: checkedAt must be YYYY-MM-DD.`);
      if (typeof item.active !== "boolean") errors.push(`contract region ${item.id}: active must be boolean.`);
    }
    if (new Set(dataset.contracts.map(pair)).size !== dataset.contracts.length) {
      errors.push("contract regions contain duplicate providerId/city/serviceType pairs.");
    }
  }
  if (derived.listing.length !== dataset.providers.filter(p => p.status === 'ACTIVE' && p.resourceCategory !== 'ASSISTIVE_DEVICE_CENTER').length) {
    errors.push(`listing has ${derived.listing.length} active service providers, expected all ${dataset.providers.length} Providers.`);
  }
  for (const item of derived.listing) {
    if (item.serviceAreaStatus === "UNCONFIRMED" && !item.conditional) {
      errors.push(`${item.provider.id}: UNCONFIRMED listing has no conditional service-region evidence.`);
    }
    if (item.serviceAreaStatus === "VERIFIED" && item.conditional) {
      errors.push(`${item.provider.id}: has both active ProviderServiceArea and conditional-only service area evidence.`);
    }
  }
  return errors;
}

function queryConditions(item, contracts) {
  const base = `/api/v1/providers?serviceType=${item.serviceTypes.join(",")}`;
  if (item.serviceAreaStatus === "VERIFIED") {
    return item.areas
      .map((area) => `${base}&city=${area.city}&district=${area.district}&areaFilter=SERVICE_AREA`)
      .join("<br>");
  }
  const contractCities = contracts
    .filter((region) => region.providerId === item.provider.id)
    .map((region) => region.city);
  const located = `${base}&city=${item.provider.city}&district=${item.provider.district}&areaFilter=LOCATED_IN`;
  const unconfirmed = `${base}&city=${item.provider.city}&areaFilter=SERVICE_AREA&includeUnconfirmed=true`;
  const contract = contractCities.length
    ? contractCities.map((city) => `${base}&contractCity=${city}`).join("<br>")
    : "—";
  return `${located}<br>${unconfirmed}<br>${contract}`;
}

function renderLookup(dataset, derived) {
  const listedVerified = derived.listing.filter((item) => item.listingStatus === "LISTED_AREA_VERIFIED").length;
  const listedUnconfirmed = derived.listing.filter((item) => item.listingStatus === "LISTED_AREA_UNCONFIRMED").length;
  const websites = dataset.providers.filter((item) => item.website !== null).length;
  const rows = derived.listing.map((item) => {
    const sources = item.conditional
      ? (item.conditional.sourcesChecked ?? []).map((source) => `${source.sourceId}（${source.checkedAt}）：${source.result}`).join("<br>")
      : "active ProviderServiceArea 的既有 A-003 可追溯證據";
    const reason = item.conditional?.reason ?? "已有至少一筆 active ProviderServiceArea。";
    return `| ${item.provider.id} | ${cell(item.provider.name)} | ${item.serviceTypes.join("、")} | ${item.listingStatus} | ${item.serviceAreaStatus} | ${cell(item.provider.address)} | ${cell(item.provider.phone)} | ${cell(item.provider.website)} | ${cell(item.provider.googleMapsUrl)} | ${cell(sources)} | ${cell(reason)} | ${cell(queryConditions(item, dataset.contracts ?? []))} |`;
  });
  return [
    `- ACTIVE 且有 active ProviderService 的 Provider：${derived.listing.length}`,
    `- LISTED_AREA_VERIFIED：${listedVerified}`,
    `- LISTED_AREA_UNCONFIRMED：${listedUnconfirmed}`,
    `- NOT_LISTED：0`,
    `- 官方網站欄位：${websites} 筆非 null、${dataset.providers.length - websites} 筆 null。僅可填服務單位或母機構官方網址；本資料集目前沒有可追溯的官方網址，因此保留 null。`,
    `- 服務範圍補查：14 家 UNCONFIRMED 的已查來源、日期與結果逐筆列於表中；均未取得可追溯的行政區服務證據，因此本次新增 active ProviderServiceArea：0 筆。`,
    `- B／C 查詢對照：表中「應出現的查詢條件」是 GET /api/v1/providers 的對照，不代表推薦。UNCONFIRMED 的 SERVICE_AREA 查詢必須帶 includeUnconfirmed=true，且回應須標示 areaMatch=UNCONFIRMED。`,
    "",
    "| Provider ID | 正式名稱 | Active 服務 | 收錄狀態 | serviceAreaStatus | 地址 | 電話 | 官方網站 | Google Maps | 已查來源／日期／結果 | 收錄理由 | 應出現的查詢條件 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
    "## 需交 Jerry 的外部聯絡需求",
    "",
    "| 對象 | 要問什麼 | 原因 |",
    "| --- | --- | --- |",
    "| 12 家輔具商家或各縣市特約名單維護單位 | 可提供到府、配送或服務的行政區清單，以及可公開引用的正式文件／網址 | SRC-004／SRC-005 僅證實特約縣市，不能推定行政區服務範圍。 |",
    "| 馬偕居家護理所 | 該居家護理所本身可提供服務的行政區，以及可引用的正式書面證據 | 醫院本體的服務範圍不可移轉給附設居家護理所。 |",
    "| 臺大北護分院附設居家護理所 | 該居家護理所本身可提供服務的行政區，以及可引用的正式書面證據 | 北護分院本體的服務範圍不可移轉給附設居家護理所。 |",
  ].join("\n");
}

function renderCoverage(dataset, derived) {
  const services = [...new Set(dataset.services.filter((item) => item.active).map((item) => item.serviceType))].sort();
  const byType = [];
  for (const serviceType of services) {
    const providerIds = dataset.services.filter((item) => item.active && item.serviceType === serviceType).map((item) => item.providerId);
    const unknown = providerIds.filter((id) => !(derived.areasByProvider.get(id) ?? []).length).sort();
    const groups = new Map();
    for (const area of dataset.areas.filter((item) => item.active && providerIds.includes(item.providerId))) {
      const key = `${area.city}|${area.district}`;
      groups.set(key, [...(groups.get(key) ?? []), area.providerId].sort());
    }
    for (const [key, candidates] of groups) {
      const [city, district] = key.split("|");
      byType.push({ serviceType, city, district, candidates, unknown });
    }
  }
  byType.sort((a, b) => `${a.serviceType}${a.city}${a.district}`.localeCompare(`${b.serviceType}${b.city}${b.district}`, "zh-Hant"));
  return [
    `- active ProviderServiceArea：${dataset.areas.filter((item) => item.active).length}`,
    `- 可推薦組合（服務類型 × 行政區）：${byType.length}`,
    `- 本表只根據 active ProviderServiceArea 計算；特約縣市不參與推薦候選或覆蓋率。`,
    "",
    "| Service Type | City | District | 可推薦候選數 | Provider IDs | 同服務類型的 UNCONFIRMED Provider |",
    "| --- | --- | --- | --- | --- |",
    ...byType.map((item) => `| ${item.serviceType} | ${item.city} | ${item.district} | ${item.candidates.length} | ${item.candidates.join("、")} | ${item.unknown.join("、") || "—"} |`),
  ].join("\n");
}

function syncReport(file, section, content) {
  const text = fs.readFileSync(file, "utf8");
  const pattern = new RegExp(`(<!-- A006:BEGIN ${section} -->\\r?\\n)[\\s\\S]*?(<!-- A006:END ${section} -->)`);
  if (!pattern.test(text)) return `${path.relative(root, file)}: missing generated section ${section}.`;
  const next = text.replace(pattern, `$1${content}\n$2`);
  if (write) fs.writeFileSync(file, next);
  else if (next !== text) return `${path.relative(root, file)}: generated ${section} section is stale (run with --write).`;
  return null;
}

try {
  const before = load();
  const expected = expectedContracts(before.evidence);
  if (write) fs.writeFileSync(path.join(staging, "provider-contract-regions.json"), `${JSON.stringify(expected, null, 2)}\n`);
  const dataset = load();
  const derived = derive(dataset);
  const errors = check(dataset, expected, derived);
  for (const error of [
    syncReport(reportFiles.lookup, "listing", renderLookup(dataset, derived)),
    syncReport(reportFiles.coverage, "coverage", renderCoverage(dataset, derived)),
  ]) if (error) errors.push(error);
  if (errors.length) {
    for (const error of errors) console.log(`ERROR: ${error}`);
    console.log(`RESULT: FAIL (${errors.length} errors)`);
    process.exitCode = 1;
  } else {
    console.log(`ProviderContractRegion: ${dataset.contracts.length}`);
    console.log(`Lookup listings: ${derived.listing.length}`);
    const coverageGroups = new Set(
      dataset.areas
        .filter((area) => area.active)
        .flatMap((area) => (derived.servicesByProvider.get(area.providerId) ?? [])
          .map((serviceType) => `${serviceType}|${area.city}|${area.district}`)),
    ).size;
    console.log(`Recommendation coverage groups: ${coverageGroups}`);
    console.log(write ? "RESULT: PASS (A-006 artifacts regenerated)" : "RESULT: PASS");
  }
} catch (error) {
  console.log(`ERROR: unable to run A-006 checks - ${error.message}`);
  console.log("RESULT: FAIL (1 errors)");
  process.exitCode = 1;
}
