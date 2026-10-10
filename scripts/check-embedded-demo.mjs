import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('dist');
const main = await readFile(path.join(root, 'index.html'), 'utf8');
const demo = await readFile(path.join(root, 'demo/index.html'), 'utf8');
assert.match(main, /src="\/assets\//, 'main site retains its own assets');
assert.match(demo, /src="\/demo\/assets\//, 'Demo assets must stay below /demo/');
assert.match(demo, /connect-src 'none'/, 'Demo cannot send answers through fetch/XHR');
assert.match(demo, /form-action 'none'/, 'Demo cannot submit HTML forms');
const marker = JSON.parse(await readFile(path.join(root, 'demo/kareo-demo-version.json'), 'utf8'));
assert.equal(marker.basePath, '/demo/');
assert.equal(marker.realApi, false);
assert.equal(marker.realCases, false);
assert.equal(marker.formalConsentActivated, false);
assert.equal(marker.publicProviderData, true);
assert.ok(marker.providerCount > 0);
for (const file of await readdir(path.join(root, 'demo/assets'))) {
  if (!file.endsWith('.js')) continue;
  const bundle = await readFile(path.join(root, 'demo/assets', file), 'utf8');
  assert.doesNotMatch(bundle, /SES-MOCK|CON-MOCK|ASM-MOCK|KB-MOCK|PROV-MOCK|REC-MOCK|LEAD-MOCK/, 'Demo uses public records, not contract fixtures');
}
console.log('Embedded Demo: separate assets, no-network CSP, public-data marker and fixture scan PASS.');
