// Validates contracts/knowledge/packs/*.json against contracts/knowledge/README.md rules
// and the constraints in content-pack.schema.json. No dependencies. Exit 1 on any error.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2] ?? '.';
const packDir = join(root, 'contracts/knowledge/packs');
if (!existsSync(packDir)) {
  if (process.env.GITHUB_ACTIONS) console.log('::warning title=Knowledge packs PENDING::contracts/knowledge/packs not present (TASK-J-002 not merged).');
  console.log('PENDING knowledge-pack: contracts/knowledge/packs not present; nothing validated.');
  process.exit(0);
}
const registry = readFileSync(join(root, 'docs/knowledge/source-registry.md'), 'utf8');
const activeSources = new Set(
  registry.split('\n')
    .filter((line) => /^\| `SRC-/.test(line) && /\|\s*true\s*\|\s*$/.test(line))
    .map((line) => line.match(/`(SRC-[A-Z0-9-]+)`/)[1]),
);

const CATEGORIES = ['ELIGIBILITY', 'BENEFIT', 'COPAY', 'ASSISTIVE_DEVICE', 'TRANSPORTATION', 'RESPITE', 'HOME_CARE', 'HOME_MEDICAL_NURSING', 'APPLICATION', 'OTHER'];
const JURISDICTIONS = ['TAIWAN', 'TAIPEI', 'NEW_TAIPEI'];
const AUTHORITIES = ['MOHW', 'LAW', 'TAIPEI_GOV', 'NEW_TAIPEI_GOV', 'KAREO_DRIVE'];
const STATUSES = ['NEEDS_REVIEW', 'APPROVED', 'REJECTED', 'CONFLICT'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const OFFICIAL_URL = /^https:\/\/([a-z0-9-]+\.)*(gov\.tw|gov\.taipei)\//;
// D-15 (2026-09-24): files in Jerry's designated Google Drive folder, registered in source-registry.md.
const DRIVE_FILE_URL = /^https:\/\/drive\.google\.com\/file\/d\/[A-Za-z0-9_-]+(\/|$)/;

let errors = 0;
const fail = (file, msg) => { errors += 1; console.error(`FAIL ${file}: ${msg}`); };

const packs = readdirSync(packDir).filter((f) => f.endsWith('.json')).sort();
if (packs.length === 0) fail(packDir, 'no content packs found');

for (const file of packs) {
  let pack;
  try { pack = JSON.parse(readFileSync(join(packDir, file), 'utf8')); } catch (e) { fail(file, `invalid JSON: ${e.message}`); continue; }
  if (`${pack.packId}.json` !== file) fail(file, 'packId must match file name');
  if (!/^KP-\d{4}-\d{2}-\d{2}-\d{3}$/.test(pack.packId ?? '')) fail(file, 'bad packId');
  if (pack.formatVersion !== '1.0') fail(file, 'formatVersion must be 1.0');
  if (!DATETIME.test(pack.createdAt ?? '')) fail(file, 'bad createdAt');
  if (!['NEEDS_REVIEW', 'APPROVED', 'REJECTED'].includes(pack.status)) fail(file, 'bad pack status');
  const review = pack.review ?? {};
  if (pack.status === 'APPROVED') {
    if (!review.reviewedBy || !DATETIME.test(review.reviewedAt ?? '') || review.decision !== 'APPROVED') fail(file, 'APPROVED pack requires reviewedBy, reviewedAt and decision=APPROVED');
    if (!/^KB-\d{4}-\d{2}-\d{2}-\d{3}$/.test(pack.intendedKnowledgeVersion ?? '')) fail(file, 'APPROVED pack requires intendedKnowledgeVersion');
  } else if (review.decision === 'APPROVED') {
    fail(file, 'review.decision=APPROVED but pack status is not APPROVED');
  }
  if (!Array.isArray(pack.records) || pack.records.length === 0) { fail(file, 'records required'); continue; }
  const ids = new Set();
  const counts = {};
  for (const r of pack.records) {
    const where = `${file}#${r.recordId}`;
    if (!/^KR-\d{4}-\d{3}$/.test(r.recordId ?? '')) fail(where, 'bad recordId');
    if (ids.has(r.recordId)) fail(where, 'duplicate recordId');
    ids.add(r.recordId);
    if (!CATEGORIES.includes(r.category)) fail(where, `bad category ${r.category}`);
    if (!JURISDICTIONS.includes(r.jurisdiction)) fail(where, `bad jurisdiction ${r.jurisdiction}`);
    if (!r.title || r.title.length > 120) fail(where, 'title required (<=120)');
    const s = r.source ?? {};
    if (!activeSources.has(s.sourceId)) fail(where, `source ${s.sourceId} not active in source-registry.md`);
    if (!AUTHORITIES.includes(s.authority)) fail(where, 'bad source.authority');
    if (s.authority === 'KAREO_DRIVE') {
      if (!DRIVE_FILE_URL.test(s.url ?? '')) fail(where, 'KAREO_DRIVE source.url must be a drive.google.com/file/d/<id> link');
    } else if (!OFFICIAL_URL.test(s.url ?? '')) fail(where, 'source.url must be an official https gov domain');
    if (!DATETIME.test(s.fetchedAt ?? '')) fail(where, 'bad source.fetchedAt');
    if (!/^sha256:[0-9a-f]{64}$/.test(s.contentHash ?? '')) fail(where, 'bad source.contentHash');
    if (r.publishedAt !== null && !DATE.test(r.publishedAt ?? '')) fail(where, 'bad publishedAt');
    if (!DATE.test(r.effectiveFrom ?? '')) fail(where, 'bad effectiveFrom');
    if (r.effectiveTo !== null && !DATE.test(r.effectiveTo ?? '')) fail(where, 'bad effectiveTo');
    if (r.effectiveTo && r.effectiveTo < r.effectiveFrom) fail(where, 'effectiveTo before effectiveFrom');
    if (!DATETIME.test(r.lastVerifiedAt ?? '')) fail(where, 'bad lastVerifiedAt');
    if (!r.excerpt || r.excerpt.length > 4000) fail(where, 'excerpt required (<=4000)');
    if (!r.summary || r.summary.length > 400) fail(where, 'summary required (<=400)');
    if (/正式核定|保證符合|一定符合|確定符合/.test(r.summary)) fail(where, 'summary must not claim official eligibility');
    if (typeof r.ruleData !== 'object' || r.ruleData === null || Array.isArray(r.ruleData)) fail(where, 'ruleData must be an object');
    if (!STATUSES.includes(r.status)) fail(where, 'bad record status');
    const rr = r.review ?? {};
    if (r.status === 'APPROVED' && (!rr.reviewedBy || !DATETIME.test(rr.reviewedAt ?? '') || rr.decision !== 'APPROVED')) fail(where, 'APPROVED record requires real reviewer, time and decision');
    if (r.status !== 'APPROVED' && rr.decision === 'APPROVED') fail(where, 'decision APPROVED but status is not');
    if (pack.status === 'APPROVED' && r.status === 'NEEDS_REVIEW') fail(where, 'APPROVED pack cannot contain NEEDS_REVIEW records');
    counts[r.status] = (counts[r.status] ?? 0) + 1;
  }
  console.log(`${file}: status=${pack.status} records=${pack.records.length} ${JSON.stringify(counts)}`);
}

if (errors) { console.error(`Knowledge pack validation FAILED with ${errors} error(s).`); process.exit(1); }
console.log('Knowledge pack validation PASSED (format only; this does not mean the content is approved or published).');
