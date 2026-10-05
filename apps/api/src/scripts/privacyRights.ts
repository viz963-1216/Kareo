// No public endpoint. Only a verified DATA_STEWARD, a private request file and
// an explicit private export file. Never print health/contact values or keys.
import { lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireOperator } from '../services/internalOperatorService.js';
import { executePrivacyRight, type PrivacyRightsDeps } from '../services/privacyRightsService.js';
import { SupabasePrivacyRepository } from '../repositories/supabasePrivacyRepository.js';
import { SupabaseLeadRepository } from '../repositories/supabaseLeadRepository.js';
import { SupabaseKnowledgeRepository } from '../repositories/supabaseKnowledgeRepository.js';
import { DatabaseKnowledgeResolver } from '../adapters/knowledgeVersionResolver.js';
import { RuleBasedAssessmentEngine } from '../assessment/ruleBasedAssessmentEngine.js';

function restricted(path:string, directory=false): void {
  const s=lstatSync(path);
  if (s.isSymbolicLink() || (directory?!s.isDirectory():!s.isFile()) || (s.mode & 0o077)!==0 || (process.getuid && s.uid!==process.getuid())) throw new Error('PRIVATE_FILE_REQUIRED');
}
export function readPrivateRequest(path:string): unknown {
  if (!isAbsolute(path)) throw new Error('PRIVATE_FILE_REQUIRED');
  restricted(dirname(path),true); restricted(path);
  return JSON.parse(readFileSync(path,'utf8'));
}
export function writePrivateExport(path:string, data:unknown): void {
  if (!isAbsolute(path)) throw new Error('PRIVATE_FILE_REQUIRED');
  mkdirSync(dirname(path),{recursive:true,mode:0o700}); restricted(dirname(path),true);
  writeFileSync(path,JSON.stringify(data,null,2)+'\n',{mode:0o600,flag:'wx'});
}
export interface PrivacyCliDeps extends PrivacyRightsDeps {
  readRequest:(path:string)=>unknown; writeExport:(path:string,data:unknown)=>void;
  log:(message:string)=>void; error:(message:string)=>void;
}
export async function runPrivacyCli(argv:string[],env:Record<string,string|undefined>,deps:PrivacyCliDeps):Promise<number> {
  const matches=argv.map(a=>a.match(/^--(request|output)=(.+)$/));
  if (!matches.length || matches.some(m=>!m) || new Set(matches.map(m=>m![1])).size!==matches.length) {deps.error('Use --request=<private absolute JSON file> [--output=<private absolute export file>]');return 2;}
  const flags=Object.fromEntries(matches.map(m=>[m![1],m![2]]));
  if (!flags.request) return 2;
  try {
    // Do not even read a sensitive request file before authentication.
    await requireOperator(deps.operatorRepo,env.KAREO_OPERATOR_ID,env.KAREO_OPERATOR_KEY,'DATA_STEWARD');
    const q=deps.readRequest(flags.request) as Record<string,unknown>;
    if (q.action==='EXPORT' && !flags.output) {deps.error('EXPORT requires a private output file.');return 2;}
    if (q.action!=='EXPORT' && flags.output) {deps.error('Output is only supported for EXPORT.');return 2;}
    const result=await executePrivacyRight(deps,q,env.KAREO_OPERATOR_ID,env.KAREO_OPERATOR_KEY);
    if (q.action==='EXPORT') deps.writeExport(flags.output,result.data);
    deps.log(JSON.stringify({requestId:result.requestId,action:result.action,status:'SUCCESS',counts:result.counts,exportWritten:q.action==='EXPORT'}));
    return 0;
  } catch {deps.error('Privacy operation failed. Verify authorization, identity attestation, target and current state; no sensitive details are logged.');return 1;}
}
if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  runPrivacyCli(process.argv.slice(2),process.env,{
    operatorRepo:new SupabaseLeadRepository(),privacyRepo:new SupabasePrivacyRepository(),
    knowledgeResolver:new DatabaseKnowledgeResolver(new SupabaseKnowledgeRepository()),engine:new RuleBasedAssessmentEngine(),
    readRequest:readPrivateRequest,writeExport:writePrivateExport,log:console.log,error:console.error,
  }).then(code=>{process.exitCode=code;}).catch(()=>{console.error('Privacy operation failed.');process.exitCode=1;});
}
