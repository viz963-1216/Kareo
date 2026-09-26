// J-003 local pre-flight for the first knowledge publication (in memory; NOT a publication and NOT E2E).
// Needs a checkout that contains B-008-r2, B-010 and B-011a (a trial combination until they are merged).
// Copy to apps/api/tests/ as first-publish-dryrun.test.ts and run:
//   cd apps/api && npx vitest run tests/first-publish-dryrun.test.ts
//
// It uses the same service calls as the CLI steps (importKnowledgePack → approveKnowledgePack →
// publishKnowledgeVersion) on every APPROVED content pack with intendedKnowledgeVersion KB-2026-09-24-001,
// then runs the B-010 engine on that snapshot for one Taipei and one New Taipei synthetic case.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { importContentPack, parseSourceRegistry } from "../src/services/knowledgeImportService.js";
import { approveRecords, publishVersion } from "../src/services/knowledgeService.js";
import { InMemoryKnowledgeRepository } from "../src/repositories/inMemoryKnowledgeRepository.js";
import { InMemoryAssessmentRepository, InMemoryConsentRepository, InMemorySessionRepository } from "../src/repositories/inMemoryRepositories.js";
import { DatabaseKnowledgeResolver } from "../src/adapters/knowledgeVersionResolver.js";
import { RuleBasedAssessmentEngine } from "../src/assessment/ruleBasedAssessmentEngine.js";
import { createAssessment } from "../src/services/assessmentService.js";
import type { RawContentPack } from "../src/types/index.js";

const ROOT = join(__dirname, "../../..");
const TARGET = "KB-2026-09-24-001";
const registry = parseSourceRegistry(readFileSync(join(ROOT, "docs/knowledge/source-registry.md"), "utf8"));
const packs = readdirSync(join(ROOT, "contracts/knowledge/packs"))
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(join(ROOT, "contracts/knowledge/packs", f), "utf8")) as RawContentPack & { records: Array<{ status: string; source: { sourceId: string; authority: string } }> })
  .filter((p) => p.status === "APPROVED" && p.intendedKnowledgeVersion === TARGET);

describe(`first publication pre-flight: ${TARGET}`, () => {
  it("imports, approves and publishes every approved record of every pack for the target version", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const expected = packs.reduce((n, p) => n + p.records.filter((r) => r.status === "APPROVED").length, 0);
    const candidates: Array<{ id: string; effectiveTo: string | null }> = [];
    for (const p of packs) {
      const report = await importContentPack(repo, p, registry, { mode: "commit" });
      expect(report.recordsRejected, `${p.packId} import rejections`).toEqual([]);
      const approvedIds = new Set(p.records.filter((r) => r.status === "APPROVED").map((r) => (r as { recordId: string }).recordId));
      const ids = (await repo.findRecordsByPackId(p.packId as string)).filter((r) => approvedIds.has(r.packRecordId)).map((r) => r.id);
      await approveRecords(repo, ids);
      for (const r of await repo.findRecordsByPackId(p.packId as string)) if (r.status === "APPROVED") candidates.push({ id: r.id, effectiveTo: r.effectiveTo });
      for (const r of p.records) repo.sourceAuthorities.set(r.source.sourceId, r.source.authority as never);
    }
    const result = await publishVersion(repo, { packs: packs.map((p) => ({ status: p.status, intendedKnowledgeVersion: p.intendedKnowledgeVersion })), candidateRecords: candidates, createdBy: "J003-dryrun", approvedBy: "J003-dryrun", today: "2026-09-25" });
    console.log(`packs=${packs.map((p) => p.packId).join(",")} expected=${expected} published=${result.publishedRecordCount} excluded=${result.excludedRecordIds.length}`);
    expect(result.versionId).toBe(TARGET);
    expect(result.publishedRecordCount + result.excludedRecordIds.length).toBe(expected);

    // B-010 on the published snapshot: Taipei and New Taipei local information must not cross over.
    const sessionRepo = new InMemorySessionRepository();
    const consentRepo = new InMemoryConsentRepository();
    const deps = { sessionRepo, consentRepo, assessmentRepo: new InMemoryAssessmentRepository(), aiAdapter: new RuleBasedAssessmentEngine(), knowledgeResolver: new DatabaseKnowledgeResolver(repo) };
    const run = async (city: string, district: string) => {
      const s = await sessionRepo.createSession();
      await consentRepo.createConsent({ sessionId: s.id, disclaimerVersion: "1.0", privacyVersion: "1.0", termsVersion: "1.0", accepted: true });
      const body = { sessionId: s.id, ageRange: "75_84", location: { city, district, precision: "DISTRICT", lat: null, lng: null }, livingSituation: "WITH_FAMILY",
        caregiverSituation: "FAMILY_LIMITED", mobilityLevel: "NEEDS_ASSISTANCE", dailyLivingLevel: "PARTIAL_ASSISTANCE",
        needs: { homeCare: "YES", medicalNursing: "YES", assistiveDevice: "YES", transportation: "YES" }, disabilityCertificate: "YES", incomeCategory: "GENERAL", freeText: "" };
      return (await createAssessment(deps as never, body, s.sessionToken)).careNeedProfile.summary as string;
    };
    const taipei = await run("臺北市", "大安區");
    const newTaipei = await run("新北市", "三重區");
    console.log(`--- 臺北市 summary ---\n${taipei}\n--- 新北市 summary ---\n${newTaipei}`);
    // Local lines (S-LOCAL-*, S-LOCAL-CENTER, local disability top-up) are prefixed with the city; official
    // text may still name the other city (e.g. Taipei transport covers 臺北市與新北市), so check prefixes.
    const localLines = (summary: string, city: string) => summary.split("\n").filter((l) => l.startsWith(`${city}：`) || l.startsWith(`${city}長期照顧管理中心`) || l.startsWith(`${city}身心障礙者輔具加碼`));
    expect(localLines(taipei, "新北市")).toEqual([]);
    expect(localLines(newTaipei, "臺北市")).toEqual([]);
    expect(localLines(taipei, "臺北市").length).toBeGreaterThan(0);
    expect(localLines(newTaipei, "新北市").length).toBeGreaterThan(0);
    // D-17: with HOME_MEDICAL_NURSING and a certificate, the central medical-device subsidy (KR-2026-018) applies in both cities.
    for (const s of [taipei, newTaipei]) expect(s).toMatch(/居家使用的醫療輔具補助/);
    expect(taipei).not.toMatch(/與長照給付分開申請）：\n[^\n]*新北市/);
  });
});
