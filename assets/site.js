
(()=>{const menu=document.querySelector('.menu'),nav=document.querySelector('.nav');
if(menu&&nav){const close=()=>{nav.classList.remove('open');menu.setAttribute('aria-expanded','false')};menu.addEventListener('click',()=>{const open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(open))});nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',close));document.addEventListener('keydown',e=>{if(e.key==='Escape')close()})}
document.querySelectorAll('[data-year]').forEach(e=>e.textContent=String(new Date().getFullYear()));
const filters=[...document.querySelectorAll('[data-filter]')],cards=[...document.querySelectorAll('[data-category]')],count=document.querySelector('[data-count]'),heading=document.querySelector('[data-category-heading]');
const categories=new Set(filters.map(b=>b.dataset.filter));
const selectCategory=(value,updateAddress=false)=>{
  if(!categories.has(value))value='all';
  filters.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===value)));
  let visible=0;
  cards.forEach(card=>{const match=value==='all'||card.dataset.category===value;card.hidden=!match;if(match)visible++});
  if(count)count.textContent=visible+' project'+(visible===1?'':'s')+' shown';
  if(heading)heading.textContent=filters.find(b=>b.dataset.filter===value)?.dataset.label||'All selected work';
  if(updateAddress){const url=new URL(window.location.href);if(value==='all')url.searchParams.delete('category');else url.searchParams.set('category',value);window.history.replaceState(null,'',url.pathname+url.search+url.hash);}
};
if(filters.length){
  const selected=new URLSearchParams(window.location.search).get('category')||'all';
  selectCategory(selected,false);
  filters.forEach(b=>b.addEventListener('click',()=>{selectCategory(b.dataset.filter,true);document.getElementById('portfolio-results')?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}));
}
document.querySelectorAll('[data-print]').forEach(x=>x.addEventListener('click',()=>window.print()));
if('IntersectionObserver'in window&&!matchMedia('(prefers-reduced-motion: reduce)').matches){const items=[...document.querySelectorAll('.reveal')];const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('show');io.unobserve(e.target)}}),{threshold:.05,rootMargin:'0px 0px 70px 0px'});items.forEach(e=>io.observe(e));document.documentElement.classList.add('js')}})();
