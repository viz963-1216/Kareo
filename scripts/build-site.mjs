import { existsSync } from 'node:fs';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { frontendEnvProblems } from './lib/frontend-env.mjs';

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
console.log('Kareo site built successfully.');
