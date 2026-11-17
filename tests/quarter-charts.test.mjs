import test from 'node:test';import assert from 'node:assert/strict';import '../web/chart-presentation.js';import '../web/quarter-charts.js';
const ranking=globalThis.smallStepQuarterRanking;
const person=(name,department,score)=>({name,department,months:[{month:7,paper:0,digital:score},{month:8,paper:0,digital:0},{month:9,paper:0,digital:0}]});
test('quarter rankings use mean including zero-vote roster members, rather than total votes',()=>{const source=[{id:'q3',year:2026,people:[person('甲','大部門',20),person('乙','大部門',0),person('丙','小部門',15)]}];const q=ranking(source,2026,'q3');assert.equal(q.rows[0].department,'小部門');assert.equal(q.rows[1].average,10);assert.deepEqual(q.winners,['小部門']);assert.equal(q.partial,true);assert.deepEqual(q.activeMonths,[7])});
test('equal averages share first place even with different headcounts',()=>{const q=ranking([{id:'q3',people:[person('甲','A',20),person('乙','A',0),person('丙','B',10)]}],2026,'q3');assert.deepEqual(q.winners.sort(),['A','B']);assert.deepEqual(q.rows.map(r=>r.rank),[1,1])});
test('year and quarter isolation do not invent missing periods or winners',()=>{const source=[{id:'q3',year:2026,people:[person('甲','A',10)]},{id:'q3',year:2027,people:[person('乙','B',30)]}];assert.equal(ranking(source,2027,'q3').winners[0],'B');assert.equal(ranking(source,2026,'q1').available,false);assert.deepEqual(ranking(source,2028,'q3').rows,[]);assert.deepEqual(ranking([{id:'q3',people:[person('甲','A',0)]}],2026,'q3').winners,[])});
test('dated period headcounts replace participant counts and incomplete departments cannot create a winner',()=>{const q={id:'q3',people:[person('甲','A',20),person('乙','B',10)],headcounts:{q3:{cutoff:'2026-09-30',departments:{A:{count:4},B:{count:1}}}}};assert.equal(ranking([q],2026,'q3').winners[0],'B');q.headcounts.q3.departments.A.count=null;assert.deepEqual(ranking([q],2026,'q3').winners,[]);assert.equal(ranking([q],2026,'q3').rows.find(r=>r.department==='A').average,null)});
test('departments with zero staff and zero votes cannot tie a positive first place',()=>{const q={id:'q1',people:[{name:'甲',department:'A',months:[{month:1,paper:10,digital:0}]}],headcounts:{q1:{cutoff:'2026-03-31',departments:{A:{count:2},B:{count:0}}}},coveredMonths:[1,2,3]};assert.deepEqual(ranking([q],2026,'q1').winners,['A']);assert.equal(ranking([q],2026,'q1').partial,false)});
test('calendar quarter follows Taiwan boundaries across seasons and years',()=>{
 const current=globalThis.smallStepCurrentQuarter;
 for(const [instant,year,id] of [
  ['2026-03-31T15:59:59Z',2026,'q1'],['2026-03-31T16:00:00Z',2026,'q2'],
  ['2026-06-30T16:00:00Z',2026,'q3'],['2026-09-30T16:00:00Z',2026,'q4'],
  ['2026-12-31T15:59:59Z',2026,'q4'],['2026-12-31T16:00:00Z',2027,'q1']
 ])assert.deepEqual(current(new Date(instant)),{year,id});
});
