import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { rm } from 'node:fs/promises';
import { publishConsentProposals } from './lib/consent-proposal-archive.mjs';
import { publishConsentDocuments } from './lib/consent-document-archive.mjs';

const root = fileURLToPath(new URL('../',import.meta.url));
// This ignored directory contains only generated proposal assets, not source files.
const publicDir = resolve(root,'apps/web/public');
await rm(resolve(publicDir,'privacy/versions'),{recursive:true,force:true});
const proposals = await publishConsentProposals(root,publicDir);
await publishConsentDocuments(root,publicDir);
console.log(`Prepared ${proposals.length} non-active consent proposal archive(s).`);
