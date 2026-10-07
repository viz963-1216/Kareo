export interface ConsentVersions {
  disclaimerVersion: string;
  privacyVersion: string;
  termsVersion: string;
}

export interface ConsentArchive extends ConsentVersions {
  version: string;
  fullTextSha256: string;
  fullTextUrl: string;
  assessmentConsentText: string;
  active: boolean;
}

export interface ConsentManifest {
  schemaVersion: number;
  archives: ConsentArchive[];
}

// The expected fingerprint comes from the compiled, approved registry, never a fetched index.
export function selectConsentArchive(manifest: ConsentManifest, versions: ConsentVersions | null): ConsentArchive | null {
  if (!versions || manifest.schemaVersion !== 1 || !Array.isArray(manifest.archives)) return null;
  const matching = manifest.archives.filter(archive => archive.active === true
    && (['disclaimerVersion', 'privacyVersion', 'termsVersion'] as const).every(key =>
      typeof versions[key] === 'string' && versions[key].length > 0
      && !versions[key].endsWith('-draft') && archive[key] === versions[key]));
  if (matching.length !== 1) return null;
  const archive = matching[0];
  return /^\d{4}-\d{2}-\d{2}-r\d+$/.test(archive.version)
    && archive.fullTextUrl === `/privacy/versions/${archive.version}.txt`
    && /^[a-f0-9]{64}$/.test(archive.fullTextSha256) && !!archive.assessmentConsentText?.trim() ? archive : null;
}

export async function retrieveConsentDocument(archive: ConsentArchive, request: typeof fetch = fetch): Promise<string> {
  if (!/^\d{4}-\d{2}-\d{2}-r\d+$/.test(archive.version)
      || archive.fullTextUrl !== `/privacy/versions/${archive.version}.txt`
      || !/^[a-f0-9]{64}$/.test(archive.fullTextSha256)) throw new Error('Invalid consent archive');
  const response = await request(archive.fullTextUrl, {
    headers: { Accept: 'text/plain' }, credentials: 'omit', cache: 'no-store', redirect: 'error',
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok || !/^text\/plain(?:;|$)/i.test(response.headers.get('content-type') ?? '')) {
    throw new Error('Consent document unavailable');
  }
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength === 0 || bytes.byteLength > 256 * 1024) throw new Error('Invalid consent document size');
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
    .map(byte => byte.toString(16).padStart(2, '0')).join('');
  if (hash !== archive.fullTextSha256) throw new Error('Consent document fingerprint mismatch');
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
