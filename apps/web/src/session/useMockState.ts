import { useSearchParams } from "react-router-dom";
import { apiMode } from "../api";
import { MOCK_STATES, type MockState } from "../api/mockScenarios";

/** Reads `?mockState=` for Mock acceptance. Always undefined against the real API. */
export function useMockState(): MockState | undefined {
  const [searchParams] = useSearchParams();
  if (apiMode !== "mock") return undefined;
  const value = searchParams.get("mockState");
  return MOCK_STATES.find((state) => state === value);
}
