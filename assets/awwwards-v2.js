/* Awwwards-inspired visual enhancement: no external animation dependency. */
(()=>{
  'use strict';
  if(!document.body.classList.contains('awwwards-v2'))return;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const fine=window.matchMedia('(hover:hover) and (pointer:fine)');
  const hero=document.querySelector('.v2-hero-grid');
  const glow=document.querySelector('.v2-hero-glow');
  const portrait=document.querySelector('.v2-portrait');
  const cards=[...document.querySelectorAll('.v2-feature')];

  const candidates=[
    ...document.querySelectorAll('.v2-feature'),
    ...document.querySelectorAll('.rail-principles article'),
    ...document.querySelectorAll('.rail-timeline-item'),
    ...document.querySelectorAll('.about-photo-frame')
  ];
  const revealNodes=candidates.filter(node=>node instanceof HTMLElement);
  let revealObserver=null;
  if(!reduced.matches&&'IntersectionObserver' in window){
    for(const node of revealNodes)node.setAttribute('data-v2-reveal','');
    revealObserver=new IntersectionObserver(entries=>{
      for(const entry of entries){
        if(!entry.isIntersecting)continue;
        entry.target.classList.add('v2-visible');
        revealObserver.unobserve(entry.target);
      }
    },{root:null,rootMargin:'0px 0px 90px 0px',threshold:0.08});
    for(const node of revealNodes)revealObserver.observe(node);
    document.body.classList.add('v2-ready');
    // Restore visibility if the document is resumed from background or the browser is busy.
    document.addEventListener('visibilitychange',()=>{
      if(document.visibilityState==='visible') {
        for(const node of revealNodes){
          if(!node.classList.contains('v2-visible')&&node.getBoundingClientRect().top<window.innerHeight)
            node.classList.add('v2-visible');
        }
      }
    },{passive:true});
  }else if(!reduced.matches){
    document.body.classList.add('v2-ready');
  }

  if(reduced.matches||!fine.matches)return;
  const mq=(element,name,value)=>element?.style.setProperty(name,value);
  if(hero&&glow&&portrait){
    let frame=0,clientX=0,clientY=0;
    hero.addEventListener('pointermove',e=>{
      if(e.pointerType!=='mouse'&&e.pointerType!=='pen')return;
      clientX=e.clientX;clientY=e.clientY;
      if(frame)return;
      frame=requestAnimationFrame(()=>{
        frame=0;
        const rect=hero.getBoundingClientRect();
        const nx=Math.max(-1,Math.min(1,((clientX-rect.left)/rect.width-.5)*2));
        const ny=Math.max(-1,Math.min(1,((clientY-rect.top)/rect.height-.5)*2));
        mq(portrait,'--v2-portrait-x',(nx*9).toFixed(1)+'px');
        mq(portrait,'--v2-portrait-y',(ny*7).toFixed(1)+'px');
        mq(glow,'--v2-glow-x',(nx*25).toFixed(1)+'px');
        mq(glow,'--v2-glow-y',(ny*20).toFixed(1)+'px');
      });
    },{passive:true});
    hero.addEventListener('pointerleave',()=>{
      if(frame){cancelAnimationFrame(frame);frame=0}
      for(const prop of ['--v2-portrait-x','--v2-portrait-y'])portrait.style.removeProperty(prop);
      for(const prop of ['--v2-glow-x','--v2-glow-y'])glow.style.removeProperty(prop);
    });
  }
  for(const card of cards){
    let frame=0,x=50,y=50;
    card.addEventListener('pointermove',e=>{
      if(e.pointerType!=='mouse'&&e.pointerType!=='pen')return;
      const rect=card.getBoundingClientRect();
      x=(e.clientX-rect.left)/rect.width*100;
      y=(e.clientY-rect.top)/rect.height*100;
      if(frame)return;
      frame=requestAnimationFrame(()=>{
        frame=0;
        card.style.setProperty('--v2-mx',Math.max(0,Math.min(100,x)).toFixed(1)+'%');
        card.style.setProperty('--v2-my',Math.max(0,Math.min(100,y)).toFixed(1)+'%');
      });
    },{passive:true});
    card.addEventListener('pointerleave',()=>{
      if(frame){cancelAnimationFrame(frame);frame=0}
      card.style.removeProperty('--v2-mx');card.style.removeProperty('--v2-my');
    });
  }
})();
