import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { publishConsentDocuments } from '../../scripts/lib/consent-document-archive.mjs';

test('formal archive refuses incomplete approvals, changed bytes, mismatched backend binding; preserves retired text', async () => {
  const root = await mkdtemp(join(tmpdir(), 'kareo-synthetic-consent-'));
  try {
    const directory = join(root, 'contracts/legal/versions'); await mkdir(directory, { recursive: true });
    const version = '2099-01-01-r1';
    const versions = { disclaimerVersion: version, privacyVersion: version, termsVersion: version };
    const text = Buffer.from(`# Kareo 同意文案 — ${version}\n\n本機合成資料，不可作正式文案。\n\n## 免責聲明\n測試免責。\n\n## 隱私告知\n測試隱私。\n\n## 服務條款\n測試條款。\n\n## 評估同意文字\n我同意這個合成測試。\n`);
    const fingerprint = createHash('sha256').update(text).digest('hex');
    const entry = { ...versions, status: 'ACTIVE', textRef: `contracts/legal/versions/${version}.md`, fullTextSha256: fingerprint };
    const review = { intendedVersion: version, consentVersions: versions, fullTextPath: entry.textRef, fullTextSha256: fingerprint,
      status: 'OWNER_APPROVED', activationAllowed: true, approvalConditionsSatisfied: true,
      approvedBy: 'SYNTHETIC-LOCAL-ONLY', approvedAt: '2099-01-01', approvalEvidence: 'synthetic-test-only' };
    const registryPath = join(root, 'contracts/legal/consent-versions.json');
    const reviewPath = join(directory, `${version}.review.json`);
    const set = async (reviewPatch = {}, entryPatch = {}) => {
      await writeFile(registryPath, JSON.stringify({ versions: [{ ...entry, ...entryPatch }] }));
      await writeFile(reviewPath, JSON.stringify({ ...review, ...reviewPatch }));
    };
    await writeFile(join(directory, `${version}.md`), text); await set();
    const output = join(root, 'dist');
    const manifest = await publishConsentDocuments(root, output);
    assert.equal(manifest.archives[0].active, true);
    assert.equal(manifest.archives[0].assessmentConsentText, '我同意這個合成測試。');
    assert.deepEqual(await readFile(join(output, `privacy/versions/${version}.txt`)), text);
    assert.ok(!JSON.stringify(manifest).includes('SYNTHETIC-LOCAL-ONLY'));
    for (const patch of [{ status: 'OWNER_APPROVED_CONDITIONAL' }, { activationAllowed: false },
      { approvalConditionsSatisfied: false }, { approvedBy: null }, { approvalEvidence: null },
      { fullTextPath: '../../outside.md' }, { fullTextSha256: '0'.repeat(64) }]) {
      await set(patch); await assert.rejects(publishConsentDocuments(root, output));
    }
    for (const patch of [{ fullTextSha256: '0'.repeat(64) }, { textRef: 'other' }, { termsVersion: 'other' }]) {
      await set({}, patch); await assert.rejects(publishConsentDocuments(root, output));
    }
    await set({}, { status: 'DRAFT' });
    assert.equal((await publishConsentDocuments(root, output)).archives[0].active, false);
    assert.deepEqual(await readFile(join(output, `privacy/versions/${version}.txt`)), text);
    await set(); await writeFile(join(directory, `${version}.md`), 'tampered');
    await assert.rejects(publishConsentDocuments(root, output), /fingerprint/);
    await rm(reviewPath); await assert.rejects(publishConsentDocuments(root, output), /no uniquely approved/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the real draft registry produces no active formal archives', async () => {
  const output = await mkdtemp(join(tmpdir(), 'kareo-draft-consent-'));
  try {
    const manifest = await publishConsentDocuments(new URL('../..', import.meta.url).pathname, output);
    assert.deepEqual(manifest, { schemaVersion: 1, archives: [] });
  } finally { await rm(output, { recursive: true, force: true }); }
});
