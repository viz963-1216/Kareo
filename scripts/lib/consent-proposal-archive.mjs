// Publish reviewable proposed text only. This never changes the active consent registry.
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

export async function publishConsentProposals(root, output) {
  const directory = join(root,'contracts/legal/proposals');
  const files = (await readdir(directory)).filter(f => /^\d{4}-\d{2}-\d{2}-r\d+\.review\.json$/.test(f)).sort();
  const target = join(output,'privacy/versions');
  await mkdir(target,{recursive:true});
  const proposals=[];
  for (const file of files) {
    const review = JSON.parse(await readFile(join(directory,file),'utf8'));
    const version = file.replace('.review.json','');
    // Only a fixed local path, a non-active proposal and matching byte fingerprint
    // are allowed. Keep private decision records out of the public artifact.
    if (review.intendedVersion !== version || review.fullTextPath !== `contracts/legal/proposals/${version}.md`
        || !['PROPOSED','OWNER_APPROVED_CONDITIONAL'].includes(review.status) || review.activationAllowed !== false) {
      throw new Error('Invalid non-active consent proposal metadata');
    }
    const content = await readFile(join(directory,`${version}.md`));
    const sha256 = createHash('sha256').update(content).digest('hex');
    if (sha256 !== review.fullTextSha256) throw new Error('Consent proposal content fingerprint changed');
    const name = `${version}-proposed.txt`;
    await writeFile(join(target,name),content);
    proposals.push({version,status:'PROPOSED_NOT_ACTIVE',fullTextSha256:sha256,fullTextUrl:`/privacy/versions/${name}`});
  }
  await writeFile(join(target,'index.json'),JSON.stringify({schemaVersion:1,proposals},null,2)+'\n');
  return proposals;
}
