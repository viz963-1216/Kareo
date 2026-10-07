// Standalone static presentation artifact. Never use this for kareo-tw acceptance or production.
import { execFileSync } from 'node:child_process';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
if (process.env.NETLIFY || process.env.CONTEXT || process.env.BRANCH === 'main') {
  throw new Error('Build the separate presentation artifact locally; never in the standard Netlify/main pipeline.');
}
const clean = !execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim();
const commit = clean ? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim() : null;
// Only ordinary local process settings reach the build. No backend or provider credentials.
const env = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'LANG'].filter(key => process.env[key]).map(key => [key, process.env[key]]));
Object.assign(env, { VITE_KAREO_DEMO: 'true', VITE_KAREO_API_MODE: 'mock', VITE_KAREO_DEPLOY_CONTEXT: 'local' });
execFileSync('npm', ['run', 'build', '--prefix', 'apps/web'], { cwd: root, env, stdio: 'inherit' });
const out = path.join(root, 'demo-dist');
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(path.join(root, 'apps/web/dist'), out, { recursive: true });
await rm(path.join(out, 'privacy'), { recursive: true, force: true });
await writeFile(path.join(out, 'demo-api-disabled.txt'), 'This static presentation has no backend API.\n');
await writeFile(path.join(out, '_redirects'), '/api/* /demo-api-disabled.txt 404\n/* /index.html 200\n');
await writeFile(path.join(out, '_headers'), `/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'
  Permissions-Policy: geolocation=(), camera=(), microphone=()
  Referrer-Policy: no-referrer
  X-Content-Type-Options: nosniff
  X-Robots-Tag: noindex, nofollow
`);
await writeFile(path.join(out, 'kareo-demo-version.json'), JSON.stringify({ schemaVersion: 1, scope: 'STATIC-SYNTHETIC-DEMO', sourceCommit: commit, workingTreeDirty: !clean, builtAt: new Date().toISOString(), realApi: false, realCases: false, formalConsentActivated: false }, null, 2)+'\n');
console.log('Built demo-dist: static synthetic presentation only, no Functions or database deployment.');
