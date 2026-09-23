// TASK-J-003: decides whether the frontend talks to the mock adapter or the real API.
// Mock is allowed only in local development (vite dev, or scripts/build-site.mjs run locally without
// Netlify CONTEXT) and Netlify deploy previews. Any other build that
// asks for mock gets the real API plus a reported problem; scripts/build-site.mjs fails such
// builds before they are deployed (same rule, scripts/lib/frontend-env.mjs).

export type ApiMode = "mock" | "real";

export interface ApiModeEnv {
  requested?: string;
  dev: boolean;
  deployContext?: string;
}

export function resolveApiMode(env: ApiModeEnv): { mode: ApiMode; problem: string | null } {
  const { requested, dev, deployContext } = env;
  if (requested === undefined || requested === "") return { mode: dev ? "mock" : "real", problem: null };
  if (requested === "real") return { mode: "real", problem: null };
  if (requested === "mock") {
    if (dev || deployContext === "deploy-preview" || deployContext === "local") return { mode: "mock", problem: null };
    return {
      mode: "real",
      problem: `VITE_KAREO_API_MODE=mock is not allowed in deploy context "${deployContext ?? "unknown"}"; using the real API.`,
    };
  }
  return { mode: "real", problem: `Unknown VITE_KAREO_API_MODE "${requested}"; using the real API.` };
}
