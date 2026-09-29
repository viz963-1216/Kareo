import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
const root = new URL('./', import.meta.url);
const read = name => JSON.parse(readFileSync(new URL(name, root), 'utf8'));
const files = readdirSync(root, { recursive: true }).filter(name => name.endsWith('.json'));
for (const name of files) {
  const value = read(name);
  if (name.startsWith('requests/')) continue;
  assert.equal(typeof value.success, 'boolean', name);
  if (value.success) assert.ok(value.data && !value.error, name);
  else {
    assert.ok(value.error?.code && value.error?.message && !value.data, name);
    assert.ok(['SESSION_INVALID', 'FORBIDDEN', 'VALIDATION_ERROR', 'NOT_FOUND', 'KNOWLEDGE_STATE_CHANGED', 'INVALID_STATUS_TRANSITION'].includes(value.error.code), name);
  }
}
const preview = read('knowledge-publish-preview-response.json').data;
const published = read('knowledge-publish-response.json').data;
const request = read('requests/publish-request.json');
assert.equal(preview.totalRecordCount, preview.publishedRecordCount + preview.carriedForwardCount);
assert.equal(preview.newRecords.length, preview.publishedRecordCount);
assert.equal(request.versionId, preview.targetVersionId);
assert.equal(request.previewToken, preview.previewToken);
assert.equal(request.confirm, true);
assert.equal(published.versionId, preview.targetVersionId);
for (const key of ['publishedRecordCount', 'carriedForwardCount', 'totalRecordCount', 'supersededRecordCount', 'excludedRecordCount']) assert.equal(published[key], preview[key], key);
for (const outcome of ['approved', 'rejected']) {
  const req = read(`requests/record-decision-${outcome}-request.json`);
  const res = read(`knowledge-record-${outcome}-response.json`).data;
  assert.equal(req.decision, outcome.toUpperCase());
  assert.equal(res.record.status, req.decision);
  assert.equal(res.review.decision, req.decision);
  assert.equal(req.expectedContentFingerprint, res.record.contentFingerprint);
  assert.ok(req.reason.trim());
  assert.equal(req.confirm, true);
}
const versions = read('knowledge-restorable-versions-response.json').data;
assert.ok(versions.versions.every(v => v.versionId !== versions.currentVersion.versionId));
for (const [scenario, response] of [['republish', 'knowledge-withdraw-response.json'], ['no-republish', 'knowledge-withdraw-no-republish-response.json']]) {
  const req = read(`requests/withdraw-${scenario}-request.json`);
  const res = read(response).data;
  if (scenario === "republish") assert.equal(req.withdrawVersionId, versions.currentVersion.versionId);
  assert.equal(res.withdrawnVersionId, req.withdrawVersionId);
  assert.equal(res.republishedVersionId, req.republishVersionId);
  assert.ok(req.reason.trim());
  assert.equal(req.confirm, true);
  assert.ok(req.republishVersionId === null || versions.versions.some(v => v.versionId === req.republishVersionId));
}
console.log(`PASS: ${files.length} admin JSON fixtures; envelope and publish/decision/withdraw consistency`);
