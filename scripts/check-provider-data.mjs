// Runs Engineer A's provider validation gate (TASK-A-004) when it exists on this branch.
// Until A-004 is merged the check is reported as PENDING (exit 0 with a warning), never as PASS.
import { existsSync, appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const gate = 'data/providers/qa/validate-providers.mjs';
const note = (status, detail) => {
  console.log(`${status} provider-data ${detail}`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Provider data gate\n\n**${status}** — ${detail}\n\n`);
};
if (!existsSync(gate)) {
  if (process.env.GITHUB_ACTIONS) console.log('::warning title=Provider data gate PENDING::TASK-A-004 validator is not merged; provider data is NOT validated by CI.');
  note('PENDING', `${gate} not present (TASK-A-004 not merged). Provider data is not validated.`);
  process.exit(0);
}
const run = spawnSync(process.execPath, [gate], { stdio: 'inherit' });
note(run.status === 0 ? 'PASS' : 'FAIL', `${gate} exited ${run.status}`);
process.exit(run.status ?? 1);
