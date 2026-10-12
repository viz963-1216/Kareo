import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';

const html = await readFile('dist/index.html', 'utf8');
assert.match(html, /src="\/assets\//);
assert.match(html, /connect-src 'self'/);
assert.match(html, /form-action 'none'/);
assert.ok(!existsSync('dist/demo'), 'public site must not publish an embedded Demo');
const marker = JSON.parse(await readFile('dist/kareo-public-version.json', 'utf8'));
assert.equal(marker.demo, false);
assert.equal(marker.publicReadApi, 'real');
assert.equal(marker.personalAnalysis, 'browser-memory');
assert.equal(marker.cloudPersonalCollection, false);
assert.equal(marker.formalConsentActivated, false);
assert.ok(marker.providerInventoryCount > 0);
assert.ok((await readdir('dist/residence')).length > 0, 'offline address modules are present');
for (const file of await readdir('dist/assets')) {
  if (!file.endsWith('.js')) continue;
  const bundle = await readFile(`dist/assets/${file}`, 'utf8');
  assert.doesNotMatch(bundle, /SES-MOCK|CON-MOCK|ASM-MOCK|KB-MOCK|PROV-MOCK|REC-MOCK|LEAD-MOCK/);
}
console.log('PASS: public root artifact, real queries, browser-memory analysis, no Demo or mock fixtures.');
