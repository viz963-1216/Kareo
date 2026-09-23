import { existsSync } from 'node:fs';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { frontendEnvProblems } from './lib/frontend-env.mjs';
import { isFullSha, VERSION_MARKER } from './lib/release-target.mjs';

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
} else {
  if (process.env.BRANCH === 'main') {
    throw new Error('Production requires the completed frontend; staging placeholder is not a release.');
  }
  await cp('deploy/staging', 'dist', { recursive: true });
}
await mkdir('dist', { recursive: true });
await writeFile('dist/api-not-found.json', JSON.stringify({success:false,error:{code:'NOT_FOUND',message:'此 API 尚未提供。'}}));
await writeFile(`dist/${VERSION_MARKER}`, `${JSON.stringify(versionMarker(), null, 2)}\n`);
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
