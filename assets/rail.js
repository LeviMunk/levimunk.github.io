/* Persistent left rail on desktop; compact mobile navigation with reliable focus handling. */
(()=>{
  'use strict';
  const menu=document.querySelector('[data-rail-menu]'),
        panel=document.getElementById('rail-panel'),
        header=document.querySelector('.rail-sidebar'),
        main=document.getElementById('main'),
        links=[...document.querySelectorAll('[data-rail-link]')],
        progress=document.querySelector('[data-rail-progress]'),
        home=document.body.dataset.page==='home',
        mobileQuery=window.matchMedia('(max-width:900px)');
  let opened=false;
  const backdrop=document.createElement('div');
  backdrop.className='rail-menu-backdrop';
  backdrop.setAttribute('aria-hidden','true');
  header?.after(backdrop);
  const isMobile=()=>mobileQuery.matches;
  const setMenu=(open,returnFocus=false)=>{
    if(!menu||!panel)return;
    opened=Boolean(open)&&isMobile();
    panel.classList.toggle('is-open',opened);
    backdrop.classList.toggle('is-visible',opened);
    menu.setAttribute('aria-expanded',String(opened));
    menu.setAttribute('aria-label',opened?'Close navigation menu':'Open navigation menu');
    menu.innerHTML=opened?'Close <span aria-hidden="true">×</span>':'Explore <span aria-hidden="true">☰</span>';
    document.documentElement.classList.toggle('mobile-nav-open',opened);
    if(opened){
      const first=panel.querySelector('a');
      first?.focus({preventScroll:true});
    }else if(returnFocus && isMobile())menu.focus({preventScroll:true});
  };
  menu?.addEventListener('click',()=>setMenu(!opened,!opened));
  backdrop.addEventListener('click',()=>setMenu(false,true));
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&opened){e.preventDefault();setMenu(false,true);return}
    if(e.key!=='Tab'||!opened||!panel||!menu)return;
    const focusables=[menu,...panel.querySelectorAll('a[href],button:not([disabled])')].filter(x=>x.getClientRects().length>0);
    const first=focusables[0],last=focusables[focusables.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}
  });
  header?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{if(opened)setMenu(false)}));
  let wasMobile=isMobile();
  window.addEventListener('resize',()=>{
    const mobile=isMobile();
    if(mobile!==wasMobile){wasMobile=mobile;setMenu(false)}
  });
  if(!home||!main)return;
  const ids=links.map(a=>a.dataset.railLink),
        sections=ids.map(id=>document.getElementById(id)).filter(Boolean);
  const setActive=id=>{
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
    const root=isMobile()?null:main;
    observer=new IntersectionObserver(entries=>{
      const visible=entries.filter(entry=>entry.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio);
      if(visible.length)setActive(visible[0].target.id);
    },{root,rootMargin:'-20% 0px -55% 0px',threshold:[0,.05,.2,.5]});
    sections.forEach(section=>observer.observe(section));
  };
  if('IntersectionObserver'in window){
    connectObserver();
    let mobile=isMobile();
    window.addEventListener('resize',()=>{
      const now=isMobile();
      if(now!==mobile){mobile=now;connectObserver()}
    });
  }
  setActive('intro');
  if(location.hash){
    const target=document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if(target)requestAnimationFrame(()=>target.scrollIntoView({behavior:'auto',block:'start'}));
  }
})();