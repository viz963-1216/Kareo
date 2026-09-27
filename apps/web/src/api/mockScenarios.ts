// Mock acceptance scenario names. Kept free of fixture imports so UI code can read them without pulling
// the mock adapter or contracts/mock data into real-API bundles (CI greps dist for mock IDs).

/** `?mockState=`: "error-once" fails the first call and succeeds on retry; "duplicate" returns an existing lead. */
export type MockState = "error" | "error-once" | "session-expired" | "knowledge-unavailable" | "duplicate";
export const MOCK_STATES: readonly MockState[] = ["error", "error-once", "session-expired", "knowledge-unavailable", "duplicate"];

export type RecommendationMockCount = 0 | 1 | 2 | 3;

/** `?mockRanking=`: forces a recommendation scenario (contracts/mock/README.md, J-002-r4). */
export type RecommendationMockRanking = "distance" | "missing-coordinates" | "district" | "city" | "no-location";
export const RECOMMENDATION_MOCK_RANKINGS: readonly RecommendationMockRanking[] = [
  "distance",
  "missing-coordinates",
  "district",
  "city",
  "no-location",
];

export type AssessmentMockScenario = "empty" | "basic" | "subsidy-new-taipei" | "disability-new-taipei" | "estimate-general-new-taipei";

/** Selects a complete contract fixture; callers must never concatenate summaries or calculate policy values. */
export function assessmentMockScenario(input: {
  hasCareNeeds: boolean;
  city: string | null;
  district: string | null;
  disabilityCertificate?: string;
  incomeCategory?: string;
}): AssessmentMockScenario {
  if (!input.hasCareNeeds) return "empty";
  if (input.city !== "新北市" || input.district !== "三重區") return "basic";
  if (input.disabilityCertificate === "YES" && input.incomeCategory === "GENERAL") return "estimate-general-new-taipei";
  if (input.disabilityCertificate === "YES") return "disability-new-taipei";
  return "subsidy-new-taipei";
}
