// J-003: build-time checks for frontend deploy settings. Same mock rule as apps/web/src/api/mode.ts
// (tests/web/mode.test.ts keeps them in sync). Returns a list of problems; any problem fails the build.
export function frontendEnvProblems(env) {
  const problems = [];
  if (env.VITE_KAREO_PUBLIC_ANALYSIS === 'true') {
    if (env.KAREO_RELEASE_SCOPE !== 'public-resources' || env.VITE_KAREO_API_MODE !== 'real') {
      problems.push('Public analysis requires public-resources scope and real read-only APIs.');
    }
    if (env.VITE_KAREO_DEMO === 'true' || env.VITE_KAREO_ENABLE_DEMO === 'true') {
      problems.push('Public analysis and Demo publication must not be enabled together.');
    }
    if (env.VITE_KAREO_ENABLE_PRECISE_LOCATION === 'true') {
      problems.push('Browser-only public analysis does not enable device GPS.');
    }
    for (const key of ['VITE_CONSENT_DISCLAIMER_VERSION', 'VITE_CONSENT_PRIVACY_VERSION', 'VITE_CONSENT_TERMS_VERSION']) {
      if (env[key]) problems.push(`Browser-only public analysis must leave ${key} unset.`);
    }
  }
  if (env.VITE_KAREO_ENABLE_DEMO === 'true' && env.KAREO_RELEASE_SCOPE !== 'public-resources') {
    problems.push('The embedded Demo requires the explicit public-resources release scope.');
  }
  if (env.VITE_KAREO_DEMO === 'true') problems.push('Static presentation builds must use scripts/build-demo.mjs, never the standard Netlify/site build.');
  const context = env.CONTEXT || 'local';
  const mode = env.VITE_KAREO_API_MODE;
  if (mode !== undefined && mode !== '' && mode !== 'mock' && mode !== 'real') {
    problems.push(`VITE_KAREO_API_MODE must be "mock" or "real" (got "${mode}").`);
  }
  if (mode === 'mock' && context !== 'deploy-preview' && context !== 'local') {
    problems.push(`VITE_KAREO_API_MODE=mock is only allowed for deploy previews; this is a "${context}" build.`);
  }
  // release is the deployment branch; main retains its legacy strict checks.
  if (env.BRANCH === 'release' || env.BRANCH === 'main') {
    const branch = env.BRANCH;
    const publicOnly = env.KAREO_RELEASE_SCOPE === 'public-resources';
    if (mode === 'mock') problems.push(`The ${branch} branch can never be built in mock mode.`);
    if (env.VITE_KAREO_REQUIRE_SESSION_TOKEN !== 'true') {
      problems.push(`The ${branch} branch requires VITE_KAREO_REQUIRE_SESSION_TOKEN=true (API_CONTRACT §3.1, B-011a).`);
    }
    for (const key of ['VITE_CONSENT_DISCLAIMER_VERSION', 'VITE_CONSENT_PRIVACY_VERSION', 'VITE_CONSENT_TERMS_VERSION']) {
      // Explicit public-only publication keeps consent unconfigured, so the existing frontend
      // cannot begin a personal assessment. Full activation still needs D-05 and the strict gate.
      if (publicOnly && env[key]) problems.push(`Public-only publication must leave ${key} unset.`);
      if (!publicOnly && !env[key]) problems.push(`The ${branch} branch requires ${key} (an ACTIVE version, PRIVACY_AND_RETENTION §3.2).`);
    }
  }
  return problems;
}
