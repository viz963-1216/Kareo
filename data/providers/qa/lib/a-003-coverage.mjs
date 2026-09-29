// A-003 coordinate / service-area evidence checks and report rendering.
//
// A coordinate counts as verified only when a record in qa/a-003-evidence.json supports it:
// source identity (name + address), an official address-point record that matches the
// Provider address, and a reproducible EPSG:3826 -> WGS84 conversion. A non-null lat/lng
// alone is never counted as verified.
import fs from "node:fs";
import path from "node:path";

export const EVIDENCE_FILE = "qa/a-003-evidence.json";

// Generated report sections: file -> section names. Each section lives between
//   <!-- A003:BEGIN name --> and <!-- A003:END name -->
export const REPORT_SECTIONS = {
  "qa/verified-coordinates-report.md": [
    "summary",
    "by-service-type",
    "service-area-basis",
    "coverage",
    "providers",
  ],
  "qa/geocoding-service-area-report.md": ["summary", "service-area-basis"],
  "qa/pending-verification.md": ["pending"],
};

// MOI town codes used by address-point records (NTPC column areacode, Taipei 鄉鎮市區代碼).
// Taipei codes were cross-checked against TOWN_NAME in SRC-COORD-TPE-002.
const AREA_CODES = {
  "63000040": "中山區",
  "63000070": "萬華區",
  "63000080": "文山區",
  "63000100": "內湖區",
  "63000110": "士林區",
  "65000010": "板橋區",
  "65000020": "三重區",
  "65000030": "中和區",
  "65000040": "永和區",
  "65000050": "新莊區",
  "65000060": "新店區",
  "65000070": "樹林區",
  "65000100": "淡水區",
  "65000130": "土城區",
  "65000140": "蘆洲區",
  "65000150": "五股區",
  "65000160": "泰山區",
  "65000170": "林口區",
};

// Conversion must reproduce the recorded WGS84 value within ~1 cm.
const CONVERSION_TOLERANCE_DEG = 1e-7;

const MISSING_LABELS = { coordinate: "座標", serviceArea: "服務範圍" };

export function twd97Tm2Zone121ToWgs84(x, y) {
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

const toHalfWidth = (text) =>
  text.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));

const SECTION_NUMERALS = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];

// Provider addresses write "501-6號" and "2段"; address-point records write "５０１之６號" and "二段".
const normalizeAddress = (text) =>
  toHalfWidth(text)
    .replace(/台/g, "臺")
    .replace(/-/g, "之")
    .replace(/([1-9])段/g, (_, n) => `${SECTION_NUMERALS[n]}段`);

export function loadDataset(root) {
  const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
  return {
    providers: read("staging/providers.json"),
    services: read("staging/provider-services.json"),
    areas: read("staging/provider-service-areas.json"),
    evidence: read(EVIDENCE_FILE),
  };
}

