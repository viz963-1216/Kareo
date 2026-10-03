// Static route declarations only; these helpers do not prove deployed HTTP behaviour.
export function parseRedirects(toml) {
  return [...toml.matchAll(/\[\[redirects\]\]\s*\n\s*from = "([^"]+)"\s*\n\s*to = "([^"]+)"/g)]
    .map((m) => ({ from: m[1], to: m[2] }));
}

export function contractEndpoints(contract) {
  const entries = [
    ...contract.matchAll(/^#{2,3} (?:\d+(?:\.\d+)*\.?(?: )?)?(GET|POST|DELETE|PUT|PATCH) (\/api\/v1\/[^\s（(]+)/gm),
    ...contract.matchAll(/`(GET|POST|DELETE|PUT|PATCH) (\/api\/v1\/[^`?\s]+)/g),
  ];
  return [...new Map(entries.map((m) => {
    const path = m[2].split('?')[0];
    return [`${m[1]} ${path}`, { method: m[1], path }];
  })).values()];
}

// Netlify ignores trailing slashes; a terminal splat may also match an empty suffix.
// Splats in the middle are unsupported: use a named placeholder for one segment.
export function validRoutePattern(pattern) {
  return !pattern.includes('*') || (pattern.endsWith('/*') && pattern.indexOf('*') === pattern.length - 1);
}

export function routeMatches(pattern, path) {
  if (!validRoutePattern(pattern)) return false;
  const normalized = pattern.replace(/\/$/, '');
  const escaped = normalized.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\/\*$/, '(?:/.*)?').replace(/:[A-Za-z_][A-Za-z0-9_]*/g, '[^/]+');
  return new RegExp(`^${escaped}/?$`).test(path);
}

export function declaresEndpoint(route, endpoint) {
  return examplePath(route.from) === examplePath(endpoint.path);
}

export function examplePath(path) {
  return path.replace(/\{[^}]+\}|:[A-Za-z_][A-Za-z0-9_]*|\*/g, 'RUNTIME-CHECK');
}

export function firstRedirect(redirects, path) {
  return redirects.find((r) => routeMatches(r.from, path));
}

export function functionName(redirect) {
  return redirect?.to.match(/^\/\.netlify\/functions\/([A-Za-z0-9_-]+)$/)?.[1] ?? null;
}
