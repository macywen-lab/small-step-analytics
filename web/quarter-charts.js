(()=>{
 const quarters=[{id:'q1',months:[1,2,3],label:'1–3 月'},{id:'q2',months:[4,5,6],label:'4–6 月'},{id:'q3',months:[7,8,9],label:'7–9 月'},{id:'q4',months:[10,11,12],label:'10–12 月'}];
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const format=value=>value===null?'—':Number(value).toLocaleString('zh-TW',{minimumFractionDigits:2,maximumFractionDigits:2});
 function quarterRanking(source,year,id){
  const definition=quarters.find(q=>q.id===id);if(!definition)return null;
  const matched=source.filter(q=>q.id===id&&Number(q.year||2026)===Number(year));
  const departments=new Map(),active=new Set();
  for(const q of matched)for(const person of q.people||[]){const name=String(person.name||''),department=String(person.department||'未填部門');let record=departments.get(department);if(!record){record={department,names:new Set,total:0};departments.set(department,record)}record.names.add(name);for(const m of person.months||[]){if(!definition.months.includes(Number(m.month)))continue;const value=Number(m.paper||0)+Number(m.digital||0);record.total+=value;if(value>0)active.add(Number(m.month))}}
  const hc=matched.find(q=>q.headcounts)?.headcounts?.[id];if(hc)for(const department of Object.keys(hc.departments))if(!departments.has(department))departments.set(department,{department,names:new Set,total:0});
  const rows=[...departments.values()].map(r=>({department:r.department,total:r.total,count:hc?(hc.departments[r.department]?.count??null):r.names.size,average:hc?(hc.departments[r.department]?.count?r.total/hc.departments[r.department].count:null):r.names.size?r.total/r.names.size:0})).sort((a,b)=>(b.average??-1)-(a.average??-1)||a.department.localeCompare(b.department,'zh-Hant'));
  const first=rows[0],winners=first&&first.total>0&&first.average!==null&&!rows.some(r=>r.average===null&&(r.count===null||r.total>0))?rows.filter(r=>r.average!==null&&r.count>0&&r.total*first.count===first.total*r.count).map(r=>r.department):[];
  let rank=0,previous=null;rows.forEach((row,index)=>{if(!previous||row.total*previous.count!==previous.total*row.count)rank=index+1;row.rank=row.average===null?null:rank;previous=row});
  return {...definition,year:Number(year),rows,winners,available:matched.length>0&&rows.length>0,activeMonths:[...active].sort((a,b)=>a-b),headcountMode:!!hc,cutoff:hc?.cutoff,incompleteHeadcounts:rows.some(r=>r.average===null&&(r.count===null||r.total>0)),partial:matched.some(q=>Array.isArray(q.coveredMonths))?matched.some(q=>(q.coveredMonths||[]).length<3):active.size<3};
 }
 function chartSvg(result,selectedDepartment){
  const visual=globalThis.smallStepPresentation,rows=result.rows,top=76,bottom=308,left=58,right=26,w=Math.max(960,rows.length*82+left+right),h=460,plotWidth=w-left-right,max=Math.max(1,...rows.map(r=>r.average||0)),step=plotWidth/Math.max(rows.length,1),barWidth=Math.min(48,step*.58),plotHeight=bottom-top;
  const lines=Array.from({length:5},(_,i)=>{const y=bottom-i*plotHeight/4,v=max*i/4;return `<line x1="${left}" x2="${w-right}" y1="${y}" y2="${y}" stroke="#e3e9df"/><text x="${left-10}" y="${y+5}" text-anchor="end" class="qc-axis">${format(v)}</text>`}).join('');
  const bars=rows.map((r,i)=>{const x=left+step*(i+.5),height=(r.average||0)/max*plotHeight,winner=result.winners.includes(r.department),position=r.average!==null&&r.average>0?r.rank:null,color=visual.colors[position]||visual.colors.other,selected=selectedDepartment!=='all'&&selectedDepartment===r.department,barTop=bottom-height;return `<g data-rank="${position||''}" data-department="${escape(r.department)}" data-selected="${selected}"><title>${result.year} 年 ${result.label}，${escape(r.department)}：平均 ${format(r.average)} 分，總票數 ${r.total}，人數 ${r.count??'待確認'}，名次 ${position||'未列名次'}</title><rect x="${x-barWidth/2}" y="${barTop}" width="${barWidth}" height="${Math.max(height,.8)}" rx="4" fill="${color}" stroke="${selected?'#174b3f':'none'}" stroke-width="${selected?3:0}"/>${winner?visual.crown({x:x+barWidth/2-4,y:barTop-39,width:28,height:25}):''}<text x="${x-(winner?5:0)}" y="${barTop-10}" text-anchor="middle" class="qc-value ${winner?'qc-value-winner':''}" style="fill:${position&&position<=3?'#5f5138':'#52738a'}">${format(r.average)}</text><text transform="translate(${x+5},${bottom+24}) rotate(-45)" text-anchor="end" class="qc-label">${escape(r.department)}</text></g>`}).join('');
  return `<div class="qc-chart-scroll"><svg class="qc-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${result.year} 年 ${result.label}部門平均分排名，第一名金色、第二名銀色、第三名銅色"><title>${result.year} 年 ${result.label} 部門平均分</title>${lines}${bars}</svg></div>`;
 }
 function mobileBars(result,selectedDepartment){
  const visual=globalThis.smallStepPresentation,max=Math.max(1,...result.rows.map(r=>r.average||0));return `<ol class="qc-mobile-bars" aria-label="${result.year} 年 ${result.label}部門平均分排名">${result.rows.map(r=>{const rank=r.average>0?r.rank:null,color=visual.colors[rank]||visual.colors.other,winner=result.winners.includes(r.department);return `<li class="qc-mobile-row" data-rank="${rank||''}" data-selected="${selectedDepartment!=='all'&&selectedDepartment===r.department}"><div class="qc-mobile-heading"><span class="qc-mobile-name"><span class="qc-mobile-rank">${rank?String(rank).padStart(2,'0'):'—'}</span>${escape(r.department)}</span><span class="qc-mobile-value">${format(r.average)}</span></div><div class="qc-mobile-track" aria-hidden="true"><div class="qc-mobile-fill" style="width:${(r.average||0)/max*100}%;background:${color}">${winner?visual.crown():''}</div></div></li>`}).join('')}</ol>`
 }
 function currentQuarter(now=new Date()){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Taipei',year:'numeric',month:'numeric'}).formatToParts(now);
  return {year:Number(parts.find(p=>p.type==='year').value),id:'q'+Math.ceil(Number(parts.find(p=>p.type==='month').value)/3)};
 }
 function refreshCurrentQuarter(){
  const current=currentQuarter();
  for(const card of document.querySelectorAll('#quarterCharts .qc-panel'))card.classList.toggle('qc-current',Number(card.dataset.year)===current.year&&card.dataset.quarter===current.id);
 }
 function renderQuarterCharts(){
  if(typeof document==='undefined'||typeof data==='undefined'||typeof state==='undefined')return;
  const target=document.querySelector('#quarterCharts');if(!target)return;
  const year=Number(state.year||2026),selectedDepartment=state.department||'all';
  const visual=globalThis.smallStepPresentation,current=currentQuarter();
  const cards=quarters.map(def=>{const result=quarterRanking(data,year,def.id),selected=state.period===def.id;
   return `<article class="qc-panel ${selected?'qc-selected':''} ${year===current.year&&def.id===current.id?'qc-current':''}" data-year="${year}" data-quarter="${def.id}" aria-label="${year} 年 ${def.label}平均分排名"><header class="qc-panel-heading"><div><p class="qc-kicker">第 ${def.id.slice(1)} 季</p><h3>${year} 年 ${def.label}</h3></div><button type="button" data-quarter-chart="${def.id}" aria-pressed="${selected}" ${result.available?'':'disabled'}>查看本季 ↗</button></header><p class="scope-caption">統計範圍：${escape(visual.scopeLabel({year,period:def.id,month:'all',department:'all'}))}${selectedDepartment!=='all'?'；強調：'+escape(selectedDepartment):''}</p>${result.available?`${chartSvg(result,selectedDepartment)}${mobileBars(result,selectedDepartment)}<details class="qc-notes qc-foot"><summary>本季資料說明</summary><p>${result.incompleteHeadcounts?'在職人數待補齊，暫不評選第一名。':''}${def.id==='q1'?'1～2 月尚未啟用電子票。':''}${result.headcountMode?'人數基準：'+result.cutoff+'。':''}${result.activeMonths.length?`${result.activeMonths.join('、')} 月有票數紀錄`:'本季目前票數為 0'}${result.partial?'；統計進度待確認，排名為目前資料結果。':'；依目前發布資料計算。'}${state.month!=='all'&&def.months.includes(Number(state.month))?' 上方月份篩選不改變本季累計排名。':''}</p></details>`:`<div class="qc-empty"><span>—</span><h4>尚無資料</h4><p>此年度季度尚未上傳紀錄，暫不列出排名。</p></div>`}</article>`;
  }).join('');
  target.innerHTML=`<div class="qc-heading"><div><p class="section-kicker">EVERY QUARTER, EVERY STEP</p><h2>${year} 年・各季部門平均分</h2></div><span class="qc-sort-label">依平均分由高至低</span></div><p class="scope-caption qc-filter-scope">目前篩選：${escape(visual.scopeLabel(state))}</p><details class="qc-notes qc-method"><summary>排名配色與計算說明</summary><div>${visual.legend()}<p>平均分＝本季含加成總票數 ÷ 季末在職人數；到職日當天計入、離職生效日當天不計入。尚未匯入日期名單時沿用原季度名冊，缺少日期或分母為 0 時平均顯示 —，暫不評選第一名。每季第一名依完整季度範圍比較，同分並列；部門篩選只強調選定部門。</p></div></details><div class="qc-grid">${cards}</div>`;
  for(const button of target.querySelectorAll('[data-quarter-chart]'))button.onclick=()=>{if(typeof setPeriod==='function')setPeriod(button.dataset.quarterChart)};
 }
 if(typeof document!=='undefined'){
  setInterval(refreshCurrentQuarter,60000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshCurrentQuarter()});
 }
 globalThis.smallStepCurrentQuarter=currentQuarter;
 globalThis.smallStepQuarterRanking=quarterRanking;globalThis.smallStepQuarterChartSvg=chartSvg;globalThis.renderQuarterCharts=renderQuarterCharts;
 if(typeof window!=='undefined'&&window.smallStepDatasetPromise)window.smallStepDatasetPromise.then(()=>renderQuarterCharts()).catch(()=>{});
})();