export function checkEvidence({ providers, services, areas, evidence }) {
  const errors = [];
  const providersById = new Map(providers.map((provider) => [provider.id, provider]));
  const sourceIds = new Set(evidence.sources.map((source) => source.sourceId));
  // Recorded instructions that some evidence relies on; every reference must resolve.
  const decisionsById = new Map((evidence.decisions ?? []).map((item) => [item.decisionId, item]));
  const decisionIds = new Set(decisionsById.keys());
  for (const item of [...evidence.coordinates, ...evidence.serviceAreas, ...evidence.pending]) {
    if (item.decisionId !== undefined && !decisionIds.has(item.decisionId)) {
      errors.push(`${item.providerId}: decision ${item.decisionId} is not recorded in evidence.decisions.`);
    }
  }
  const coordinateEvidence = new Map();

  // A Provider counts as verified only when its evidence passes every check below.
  const verifiedIds = new Set();
  for (const item of evidence.coordinates) {
    const before = errors.length;
    checkCoordinate(item);
    if (errors.length === before) verifiedIds.add(item.providerId);
  }

  function checkCoordinate(item) {
    const id = item.providerId;
    const provider = providersById.get(id);
    if (!provider) {
      errors.push(`${id}: coordinate evidence references a missing Provider.`);
      return;
    }
    if (coordinateEvidence.has(id)) errors.push(`${id}: duplicate coordinate evidence.`);
    coordinateEvidence.set(id, item);

    if (item.name !== provider.name) errors.push(`${id}: evidence name differs from providers.json.`);
    if (item.address !== provider.address) {
      errors.push(`${id}: evidence address differs from providers.json.`);
    }
    if (!Array.isArray(item.identity) || item.identity.length === 0) {
      errors.push(`${id}: missing identity evidence (official name/address match).`);
    }
    for (const identity of item.identity ?? []) {
      if (!sourceIds.has(identity.sourceId)) {
        errors.push(`${id}: identity source ${identity.sourceId} is not registered.`);
      }
      if (!identity.document || !identity.sourceName || !identity.sourceAddress || !identity.checkedAt) {
        errors.push(`${id}: identity evidence needs document, sourceName, sourceAddress, checkedAt.`);
      }
    }

    const coordinate = item.coordinate ?? {};
    if (!sourceIds.has(coordinate.sourceId)) {
      errors.push(`${id}: coordinate source ${coordinate.sourceId} is not registered.`);
    }
    if (coordinate.sourceCrs !== "EPSG:3826") {
      errors.push(`${id}: unsupported or missing source CRS ${coordinate.sourceCrs}.`);
      return;
    }
    const fields = String(coordinate.record ?? "").split(",");
    if (fields.length !== 11) {
      errors.push(`${id}: address-point record must have 11 CSV fields.`);
      return;
    }
    const [, areaCode, , , road, , lane, alley, number, rawX, rawY] = fields;
    if (Number(rawX) !== coordinate.x || Number(rawY) !== coordinate.y) {
      errors.push(`${id}: x/y differ from the quoted address-point record.`);
    }
    if (AREA_CODES[areaCode] !== provider.district) {
      errors.push(`${id}: record areacode ${areaCode} does not match district ${provider.district}.`);
    }
    // A building shares one address point across floors, so compare up to "號" only.
    const houseNumber = number.slice(0, number.indexOf("號") + 1) || number;
    const recordAddress = normalizeAddress(`${road}${lane}${alley}${houseNumber}`);
    if (!normalizeAddress(provider.address).includes(recordAddress)) {
      errors.push(`${id}: address-point record "${recordAddress}" does not match the Provider address.`);
    }

    const converted = twd97Tm2Zone121ToWgs84(coordinate.x, coordinate.y);
    for (const key of ["lat", "lng"]) {
      if (!(Math.abs(converted[key] - item.wgs84?.[key]) <= CONVERSION_TOLERANCE_DEG)) {
        errors.push(`${id}: ${key} is not reproduced by EPSG:3826 conversion of the record.`);
      }
      if (provider[key] !== item.wgs84?.[key]) {
        errors.push(`${id}: providers.json ${key} differs from the verified evidence value.`);
      }
    }
  }

  // Coordinates adopted by an explicit instruction from a non-official source (for example a
  // map listing) are allowed only with an UNOFFICIAL_COORDINATE decision. They are never
  // counted as verified; coverage lists them separately.
  const unofficialEntries = new Map();
  const unofficialIds = new Set();
  for (const item of evidence.unofficialCoordinates ?? []) {
    const id = item.providerId;
    const provider = providersById.get(id);
    const before = errors.length;
    if (!provider) {
      errors.push(`${id}: unofficial coordinate references a missing Provider.`);
      continue;
    }
    if (unofficialEntries.has(id)) errors.push(`${id}: duplicate unofficial coordinate.`);
    unofficialEntries.set(id, item);
    if (coordinateEvidence.has(id)) {
      errors.push(`${id}: has both verified evidence and an unofficial coordinate.`);
    }
    if (decisionsById.get(item.decisionId)?.settingType !== "UNOFFICIAL_COORDINATE") {
      errors.push(`${id}: unofficial coordinate needs an UNOFFICIAL_COORDINATE decision.`);
    }
    if (!sourceIds.has(item.sourceId)) {
      errors.push(`${id}: unofficial coordinate source ${item.sourceId} is not registered.`);
    }
    if (item.name !== provider.name || item.address !== provider.address) {
      errors.push(`${id}: unofficial coordinate name/address differs from providers.json.`);
    }
    for (const key of ["lat", "lng"]) {
      if (provider[key] !== item[key]) {
        errors.push(`${id}: providers.json ${key} differs from the unofficial coordinate.`);
      }
    }
    if (errors.length === before) unofficialIds.add(id);
  }

  for (const provider of providers) {
    const hasAny = provider.lat !== null || provider.lng !== null;
    const recorded = coordinateEvidence.has(provider.id) || unofficialEntries.has(provider.id);
    if (hasAny && !recorded) {
      errors.push(`${provider.id}: non-null coordinate has no verified evidence.`);
    }
    if (!hasAny && recorded) {
      errors.push(`${provider.id}: evidence exists but providers.json coordinate is null.`);
    }
  }

  // Service areas an official source states directly (OFFICIAL) are kept apart from areas
  // created by an instructed platform setting (PLATFORM_SETTING).
  const settingAreaKeys = new Set();
  const activeAreas = areas.filter((area) => area.active);
  for (const item of evidence.serviceAreas) {
    if (!providersById.has(item.providerId)) {
      errors.push(`${item.providerId}: service-area evidence references a missing Provider.`);
      continue;
    }
    const decisionType = decisionsById.get(item.decisionId)?.settingType;
    if (item.basis === "PLATFORM_SETTING") {
      if (decisionType !== "PLATFORM_SETTING") {
        errors.push(`${item.providerId}: PLATFORM_SETTING service area needs a PLATFORM_SETTING decision.`);
      }
      for (const district of item.districts) {
        settingAreaKeys.add(`${item.providerId}|${item.city}|${district}`);
      }
    } else if (item.basis !== "OFFICIAL" || decisionType === "PLATFORM_SETTING") {
      errors.push(`${item.providerId}: service-area basis must be OFFICIAL or match its decision type.`);
    }
    if (!sourceIds.has(item.sourceId)) {
      errors.push(`${item.providerId}: service-area source ${item.sourceId} is not registered.`);
    }
    const actual = activeAreas
      .filter((area) => area.providerId === item.providerId && area.city === item.city)
      .map((area) => area.district)
      .sort();
    const expected = [...item.districts].sort();
    if (actual.join("、") !== expected.join("、")) {
      errors.push(
        `${item.providerId}: ProviderServiceArea (${actual.join("、") || "none"}) differs from evidence (${expected.join("、")}).`,
      );
    }
  }

  const pendingById = new Map();
  for (const item of evidence.pending) {
    if (!providersById.has(item.providerId)) {
      errors.push(`${item.providerId}: pending entry references a missing Provider.`);
    }
    if (pendingById.has(item.providerId)) errors.push(`${item.providerId}: duplicate pending entry.`);
    pendingById.set(item.providerId, item);
    if (!item.reason?.trim() || !item.nextStep?.trim()) {
      errors.push(`${item.providerId}: pending entry needs a reason and a next step.`);
    }
    for (const checked of item.sourcesChecked ?? []) {
      if (!sourceIds.has(checked.sourceId) || !/^\d{4}-\d{2}-\d{2}$/.test(checked.checkedAt ?? "")) {
        errors.push(`${item.providerId}: checked source needs a registered sourceId and a date.`);
      }
    }
  }

  const activeServiceProviders = new Set(
    services.filter((service) => service.active).map((service) => service.providerId),
  );
  for (const provider of providers) {
    const missing = new Set(pendingById.get(provider.id)?.missing ?? []);
    const needsCoordinate =
      !coordinateEvidence.has(provider.id) && !unofficialEntries.has(provider.id);
    const needsServiceArea =
      activeServiceProviders.has(provider.id) &&
      !activeAreas.some((area) => area.providerId === provider.id);
    if (needsCoordinate !== missing.has("coordinate")) {
      errors.push(`${provider.id}: pending list "coordinate" does not match the evidence state.`);
    }
    if (needsServiceArea !== missing.has("serviceArea")) {
      errors.push(`${provider.id}: pending list "serviceArea" does not match the data.`);
    }
  }

  return { errors, verifiedIds, pendingById, settingAreaKeys, unofficialIds };
}

