import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { publishConsentProposals } from '../../scripts/lib/consent-proposal-archive.mjs';

test('archive preserves exact proposed bytes, rejects changed/active/path metadata and publishes no owner decision details',async()=>{
  const root=await mkdtemp(join(tmpdir(),'kareo-consent-archive-'));
  try {
    const dir=join(root,'contracts/legal/proposals');await mkdir(dir,{recursive:true});
    const text=Buffer.from('# 固定候選版本\n尚未生效\n');
    const metadata={intendedVersion:'2026-10-05-r1',status:'OWNER_APPROVED_CONDITIONAL',activationAllowed:false,
      fullTextPath:'contracts/legal/proposals/2026-10-05-r1.md',fullTextSha256:createHash('sha256').update(text).digest('hex'),
      approvedBy:'private-reviewer-marker',approvalEvidence:'private-decision-marker'};
    await writeFile(join(dir,'2026-10-05-r1.md'),text);
    const set=async patch=>writeFile(join(dir,'2026-10-05-r1.review.json'),JSON.stringify({...metadata,...patch}));
    await set({});const out=join(root,'dist');
    const entries=await publishConsentProposals(root,out);
    assert.deepEqual(await readFile(join(out,'privacy/versions/2026-10-05-r1-proposed.txt')),text);
    assert.equal(entries[0].status,'PROPOSED_NOT_ACTIVE');
    const index=await readFile(join(out,'privacy/versions/index.json'),'utf8');
    assert.ok(!index.includes('private-'));
    for (const patch of [{status:'ACTIVE'},{activationAllowed:true},{fullTextPath:'../../outside.md'},{fullTextSha256:'0'.repeat(64)}]) {
      await set(patch);await assert.rejects(publishConsentProposals(root,out));
    }
    await set({});await writeFile(join(dir,'2026-10-05-r1.md'),'changed');
    await assert.rejects(publishConsentProposals(root,out),/fingerprint/);
  } finally { await rm(root,{recursive:true,force:true}); }
});
