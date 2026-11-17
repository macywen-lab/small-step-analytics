(()=>{
 const overviewFilters=document.querySelector('.content>.filters');
 if(overviewFilters){const measure=()=>document.documentElement.style.setProperty('--overview-filters-height',Math.ceil(overviewFilters.getBoundingClientRect().height)+'px');new ResizeObserver(measure).observe(overviewFilters);measure()}
 const reader=document.getElementById('electronicReader'),readerFilters=reader?.querySelector('.en-filters');
 const syncReaderFilters=()=>{const reading=matchMedia('(max-width:900px)').matches&&document.body.classList.contains('electronic-view')&&readerFilters&&readerFilters.getBoundingClientRect().top<=1&&reader.getBoundingClientRect().bottom>0;if(document.body.classList.contains('reading-all-notes')!==!!reading)document.body.classList.toggle('reading-all-notes',!!reading)};
 window.addEventListener('scroll',syncReaderFilters,{passive:true});window.addEventListener('resize',syncReaderFilters);new MutationObserver(syncReaderFilters).observe(document.body,{attributes:true,attributeFilter:['class']});syncReaderFilters();
 const toggle=document.getElementById('mobileNavToggle'),sidebar=document.querySelector('.sidebar');if(!toggle||!sidebar)return;
 const close=()=>{sidebar.classList.remove('is-menu-open');toggle.setAttribute('aria-expanded','false');toggle.querySelector('span').textContent='☰'};
 toggle.addEventListener('click',()=>{const open=sidebar.classList.toggle('is-menu-open');toggle.setAttribute('aria-expanded',String(open));toggle.querySelector('span').textContent=open?'×':'☰'});
 sidebar.querySelector('nav').addEventListener('click',e=>{if(e.target.closest('[data-view]'))close()});sidebar.querySelector('.brand').addEventListener('click',close);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&sidebar.classList.contains('is-menu-open')){close();toggle.focus()}});
 window.matchMedia('(min-width:901px)').addEventListener('change',e=>{if(e.matches)close()});
})();
