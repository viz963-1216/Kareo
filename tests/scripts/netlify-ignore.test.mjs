// J-003: the Netlify ignore command may skip only changes that cannot affect the deployed site.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { decide } from '../../scripts/netlify-ignore.mjs';

const SCRIPT = resolve('scripts/netlify-ignore.mjs');

function write(root, file, text) {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), text);
}

function fixtureRepo() {
  const root = mkdtempSync(join(tmpdir(), 'kareo-ignore-'));
  write(root, 'netlify.toml', '# docs/ in a comment is not a reference\n[build]\n  publish = "dist"\n');
  write(root, 'apps/web/src/fixtures.ts', '// see docs/API_CONTRACT.md\nimport rec from "../../../contracts/mock/recommendation-response.json";\nexport default rec;\n');
  write(root, 'apps/api/src/handler.ts', 'export const x = 1; // docs/DATA_MODEL.md\n');
  write(root, 'contracts/mock/recommendation-response.json', '{"success":true,"data":{}}\n');
  write(root, 'contracts/mock/providers/P1.json', '{"success":true,"data":{}}\n');
  write(root, 'contracts/knowledge/packs/KP-1.json', '{}\n');
  write(root, 'docs/API_CONTRACT.md', '# contract\n');
  write(root, 'tasks/README.md', '# tasks\n');
  write(root, 'README.md', '# readme\n');
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  git('init', '-q');
  git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'add', '-A');
  git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-qm', 'base');
  return { root, git };
}

function runIgnore(root, git, changes) {
  const base = git('rev-parse', 'HEAD');
  for (const [file, text] of Object.entries(changes)) write(root, file, text);
  git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'add', '-A');
  git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-qm', 'change');
  const head = git('rev-parse', 'HEAD');
  const run = spawnSync(process.execPath, [SCRIPT], {
    cwd: root,
    env: { ...process.env, CACHED_COMMIT_REF: base, COMMIT_REF: head },
    encoding: 'utf8',
  });
  return { status: run.status, output: run.stdout + run.stderr };
}

test('scenario 1: documentation-only commit is skipped (exit 0)', () => {
  const { root, git } = fixtureRepo();
  const run = runIgnore(root, git, { 'docs/API_CONTRACT.md': '# contract v2\n', 'tasks/README.md': '# t2\n', 'README.md': '# r2\n' });
  assert.equal(run.status, 0, run.output);
  assert.match(run.output, /skipping build/);
});

test('scenario 2: contract file imported by the frontend is built (exit 1)', () => {
  const { root, git } = fixtureRepo();
  const run = runIgnore(root, git, { 'contracts/mock/recommendation-response.json': '{"success":true,"data":{"x":1}}\n' });
  assert.equal(run.status, 1, run.output);
  assert.match(run.output, /contracts\/mock\/recommendation-response\.json/);
});

test('a new or changed file in a folder the frontend imports from is built', () => {
  const { root } = fixtureRepo();
  assert.equal(decide(['contracts/mock/providers/P1.json'], root).skip, false);
  assert.equal(decide(['contracts/mock/providers/P2.json'], root).skip, false);
});

test('unreferenced contract data is skipped; code, config and mixed commits are built', () => {
  const { root } = fixtureRepo();
  assert.equal(decide(['contracts/knowledge/packs/KP-1.json'], root).skip, true);
  assert.equal(decide(['apps/web/src/fixtures.ts'], root).skip, false);
  assert.equal(decide(['netlify.toml'], root).skip, false);
  assert.equal(decide(['.gitignore'], root).skip, false);
  assert.equal(decide(['docs/API_CONTRACT.md', 'apps/api/src/handler.ts'], root).skip, false);
  assert.equal(decide([], root).skip, false);
});

test('references only inside comments do not force a build', () => {
  const { root } = fixtureRepo();
  assert.equal(decide(['docs/API_CONTRACT.md'], root).skip, true);
});

test('data read by backend tests is built, because the Netlify build runs the tests', () => {
  const { root } = fixtureRepo();
  write(root, 'apps/api/tests/import.test.ts', 'const dir = "data/providers/staging";\n');
  assert.equal(decide(['data/providers/staging/providers.json'], root).skip, false);
});

test('missing deploy refs build (exit 1)', () => {
  const run = spawnSync(process.execPath, [SCRIPT], { env: { ...process.env, CACHED_COMMIT_REF: '', COMMIT_REF: '' }, encoding: 'utf8' });
  assert.equal(run.status, 1);
});

test('real repository: contract mocks imported by apps/web are never skipped', () => {
  assert.equal(decide(['contracts/mock/recommendation-response.json']).skip, false);
  assert.equal(decide(['docs/MVP_DECISIONS.md', 'tasks/README.md']).skip, true);
});
