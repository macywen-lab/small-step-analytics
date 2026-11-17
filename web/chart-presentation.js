(()=>{
 const colors={1:'#C49A3A',2:'#8D9DAA',3:'#B67B52',other:'#86A9C3'};
 function scopeLabel({year=2026,period='all',month='all',department='all'}={}){
  let time='全年整合（1–12 月）';if(month!=='all'){const m=Number(month);time=`${m} 月（第 ${Math.ceil(m/3)} 季）`}else if(/^q[1-4]$/.test(period)){const q=Number(period.slice(1));time=`第 ${q} 季（${(q-1)*3+1}–${q*3} 月）`}
  return `${year} 年｜${time}｜${department==='all'?'全部部門':department}`
 }
 function ranks(rows,{key='average',numerator,denominator}={}){
  const result=new Map(),sorted=[...rows].filter(r=>r[key]!==null&&Number.isFinite(Number(r[key]))&&Number(r[key])>0&&(!denominator||r[denominator]>0)).sort((a,b)=>b[key]-a[key]);let rank=0,last=null;
  sorted.forEach((r,i)=>{const equal=last&&(numerator&&denominator?r[numerator]*last[denominator]===last[numerator]*r[denominator]:r[key]===last[key]);if(!equal)rank=i+1;result.set(r,rank);last=r});return result
 }
 const crownPaths='<path d="M4 8 11 13 16 4 21 13 28 8 25 21H7Z" fill="#F2C85C" stroke="#A3741D" stroke-width="1.3" stroke-linejoin="round"/><path d="M7 21H25V24H7Z" fill="#D6A638" stroke="#A3741D" stroke-width="1.1"/><g fill="#F8D77C" stroke="#A3741D" stroke-width="1"><circle cx="4" cy="6" r="2"/><circle cx="16" cy="3" r="2"/><circle cx="28" cy="6" r="2"/></g><path d="m16 13 2 3-2 3-2-3Z" fill="#FFF3C3"/>';
 function crown({x,y,width=30,height=26}={}){const positioned=x!==undefined?`x="${x}" y="${y}"`:'';return `<svg class="rank-crown" ${positioned} width="${width}" height="${height}" viewBox="0 0 32 26" aria-hidden="true" focusable="false">${crownPaths}</svg>`}
 function legend(){return '<div class="rank-legend" aria-label="排名配色"><span><i style="background:'+colors[1]+'"></i>第一名</span><span><i style="background:'+colors[2]+'"></i>第二名</span><span><i style="background:'+colors[3]+'"></i>第三名</span><small>同分並列</small></div>'}
 globalThis.smallStepPresentation={colors,scopeLabel,ranks,crown,legend};
})();
