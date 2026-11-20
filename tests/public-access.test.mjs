import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import worker from '../dist/server/index.js';
import {LocalBucket} from '../scripts/local-bucket.mjs';
import {authenticatedFetch} from './auth-helper.mjs';
const call=(b,path,body,headers={})=>worker.fetch(new Request('https://localhost'+path,{method:body?'POST':'GET',headers:{...(body?{'content-type':'application/json','x-small-step-write':'1'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})}),{BUCKET:b});
const admin=(b,path,body)=>authenticatedFetch(worker,b,new Request('https://localhost/api/admin/'+path,{method:body?'POST':'GET',headers:body?{'content-type':'application/json','x-small-step-write':'1'}:{},...(body?{body:JSON.stringify(body)}:{})}));
test('public browsing performs no storage mutations and hides backend identities',async()=>{
 const b=new LocalBucket;await b.put('small-step/employees/v1/users.json',JSON.stringify({users:[{id:'kept',hash:'kept'}]}));await b.put('uploaded-file.xlsx','preserved');const before=[...b.map].map(([k,v])=>[k,v.bytes.toString()]);
 for(const path of ['/','/index.html','/api/dataset'])assert.equal((await call(b,path)).status,200);
 for(const path of ['/login.html','/login','/login/']){const r=await call(b,path);assert.equal(r.status,302);assert.equal(r.headers.get('location'),'/');}
 const d=await(await call(b,'/api/dataset')).json();assert(d.data.every(q=>!('managers' in q)));assert(d.notes.every(n=>!('employeeId' in n)&&!('reviewedBy' in n)));
 assert.deepEqual([...b.map].map(([k,v])=>[k,v.bytes.toString()]),before);
 for(const path of ['/api/admin/status','/api/admin/backup','/api/admin/web-notes','/upload-template.xlsx'])assert.equal((await call(b,path)).status,401);
});
test('public submissions validate sender, resist duplicate counting, and publish only after backend review',async()=>{
 const b=new LocalBucket,snapshot={};for(const [key,file]of[['data','data.json'],['stories','stories.json'],['notes','electronic-notes.json'],['roster','roster.json']])snapshot[key]=JSON.parse(await readFile(new URL('../web/'+file,import.meta.url)));
 snapshot.roster=snapshot.roster.map(e=>({...e,status:'在職',hireDate:'2020-01-01',leaveDate:''}));const revision='12345678-1234-1234-1234-123456789abc';await b.put('small-step/v1/versions/'+revision+'.json',JSON.stringify({revision,snapshot,filename:'fixture.xlsx'}));await b.put('small-step/v1/current.json',JSON.stringify({revision}));
 const name=snapshot.roster[0].name,input={id:crypto.randomUUID(),sender:name,helper:name,beneficiary:name,content:'免登入測試，感謝協助。'};
 for(const sender of ['', '不存在'])assert.equal((await call(b,'/api/notes',{...input,sender})).status,422);
 assert.equal((await call(b,'/api/notes',input,{origin:'https://evil.example'})).status,403);
 assert.equal((await call(b,'/api/notes',input)).status,201);assert.equal((await call(b,'/api/notes',input)).status,200);assert.equal((await call(b,'/api/notes',{...input,content:'different'})).status,409);
 assert(!(await(await call(b,'/api/dataset')).json()).notes.some(n=>n.id==='web-'+input.id));
 const reviews=await(await admin(b,'reviews?state=pending')).json();assert.equal((await admin(b,'reviews',{expectedRevision:reviews.revision,changes:[{id:'web-'+input.id,status:'V'}]})).status,200);
 const visible=(await(await call(b,'/api/dataset')).json()).notes.find(n=>n.id==='web-'+input.id);assert.equal(visible.sender,name);assert.equal(visible.employeeId,undefined);assert.equal((await(await admin(b,'web-notes')).json()).notes.length,1);
});
test('front-end and backend navigation omit removed personal and employee-account screens',async()=>{
 const html=await readFile(new URL('../web/index.html',import.meta.url),'utf8'),adminHtml=await readFile(new URL('../web/admin.html',import.meta.url),'utf8');
 assert(!html.includes('個人設定'));assert(!html.includes('data-mobile-view="settings"'));assert(!html.includes('id="settings"'));assert(!html.includes('id="mynotes"'));assert(!html.includes('my-notes.js'));assert(!adminHtml.includes('backendEmployees'));assert(!adminHtml.includes('employeePasswordDialog'));
 for(const view of ['electronic','write','overview'])assert(html.includes(`data-view="${view}"`));assert(html.includes('後台管理登入'));assert(html.includes('id="noteSender" list="beneficiaryNames" required'));
});
