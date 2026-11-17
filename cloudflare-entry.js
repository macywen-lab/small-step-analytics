import application from './dist/server/index.js';
import {normalizedQuarter} from './web/import-model.js';
import {normalizeRoster} from './web/raw-model.js';
const USERS='small-step/auth/v1/users.json', CURRENT='small-step/v1/current.json', NOTES='small-step/employees/v1/notes.json', REVIEWS='small-step/reviews/v1/current.json', LOCK='small-step/migration-lock.json';
const reply=(value,status=200)=>Response.json(value,{status,headers:{'cache-control':'no-store'}});
const hex=b=>Array.from(new Uint8Array(b),n=>n.toString(16).padStart(2,'0')).join('');
async function bootstrap(env){
 if(await env.BUCKET.get(USERS))return;
 const id=env.ADMIN_BOOTSTRAP_ID,password=env.ADMIN_BOOTSTRAP_PASSWORD;
 if(!/^\d{1,20}$/.test(id||'')||typeof password!=='string'||password.length<12||password.length>128)throw Object.assign(Error('請先設定 ADMIN_BOOTSTRAP_ID 與至少 12 字元的 ADMIN_BOOTSTRAP_PASSWORD。'),{status:503});
 const salt=hex(crypto.getRandomValues(new Uint8Array(16))),key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']),hash=hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},key,256));
 await env.BUCKET.put(USERS,JSON.stringify({users:[{id,role:'admin',salt,hash,revision:crypto.randomUUID(),createdAt:new Date().toISOString()}]}),{onlyIf:{etagDoesNotMatch:'*'}});
}
async function migrate(request,env){
 const session=await application.fetch(new Request(new URL('/api/admin/auth/session',request.url),{headers:request.headers}),env);
 if(session.status!==200)return session;
 if((await session.json()).role!=='admin')return reply({error:'僅管理員可匯入備份。'},403);
 if(request.method!=='POST')return reply({error:'請使用備份匯入表單。'},405);
 const own=new URL(request.url).origin;
 if(request.headers.get('origin')!==own||request.headers.get('x-small-step-write')!=='1'||!request.headers.get('content-type')?.startsWith('application/json'))return reply({error:'請從新站的備份匯入頁操作。'},403);
 if(Number(request.headers.get('content-length')||0)>20*1024*1024)return reply({error:'備份上限 20 MB。'},413);
 const raw=await request.text();if(new TextEncoder().encode(raw).length>20*1024*1024)return reply({error:'備份上限 20 MB。'},413);
 let b;try{b=JSON.parse(raw)}catch{return reply({error:'請選擇舊站下載的 JSON 備份。'},422)}
 if(b.schemaVersion!==1||!Array.isArray(b.data)||!b.data.length||b.data.length>4||!Array.isArray(b.stories)||!Array.isArray(b.notes)||!Array.isArray(b.roster)||!Array.isArray(b.webSubmissions)||!b.electronicReview?.decisions)return reply({error:'備份不完整，請重新從第 41 版後台下載目前資料備份。'},422);
 b.data.forEach(normalizedQuarter);normalizeRoster(b.roster);
 if(new Set(b.data.map(q=>q.id)).size!==b.data.length) return reply({error:'備份有重複季度。'},422);
 for(const n of [...b.notes,...b.webSubmissions])if(!n||typeof n.id!=='string'||typeof n.content!=='string'||typeof n.name!=='string'||!['q1','q2','q3','q4'].includes(n.quarter))return reply({error:'便條紙備份格式不完整。'},422);
 for(const [id,d] of Object.entries(b.electronicReview.decisions))if(!/^(import-|web-)/.test(id)||!d||!['','V','X'].includes(d.status)||d.bonus!==undefined&&(!Number.isSafeInteger(d.bonus)||d.bonus<0||d.bonus>1e9))return reply({error:'審核備份格式不正確。'},422);
 const bucket=env.BUCKET,lock=await bucket.put(LOCK,JSON.stringify({at:new Date().toISOString()}),{onlyIf:{etagDoesNotMatch:'*'}});
 if(!lock)return reply({error:'已有備份正在匯入，請稍後重試。'},409);
 const written=[];let committed=false;
 try{
  for(const key of [CURRENT,NOTES,REVIEWS,'small-step/employees/v1/users.json'])if(await bucket.get(key))return reply({error:'此功能僅供全新站台首次匯入；已有資料時不會覆蓋。'},409);
  const revision=crypto.randomUUID(),key='small-step/v1/versions/'+revision+'.json';
  const record={revision,parent:'initial',createdAt:new Date().toISOString(),action:'upload',filename:'舊站資料備份匯入',quarter:null,hasOriginal:false,snapshot:{data:b.data,stories:b.stories,notes:b.notes,roster:b.roster}};
  for(const [k,v]of [[key,record],[NOTES,{notes:b.webSubmissions}],[REVIEWS,b.electronicReview]]){await bucket.put(k,JSON.stringify(v));written.push(k)}
  const saved=await bucket.put(CURRENT,JSON.stringify({revision,employeeDirectoryKey:null}),{onlyIf:{etagDoesNotMatch:'*'}});if(!saved)throw Error('匯入時資料已變更。');committed=true;
  return reply({imported:true,notes:b.notes.length,webSubmissions:b.webSubmissions.length,roster:b.roster.length,reviewDecisions:Object.keys(b.electronicReview.decisions).length});
 }finally{if(!committed&&written.length)await bucket.delete(written);await bucket.delete(LOCK)}
}
export default {async fetch(request,env){try{
 if(!env.BUCKET)return reply({error:'請綁定 R2：BUCKET → small-step-data。'},503);
 const path=new URL(request.url).pathname;
 if(path==='/api/admin/migration')return await migrate(request,env);
 if(await env.BUCKET.get(LOCK))return reply({error:'正在匯入網站備份，請稍後重新整理。'},503);
 if(path==='/api/admin/auth/login'&&request.method==='POST')await bootstrap(env);
 return await application.fetch(request,env);
 }catch(e){return reply({error:e.status?e.message:'匯入或初始化未完成，請檢查備份及設定後重試。'},e.status||500)}}};
