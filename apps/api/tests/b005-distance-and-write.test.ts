// J-003 repro for B-005 (PR #40, commit 1a12c62). Copy to apps/api/tests/ as b005-distance-and-write.test.ts:
//   cd apps/api && npx vitest run tests/b005-distance-and-write.test.ts
// Expected on 1a12c62: both tests FAIL (they state the required behaviour).
//
// 1. selectTop3 rounds distanceKm to 0.1 km BEFORE sorting, so providers 1.21／1.22／1.23／1.24 km away all
//    become 1.2 and the tie-break (providerId) decides the Top 3: the farthest provider can beat a nearer one.
//    Rounding is for the response only (API_CONTRACT §9); ranking must use the computed distance.
// 2. createRecommendation writes RecommendationRun and RecommendationItems in two separate calls. If the
//    items write fails, the run stays behind with no items and can be referenced later (e.g. by a Lead).
//    The in-memory repository shows the service behaviour; the Supabase repository makes the same two
//    independent REST inserts, so there is no transaction around them either.
import { describe, it, expect } from "vitest";
import { createRecommendation } from "../src/services/recommendationService.js";
import {
  InMemoryAssessmentRepository, InMemoryProviderRepository, InMemoryRecommendationRepository, InMemorySessionRepository,
} from "../src/repositories/inMemoryRepositories.js";
import type { Assessment, Provider } from "../src/types/index.js";

const USER = { lat: 25.0, lng: 121.5 };
const KM_PER_DEG_LAT = 111.195; // haversine with R = 6371 km along a meridian

async function fixture(providers: Array<{ id: string; km: number }>) {
  const sessionRepo = new InMemorySessionRepository();
  const assessmentRepo = new InMemoryAssessmentRepository();
  const providerRepo = new InMemoryProviderRepository();
  const recommendationRepo = new InMemoryRecommendationRepository();
  const s = await sessionRepo.createSession();
  assessmentRepo.assessments.push({
    id: "ASM-J003", sessionId: s.id, ageRange: "75_84", city: "新北市", district: "三重區", locationPrecision: "GPS",
    lat: USER.lat, lng: USER.lng, livingSituation: "WITH_FAMILY", caregiverSituation: "FAMILY_LIMITED", mobilityLevel: "NEEDS_ASSISTANCE",
    dailyLivingLevel: "PARTIAL_ASSISTANCE", homeCareNeed: "YES", medicalNursingNeed: "UNKNOWN", assistiveDeviceNeed: "UNKNOWN",
    transportationNeed: "UNKNOWN", freeText: "", status: "COMPLETED", knowledgeVersion: "KB-2026-09-24-001",
    createdAt: "2026-09-27T10:00:00+08:00", updatedAt: "2026-09-27T10:00:00+08:00",
  } as unknown as Assessment);
  for (const p of providers) {
    providerRepo.providers.push({
      id: p.id, name: `synthetic ${p.id}`, type: "HOME_CARE", address: "synthetic", city: "新北市", district: "三重區",
      lat: USER.lat + p.km / KM_PER_DEG_LAT, lng: USER.lng, phone: null, website: null, googleMapsUrl: "https://maps.google.com/?q=synthetic",
      status: "ACTIVE", verified: true, createdAt: "2026-09-01T00:00:00+08:00", updatedAt: "2026-09-01T00:00:00+08:00",
    } as Provider);
    providerRepo.services.push({ id: `${p.id}-S`, providerId: p.id, serviceType: "HOME_CARE", active: true });
    providerRepo.serviceAreas.push({ id: `${p.id}-A`, providerId: p.id, city: "新北市", district: "三重區", active: true });
  }
  return { deps: { sessionRepo, assessmentRepo, providerRepo, recommendationRepo }, token: s.sessionToken, recommendationRepo };
}

describe("B-005 DISTANCE ranking and recommendation write", () => {
  it("ranks by the computed distance; the farthest provider (smallest id) is not in the Top 3", async () => {
    // Farthest gets the lexicographically smallest id, nearest the largest (Codex review, PR #40).
    const f = await fixture([{ id: "PROV-A", km: 1.24 }, { id: "PROV-B", km: 1.23 }, { id: "PROV-C", km: 1.22 }, { id: "PROV-D", km: 1.21 }]);
    const r = await createRecommendation(f.deps as never, { assessmentId: "ASM-J003", serviceType: "HOME_CARE" }, f.token);
    const data = (r as { data?: unknown }).data ?? r;
    const ids = ((data as { providers: Array<{ providerId?: string; id?: string }> }).providers).map((p) => p.providerId ?? p.id);
    expect(ids).toEqual(["PROV-D", "PROV-C", "PROV-B"]);
  });

  it("an items write failure leaves no run behind that could be used as a valid result", async () => {
    const f = await fixture([{ id: "PROV-A", km: 1 }, { id: "PROV-B", km: 2 }]);
    f.recommendationRepo.insertItems = async () => { throw new Error("simulated items write failure"); };
    await expect(createRecommendation(f.deps as never, { assessmentId: "ASM-J003", serviceType: "HOME_CARE" }, f.token)).rejects.toBeTruthy();
    expect(f.recommendationRepo.runs).toHaveLength(0);
  });
});