// Candidate = ACTIVE Provider + active ProviderService + active ProviderServiceArea.
// READY (DISTANCE usable, D-13c) only when every candidate has evidence-backed coordinates
// and no ACTIVE Provider offering that service type has unknown service areas (it could be
// a hidden candidate in any district).
export function computeCoverage(
  { providers, services, areas },
  verifiedIds,
  settingAreaKeys = new Set(),
  unofficialIds = new Set(),
) {
  const providersById = new Map(providers.map((provider) => [provider.id, provider]));
  const activeServices = services.filter(
    (service) => service.active && providersById.get(service.providerId)?.status === "ACTIVE",
  );
  const activeAreas = areas.filter((area) => area.active);
  const serviceTypes = [...new Set(activeServices.map((service) => service.serviceType))];

  const groups = [];
  const byType = [];
  for (const serviceType of serviceTypes) {
    const providerIds = [
      ...new Set(
        activeServices
          .filter((service) => service.serviceType === serviceType)
          .map((service) => service.providerId),
      ),
    ];
    const unknownArea = providerIds.filter(
      (id) => !activeAreas.some((area) => area.providerId === id),
    );
    const keys = new Map();
    for (const area of activeAreas.filter((item) => providerIds.includes(item.providerId))) {
      const key = `${area.city}|${area.district}`;
      keys.set(key, (keys.get(key) ?? new Set()).add(area.providerId));
    }
    const typeGroups = [...keys.entries()].map(([key, ids]) => {
      const [city, district] = key.split("|");
      const candidates = [...ids].sort();
      const missing = candidates.filter((id) => !verifiedIds.has(id) && !unofficialIds.has(id));
      const unofficialCandidates = candidates.filter((id) => unofficialIds.has(id));
      let status = "READY";
      if (missing.length > 0) status = "BLOCKED_MISSING_COORDINATE";
      else if (unknownArea.length > 0) status = "BLOCKED_UNKNOWN_SERVICE_AREA";
      const settingCandidates = candidates.filter((id) =>
        settingAreaKeys.has(`${id}|${city}|${district}`),
      );
      return {
        serviceType,
        city,
        district,
        candidates,
        missing,
        status,
        settingCandidates,
        unofficialCandidates,
      };
    });
    typeGroups.sort((a, b) =>
      `${a.city}${a.district}`.localeCompare(`${b.city}${b.district}`, "zh-Hant"),
    );
    groups.push(...typeGroups);
    byType.push({
      serviceType,
      providers: providerIds.length,
      verified: providerIds.filter((id) => verifiedIds.has(id)).length,
      unofficial: providerIds.filter((id) => unofficialIds.has(id)).length,
      withServiceArea: providerIds.length - unknownArea.length,
      unknownArea,
      groups: typeGroups.length,
      ready: typeGroups.filter((group) => group.status === "READY").length,
    });
  }
  return { groups, byType };
}

