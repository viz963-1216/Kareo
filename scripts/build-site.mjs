import { existsSync } from 'node:fs';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { frontendEnvProblems } from './lib/frontend-env.mjs';
import { isFullSha, VERSION_MARKER } from './lib/release-target.mjs';
import {acceptanceProbeHtml} from './lib/acceptance-session-probe.mjs';
import {acceptancePublicProbeHtml} from './lib/acceptance-public-probe.mjs';

await rm('dist', { recursive: true, force: true });
if (existsSync('apps/web/package.json')) {
  if (!existsSync('apps/web/package-lock.json')) {
    throw new Error('Frontend requires a committed package-lock.json for npm ci.');
  }
  execFileSync('npm', ['ci', '--prefix', 'apps/web'], { stdio: 'inherit' });
  const problems = frontendEnvProblems(process.env);
  if (problems.length) throw new Error(`Frontend deploy settings rejected:\n- ${problems.join('\n- ')}`);
  execFileSync('npm', ['run', 'build', '--prefix', 'apps/web'], {
    stdio: 'inherit',
    env: { ...process.env, VITE_KAREO_DEPLOY_CONTEXT: process.env.CONTEXT || 'local' },
  });
  if (!existsSync('apps/web/dist/index.html')) {
    throw new Error('Frontend must produce apps/web/dist/index.html.');
  }
  await cp('apps/web/dist', 'dist', { recursive: true });
  if (process.env.VITE_KAREO_PUBLIC_ANALYSIS === 'true') {
    // Public doorplate modules contain government open data only; typed addresses
    // are matched in the browser, never sent to a geocoder or personal-flow API.
    const manifest = JSON.parse(await readFile('data/residence/manifest.json', 'utf8'));
    await mkdir('dist/residence', { recursive: true });
    for (const item of Object.values(manifest.districts)) {
      const json = await readFile(`data/residence/${item.file}`, 'utf8');
      await writeFile(`dist/residence/${item.file.replace('.json', `-${item.sha256.slice(0,12)}.js`)}`, `export default ${json.trim()};\n`);
    }
    const html = await readFile('dist/index.html', 'utf8');
    await writeFile('dist/index.html', html.replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'">`));
    const knowledge = JSON.parse(await readFile('data/public-preview/published-knowledge.json', 'utf8'));
    await writeFile('dist/kareo-public-version.json', JSON.stringify({ schemaVersion: 1, scope: 'PUBLIC-SERVICES',
      demo: false, publicReadApi: 'real', personalAnalysis: 'browser-memory', cloudPersonalCollection: false,
      formalConsentActivated: false, providerInventoryCount: JSON.parse(await readFile('data/providers/staging/providers.json', 'utf8')).length,
      assessmentKnowledgeVersion: knowledge.version }, null, 2)+'\n');
  }
  if (process.env.VITE_KAREO_ENABLE_DEMO === 'true') {
    // Main site is already copied. The child build receives only ordinary process settings,
    // bundles public snapshots and writes a separate /demo/ artifact with network writes blocked.
    execFileSync(process.execPath, ['scripts/build-demo.mjs', '--embedded-netlify'], { stdio: 'inherit' });
    await cp('demo-dist', 'dist/demo', { recursive: true });
  }
} else {
  if (['release', 'main'].includes(process.env.BRANCH)) {
    throw new Error('Production requires the completed frontend; staging placeholder is not a release.');
  }
  await cp('deploy/staging', 'dist', { recursive: true });
}
await mkdir('dist', { recursive: true });
await writeFile('dist/api-not-found.json', JSON.stringify({success:false,error:{code:'NOT_FOUND',message:'此 API 尚未提供。'}}));
await writeFile(`dist/${VERSION_MARKER}`, `${JSON.stringify(versionMarker(), null, 2)}\n`);
const probe=acceptanceProbeHtml(process.env);
if(probe){
  await writeFile('dist/__acceptance-session-check.html',probe);
  await cp('scripts/lib/acceptance-probe-client.mjs','dist/__acceptance-session-probe.mjs');
  await writeFile('dist/__acceptance-public-check.html',acceptancePublicProbeHtml(process.env));
  await cp('scripts/lib/acceptance-public-probe-client.mjs','dist/__acceptance-public-probe.mjs');
}
console.log('Kareo site built successfully.');

// Deployed version marker (J-003). Netlify sets COMMIT_REF (full SHA), BRANCH, CONTEXT and DEPLOY_ID
// at build time; functions ship in the same atomic deploy, so this identifies the whole deployment.
// Only public build metadata is written: never add secrets or tokens here.
function versionMarker() {
  let commit = process.env.COMMIT_REF;
  let source = 'netlify:COMMIT_REF';
  if (!commit) {
    try {
      commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
      source = 'git rev-parse HEAD (local build)';
      // A dirty working tree is not that commit: claim no version rather than a wrong one.
      if (execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()) {
        commit = null;
        source = 'local build with uncommitted changes';
      }
    } catch {
      commit = null;
    }
  }
  return {
    schemaVersion: 1,
    commit: isFullSha(commit) ? commit : null,
    commitSource: source,
    branch: process.env.BRANCH ?? null,
    context: process.env.CONTEXT ?? 'local',
    deployId: process.env.DEPLOY_ID ?? null,
    builtAt: new Date().toISOString(),
  };
}
