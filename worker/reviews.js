const REVIEW_KEY='small-step/reviews/v1/current.json',reviewCatalogCache=new Map();
function reviewStatus(value){const status=String(value??'').trim().toUpperCase();if(!['','V','X'].includes(status))fail('審核狀態只能填 V、X 或留白。',422);return status}
function reviewDate(value){const m=String(value||'').match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);return m?`${m[1]}/${m[2].padStart(2,'0')}/${m[3].padStart(2,'0')}`:String(value||'')}
function reviewMatchKey(n){return JSON.stringify([reviewDate(n.date),n.sender||'',n.name||'',n.department||'',n.beneficiary||'',n.content||''])}
function reviewFullKey(n){return JSON.stringify([reviewMatchKey(n),String(n.period||n.month+'月'),Number(n.bonus||0)])}
function reviewImportKey(n){return JSON.stringify([reviewMatchKey(n),String(n.period||n.month+'月')])}
function reviewBonus(value){if(typeof value!=='number')fail('加分必須是非負整數。',422);return countValue(value,'加分')}
async function reviewDocument(bucket){const obj=await bucket.get(REVIEW_KEY);return {obj,...(obj?await obj.json():{revision:'initial',decisions:{},history:[]})}}
async function importedReviewRecords(snapshot){
 const notes=snapshot.notes||[],key=await authDigest(JSON.stringify([notes,snapshot.stories]));if(reviewCatalogCache.has(key))return reviewCatalogCache.get(key);
 const metadata=new Map();for(const r of LEGACY_DIGITAL_RECORDS){const key=reviewMatchKey(r),list=metadata.get(key)||[];list.push(r);metadata.set(key,list)}
 const occurrences=new Map(),identities=new Map(),records=[];
 for(const n of notes){const k=reviewMatchKey(n),i=occurrences.get(k)||0;occurrences.set(k,i+1);const seed=metadata.get(k)?.[i],bonus=n.bonus??seed?.bonus??snapshot.stories?.find(s=>s.source==='digital'&&s.id===n.id)?.bonus??0,period=n.period||seed?.period||n.month+'月',record={...n,date:reviewDate(n.date),year:Number(n.year||2026),period,bonus,source:'imported',review:reviewStatus(n.review)};const full=reviewFullKey(record),ordinal=identities.get(full)||0;identities.set(full,ordinal+1);record.id='import-'+await authDigest(full)+'-'+ordinal;records.push(record)}
 if(reviewCatalogCache.size>=2)reviewCatalogCache.clear();reviewCatalogCache.set(key,records);return records;
}
async function allReviewRecords(bucket,snapshot){
 const document=await reviewDocument(bucket),source=await importedReviewRecords(snapshot),web=(await webNotes(bucket)).notes.map(n=>({...n,id:'web-'+n.id,source:'web',date:reviewDate(n.date),period:n.month+'月',bonus:0,review:''}));
 return {document,records:[...source,...web].map(n=>{const decision=document.decisions[n.id];return {...n,bonus:decision?.bonus??n.bonus,review:decision?decision.status:n.review,reviewedAt:decision?.at||null,reviewedBy:decision?.by||null}})};
}
function reviewCounts(records){return {all:records.length,pending:records.filter(n=>n.review==='').length,approved:records.filter(n=>n.review==='V').length,rejected:records.filter(n=>n.review==='X').length}}
async function reviewedSnapshot(bucket,snapshot){
 const {records,document}=await allReviewRecords(bucket,snapshot),approved=records.filter(n=>n.review==='V'),next=structuredClone(snapshot);
 for(const q of next.data){for(const p of q.people){for(const m of p.months){m.digitalBase=0;m.digitalBonus=0;m.digital=0;m.digitalSignature=0}p.digitalSignature=0;p.signature=p.paperSignature||0}for(const m of q.managers){m.digital=0;m.total=m.paper||0}}
 next.notes=[];next.stories=(next.stories||[]).filter(s=>s.source!=='digital');
 for(const n of approved){let q=next.data.find(q=>q.id===n.quarter&&Number(q.year||2026)===Number(n.year||2026));if(!q){q={id:n.quarter,year:n.year||2026,months:Array.from({length:3},(_,i)=>(Number(n.quarter.slice(1))-1)*3+i+1),people:[],managers:[],reported:[],filename:'已審核電子便利貼',calculationMode:'raw',coveredMonths:[]};next.data.push(q)}
  for(const name of new Set([n.name,n.sender])){let p=q.people.find(p=>p.name===name);if(!p){const e=next.roster.find(e=>e.name===name);if(!e)continue;p=emptyPerson(e,Math.max(1,...q.people.map(p=>p.row))+1,q.months);q.people.push(p)}const m=p.months.find(m=>m.month===n.month);if(!m)continue;if(name===n.name){m.digitalBase++;m.digitalBonus+=Number(n.bonus||0);m.digital=m.digitalBase+m.digitalBonus}if(name===n.sender){m.digitalSignature++;p.digitalSignature++;p.signature=(p.paperSignature||0)+p.digitalSignature;const manager=q.managers.find(e=>e.name===name);if(manager){manager.digital++;manager.total=manager.paper+manager.digital}}}
  next.notes.push({...n});if(n.bonus>0&&n.content)next.stories.push({...n,source:'digital',sheet:'電子便利貼(全)',row:n.row||2});
 }
 // Rebuild legacy reported tables too, so every analysis uses the same approved ledger.
 for(const q of next.data){q.reported=[];for(const period of [...q.months,q.id]){const rows=[...new Set(q.people.map(p=>p.department))].map(department=>{const ps=q.people.filter(p=>p.department===department),mm=ps.flatMap(p=>p.months).filter(m=>period===q.id||m.month===period),paper=mm.reduce((s,m)=>s+m.paper,0),digital=mm.reduce((s,m)=>s+m.digital,0);return {department,paper,digital,total:paper+digital,headcount:ps.length,average:ps.length?(paper+digital)/ps.length:0,period}}).sort((a,b)=>b.average-a.average||a.department.localeCompare(b.department,'zh-Hant'));let rank=0,last=null;rows.forEach((r,i)=>{if(r.average!==last){rank=i+1;last=r.average}r.rank=rank});q.reported.push(...rows)}}
 next.reviewMeta={revision:document.revision,...reviewCounts(records)};return next;
}
function reviewPage(request,records){const url=new URL(request.url),state=url.searchParams.get('state')||'all',query=(url.searchParams.get('query')||'').trim(),filtered=records.filter(n=>(state==='all'||n.review===({pending:'',approved:'V',rejected:'X'}[state]))&&(!query||[n.name,n.sender,n.department,n.content].some(v=>String(v||'').includes(query)))).sort((a,b)=>{const direction=url.searchParams.get('sort')==='oldest'?1:-1,time=n=>Date.parse(n.createdAt||reviewDate(n.date).replaceAll('/','-')+'T00:00:00+08:00')||0;return direction*(time(a)-time(b)||a.id.localeCompare(b.id))}),pages=Math.max(1,Math.ceil(filtered.length/10)),page=Math.min(pages,Math.max(1,Number(url.searchParams.get('page'))||1));return {records:filtered.slice((page-1)*10,page*10),page,pages,total:filtered.length}}
async function employeeMyNotes(request,bucket){const session=await requireEmployee(request,bucket),current=await readCurrent(bucket),catalog=await allReviewRecords(bucket,current.record.snapshot),mine=catalog.records.filter(n=>n.source==='web'?n.employeeId===session.user.id:n.sender===session.person.name);const result=reviewPage(request,mine);result.records=result.records.map(({employeeId,reviewedBy,...n})=>n);return json({...result,counts:reviewCounts(mine)})}
async function adminReviewList(request,bucket){const current=await readCurrent(bucket),catalog=await allReviewRecords(bucket,current.record.snapshot);return json({...reviewPage(request,catalog.records),counts:reviewCounts(catalog.records),revision:catalog.document.revision})}
async function applyReviewChanges(bucket,request,input,changes,actor){
 const document=await reviewDocument(bucket);if(input.expectedRevision!==document.revision)fail('其他人剛完成審核，請重新讀取再操作。',409);
 if(!Array.isArray(changes)||!changes.length||changes.length>60000)fail('請提供有效的審核紀錄。',422);
 const decisions={...document.decisions},now=new Date().toISOString();for(const c of changes)decisions[c.id]={...decisions[c.id],status:reviewStatus(c.status),...(Object.hasOwn(c,'bonus')?{bonus:reviewBonus(c.bonus)}:{}),by:actor,at:now};
 const revision=crypto.randomUUID(),history=[...(document.history||[]),{at:now,by:actor,count:changes.length}].slice(-500),saved=await bucket.put(REVIEW_KEY,JSON.stringify({revision,decisions,history}),{onlyIf:document.obj?{etagMatches:document.obj.etag}:{etagDoesNotMatch:'*'}});if(!saved)fail('審核資料已變更，請重新讀取。',409);return json({updated:true,revision,count:changes.length});
}
async function adminReviewUpdate(request,bucket){writeGuard(request);const input=await employeeBody(request,8*1024*1024),current=await readCurrent(bucket),catalog=await allReviewRecords(bucket,current.record.snapshot),ids=new Set(catalog.records.map(n=>n.id));if(!Array.isArray(input.changes)||input.changes.some(c=>!ids.has(c.id)))fail('找不到這張便利貼，請重新讀取。',422);const {user}=await requireAdminSession(request,bucket);return applyReviewChanges(bucket,request,input,input.changes,user.id)}
async function reviewExport(bucket){const current=await readCurrent(bucket),catalog=await allReviewRecords(bucket,current.record.snapshot);return json({records:catalog.records,revision:catalog.document.revision,datasetRevision:current.record.revision,counts:reviewCounts(catalog.records)})}
async function reviewImport(request,bucket,actor){
 writeGuard(request);const input=await employeeBody(request,8*1024*1024),current=await readCurrent(bucket),catalog=await allReviewRecords(bucket,current.record.snapshot);if(!Array.isArray(input.records)||!input.records.length||input.records.length>60000)fail('請提供電子便利貼審核檔案。',422);
 const lookup=new Map();for(const record of catalog.records){const key=reviewImportKey(record),list=lookup.get(key)||[];list.push(record);lookup.set(key,list)}const offsets=new Map(),changes=[];
 for(const row of input.records){const key=reviewImportKey(row),index=offsets.get(key)||0,record=lookup.get(key)?.[index];if(!record)fail(`第 ${changes.length+2} 列與目前電子便利貼不一致。請保留 A～G 欄，只更新 H 欄加分與 I 欄審核狀態；新增紀錄請先從資料管理匯入。`,422);offsets.set(key,index+1);changes.push({id:record.id,status:reviewStatus(row.review),bonus:reviewBonus(row.bonus)})}
 return applyReviewChanges(bucket,request,input,changes,actor);
}
