// J-004: read-only evidence preparation. This script cannot purge or authorize
// receipt retirement, certify vendor backups, activate consent or award E2E PASS.
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const TARGET = Object.freeze({
  projectRef: 'ojawadobnaxduxybqolk',
  siteId: 'faeb21e1-94d1-4d42-bbbc-6f9692caaef9',
  operatorId: 'OP-SU-ZIJIE-ACCEPTANCE',
});
const COUNT_KEYS = ['assessments', 'profiles', 'recommendationRuns', 'recommendationItems',
  'receiptSessions', 'disabledReceiptSessions', 'openReceiptLeads', 'receiptContactFields',
  'retainedReceiptLeads', 'retainedReceiptConsents'];
const BACKUP_REQUIREMENTS = ['VENDOR_PHYSICAL_RESTORE', 'VENDOR_RECOVERABLE_COPIES',
  'MANUAL_OFFLINE_COPIES', 'INCIDENT_EXPORTS_AND_LOGS', 'JOURNAL_AND_VENDOR_SUPPORT_COPIES',
  'HUMAN_RETIREMENT_CHECKPOINT'];

function guard(env) {
  if (env.SUPABASE_URL !== `https://${TARGET.projectRef}.supabase.co`
      || env.NETLIFY_SITE_ID !== TARGET.siteId || env.KAREO_OPERATOR_ID !== TARGET.operatorId) {
    throw new Error('CONFIGURATION_REJECTED');
  }
  for (const key of ['SUPABASE_SERVICE_ROLE_KEY', 'NETLIFY_AUTH_TOKEN', 'KAREO_OPERATOR_KEY']) {
    if (typeof env[key] !== 'string' || !env[key].trim()) throw new Error('CONFIGURATION_REJECTED');
  }
}

// No receipt IDs or their hashes enter the output. This digest exists only in
// memory to detect a changed journal between observations, not as public data.
function receiptSet(raw, validateReceipt) {
  if (!Array.isArray(raw) || raw.length > 10000) throw new Error('JOURNAL_INVALID');
  const keys = new Set();
  const receipts = raw.map(value => {
    const r = validateReceipt(value, TARGET.projectRef);
    const key = `${r.sessionId}\0${r.action}`;
    if (keys.has(key)) throw new Error('JOURNAL_INVALID');
    keys.add(key);
    return { schemaVersion: r.schemaVersion, projectRef: r.projectRef,
      sessionId: r.sessionId, action: r.action, requestedAt: r.requestedAt };
  });
  const sessionIds = [...new Set(receipts.map(r => r.sessionId))].sort();
  if (sessionIds.length > 1000) throw new Error('JOURNAL_TOO_LARGE_FOR_THIS_CHECK');
  const canonical = receipts.map(r => JSON.stringify(r)).sort().join('\n');
  return { sessionIds, count: receipts.length,
    digest: createHash('sha256').update(canonical).digest('hex') };
}

function counts(raw, sessionCount) {
  if (!raw || Object.keys(raw).sort().join(',') !== [...COUNT_KEYS].sort().join(',')) throw new Error('COUNTS_INVALID');
  const result = {};
  for (const key of COUNT_KEYS) {
    if (!Number.isSafeInteger(raw[key]) || raw[key] < 0) throw new Error('COUNTS_INVALID');
    result[key] = raw[key];
  }
  if (result.receiptSessions > sessionCount || result.disabledReceiptSessions > result.receiptSessions
      || result.openReceiptLeads > result.retainedReceiptLeads
      || result.receiptContactFields > result.retainedReceiptLeads) throw new Error('COUNTS_INVALID');
  return result;
}

