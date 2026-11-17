import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {activeAt,periodHeadcounts,mergeEmployees,normalizedRaw,rosterFromData,publicQuarterData} from '../web/raw-model.js';import {parseRawWorkbook} from '../web/raw-import.js';
const XLSX=createRequire(import.meta.url)('../web/vendor/xlsx.full.min.js');
const employee=(name,hireDate,leaveDate='',department='A')=>({name,department,group:'一組',hireDate,leaveDate});
test('month and quarter end use effective departure day, including leap-year month ends',()=>{
 const roster=[employee('持續在職','2020-01-01'),employee('當天離職','2024-02-01','2024-02-29'),employee('當天到職','2024-02-29'),employee('次日到職','2024-03-01'),employee('季末離職','2024-01-01','2024-03-31')];
 const h=periodHeadcounts(roster,2024);assert.equal(h[2].cutoff,'2024-02-29');assert.equal(h[2].total,3);assert.equal(h.q1.cutoff,'2024-03-31');assert.equal(h.q1.total,3);
 assert.equal(activeAt(employee('離職','2020-01-01','2026-06-30'),'2026-06-30'),false);assert.equal(activeAt(employee('新進','2026-06-30'),'2026-06-30'),true)
});
test('roster-only workbook accepts supplied five fields and Excel dates, rejects obsolete headers and invalid dates',()=>{
 const sheet=XLSX.utils.aoa_to_sheet([['部門','姓名','組別','到職日','離職日'],['A','甲','一組',new Date(Date.UTC(2026,0,1)), '2026/06/30']]),wb={Sheets:{員工名單:sheet},SheetNames:['員工名單']};
 const p=parseRawWorkbook(wb,'名單.xlsx',XLSX);assert.equal(p.raw.rosterOnly,true);assert.equal(p.raw.employees[0].hireDate,'2026-01-01');assert.equal(p.raw.employees[0].leaveDate,'2026-06-30');assert.deepEqual(p.detectedMonths,[]);assert.equal(p.raw.records.length,0);
 sheet.D2={t:'s',v:'2026/02/30'};assert.throws(()=>parseRawWorkbook(wb,'名單.xlsx',XLSX),/有效日期/);sheet.D1.v='新進離職';assert.throws(()=>parseRawWorkbook(wb,'名單.xlsx',XLSX),/到職日/)
});
test('date roster merges omitted employees and retains dates through legacy snapshot enrichment',()=>{
 const old=employee('甲','2020-01-01'),delta=normalizedRaw({records:[],employees:[employee('乙','2026-11-01')]}).employees,r=mergeEmployees([old],delta).roster;
 assert.equal(r.length,2);assert.equal(r[0].hireDate,'2020-01-01');assert.equal(rosterFromData([{people:[{name:'甲',department:'A'}]}],r)[0].hireDate,'2020-01-01');
 assert.throws(()=>normalizedRaw({records:[],employees:[employee('錯誤','2026-11-01','2026-10-31')]}),/不得早於/)
});
test('unknown dates never fabricate headcounts, and public period averages use full master roster including zero voters',()=>{
 const q={id:'q3',months:[7,8,9],people:[{name:'甲',department:'A',months:[{month:7,paper:0,digital:10}]}],reported:[]};
 const data=publicQuarterData({data:[q],roster:[employee('甲','2020-01-01'),employee('零票','2020-01-01')]});assert.equal(data[0].reported.find(r=>r.period==='q3').average,5);
 const incomplete=periodHeadcounts([employee('甲','2020-01-01'),{name:'未補',department:'A'}],2026);assert.equal(incomplete.q3.departments.A.count,null);assert.equal(incomplete.q3.total,null)
});
test('dated roster upload keeps employment dates private while exposing aggregate counts and guarded backups',async()=>{
 const {default:worker}=await import('../dist/server/index.js'),{LocalBucket}=await import('../scripts/local-bucket.mjs'),{authenticatedFetch}=await import('./auth-helper.mjs'),bucket=new LocalBucket;
 const post=(path,body)=>authenticatedFetch(worker,bucket,new Request('http://localhost'+path,{method:'POST',headers:{'x-small-step-write':'1',...(body instanceof FormData?{}:{'content-type':'application/json'})},body:body instanceof FormData?body:JSON.stringify(body)}));
 const payload={mode:'raw',filename:'員工名單.xlsx',raw:{rosterOnly:true,records:[],employees:[employee('日期測試員工','2026-11-16','2026-12-31')]},months:[],expectedRevision:'initial',acknowledgedWarnings:true},form=new FormData;form.append('file',new File([new Uint8Array([80,75,3,4,0])],payload.filename));form.append('payload',JSON.stringify(payload));assert.equal((await post('/api/admin/update',form)).status,201);
 const pub=await(await authenticatedFetch(worker,bucket,new Request('http://localhost/api/dataset'))).json();assert.equal(pub.roster.find(e=>e.name==='日期測試員工').hireDate,undefined);assert.equal(pub.data[0].headcounts[11].cutoff,'2026-11-30');
 const backup=await authenticatedFetch(worker,bucket,new Request('http://localhost/api/admin/backup'));assert.equal((await backup.json()).roster.find(e=>e.name==='日期測試員工').leaveDate,'2026-12-31')
});
