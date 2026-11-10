/* Allow visitors to explore a field without navigating away, and preserve old category links. */
(()=>{'use strict';
  const groups=[...document.querySelectorAll('[data-focus-group]')];if(!groups.length)return;
  const names={content:'marketing',analytics:'marketing',marketing:'marketing',business:'business',operations:'business',systems:'systems',automation:'systems'};
  const q=new URLSearchParams(window.location.search).get('category');
  const chosen=location.hash.startsWith('#focus-')?location.hash.slice(7):(names[q]||'');
  const el=groups.find(g=>g.dataset.focusGroup===chosen);
  if(el){el.open=true;requestAnimationFrame(()=>el.scrollIntoView({behavior:'auto',block:'start'}))}
})();