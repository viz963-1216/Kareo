// Requires a fresh disposable PostgreSQL 17 database and an official PostgREST executable.
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { startLocalStack } from './stack.mjs';
import { verifyLocalStack } from './verify.mjs';

const args = process.argv.slice(2);
const out = args.find(a => a.startsWith('--out='))?.slice(6);
if (!out || args.length !== 1 || resolve(out).includes('/tests/e2e/results/')) {
  console.error('Usage: node tests/local/run.mjs --out=<local evidence JSON outside tests/e2e/results>'); process.exit(2);
}
let stack;
try {
  stack = await startLocalStack({ databaseUrl: process.env.KAREO_LOCAL_PG_URL, postgrestBinary: process.env.KAREO_LOCAL_POSTGREST });
  const report = await verifyLocalStack(stack);
  report.sourceCommit = execFileSync('git', ['rev-parse','HEAD'], { encoding:'utf8' }).trim();
  report.workingTreeDirty = !!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim();
  mkdirSync(dirname(resolve(out)), { recursive:true }); writeFileSync(out, JSON.stringify(report,null,2)+'\n');
  console.log(`Local HTTP integration ${report.status}; not deployed acceptance.`);
  process.exitCode = report.status === 'PASS' ? 0 : 1;
} catch (e) { console.error(e.message); process.exitCode = 1; }
finally { await stack?.close(); }
