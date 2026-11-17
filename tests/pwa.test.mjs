import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import worker from '../dist/server/index.js';
import {parseRawWorkbook} from '../web/raw-import.js';
const call=path=>worker.fetch(new Request('https://example.com'+path),{});
const body=async r=>gunzipSync(Buffer.from(await r.arrayBuffer())).toString();
test('PWA endpoints have install metadata, actual PNG icons and revalidated root service worker',async()=>{
 const r=await call('/manifest.webmanifest');assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/manifest\+json/);const m=JSON.parse(await body(r));assert.equal(m.scope,'/');assert.equal(m.start_url,'/');assert.equal(m.display,'standalone');assert(m.icons.some(i=>i.sizes==='512x512'&&i.purpose==='maskable'));
 for(const i of m.icons){const response=await call(i.src),png=gunzipSync(Buffer.from(await response.arrayBuffer()));assert.equal(png.toString('hex',0,8),'89504e470d0a1a0a');assert.equal(png.readUInt32BE(16),Number(i.sizes.split('x')[0]))}
 const sw=await call('/sw.js');assert.equal(sw.headers.get('service-worker-allowed'),'/');assert.match(sw.headers.get('cache-control'),/no-store/);const source=await body(sw);assert(!source.includes('__PWA_REVISION__'));assert.match(source,/small-step-shell-[a-f0-9]{16}/);
 assert.equal((await call('/api/admin/status')).status,503); // Storage remains required; no public shell route bypass.
});
test('offline worker never intercepts data, admin API or writes, and serves only neutral offline navigation',async()=>{
 const source=await readFile(new URL('../web/sw.js',import.meta.url),'utf8'),handlers={},cache=new Map;let skipped=false;
 const context={URL,fetch:async()=>{throw Error('offline')},caches:{open:async()=>({addAll:async paths=>{for(const path of paths)cache.set(path,path)}}),match:async path=>cache.get(path),keys:async()=>['small-step-shell-old','unrelated-cache'],delete:async key=>{assert.equal(key,'small-step-shell-old')}},self:{location:{origin:'https://example.com'},clients:{claim:async()=>{}},addEventListener:(name,fn)=>handlers[name]=fn,skipWaiting:()=>{skipped=true}}};vm.runInNewContext(source,context);
 let pending;handlers.install({waitUntil:p=>pending=p});await pending;assert.deepEqual([...cache.keys()],['/offline.html','/icons/icon-192.png','/icons/icon-512.png']);
 for(const [url,method,mode] of [['/api/dataset','GET','cors'],['/api/admin/backup','GET','cors'],['/api/admin/update','POST','cors'],['/data.json','GET','cors'],['/admin-auth.js','GET','cors']]){let handled=false;handlers.fetch({request:{url:'https://example.com'+url,method,mode},respondWith:()=>handled=true});assert.equal(handled,false,url)}
 handlers.fetch({request:{url:'https://example.com/admin.html',method:'GET',mode:'navigate'},respondWith:p=>pending=p});assert.equal(await pending,'/offline.html');assert(!skipped);handlers.message({data:{type:'ACTIVATE_UPDATE'}});assert(skipped);handlers.activate({waitUntil:p=>pending=p});await pending;
});
test('new roster column order and legacy uploads resolve the same person without swapping group and name',async()=>{
 const require=createRequire(import.meta.url),XLSX=require('../web/vendor/xlsx.full.min.js');
 for(const rows of [[['部門','組別','姓名','到職日','離職日'],['環安部','第三組','測試員工','2026/01/01','']],[['部門','姓名','組別','到職日','離職日'],['環安部','測試員工','第三組','2026/01/01','']]]){const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(rows),'員工名單');const employee=parseRawWorkbook(book,'名單.xlsx',XLSX).raw.employees[0];assert.equal(employee.name,'測試員工');assert.equal(employee.group,'第三組');assert.equal(employee.department,'環安部')}
 const template=XLSX.read(await readFile(new URL('../web/upload-template.xlsx',import.meta.url)),{type:'buffer'});assert.equal(template.Sheets['員工名單'].B1.v,'組別');assert.equal(template.Sheets['員工名單'].C1.v,'姓名');
});