export function computeStats(dataset, verifiedIds, coverage, unofficialIds = new Set()) {
  const { providers, areas } = dataset;
  const nonNull = providers.filter((p) => p.lat !== null && p.lng !== null).length;
  return {
    providers: providers.length,
    serviceAreas: areas.length,
    nonNullCoordinates: nonNull,
    verifiedCoordinates: providers.filter((p) => verifiedIds.has(p.id)).length,
    unofficialCoordinates: providers.filter((p) => unofficialIds.has(p.id)).length,
    nonNullWithoutEvidence: providers.filter(
      (p) => (p.lat !== null || p.lng !== null) && !verifiedIds.has(p.id) && !unofficialIds.has(p.id),
    ).length,
    pendingCoordinates: providers.filter((p) => !verifiedIds.has(p.id) && !unofficialIds.has(p.id))
      .length,
    missingServiceArea: new Set(coverage.byType.flatMap((type) => type.unknownArea)).size,
    groups: coverage.groups.length,
    readyGroups: coverage.groups.filter((group) => group.status === "READY"),
  };
}

const STATUS_TEXT = {
  READY: "READY",
  BLOCKED_MISSING_COORDINATE: "BLOCKED（缺座標）",
  BLOCKED_UNKNOWN_SERVICE_AREA: "BLOCKED（同類型有 Provider 服務範圍未知）",
};

const cell = (value) => String(value).replace(/\|/g, "\\|").replace(/\n/g, " ");

