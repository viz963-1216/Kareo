// J-004 read-only release health check. No session, consent, assessment or Lead is created.
import { pathToFileURL } from 'node:url';
import { resolveReleaseTarget, deploymentUrl } from './lib/release-target.mjs';

export async function smokeRelease({ commit, env, knowledgeVersion, fetcher = fetch }) {
  const results = [];
  const check = async (name, path, validate) => {
    try {
      const response = await fetcher(deploymentUrl(env, path), { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15000) });
      await validate(response);
      results.push({ name, status: 'PASS' });
    } catch (error) {
      results.push({ name, status: 'FAIL', detail: error.message });
    }
  };
  const require = (ok, message) => { if (!ok) throw new Error(message); };
  await check('homepage', '/', async r => {
    require(r.status === 200, `HTTP ${r.status}`);
    require((r.headers.get('content-type') ?? '').includes('text/html'), 'Expected HTML');
  });
  await check('deployed commit', '/kareo-version.json', async r => {
    require(r.status === 200, `HTTP ${r.status}`);
    const body = await r.json();
    require(body.commit === commit, 'Deployment commit does not match release target');
  });
  await check('published knowledge', '/api/v1/knowledge/status', async r => {
    require(r.status === 200, `HTTP ${r.status}`);
    const body = await r.json();
    require(body.success === true, 'Knowledge status is not successful');
    require(body.data?.version === knowledgeVersion, 'Published knowledge version does not match');
  });
  await check('unknown API', '/api/v1/j004-nonexistent-route', async r => {
    require(r.status === 404, `Expected 404, received ${r.status}`);
    const body = await r.json();
    require(body.success === false && body.error?.code === 'NOT_FOUND', 'Expected JSON NOT_FOUND');
  });
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const target = resolveReleaseTarget(process.argv.slice(2));
  const knowledgeVersion = process.argv.find(a => a.startsWith('--knowledge-version='))?.split('=').slice(1).join('=');
  if (!/^KB-\d{4}-\d{2}-\d{2}-\d{3}$/.test(knowledgeVersion ?? '')) target.problems.push('Provide --knowledge-version=KB-YYYY-MM-DD-NNN');
  if (target.problems.length) {
    console.error(target.problems.join('\n'));
    process.exitCode = 2;
  } else {
    const results = await smokeRelease({ ...target, knowledgeVersion });
    console.log(JSON.stringify({ commit: target.commit, environment: target.env.key, knowledgeVersion, scope: 'read-only health checks; not MVP E2E', results }, null, 2));
    process.exitCode = results.some(r => r.status === 'FAIL') ? 1 : 0;
  }
}
