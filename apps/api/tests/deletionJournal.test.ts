import { beforeAll,afterAll,describe,it,expect } from 'vitest';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import {join} from 'node:path';
import {BlobsServer} from '@netlify/blobs/server';
import {getStore,setEnvironmentContext} from '@netlify/blobs';
import {NetlifyDeletionJournal,journalProjectRef} from '../src/privacy/netlifyDeletionJournal.js';
import {validateReceipt,receiptKey} from '../src/privacy/deletionJournal.js';
import {persistDeletionIntent} from '../src/privacy/persistDeletionIntent.js';
let server:BlobsServer,dir:string,journal:NetlifyDeletionJournal,store:ReturnType<typeof getStore>;
const saved=process.env.NETLIFY_BLOBS_CONTEXT;
beforeAll(async()=>{
 dir=mkdtempSync(join(tmpdir(),'kareo-journal-test-'));
 server=new BlobsServer({directory:dir,token:'synthetic-only',logger:()=>{}});
 const address=await server.start(),url=`http://127.0.0.1:${address.port}`;
 setEnvironmentContext({siteID:'00000000-0000-4000-8000-000000000001',token:'synthetic-only',edgeURL:url,uncachedEdgeURL:url});
 store=getStore({name:'kareo-deletion-journal-LOCAL-SYNTHETIC',region:'us-east-1',consistency:'strong'});
 journal=new NetlifyDeletionJournal('LOCAL-SYNTHETIC',()=>store);
});
afterAll(async()=>{await server.stop();rmSync(dir,{recursive:true,force:true});if(saved===undefined)delete process.env.NETLIFY_BLOBS_CONTEXT;else process.env.NETLIFY_BLOBS_CONTEXT=saved;});
describe('independent deletion journal with real official SDK filesystem server',()=>{
 it('binds cloud namespaces to a strict actual Supabase origin',()=>{
  expect(journalProjectRef('https://ojawadobnaxduxybqolk.supabase.co')).toBe('ojawadobnaxduxybqolk');
  for(const u of ['http://ojawadobnaxduxybqolk.supabase.co','https://ojawadobnaxduxybqolk.supabase.co/other','https://evil.invalid','https://x:secret@ojawadobnaxduxybqolk.supabase.co'])expect(()=>journalProjectRef(u)).toThrow();
 });
 it('concurrent conditional inserts retain one original intent and retries do not postpone it',async()=>{
  const now=new Date(Date.now()-5000).toISOString();
  const values=await Promise.all(Array.from({length:5},()=>journal.record('SES-SDK-1','USER_DELETED',now)));
  expect(values.every(r=>r.requestedAt===now)).toBe(true);
  const retry=await journal.record('SES-SDK-1','USER_DELETED',new Date().toISOString());expect(retry.requestedAt).toBe(now);
  expect(await journal.readAll()).toHaveLength(1);
 });
 it('rejects foreign, malformed, future or extra sensitive receipt fields',()=>{
  const r={schemaVersion:1,projectRef:'LOCAL-SYNTHETIC',sessionId:'SES-SDK-2',action:'CONSENT_WITHDRAWN',requestedAt:new Date().toISOString()};
  for(const change of [{projectRef:'another'}, {sessionId:'../path'}, {action:'OTHER'}, {requestedAt:'bad'}, {requestedAt:'2999-01-01'}, {phone:'0900000000'}])expect(()=>validateReceipt({...r,...change},'LOCAL-SYNTHETIC')).toThrow('DELETION_JOURNAL_INVALID');
 });
 it('strong read verifies the saved receipt rather than trusting a write acknowledgment',async()=>{
  const bad=new NetlifyDeletionJournal('LOCAL-SYNTHETIC',()=>({setJSON:async()=>({modified:true}),get:async()=>null} as unknown as typeof store));
  await expect(bad.record('SES-SDK-3','USER_DELETED',new Date().toISOString())).rejects.toThrow('DELETION_JOURNAL_UNINITIALIZED');
 });
 it('a corrupted or wrong-key object stops the entire read; it is never silently skipped',async()=>{
  const r={schemaVersion:1 as const,projectRef:'LOCAL-SYNTHETIC',sessionId:'SES-SDK-4',action:'USER_DELETED' as const,requestedAt:new Date().toISOString()};
  await store.setJSON('intents/wrong-key',r);
  await expect(journal.readAll()).rejects.toThrow('DELETION_JOURNAL_INVALID');
  await store.delete('intents/wrong-key');
  await store.setJSON(receiptKey(r),{...r,phone:'0900000000'});
  await expect(journal.readAll()).rejects.toThrow('DELETION_JOURNAL_INVALID');
  await store.delete(receiptKey(r));
 });
 it('transport or storage failure never supplies a success timestamp or leaks the exception',async()=>{
  const fail={projectRef:'LOCAL-SYNTHETIC',record:async()=>{throw new Error('private-token-and-contact');},readAll:async()=>[]};
  await expect(persistDeletionIntent(fail,'SES-FAIL','USER_DELETED',new Date().toISOString())).rejects.toThrow('無法確認刪除請求紀錄');
 });
});
