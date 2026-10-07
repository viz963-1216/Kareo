// Public, immutable consent text. Approval is an input; this function never grants it.
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const keys = ['disclaimerVersion', 'privacyVersion', 'termsVersion'];
const sameVersions = (a, b) => keys.every(key => typeof a?.[key] === 'string' && a[key] === b?.[key]);

export async function publishConsentDocuments(root, output) {
  const directory = join(root, 'contracts/legal/versions');
  let files;
  try { files = await readdir(directory); }
  catch (error) { if (error.code !== 'ENOENT') throw error; files = []; }
  const registry = JSON.parse(await readFile(join(root, 'contracts/legal/consent-versions.json'), 'utf8'));
  if (!Array.isArray(registry.versions)) throw new Error('Invalid consent registry');
  const archives = [];
  const verifiedBytes = new Map();
  for (const file of files.filter(f => /^\d{4}-\d{2}-\d{2}-r\d+\.review\.json$/.test(f)).sort()) {
    const version = file.replace('.review.json', '');
    const review = JSON.parse(await readFile(join(directory, file), 'utf8'));
    const fullTextPath = `contracts/legal/versions/${version}.md`;
    if (review.intendedVersion !== version || review.fullTextPath !== fullTextPath
        || review.status !== 'OWNER_APPROVED' || review.activationAllowed !== true
        || review.approvalConditionsSatisfied !== true || typeof review.approvedBy !== 'string' || !review.approvedBy.trim()
        || typeof review.approvedAt !== 'string' || !review.approvedAt.trim()
        || typeof review.approvalEvidence !== 'string' || !review.approvalEvidence.trim()
        || !keys.every(key => typeof review.consentVersions?.[key] === 'string'
          && review.consentVersions[key].trim() && !review.consentVersions[key].endsWith('-draft'))) {
      throw new Error('Formal consent lacks a completed, exact approval record');
    }
    const bytes = await readFile(join(root, fullTextPath));
    if (!bytes.length || bytes.length > 256 * 1024) throw new Error('Invalid formal consent size');
    const fullTextSha256 = createHash('sha256').update(bytes).digest('hex');
    if (fullTextSha256 !== review.fullTextSha256) throw new Error('Formal consent content fingerprint changed');
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (!text.startsWith(`# Kareo 同意文案 — ${version}\n\n`)
        || !['免責聲明', '隱私告知', '服務條款', '評估同意文字'].every(title => text.split(`\n## ${title}\n`).length === 2)) {
      throw new Error('Formal consent is missing versioned document sections');
    }
    const assessmentConsentText = text.split('\n## 評估同意文字\n')[1].split(/\n## /)[0].trim();
    if (!assessmentConsentText || assessmentConsentText.includes('\n') || assessmentConsentText.length > 2000) {
      throw new Error('Formal assessment consent must be one explicit text paragraph');
    }
    // A fixed review fingerprint is independently bound to the backend registry.
    const activeEntries = registry.versions.filter(entry => entry.status === 'ACTIVE' && sameVersions(entry, review.consentVersions));
    if (activeEntries.some(entry => entry.textRef !== fullTextPath || entry.fullTextSha256 !== fullTextSha256)) {
      throw new Error('Active consent registry does not bind to the approved full text');
    }
    archives.push({ version, ...review.consentVersions, fullTextSha256,
      fullTextUrl: `/privacy/versions/${version}.txt`, assessmentConsentText, active: activeEntries.length === 1 });
    if (activeEntries.length > 1) throw new Error('Ambiguous active consent combination');
    verifiedBytes.set(version, bytes);
  }
  for (const entry of registry.versions.filter(entry => entry.status === 'ACTIVE')) {
    if (archives.filter(archive => archive.active && sameVersions(archive, entry)).length !== 1) {
      throw new Error('Active consent has no uniquely approved full-text archive');
    }
  }
  const target = join(output, 'privacy/versions');
  await mkdir(target, { recursive: true });
  // Keep approved historical archives downloadable even after registry retirement.
  for (const archive of archives) {
    await writeFile(join(target, `${archive.version}.txt`), verifiedBytes.get(archive.version));
  }
  const manifest = { schemaVersion: 1, archives };
  await writeFile(join(target, 'formal-index.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}
