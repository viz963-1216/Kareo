// J-003 deployment evidence: what version is actually deployed at a base URL.
// Reads <base-url>/kareo-version.json (written by scripts/build-site.mjs from Netlify's COMMIT_REF)
// and records exactly what was observed, including failures. It never fills in the target commit.
import { deploymentUrl, isFullSha, VERSION_MARKER } from '../../scripts/lib/release-target.mjs';

export async function observeDeployment(env, fetchImpl = fetch) {
  const url = deploymentUrl(env, VERSION_MARKER);
  url.searchParams.set('nocache', String(Date.now()));
  const observation = { versionUrl: deploymentUrl(env, VERSION_MARKER).href, fetchedAt: new Date().toISOString() };
  try {
    const response = await fetchImpl(url, { headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(15_000) });
    observation.httpStatus = response.status;
    const text = await response.text();
    let marker;
    try { marker = JSON.parse(text); } catch { return { ...observation, commit: null, error: 'version marker is not JSON (not deployed with J-003-r3 build?)' }; }
    if (!response.ok) return { ...observation, commit: null, error: `version marker HTTP ${response.status}` };
    if (!isFullSha(marker?.commit)) return { ...observation, commit: null, error: `version marker has no full commit (${JSON.stringify(marker?.commit ?? null)}; source ${marker?.commitSource ?? '?'})` };
    return { ...observation, commit: marker.commit, commitSource: marker.commitSource ?? null, context: marker.context ?? null, branch: marker.branch ?? null, deployId: marker.deployId ?? null, builtAt: marker.builtAt ?? null };
  } catch (e) {
    return { ...observation, commit: null, error: `version marker unreachable: ${e.message}` };
  }
}

// Evidence block stored in a result file. Both observations must equal the target for the run to count.
export function deploymentEvidence(before, after, targetCommit) {
  const matches = before.commit === targetCommit && after?.commit === targetCommit;
  return { method: VERSION_MARKER, targetCommit, before, after: after ?? null, matches };
}
