(()=>{const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function content(value){const text=String(value||'');if([...text].length<=160)return `<p class="en-content ${text?'':'en-empty-content'}">${text?safe(text):'這張便利貼未填寫事件說明，仍保留原始紀錄。'}</p>`;return `<p class="en-content desktop-full-copy">${safe(text)}</p><details class="mobile-full-copy note-full"><summary><p class="en-content">${safe([...text].slice(0,140).join(''))}…</p><span>展開完整便利貼</span></summary><p class="en-content">${safe(text)}</p></details>`}
window.smallStepNoteCard=(n,number,withStatus=false)=>`<li class="en-entry"><div class="en-entry-heading"><div><span class="en-sequence">${String(number).padStart(2,'0')}</span><strong>To ${safe(n.name)}</strong><span class="en-department">${safe(n.department)||'未填部門'}</span></div><time>${safe(n.date)||n.month+' 月'}</time></div>${content(n.content)}<div class="en-entry-footer"><span>來自 <b>${safe(n.sender)||'未署名'}</b> 的感謝</span>${n.beneficiary?`<span>被幫忙的人：${safe(n.beneficiary)}</span>`:''}${withStatus?`<span class="note-status ${n.review==='X'?'rejected':n.review==='V'?'':'pending'}">${n.review==='V'?'已通過':n.review==='X'?'未通過':'審核中'}</span>`:''}</div></li>`;
window.smallStepSeasonNote=(r,number)=>{
  const quarter=/^q[1-4]$/.test(r.quarter)?r.quarter:'q'+Math.ceil(Number(r.month)/3);
  const date=String(r.date||'').match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:$|\D)/);
  const dateLabel=date?date[1]+'/'+date[2].padStart(2,'0')+'/'+date[3].padStart(2,'0'):String(r.year||2026)+' 年 '+r.month+' 月';
  return `<li class="season-note ${/^q[1-4]$/.test(quarter)?quarter:'q1'}" data-quote-id="${safe(r.id)}">
   <div class="season-copy" tabindex="0">
    <div class="season-heading"><div><small>${String(number).padStart(2,'0')}</small> <strong>To ${safe(r.name)}</strong> <small>${safe(r.department||'未填部門')}</small></div><time>${safe(r.source==='paper'&&r.period?String(r.year||2026)+' 年 '+r.period:dateLabel)}</time></div>
    <blockquote>${safe(r.content||"這張便利貼未填寫事件說明，仍保留原始紀錄。")}</blockquote>
    ${String(r.beneficiary??"").trim()?`<div class="season-beneficiary">被幫忙的人：<strong>${safe(r.beneficiary)}</strong></div>`:""}
    <div class="season-credit">來自 <strong>${safe(r.sender||'未署名')}</strong> 的感謝 · ${r.source==='paper'?'紙本':'電子'}</div>
   </div></li>`;

};
})();

// Limit the two public reading sections without changing their source dataset.
window.latestDisplayNote = function(records) {
  function dateKey(note) {
    const parts = String(note.date || '').match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
    if (parts) return Number(parts[1])*10000 + Number(parts[2])*100 + Number(parts[3]);
    const day = String(note.period || '').match(/\d+\/(\d+)$/);
    return Number(note.year || 2026)*10000 + Number(note.month || 0)*100 + Number(day?.[1] || 0);
  }
  return [...records].filter(note => String(note.content || '').trim())
    .sort((a,b) => dateKey(b)-dateKey(a) || (Date.parse(b.createdAt)||0)-(Date.parse(a.createdAt)||0)
      || Number(b.row || 0)-Number(a.row || 0)).slice(0,1);
};