export function renderSections(
  dataset,
  verifiedIds,
  coverage,
  pendingById,
  unofficialIds = new Set(),
) {
  const stats = computeStats(dataset, verifiedIds, coverage, unofficialIds);
  const unofficialById = new Map(
    (dataset.evidence.unofficialCoordinates ?? []).map((item) => [item.providerId, item]),
  );
  const { providers, areas, evidence } = dataset;
  const evidenceById = new Map(evidence.coordinates.map((item) => [item.providerId, item]));
  const providersById = new Map(providers.map((provider) => [provider.id, provider]));
  const pct = (a, b) => (b === 0 ? "—" : `${Math.round((a / b) * 100)}%`);
  const settingEvidence = evidence.serviceAreas.filter((item) => item.basis === "PLATFORM_SETTING");
  const officialEvidence = evidence.serviceAreas.filter((item) => item.basis === "OFFICIAL");
  const settingAreas = settingEvidence.reduce((n, item) => n + item.districts.length, 0);

  const summary = [
    `- Provider 總數：${stats.providers}`,
    `- ProviderServiceArea 筆數：${stats.serviceAreas}`,
    `- lat/lng 非 null：${stats.nonNullCoordinates}`,
    `- 有完整驗證證據的座標：${stats.verifiedCoordinates}（名稱／地址核對＋官方門牌點＋可重現轉換，見 \`qa/a-003-evidence.json\`）`,
    `- 依指示採用的非官方座標（非官方門牌點，不計入已驗證）：${stats.unofficialCoordinates}` +
      (unofficialIds.size
        ? `（${[...unofficialIds].map((id) => `${id}，${unofficialById.get(id).decisionId}`).join("；")}）`
        : ""),
    `- 非 null 但缺任何證據：${stats.nonNullWithoutEvidence}`,
    `- 仍無座標：${stats.pendingCoordinates}`,
    `- 缺 ProviderServiceArea 的 ACTIVE Provider：${stats.missingServiceArea}`,
    `- 依指示建立的平台設定服務範圍（非官方證實）：${settingAreas} 筆（${[...new Set(settingEvidence.map((item) => item.decisionId))].join("、") || "—"}）`,
    `- 服務類型 × 行政區組合：${stats.groups}；DISTANCE READY：${stats.readyGroups.length}` +
      (stats.readyGroups.length
        ? `（${stats.readyGroups.map((g) => `${g.serviceType} × ${g.city}${g.district}`).join("、")}）`
        : ""),
  ].join("\n");

  const byType = [
    "| Service Type | ACTIVE Provider | 有已驗證座標 | 依指示採用的非官方座標 | 座標覆蓋率（含非官方） | 有服務範圍 | 行政區組合 | READY 組合 | 待補 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...coverage.byType.map((type) =>
      `| ${type.serviceType} | ${type.providers} | ${type.verified} | ${type.unofficial} | ${pct(type.verified + type.unofficial, type.providers)} | ${type.withServiceArea} | ${type.groups} | ${type.ready} | ` +
      (type.unknownArea.length
        ? `服務範圍未知：${type.unknownArea.join("、")}；不得由地址推測，也因此沒有可推薦組合`
        : "—") +
      " |",
    ),
  ].join("\n");

  const coverageTable = [
    "| Service Type | City | District | 候選數 | 有座標 | 覆蓋率 | 狀態 | 待補座標 | 依平台設定納入的候選 | 採非官方座標的候選 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...coverage.groups.map((group) => {
      const located = group.candidates.length - group.missing.length;
      return `| ${group.serviceType} | ${group.city} | ${group.district} | ${group.candidates.length} | ${located} | ${pct(located, group.candidates.length)} | ${STATUS_TEXT[group.status]} | ${group.missing.join("、") || "—"} | ${group.settingCandidates.join("、") || "—"} | ${group.unofficialCandidates.join("、") || "—"} |`;
    }),
  ].join("\n");

  // Every active area row falls in exactly one bucket; the total must equal the data.
  const areaKey = (area) => `${area.providerId}|${area.city}|${area.district}`;
  const officialKeys = new Set(
    officialEvidence.flatMap((item) => item.districts.map((d) => `${item.providerId}|${item.city}|${d}`)),
  );
  const settingKeys = new Set(
    settingEvidence.flatMap((item) => item.districts.map((d) => `${item.providerId}|${item.city}|${d}`)),
  );
  const typeOf = new Map(providers.map((provider) => [provider.id, provider.type]));
  const basisRows = new Map();
  for (const area of areas.filter((item) => item.active)) {
    const type = typeOf.get(area.providerId);
    const row = basisRows.get(type) ?? { official: 0, setting: 0, other: 0 };
    if (settingKeys.has(areaKey(area))) row.setting += 1;
    else if (officialKeys.has(areaKey(area))) row.official += 1;
    else row.other += 1;
    basisRows.set(type, row);
  }
  const serviceAreaBasis = [
    "| Provider 類型 | 官方來源直接證實（本檔證據） | 官方來源（A-003-r1 人工核對 SRC-001，未列入本檔證據） | 依指示建立的平台設定（非官方證實） | 合計 |",
    "| --- | --- | --- | --- | --- |",
    ...[...basisRows.entries()].map(
      ([type, row]) =>
        `| ${type} | ${row.official} | ${row.other} | ${row.setting} | ${row.official + row.other + row.setting} |`,
    ),
    "",
    ...(evidence.decisions ?? [])
      .filter((item) => item.settingType === "PLATFORM_SETTING")
      .map((item) => {
        const rows = settingEvidence.filter((e) => e.decisionId === item.decisionId);
        const ids = [...new Set(rows.map((e) => e.providerId))];
        const count = rows.reduce((n, e) => n + e.districts.length, 0);
        return `- ${item.decisionId}（${count} 筆；${ids.join("、")}）：${item.decision}`;
      }),
  ].join("\n");

  const providerTable = [
    "| Provider ID | 名稱 | 類型 | lat | lng | 座標狀態 | 座標證據 | 查核日 | 服務範圍筆數 | 待補 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...providers.map((provider) => {
      const item = evidenceById.get(provider.id);
      const areaCount = areas.filter((a) => a.providerId === provider.id && a.active).length;
      const missing = (pendingById.get(provider.id)?.missing ?? []).map((m) => MISSING_LABELS[m] ?? m);
      const unofficial = unofficialById.get(provider.id);
      let proof = "—";
      let state = "PENDING";
      let checkedAt = "—";
      if (item) {
        proof = `${item.identity.map((i) => i.sourceId).join("＋")} 名稱／地址；${item.coordinate.sourceId} \`${item.coordinate.record.split(",").slice(4, 9).join("")}\`（${item.coordinate.sourceCrs} → WGS84）`;
        state = "VERIFIED";
        checkedAt = item.coordinate.checkedAt;
      } else if (unofficial) {
        proof = `${unofficial.sourceId} 地圖標記（非官方門牌點，依 ${unofficial.decisionId}）`;
        state = "UNOFFICIAL";
        checkedAt = unofficial.checkedAt;
      }
      return `| ${provider.id} | ${cell(provider.name)} | ${provider.type} | ${provider.lat ?? "null"} | ${provider.lng ?? "null"} | ${state} | ${cell(proof)} | ${checkedAt} | ${areaCount} | ${missing.join("、") || "—"} |`;
    }),
  ].join("\n");

  const pending = [
    "| Provider ID | 名稱 | 缺少 | 已查閱來源與日期 | 尚無法確認的原因 | 下一步 |",
    "| --- | --- | --- | --- | --- | --- |",
    ...[...pendingById.values()].map((item) => {
      const checked = (item.sourcesChecked ?? []).length
        ? item.sourcesChecked.map((c) => `${c.sourceId}（${c.checkedAt}）：${c.result}`).join("<br>")
        : "無查閱紀錄（未找到可查的來源）";
      const missing =
        item.missing.map((m) => MISSING_LABELS[m] ?? m).join("、") +
        (item.decisionId ? `（${item.decisionId}）` : "");
      return `| ${item.providerId} | ${cell(providersById.get(item.providerId)?.name ?? "?")} | ${missing} | ${cell(checked)} | ${cell(item.reason)} | ${cell(item.nextStep)} |`;
    }),
  ].join("\n");

  return {
    summary,
    "by-service-type": byType,
    "service-area-basis": serviceAreaBasis,
    coverage: coverageTable,
    providers: providerTable,
    pending,
  };
}

const sectionPattern = (name) =>
  new RegExp(`(<!-- A003:BEGIN ${name} -->\\r?\\n)([\\s\\S]*?)(<!-- A003:END ${name} -->)`);

// Returns errors for sections that differ from the data; with write=true, rewrites them.
export function syncReports(root, sections, { write = false } = {}) {
  const errors = [];
  for (const [file, names] of Object.entries(REPORT_SECTIONS)) {
    const filePath = path.join(root, file);
    let text = fs.readFileSync(filePath, "utf8");
    for (const name of names) {
      const pattern = sectionPattern(name);
      const match = text.match(pattern);
      if (!match) {
        errors.push(`${file}: generated section "${name}" markers are missing.`);
        continue;
      }
      const lineEnding = match[1].endsWith("\r\n") ? "\r\n" : "\n";
      const expected = `${sections[name]}\n`.replace(/\n/g, lineEnding);
      if (match[2] !== expected) {
        if (write) text = text.replace(pattern, (_, begin, __, end) => begin + expected + end);
        else errors.push(`${file}: section "${name}" differs from the data (run with --write).`);
      }
    }
    if (write) fs.writeFileSync(filePath, text);
  }
  return errors;
}
