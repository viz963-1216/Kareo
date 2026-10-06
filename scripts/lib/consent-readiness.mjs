// Read the checked-out consent registry; this never activates or invents a version.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const VERSION_KEYS = ['disclaimerVersion', 'privacyVersion', 'termsVersion'];
export function activeConsentVersions(registry) {
  if (!Array.isArray(registry?.versions)) return null;
  const active = registry.versions.find((entry) => entry?.status === 'ACTIVE'
    && VERSION_KEYS.every((key) => typeof entry[key] === 'string' && entry[key].trim()
      && !entry[key].endsWith('-draft')));
  return active ? Object.fromEntries(VERSION_KEYS.map((key) => [key, active[key]])) : null;
}

export function readActiveConsent(root = process.cwd()) {
  try {
    return activeConsentVersions(JSON.parse(readFileSync(join(root, 'contracts/legal/consent-versions.json'), 'utf8')));
  } catch {
    // Do not echo file contents, private paths or parse errors into shared logs.
    return null;
  }
}
