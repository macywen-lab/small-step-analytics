import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../web/app.js',import.meta.url),'utf8');
function setup(){
 let download;
 const context=vm.createContext({window:{smallStepRoster:[{name:'在職甲',status:'在職'},{name:'在職零票',status:'在職'},{name:'離職乙',status:'離職'},{name:'未到職丙',status:'未到職'}]},document:{createElement:()=>({click(){}})},Blob,URL:{createObjectURL:b=>{download=b;return 'blob:test'},revokeObjectURL(){}},setTimeout:fn=>fn()});
 vm.runInContext(source.split("document.addEventListener('click'")[0],context);
 const person=(name,score)=>({name,department:'測試部門',signature:1,paperSignature:1,digitalSignature:0,months:[{month:1,paper:score,paperBase:score,paperBonus:0,digital:0,digitalBase:0,digitalBonus:0,paperSignature:1,digitalSignature:0}]});
 context.fixture=[{id:'q1',year:2026,people:[person('在職甲',5),person('在職零票',0),person('離職乙',100),person('未到職丙',20),person('狀態待確認',10)]}];vm.runInContext("data=fixture;state.view='people'",context);
 return {run:code=>vm.runInContext(code,context),download:()=>download};
}
test('people records exclude departed, future and unconfirmed staff before totals and ranking, retaining active zero voters',()=>{
 const {run}=setup();assert.equal(run("records().map(r=>r.name).join(',')"),'在職甲,在職零票');assert.equal(run("sum(records(),'total')"),5);assert.equal(run("sum(records(),'signature')"),2);assert.equal(run("ranks(records()).get('在職甲')"),1);assert.equal(run("state.query='離職乙';filteredPeople(records()).length"),0);assert.equal(run("state.query='';state.onlyVotes=true;filteredPeople(records()).length"),1);
});
test('other views retain historical records and totals',()=>{const {run}=setup();for(const view of ['overview','departments','managers','electronic']){run(`state.view='${view}'`);assert.equal(run('records().length'),5);assert.equal(run("sum(records(),'total')"),135)}});
test('public frontend has no CSV export function',()=>{assert(!source.includes('function exportCsv'));assert(!source.includes('createObjectURL'));});
