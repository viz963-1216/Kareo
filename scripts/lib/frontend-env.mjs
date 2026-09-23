// J-003: build-time checks for frontend deploy settings. Same mock rule as apps/web/src/api/mode.ts
// (tests/web/mode.test.ts keeps them in sync). Returns a list of problems; any problem fails the build.
export function frontendEnvProblems(env) {
  const problems = [];
  const context = env.CONTEXT || 'local';
  const mode = env.VITE_KAREO_API_MODE;
  if (mode !== undefined && mode !== '' && mode !== 'mock' && mode !== 'real') {
    problems.push(`VITE_KAREO_API_MODE must be "mock" or "real" (got "${mode}").`);
  }
  if (mode === 'mock' && context !== 'deploy-preview' && context !== 'local') {
    problems.push(`VITE_KAREO_API_MODE=mock is only allowed for deploy previews; this is a "${context}" build.`);
  }
  // main is the public release branch (kareo-tw production branch is staging, so CONTEXT alone is not enough).
  if (env.BRANCH === 'main') {
    if (mode === 'mock') problems.push('The main branch can never be built in mock mode.');
    if (env.VITE_KAREO_REQUIRE_SESSION_TOKEN !== 'true') {
      problems.push('The main branch requires VITE_KAREO_REQUIRE_SESSION_TOKEN=true (API_CONTRACT §3.1, B-011a).');
    }
    for (const key of ['VITE_CONSENT_DISCLAIMER_VERSION', 'VITE_CONSENT_PRIVACY_VERSION', 'VITE_CONSENT_TERMS_VERSION']) {
      if (!env[key]) problems.push(`The main branch requires ${key} (an ACTIVE version, PRIVACY_AND_RETENTION §3.2).`);
    }
  }
  return problems;
}
