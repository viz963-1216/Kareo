// J-004 scheduled acceptance cleanup; reuse B-011b's authenticated CLI.
// No new deletion implementation, endpoint, shared system account or auth bypass.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export async function cleanupStaging({ mode, env, loadCli, log = console.log, error = console.error }) {
  try {
    if (!['dry-run', 'commit'].includes(mode)) throw new Error('Invalid mode');
    const url = new URL(env.SUPABASE_URL);
    if (url.protocol !== 'https:' || url.hostname !== 'ojawadobnaxduxybqolk.supabase.co'
        || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) {
      throw new Error('Wrong acceptance project');
    }
    for (const key of ['SUPABASE_SERVICE_ROLE_KEY', 'KAREO_OPERATOR_ID', 'KAREO_OPERATOR_KEY']) {
      if (typeof env[key] !== 'string' || !env[key].trim()) throw new Error('Missing configuration');
    }
    const { runCleanupCli, sessionRepo, operatorRepo } = await loadCli();
    return await runCleanupCli([`--${mode}`, '--operator-id', env.KAREO_OPERATOR_ID], env,
      { sessionRepo, operatorRepo, log, error });
  } catch {
    // CLI/database exceptions can carry SQL or private data. Let DeletionRun keep
    // its sanitized failure classification; Actions logs must not echo exceptions.
    error('Staging retention cleanup failed. Check configuration, operator access and DeletionRun status.');
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const mode = args.length === 1 ? args[0].match(/^--mode=(dry-run|commit)$/)?.[1] : undefined;
  process.exitCode = await cleanupStaging({ mode, env: process.env, loadCli: async () => {
    const [{ runCleanupCli }, { SupabaseSessionRepository }, { SupabaseLeadRepository }] = await Promise.all([
      import('../apps/api/dist/scripts/cleanupExpiredData.js'),
      import('../apps/api/dist/repositories/supabaseSessionRepository.js'),
      import('../apps/api/dist/repositories/supabaseLeadRepository.js'),
    ]);
    return { runCleanupCli, sessionRepo: new SupabaseSessionRepository(), operatorRepo: new SupabaseLeadRepository() };
  } });
}
