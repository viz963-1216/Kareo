// J-003 staging entry point: read-only by default; synthetic writes are explicit.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
import { resolveReleaseTarget } from './lib/release-target.mjs';
import { runPublicApiE2e } from '../tests/e2e/run-public-api-e2e.mjs';

const args = process.argv.slice(2);
// Preserve the old positional URL, but never accept it without an exact target SHA.
const targetArgs = args[0] && !args[0].startsWith('--')
  ? [`--base-url=${args[0]}`, ...args.slice(1)] : args;
const target = resolveReleaseTarget(targetArgs, process.env, { allowInsecure: args.includes('--local') });
const out = args.find(arg => arg.startsWith('--out='))?.slice(6);
const writeMode = args.includes('--write-e2e') || args.includes('--with-assessment');
const allowWrites = args.includes('--allow-writes');
const problems = [...target.problems];
if (!out) problems.push('missing --out=<JSON file>');
if (writeMode && !allowWrites) problems.push('write E2E requires --allow-writes; it creates synthetic sessions/assessments and exercises withdrawal/deletion');
if (allowWrites && !writeMode) problems.push('--allow-writes requires --write-e2e (or legacy --with-assessment)');
if (problems.length) {
  console.error('Usage: node scripts/smoke-staging.mjs --base-url=<https URL> --commit=<full SHA> --out=<file> [--write-e2e --allow-writes]');
  for (const problem of problems) console.error(problem);
  process.exitCode = 2;
} else if (!writeMode) {
  const { run, exitCode } = await runPublicApiE2e({ target });
  writeFileSync(out, `${JSON.stringify(run, null, 2)}\n`);
  process.exitCode = exitCode;
} else {
  // The actual runner rechecks the marker and ACTIVE registry before any POST.
  const runner = fileURLToPath(new URL('../tests/e2e/run-api-e2e.mjs', import.meta.url));
  const child = spawn(process.execPath, [runner, `--base-url=${target.env.key}`,
    `--commit=${target.commit}`, `--out=${out}`, '--allow-writes',
    ...(args.includes('--local') ? ['--local'] : [])], { stdio: 'inherit' });
  process.exitCode = await new Promise(resolve => {
    child.once('error', () => { console.error('API runner could not start'); resolve(1); });
    child.once('close', code => resolve(code ?? 1));
  });
}
