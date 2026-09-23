// Netlify "ignore" command: exit 0 = skip this build, exit 1 = build (MVP_DECISIONS D-09).
// A commit is skipped only when every changed file is proven not to affect the deployed site:
//   1. it is in a documentation-like location (CANDIDATES), and
//   2. nothing that is built or deployed references it — neither its path nor any folder containing it
//      (below the top level) appears in frontend/backend source, tests, build scripts or netlify.toml.
// Example: apps/web imports ../../../../contracts/mock/recommendation-response.json, so any change under
// contracts/mock/ builds, while contracts/knowledge/*.json or docs/*.md changes are skipped.
// Any uncertainty (missing refs, git error, unreadable file) builds, so code changes are never silently skipped.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const CANDIDATES = [/^docs\//, /^tasks\//, /^contracts\//, /^data\//, /^\.github\//, /^[^/]+\.md$/];
// Everything the Netlify build reads or bundles. Tests are included because the build command runs them.
const DEPLOY_INPUTS = ['apps', 'scripts/build-site.mjs', 'scripts/lib', 'netlify.toml'];
const SCANNED = /\.(m?[jt]sx?|json|toml|html|css)$/;
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git']);

function collect(path, out) {
  if (!existsSync(path)) return out;
  const stat = statSync(path);
  if (stat.isFile()) {
    if (SCANNED.test(path)) out.push(path);
    return out;
  }
  for (const name of readdirSync(path)) {
    if (!SKIP_DIRS.has(name)) collect(join(path, name), out);
  }
  return out;
}

// Comments often cite specs (e.g. "docs/API_CONTRACT.md 第 5 節"); only code references count.
function stripComments(path, text) {
  if (/\.toml$/.test(path)) return text.replace(/^\s*#.*$/gm, '');
  if (/\.m?[jt]sx?$/.test(path)) return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  return text;
}

// "contracts/mock/providers/A.json" -> ["contracts/mock/providers/A.json", "contracts/mock/providers", "contracts/mock"]
function referenceKeys(file) {
  const parts = file.split('/');
  const keys = [file];
  for (let i = parts.length - 1; i >= 2; i--) keys.push(parts.slice(0, i).join('/'));
  return keys;
}

/** Returns { skip: boolean, reason: string, deployable: string[] } for the changed files. */
export function decide(files, root = '.') {
  if (files.length === 0) return { skip: false, reason: 'no changed files listed', deployable: [] };
  const sources = DEPLOY_INPUTS.flatMap((p) => collect(join(root, p), []));
  let corpus = '';
  for (const source of sources) corpus += stripComments(source, readFileSync(source, 'utf8')) + '\n';

  const deployable = [];
  for (const file of files) {
    if (!CANDIDATES.some((pattern) => pattern.test(file))) {
      deployable.push(`${file} (code or config)`);
      continue;
    }
    const hit = referenceKeys(file).find((key) => corpus.includes(key));
    if (hit) deployable.push(`${file} (referenced as "${hit}")`);
  }
  if (deployable.length) return { skip: false, reason: 'deployable changes', deployable };
  return { skip: true, reason: `${files.length} documentation-only file(s) changed`, deployable };
}

function main() {
  const base = process.env.CACHED_COMMIT_REF;
  const head = process.env.COMMIT_REF;
  if (!base || !head || base === head) {
    console.log('netlify-ignore: no previous deploy ref; building.');
    return 1;
  }
  let files;
  try {
    files = execFileSync('git', ['diff', '--name-only', base, head], { encoding: 'utf8' }).split('\n').filter(Boolean);
  } catch {
    console.log('netlify-ignore: git diff failed; building.');
    return 1;
  }
  let result;
  try {
    result = decide(files);
  } catch (error) {
    console.log(`netlify-ignore: could not check references (${error.message}); building.`);
    return 1;
  }
  if (result.skip) {
    console.log(`netlify-ignore: ${result.reason}; skipping build.`);
    return 0;
  }
  console.log(`netlify-ignore: ${result.reason}: ${result.deployable.slice(0, 10).join(', ') || '(none listed)'}; building.`);
  return 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exit(main());
