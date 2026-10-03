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

export function routeMatches(pattern, path) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*').replace(/:[A-Za-z_][A-Za-z0-9_]*/g, '[^/]+');
  return new RegExp(`^${escaped}$`).test(path);
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
