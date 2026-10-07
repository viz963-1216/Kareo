// Publish only the isolated static presentation site; no Functions, env updates or paid upgrades.
import { execFileSync } from 'node:child_process';
import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = path.join(root, 'demo-dist');
const siteId = '8c1f7f95-4f25-4d3f-aa7d-b46016108462';
const manifest = JSON.parse(await readFile(path.join(out, 'kareo-demo-version.json'), 'utf8'));
if (manifest.scope !== 'STATIC-SYNTHETIC-DEMO' || manifest.workingTreeDirty !== false
    || !/^[a-f0-9]{40}$/.test(manifest.sourceCommit ?? '') || manifest.realApi !== false
    || manifest.realCases !== false || manifest.formalConsentActivated !== false) throw new Error('Rebuild a clean, synthetic demo artifact before publishing.');
const expected = new Set(['index.html', '_headers', '_redirects', 'demo-api-disabled.txt', 'kareo-demo-version.json', 'assets']);
for (const entry of await readdir(out, { withFileTypes: true })) {
  if (!expected.has(entry.name) || entry.isSymbolicLink()) throw new Error('Unexpected file in demo artifact.');
}
for (const entry of await readdir(path.join(out, 'assets'), { withFileTypes: true })) {
  if (!entry.isFile() || !/\.(js|css)$/.test(entry.name)) throw new Error('Unexpected demo asset.');
}
let token = process.env.NETLIFY_AUTH_TOKEN;
if (!token) {
  // Existing local Netlify CLI sign-in; never create, print or store a credential.
  const config = JSON.parse(await readFile(path.join(os.homedir(), 'Library/Preferences/netlify/config.json'), 'utf8'));
  token = config.users?.[config.userId]?.auth?.token;
}
if (!token) throw new Error('Use your existing Netlify CLI sign-in or server-side NETLIFY_AUTH_TOKEN.');
const headers = { Authorization: `Bearer ${token}` };
const base = 'https://api.netlify.com/api/v1';
const siteResponse = await fetch(`${base}/sites/${siteId}`, { headers });
if (!siteResponse.ok) throw new Error(`Demo site lookup failed: HTTP ${siteResponse.status}`);
const site = await siteResponse.json();
if (site.id !== siteId || site.name !== 'kareo-demo-tw' || site.account_id !== '6a83ce4e6082d9e35fc3d12a') throw new Error('Refusing to publish to another site or account.');
const temp = await mkdtemp(path.join(os.tmpdir(), 'kareo-demo-upload-'));
try {
  const archive = path.join(temp, 'demo.zip');
  execFileSync('zip', ['-qr', archive, '.'], { cwd: out });
  const response = await fetch(`${base}/sites/${siteId}/deploys`, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/zip' }, body: await readFile(archive),
  });
  if (!response.ok) throw new Error(`Demo upload failed: HTTP ${response.status}; no upgrade or retry purchase performed.`);
  const deploy = await response.json();
  console.log(JSON.stringify({ siteId, siteName: site.name, sourceCommit: manifest.sourceCommit, deployId: deploy.id, state: deploy.state, url: site.ssl_url, deployUrl: deploy.deploy_ssl_url }, null, 2));
} finally {
  await rm(temp, { recursive: true, force: true });
}
