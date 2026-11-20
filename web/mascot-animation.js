// Respect the device's reduced-motion preference without changing the layout.
(()=>{
 const preference=matchMedia('(prefers-reduced-motion: reduce)');
 function sync(){for(const image of document.querySelectorAll('img[data-mascot]')){
  const path='/mascots/'+image.dataset.mascot+(preference.matches?'.png':'.gif?v=55');
  if(image.getAttribute('src')!==path)image.src=path;
 }}
 preference.addEventListener('change',sync);
 window.addEventListener('small-step-view-changed',sync);
 sync();
})();
