// J-003: mock mode must never be used outside local development and deploy previews.
import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveApiMode } from "../../apps/web/src/api/mode.ts";
import { frontendEnvProblems } from "../../scripts/lib/frontend-env.mjs";

test("defaults: dev server uses mock, builds use the real API", () => {
  assert.deepEqual(resolveApiMode({ dev: true }), { mode: "mock", problem: null });
  assert.deepEqual(resolveApiMode({ dev: false }), { mode: "real", problem: null });
  assert.deepEqual(resolveApiMode({ dev: false, requested: "" }), { mode: "real", problem: null });
});

test("mock is allowed only in dev, local builds and deploy previews", () => {
  for (const deployContext of ["deploy-preview", "local"]) {
    assert.equal(resolveApiMode({ dev: false, requested: "mock", deployContext }).mode, "mock");
  }
  for (const deployContext of ["production", "branch-deploy", undefined]) {
    const result = resolveApiMode({ dev: false, requested: "mock", deployContext });
    assert.equal(result.mode, "real");
    assert.match(result.problem ?? "", /not allowed/);
  }
});

test("unknown mode values fall back to the real API with a problem", () => {
  const result = resolveApiMode({ dev: true, requested: "Mock" });
  assert.equal(result.mode, "real");
  assert.ok(result.problem);
});

test("build guard rejects every production mock build the runtime would refuse", () => {
  for (const context of ["production", "branch-deploy", "deploy-preview", undefined]) {
    for (const requested of ["mock", "real", undefined]) {
      const env = { CONTEXT: context, VITE_KAREO_API_MODE: requested };
      const buildOk = frontendEnvProblems(env).length === 0;
      const runtime = resolveApiMode({ dev: false, requested, deployContext: context ?? "local" });
      if (buildOk && requested !== undefined) assert.equal(runtime.mode, requested, JSON.stringify(env));
      if (!buildOk) assert.ok(runtime.problem, `runtime should also flag ${JSON.stringify(env)}`);
    }
  }
});

test("main branch requires real mode, session tokens and consent versions", () => {
  const problems = frontendEnvProblems({ CONTEXT: "production", BRANCH: "main" });
  assert.ok(problems.some((p) => p.includes("VITE_KAREO_REQUIRE_SESSION_TOKEN")));
  assert.ok(problems.some((p) => p.includes("VITE_CONSENT_PRIVACY_VERSION")));
  assert.ok(frontendEnvProblems({ CONTEXT: "production", BRANCH: "main", VITE_KAREO_API_MODE: "mock" }).some((p) => p.includes("mock")));
  assert.deepEqual(
    frontendEnvProblems({
      CONTEXT: "production",
      BRANCH: "main",
      VITE_KAREO_REQUIRE_SESSION_TOKEN: "true",
      VITE_CONSENT_DISCLAIMER_VERSION: "1.0",
      VITE_CONSENT_PRIVACY_VERSION: "1.0",
      VITE_CONSENT_TERMS_VERSION: "1.0",
    }),
    [],
  );
  // staging is the kareo-tw production branch: it may run while B-011a is pending.
  assert.deepEqual(frontendEnvProblems({ CONTEXT: "production", BRANCH: "staging" }), []);
});
