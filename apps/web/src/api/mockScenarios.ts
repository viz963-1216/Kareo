// Mock acceptance scenario names. Kept free of fixture imports so UI code can read them without pulling
// the mock adapter or contracts/mock data into real-API bundles (CI greps dist for mock IDs).

/** `?mockState=`: "error-once" fails the first call and succeeds on retry. */
export type MockState = "error" | "error-once" | "session-expired" | "knowledge-unavailable";
export const MOCK_STATES: readonly MockState[] = ["error", "error-once", "session-expired", "knowledge-unavailable"];

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
