import { connectLambda, getStore, type Store } from '@netlify/blobs';
import { receiptKey, validateReceipt, type DeletionJournal, type DeletionAction, type DeletionReceipt } from './deletionJournal.js';

export function journalProjectRef(raw:string|undefined):string {
  const u=new URL(raw ?? '');
  if (u.protocol!=='https:' || u.username || u.password || u.port || u.search || u.hash
    || !['','/'].includes(u.pathname) || !/^[a-z0-9]{20}\.supabase\.co$/.test(u.hostname)) throw new Error('DELETION_JOURNAL_CONFIG');
  return u.hostname.split('.')[0];
}
export class NetlifyDeletionJournal implements DeletionJournal {
  constructor(readonly projectRef:string,private open:()=>Store) {}
  async record(sessionId:string,action:DeletionAction,requestedAt:string):Promise<DeletionReceipt> {
    const proposed=validateReceipt({schemaVersion:1,projectRef:this.projectRef,sessionId,action,requestedAt},this.projectRef);
    const key=receiptKey(proposed), store=this.open();
    await store.setJSON('manifest',{schemaVersion:1,projectRef:this.projectRef},{onlyIfNew:true});
    await this.verifyManifest(store);
    await store.setJSON(key,proposed,{onlyIfNew:true});
    // Strong read is mandatory even when a concurrent writer won. Never overwrite
    // or move the original accepted request's deadline forward on retry.
    const saved=validateReceipt(await store.get(key,{type:'json',consistency:'strong'}),this.projectRef);
    if (saved.sessionId!==sessionId || saved.action!==action || Date.parse(saved.requestedAt)>Date.parse(requestedAt)) throw new Error('DELETION_JOURNAL_INVALID');
    return saved;
  }
  private async verifyManifest(store:Store):Promise<void> {
    const m=await store.get('manifest',{type:'json',consistency:'strong'});
    if (!m || Object.keys(m).sort().join(',')!=='projectRef,schemaVersion' || m.schemaVersion!==1 || m.projectRef!==this.projectRef) throw new Error('DELETION_JOURNAL_UNINITIALIZED');
  }
  async readAll():Promise<DeletionReceipt[]> {
    const store=this.open(), records:DeletionReceipt[]=[];
    await this.verifyManifest(store);
    const seen=new Set<string>();
    for await (const page of store.list({prefix:'intents/',paginate:true})) {
      for (const blob of page.blobs) {
        if (seen.has(blob.key) || records.length>=10000) throw new Error('DELETION_JOURNAL_INCOMPLETE');
        seen.add(blob.key);
        const r=validateReceipt(await store.get(blob.key,{type:'json',consistency:'strong'}),this.projectRef);
        if (receiptKey(r)!==blob.key) throw new Error('DELETION_JOURNAL_INVALID');
        records.push(r);
      }
    }
    return records.sort((a,b)=>Date.parse(a.requestedAt)-Date.parse(b.requestedAt));
  }
}
// Lazy opening: a visitor / data steward is authenticated before any Blob I/O.
// event.blobs is the platform Lambda context, never parsed from request body.
export function createDeletionJournal(event?:{blobs?:string;headers?:Record<string,string|undefined>|null}):DeletionJournal {
  let instance:NetlifyDeletionJournal|undefined;
  const get=()=>{
    if (instance) return instance;
    const projectRef=journalProjectRef(process.env.SUPABASE_URL);
    instance=new NetlifyDeletionJournal(projectRef,()=>{
      if (event?.blobs) {
        if (!event.headers) throw new Error('DELETION_JOURNAL_CONFIG');
        connectLambda({blobs:event.blobs,headers:Object.fromEntries(Object.entries(event.headers).filter((entry):entry is [string,string]=>typeof entry[1]==='string'))});
      }
      const options=process.env.NETLIFY_AUTH_TOKEN && process.env.NETLIFY_SITE_ID
        ? {token:process.env.NETLIFY_AUTH_TOKEN,siteID:process.env.NETLIFY_SITE_ID}:{};
      return getStore({name:'kareo-deletion-journal-'+projectRef,region:'us-east-1',consistency:'strong',...options});
    });
    return instance;
  };
  return {get projectRef(){return get().projectRef;},record:(...args)=>get().record(...args),readAll:()=>get().readAll()};
}
