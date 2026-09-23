// J-003 release target: the exact commit being released and the deployment it is verified on.
// Shared by scripts/acceptance-gate.mjs, tests/e2e/run-api-e2e.mjs and scripts/build-site.mjs so the
// CLI flags, environment variables and URL rules are identical everywhere.
//
//   --commit=<40-hex sha>   or KAREO_RELEASE_COMMIT
//   --base-url=<https url>  or KAREO_RELEASE_BASE_URL
//
// The deployed version marker is <base-url>/kareo-version.json, written by scripts/build-site.mjs.

export const VERSION_MARKER = 'kareo-version.json';
const SHA = /^[0-9a-f]{40}$/;
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '0.0.0.0']);

export function isFullSha(value) {
  return typeof value === 'string' && SHA.test(value);
}

// Normalizes a deployment URL with the WHATWG URL parser. The environment key keeps the path, so
// https://host/app and https://host/app2 (or https://host/) are different environments.
// Returns { key, url } or { error }.
export function normalizeEnvironment(raw, { allowInsecure = false } = {}) {
  let url;
  try {
    url = new URL(String(raw ?? ''));
  } catch {
    return { error: `not a valid URL: ${JSON.stringify(raw)}` };
  }
  if (url.username || url.password) return { error: 'URL must not contain credentials' };
  if (url.search || url.hash) return { error: 'URL must not contain a query or fragment' };
  if (!allowInsecure) {
    if (url.protocol !== 'https:') return { error: `must be https (got ${url.protocol})` };
    if (LOOPBACK.has(url.hostname) || url.hostname.endsWith('.localhost') || /^127\./.test(url.hostname)) {
      return { error: `must be a deployed host, not ${url.hostname}` };
    }
  } else if (!['https:', 'http:'].includes(url.protocol)) {
    return { error: `must be http(s) (got ${url.protocol})` };
  }
  const path = url.pathname.replace(/\/+$/, '');
  return { key: `${url.protocol}//${url.host}${path}`, url: new URL(`${url.protocol}//${url.host}${path}/`) };
}

// Resolves a path such as /api/v1/session under the deployment, keeping any sub-path.
export function deploymentUrl(env, path) {
  return new URL(path.replace(/^\/+/, ''), env.url);
}

function flag(argv, name) {
  const prefix = `--${name}=`;
  const eq = argv.find((a) => a.startsWith(prefix));
  if (eq) return eq.slice(prefix.length);
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
}

// Reads the release target from CLI flags (preferred) or environment variables.
// Returns { commit, env, problems[] }; commit/env are undefined when missing or invalid.
export function resolveReleaseTarget(argv, environment = process.env, options = {}) {
  const problems = [];
  const rawCommit = flag(argv, 'commit') ?? environment.KAREO_RELEASE_COMMIT;
  const rawBase = flag(argv, 'base-url') ?? environment.KAREO_RELEASE_BASE_URL;
  let commit;
  if (!rawCommit) problems.push('missing target commit (--commit=<40-hex sha> or KAREO_RELEASE_COMMIT)');
  else if (!isFullSha(rawCommit)) problems.push(`target commit must be a full 40-character lowercase SHA, got ${JSON.stringify(rawCommit)}`);
  else commit = rawCommit;
  let env;
  if (!rawBase) problems.push('missing target deployment (--base-url=<https url> or KAREO_RELEASE_BASE_URL)');
  else {
    const n = normalizeEnvironment(rawBase, options);
    if (n.error) problems.push(`target base URL ${n.error}`);
    else env = n;
  }
  return { commit, env, problems };
}
