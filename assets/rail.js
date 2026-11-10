/* Persistent editorial sidebar and section awareness */
(()=>{
  const menu=document.querySelector('[data-rail-menu]'),
        panel=document.getElementById('rail-panel'),
        main=document.getElementById('main'),
        links=[...document.querySelectorAll('[data-rail-link]')],
        progress=document.querySelector('[data-rail-progress]'),
        home=document.body.dataset.page==='home';
  const setMenu=(open)=>{
    if(!menu||!panel)return;
    panel.classList.toggle('is-open',open);
    menu.setAttribute('aria-expanded',String(open));
    menu.innerHTML=open?'Close <span aria-hidden="true">×</span>':'Explore <span aria-hidden="true">☰</span>';
  };
  menu?.addEventListener('click',()=>setMenu(menu.getAttribute('aria-expanded')!=='true'));
  document.addEventListener('keydown',e=>{if(e.key==='Escape')setMenu(false)});
  links.forEach(a=>a.addEventListener('click',()=>setMenu(false)));
  document.addEventListener('click',e=>{
    if(panel?.classList.contains('is-open') && !e.target.closest('.rail-sidebar'))setMenu(false);
  });
  if(!home||!main)return;
  const ids=links.map(a=>a.dataset.railLink),sections=ids.map(id=>document.getElementById(id)).filter(Boolean);
  const setActive=(id)=>{
    links.forEach(link=>{
      if(link.dataset.railLink===id)link.setAttribute('aria-current','location');
      else link.removeAttribute('aria-current');
    });
    const i=ids.indexOf(id);
    if(progress&&i>=0)progress.textContent=String(i+1).padStart(2,'0')+' / '+String(ids.length).padStart(2,'0');
  };
  let observer;
  const connectObserver=()=>{
    observer?.disconnect();
    const root=window.matchMedia('(max-width:900px)').matches?null:main;
    observer=new IntersectionObserver(entries=>{
      const visible=entries.filter(entry=>entry.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio);
      if(visible.length)setActive(visible[0].target.id);
    },{root,rootMargin:'-20% 0px -55% 0px',threshold:[0,.05,.2,.5]});
    sections.forEach(section=>observer.observe(section));
  };
  if('IntersectionObserver'in window){
    connectObserver();
    let lastMobile=window.matchMedia('(max-width:900px)').matches;
    window.addEventListener('resize',()=>{
      const mobile=window.matchMedia('(max-width:900px)').matches;
      if(mobile!==lastMobile){lastMobile=mobile;setMenu(false);connectObserver()}
    });
  }
  setActive('intro');
  if(location.hash){
    const target=document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if(target)requestAnimationFrame(()=>target.scrollIntoView({behavior:'auto',block:'start'}));
  }
})();