export async function checkErasureReadiness({ env, load, now = () => new Date().toISOString() }) {
  const report = { schemaVersion: 1, scope: 'READ_ONLY_ACCEPTANCE_ERASURE_OBSERVATIONS_NOT_E2E',
    projectRef: TARGET.projectRef, siteId: TARGET.siteId, operatorId: TARGET.operatorId,
    commit: /^[a-f0-9]{40}$/.test(env.GITHUB_SHA ?? '') ? env.GITHUB_SHA : 'LOCAL_WORKTREE',
    startedAt: now(), status: 'STOPPED', currentErasure: 'NOT_ESTABLISHED',
    receiptPurgeAllowed: false, activationAllowed: false, physicalRestoreVerified: false,
    backupRequirements: BACKUP_REQUIREMENTS.map(name => ({ name, status: 'PENDING' })) };
  let stage = 'CONFIGURATION';
  try {
    guard(env);
    const deps = await load();
    stage = 'AUTHORIZATION';
    await deps.authorize(); // Must precede all journal/receipt-target I/O.
    stage = 'SITE_IDENTITY';
    await deps.verifySite();
    stage = 'JOURNAL_READ';
    if (deps.journal.projectRef !== TARGET.projectRef) throw new Error('JOURNAL_PROJECT_MISMATCH');
    const before = receiptSet(await deps.journal.readAll(), deps.validateReceipt);
    stage = 'DATABASE_OBSERVATION';
    const first = counts(await deps.observe(before.sessionIds), before.sessionIds.length);
    await deps.authorize();
    const second = counts(await deps.observe(before.sessionIds), before.sessionIds.length);
    stage = 'JOURNAL_RECHECK';
    const after = receiptSet(await deps.journal.readAll(), deps.validateReceipt);
    await deps.authorize();
    if (before.digest !== after.digest || JSON.stringify(first) !== JSON.stringify(second)) {
      stage = 'OBSERVATIONS_CHANGED';
      throw new Error('OBSERVATIONS_CHANGED');
    }
    report.receiptsRead = before.count;
    report.receiptSessionCount = before.sessionIds.length;
    report.observedCounts = first;
    report.observationsUnchanged = true;
    // This deliberately conservative first tool requires the four health tables
    // to be globally empty. Other users' valid data produces NOT_ESTABLISHED,
    // never an accusation of a deletion defect. No raw health data is fetched.
    const healthAbsent = ['assessments', 'profiles', 'recommendationRuns', 'recommendationItems']
      .every(key => first[key] === 0);
    const disabled = first.receiptSessions === first.disabledReceiptSessions;
    const outreachStopped = first.openReceiptLeads === 0 && first.receiptContactFields === 0;
    report.currentErasure = before.count === 0 ? 'NO_RECEIPTS_TO_CHECK'
      : healthAbsent && disabled && outreachStopped ? 'OBSERVED_HEALTH_AND_OUTREACH_ERASURE'
        : 'NOT_ESTABLISHED';
    report.status = 'READ_ONLY_CHECK_COMPLETE_RETIREMENT_PENDING';
    report.limitations = ['TWO_NONTRANSACTIONAL_OBSERVATIONS_NOT_A_LOCKED_SNAPSHOT',
      'GLOBAL_HEALTH_COUNTS_ARE_CONSERVATIVE', 'RETAINED_CASE_AND_CONSENT_RECORDS_ARE_NOT_FULL_ERASURE',
      'NO_VENDOR_BACKUP_OR_RETIREMENT_CERTIFICATION', 'NO_PURGE_IMPLEMENTATION_OR_AUTHORIZATION'];
    report.finishedAt = now();
    return { exitCode: 0, report };
  } catch {
    // Never propagate provider messages, IDs, raw receipt, token, SQL or key.
    report.stoppedAt = stage;
    report.finishedAt = now();
    return { exitCode: 1, report };
  }
}

export function createCountObserver(client) {
  const count = async (table, filter = q => q) => {
    const { count: value, error } = await filter(client.from(table).select('id', { count: 'exact', head: true }))
      .abortSignal(AbortSignal.timeout(30000));
    if (error || !Number.isSafeInteger(value) || value < 0) throw new Error('COUNT_QUERY_FAILED');
    return value;
  };
  return async sessionIds => {
    const result = {};
    for (const [name, table] of [['assessments', 'assessments'], ['profiles', 'care_need_profiles'],
      ['recommendationRuns', 'recommendation_runs'], ['recommendationItems', 'recommendation_items']]) {
      result[name] = await count(table);
    }
    for (const key of COUNT_KEYS.slice(4)) result[key] = 0;
    for (let offset = 0; offset < sessionIds.length; offset += 100) {
      const ids = sessionIds.slice(offset, offset + 100);
      const definitions = [
        ['receiptSessions', 'sessions', q => q.in('id', ids)],
        ['disabledReceiptSessions', 'sessions', q => q.in('id', ids).eq('status', 'DELETED')],
        ['openReceiptLeads', 'leads', q => q.in('session_id', ids).not('status', 'in', '(CLOSED,CANCELLED)')],
        ['receiptContactFields', 'leads', q => q.in('session_id', ids).or('contact_name.not.is.null,contact_phone.not.is.null')],
        ['retainedReceiptLeads', 'leads', q => q.in('session_id', ids)],
        ['retainedReceiptConsents', 'consents', q => q.in('session_id', ids)],
      ];
      for (const [name, table, filter] of definitions) result[name] += await count(table, filter);
    }
    return result;
  };
}

async function realDependencies() {
  const [{ getSupabaseClient }, { SupabaseLeadRepository }, { requireOperator },
    { createDeletionJournal }, { validateReceipt }] = await Promise.all([
    import('../apps/api/dist/repositories/supabaseClient.js'),
    import('../apps/api/dist/repositories/supabaseLeadRepository.js'),
    import('../apps/api/dist/services/internalOperatorService.js'),
    import('../apps/api/dist/privacy/netlifyDeletionJournal.js'),
    import('../apps/api/dist/privacy/deletionJournal.js'),
  ]);
  return {
    authorize: () => requireOperator(new SupabaseLeadRepository(), process.env.KAREO_OPERATOR_ID,
      process.env.KAREO_OPERATOR_KEY, 'DATA_STEWARD'),
    verifySite: async () => {
      const response = await fetch(`https://api.netlify.com/api/v1/sites/${TARGET.siteId}`, {
        headers: { Authorization: `Bearer ${process.env.NETLIFY_AUTH_TOKEN}` },
        redirect: 'error', signal: AbortSignal.timeout(30000),
      });
      if (response.status !== 200) throw new Error('SITE_IDENTITY_FAILED');
      const site = await response.json();
      if (site.id !== TARGET.siteId || site.name !== 'kareo-tw') throw new Error('SITE_IDENTITY_FAILED');
    },
    journal: createDeletionJournal(), validateReceipt,
    observe: createCountObserver(getSupabaseClient()),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  // No arbitrary operator, project, credential, input inventory or commit mode.
  if (process.argv.length !== 2) {
    console.error('Erasure readiness check accepts no arguments.');
    process.exitCode = 1;
  } else {
    const { exitCode, report } = await checkErasureReadiness({ env: process.env, load: realDependencies });
    mkdirSync('work', { recursive: true });
    writeFileSync('work/erasure-readiness.json', JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
    console.log(JSON.stringify(report));
    process.exitCode = exitCode;
  }
}
