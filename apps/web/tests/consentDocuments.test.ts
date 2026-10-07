import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { retrieveConsentDocument, selectConsentArchive, type ConsentArchive } from '../src/consent/documents.ts';

const text = '# Synthetic consent document\n本機合成測試，不是正式文案。\n';
const archive: ConsentArchive = { version: '2099-01-01-r1', disclaimerVersion: 'D', privacyVersion: 'P', termsVersion: 'T',
  fullTextSha256: createHash('sha256').update(text).digest('hex'), fullTextUrl: '/privacy/versions/2099-01-01-r1.txt',
  assessmentConsentText: '合成測試同意。', active: true };
const versions = { disclaimerVersion: 'D', privacyVersion: 'P', termsVersion: 'T' };

test('frontend requires one ACTIVE exact combination and a fixed local full-text URL', () => {
  const manifest = { schemaVersion: 1, archives: [archive] };
  assert.deepEqual(selectConsentArchive(manifest, versions), archive);
  for (const supplied of [null, { ...versions, termsVersion: 'unknown' }, { ...versions, privacyVersion: 'P-draft' }]) {
    assert.equal(selectConsentArchive(manifest, supplied), null);
  }
  for (const patch of [{ active: false }, { fullTextSha256: 'bad' }, { fullTextUrl: 'https://example.invalid/document' }, { assessmentConsentText: '' }]) {
    assert.equal(selectConsentArchive({ schemaVersion: 1, archives: [{ ...archive, ...patch }] }, versions), null);
  }
  assert.equal(selectConsentArchive({ schemaVersion: 1, archives: [archive, archive] }, versions), null);
});

test('real HTTP retrieval rejects HTML, errors and changed bytes instead of accepting fallback copy', async () => {
  let body = text, contentType = 'text/plain; charset=utf-8', status = 200;
  const server = createServer((_request, response) => { response.writeHead(status, { 'Content-Type': contentType }); response.end(body); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const request: typeof fetch = (input, init) => fetch(`http://127.0.0.1:${address.port}${input}`, init);
  try {
    assert.equal(await retrieveConsentDocument(archive, request), text);
    body = text + 'changed'; await assert.rejects(retrieveConsentDocument(archive, request), /fingerprint/);
    body = text; contentType = 'text/html'; await assert.rejects(retrieveConsentDocument(archive, request), /unavailable/);
    contentType = 'text/plain'; status = 404; await assert.rejects(retrieveConsentDocument(archive, request), /unavailable/);
    status = 200; body = ''; await assert.rejects(retrieveConsentDocument(archive, request), /size/);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
