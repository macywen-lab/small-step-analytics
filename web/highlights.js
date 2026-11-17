const HIGHLIGHT_PAGE_SIZE=4;
let highlights=[],highlightLoaded=false,highlightFailed=false,highlightIndex=0,highlightKey='',highlightElapsed=0,highlightLast=0,highlightPlaying=!window.matchMedia('(prefers-reduced-motion: reduce)').matches,highlightFrame=0,highlightMotion=null;
function highlightRecords(){const query=$('#highlightSearch').value.trim(),source=$('#highlightSource').value;return highlights.filter(r=>Number(r.year||2026)===Number(state.year)&&(state.period==='all'||r.quarter===state.period)&&(state.month==='all'||r.month===+state.month)&&(state.department==='all'||r.department===state.department)&&(source==='all'||r.source===source)&&(!query||[r.name,r.department,r.content,r.sender].some(v=>v.includes(query))))}
function highlightPage(items,index){if(!items.length)return [];const count=Math.min(HIGHLIGHT_PAGE_SIZE,items.length),start=index*HIGHLIGHT_PAGE_SIZE;return Array.from({length:count},(_,i)=>items[(start+i)%items.length])}
function renderHighlights(manual=false){
 if(state.view!=='electronic'){cancelAnimationFrame(highlightFrame);highlightLast=0;window.dispatchEvent(new Event('warmth:pause'));return}
 const items=highlightRecords(),key=items.map(r=>r.id).join('|'),pages=Math.ceil(items.length/HIGHLIGHT_PAGE_SIZE);
 if(key!==highlightKey){highlightKey=key;highlightIndex=0;highlightElapsed=0}
 highlightIndex=pages?((highlightIndex%pages)+pages)%pages:0;
 const shown=highlightPage(items,highlightIndex),grid=$('#highlightCard');grid.hidden=!items.length;$('#highlightEmpty').hidden=items.length>0;
 $('#highlightEmpty').innerHTML=highlightFailed?'<span>✧</span><h3>精選內容暫時無法載入</h3><p>請重新整理網頁，再試一次。</p>':!highlightLoaded?'<span>✧</span><h3>正在準備每一份感謝…</h3><p>稍後即可閱讀同仁的暖心紀錄。</p>':'<span>✧</span><h3>每一份感謝，都值得等待。</h3><p>目前沒有符合的語錄，請調整月份、部門或搜尋內容。</p>';
 if(highlightMotion){highlightMotion.kill();highlightMotion=null}
 grid.innerHTML=shown.map((r,i)=>`<li class="warm-quote-row" data-quote-id="${esc(r.id)}"><span class="warm-quote-index" aria-hidden="true">${String((highlightIndex*HIGHLIGHT_PAGE_SIZE+i)%items.length+1).padStart(2,'0')}</span><div class="warm-quote-person"><h3>${esc(r.name)}</h3><span>${esc(r.department)}</span></div><blockquote>${esc(r.content)}</blockquote><div class="warm-quote-credit"><p class="highlight-sender">來自 <strong>${esc(r.sender||'未署名')}</strong> 的感謝</p><span class="quote-period">${r.year||2026} 年 ${r.month} 月 · ${r.source==='paper'?'便條紙':'電子'}</span></div></li>`).join('');
 grid.setAttribute('aria-label',`第 ${highlightIndex+1} 組，共 ${pages} 組，本組 ${shown.length} 則精選語錄`);
 $('#highlightCounter').innerHTML=`<strong>${String(pages?highlightIndex+1:0).padStart(2,'0')}</strong><span>／ ${String(pages).padStart(2,'0')} 組</span>`;
 $('#highlightSummary').textContent=`共 ${items.length} 則精選 · 本組 ${shown.length} 則`;
 $('#highlightScope').textContent=scopeText();
 $('#highlightPrev').disabled=pages<2;$('#highlightNext').disabled=pages<2;$('#highlightPlay').disabled=pages<2;
 $('#highlightScrubber').max=String(Math.max(1,pages));$('#highlightScrubber').value=String(highlightIndex+1);$('#highlightScrubber').disabled=pages<2;$('#highlightScrubber').setAttribute('aria-valuetext',pages?`第 ${highlightIndex+1} 組，共 ${pages} 組`:'沒有精選語錄');
 updateHighlightPlay();updateHighlightProgress();startHighlightClock();
 if(!manual)$('#highlightAnnouncement').textContent='';
 if(manual)$('#highlightAnnouncement').textContent=`第 ${highlightIndex+1} 組，共 ${pages} 組。${shown.map(r=>r.name).join('、')}。`;
 if(window.gsap&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches)highlightMotion=gsap.fromTo(grid.querySelectorAll('.warm-quote-row'),{autoAlpha:0,y:10},{autoAlpha:1,y:0,duration:.65,stagger:.07,ease:'power3.out',clearProps:'transform,opacity,visibility'});
 window.dispatchEvent(new Event('warmth:resume'));
}
function updateHighlightPlay(){const active=highlightPlaying&&highlightRecords().length>HIGHLIGHT_PAGE_SIZE;$('#highlightPlay').innerHTML=active?'Ⅱ <span>暫停</span>':'▶ <span>播放</span>';$('#highlightPlay').setAttribute('aria-label',active?'暫停輪播':'開始輪播');$('#highlightStatus').textContent=!highlightLoaded?'正在準備暖心精選':!highlightRecords().length?'等待暖心肯定':active?`暖心輪播中 · 每組 ${$('#highlightSpeed').value} 秒 · 四則`:'靜心閱讀 · 每組四則';$('.highlight-intro .live-dot').classList.toggle('is-playing',active)}
function updateHighlightProgress(){const duration=Number($('#highlightSpeed').value)*1000;$('#highlightProgress').style.transform=`scaleX(${Math.min(1,highlightElapsed/duration)})`}
function startHighlightClock(){cancelAnimationFrame(highlightFrame);highlightLast=0;if(state.view!=='electronic'||!highlightPlaying||highlightRecords().length<=HIGHLIGHT_PAGE_SIZE||document.hidden)return;highlightFrame=requestAnimationFrame(highlightTick)}
function highlightTick(now){if(state.view!=='electronic'||!highlightPlaying||document.hidden){highlightLast=0;return}if(highlightLast)highlightElapsed+=Math.min(1000,now-highlightLast);highlightLast=now;const duration=Number($('#highlightSpeed').value)*1000;if(highlightElapsed>=duration){highlightIndex++;highlightElapsed=0;renderHighlights();return}updateHighlightProgress();highlightFrame=requestAnimationFrame(highlightTick)}
function advanceHighlight(delta){highlightIndex+=delta;highlightElapsed=0;renderHighlights(true)}
$('#highlightPrev').onclick=()=>advanceHighlight(-1);$('#highlightNext').onclick=()=>advanceHighlight(1);$('#highlightPlay').onclick=()=>{highlightPlaying=!highlightPlaying;updateHighlightPlay();startHighlightClock()};
$('#highlightSearch').addEventListener('input',()=>renderHighlights(true));$('#highlightSource').addEventListener('change',()=>renderHighlights(true));$('#highlightSpeed').addEventListener('change',()=>{highlightElapsed=0;updateHighlightPlay();updateHighlightProgress();startHighlightClock()});
$('#highlightScrubber').addEventListener('input',e=>{highlightIndex=Number(e.target.value)-1;highlightElapsed=0;renderHighlights(true)});
$('#reset').addEventListener('click',()=>{$('#highlightSearch').value='';$('#highlightSource').value='all';highlightElapsed=0;renderHighlights()});
function syncPresentation(){const active=!!document.fullscreenElement||$('#highlightTheater').classList.contains('is-presenting');$('#highlightFullscreen').innerHTML=active?'⛶ <span>離開展示</span>':'⛶ <span>放大閱讀</span>';$('#highlightFullscreen').setAttribute('aria-label',active?'離開全螢幕展示':'放大閱讀暖心精選');window.dispatchEvent(new Event('warmth:resize'))}
$('#highlightFullscreen').onclick=async()=>{const theater=$('#highlightTheater');if(document.fullscreenElement){await document.exitFullscreen()}else if(theater.classList.contains('is-presenting')){theater.classList.remove('is-presenting');document.body.classList.remove('presentation-open')}else{try{await theater.requestFullscreen()}catch{theater.classList.add('is-presenting');document.body.classList.add('presentation-open')}}syncPresentation()};
$('#highlightLaunch').onclick=()=>$('#highlightFullscreen').click();
document.addEventListener('fullscreenchange',syncPresentation);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#highlightTheater').classList.contains('is-presenting')){$('#highlightTheater').classList.remove('is-presenting');document.body.classList.remove('presentation-open');syncPresentation()}});
document.addEventListener('visibilitychange',()=>{cancelAnimationFrame(highlightFrame);highlightLast=0;if(!document.hidden)startHighlightClock()});
document.addEventListener('keydown',e=>{if(state.view!=='electronic'||(!$('#highlightTheater').contains(e.target)&&!document.fullscreenElement&&!$('#highlightTheater').classList.contains('is-presenting'))||['INPUT','SELECT','TEXTAREA','BUTTON'].includes(e.target.tagName)||e.altKey||e.ctrlKey||e.metaKey)return;if(e.key==='ArrowRight'){e.preventDefault();advanceHighlight(1)}else if(e.key==='ArrowLeft'){e.preventDefault();advanceHighlight(-1)}else if(e.code==='Space'){e.preventDefault();$('#highlightPlay').click()}});
let highlightTouchStart=null;$('#highlightCard').addEventListener('pointerdown',e=>{if(e.pointerType==='touch')highlightTouchStart={x:e.clientX,y:e.clientY}});$('#highlightCard').addEventListener('pointerup',e=>{if(!highlightTouchStart)return;const dx=e.clientX-highlightTouchStart.x,dy=e.clientY-highlightTouchStart.y;if(Math.abs(dx)>80&&Math.abs(dx)>Math.abs(dy)*1.5)advanceHighlight(dx<0?1:-1);highlightTouchStart=null});$('#highlightCard').addEventListener('pointercancel',()=>highlightTouchStart=null);
window.smallStepDatasetPromise.then(payload=>payload.stories).then(r=>{highlights=r;highlightLoaded=true;renderHighlights()}).catch(()=>{highlightLoaded=true;highlightFailed=true;renderHighlights()});

