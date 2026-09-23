// Netlify "ignore" command: exit 0 = skip this build, exit 1 = build.
// Builds are skipped only when every changed file is documentation-like.
// Any uncertainty (missing refs, git error) builds, so code changes are never silently skipped.
import { execFileSync } from 'node:child_process';

const SKIPPABLE = [/^docs\//, /^tasks\//, /^contracts\//, /^data\/providers\//, /^\.github\//, /^[^/]+\.md$/];
const base = process.env.CACHED_COMMIT_REF;
const head = process.env.COMMIT_REF;

if (!base || !head || base === head) {
  console.log('netlify-ignore: no previous deploy ref; building.');
  process.exit(1);
}
let files;
try {
  files = execFileSync('git', ['diff', '--name-only', base, head], { encoding: 'utf8' }).split('\n').filter(Boolean);
} catch {
  console.log('netlify-ignore: git diff failed; building.');
  process.exit(1);
}
const deployable = files.filter((file) => !SKIPPABLE.some((pattern) => pattern.test(file)));
if (files.length > 0 && deployable.length === 0) {
  console.log(`netlify-ignore: ${files.length} docs/data-only file(s) changed; skipping build.`);
  process.exit(0);
}
console.log(`netlify-ignore: deployable changes: ${deployable.slice(0, 10).join(', ') || '(none listed)'}; building.`);
process.exit(1);
