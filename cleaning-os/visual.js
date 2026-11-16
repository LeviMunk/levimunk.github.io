(()=>{'use strict';
const E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n)||0);
const imgs=[
'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=82',
'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=80',
'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=900&q=80',
'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=80',
'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=900&q=80'
];
function icon(name,size=20){
const paths={
sparkle:'<path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Z"/><path d="m20 17 .6 1.4L22 19l-1.4.6L20 21l-.6-1.4L18 19l1.4-.6L20 17Z"/>',
calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 14h3M8 18h6"/>',
home:'<path d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
shield:'<path d="M12 2 4 5v6c0 5 3 8 8 11 5-3 8-6 8-11V5Z"/><path d="m8 12 3 3 5-6"/>',
users:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5v1"/>',
chart:'<path d="M3 3v18h18M7 16l4-5 3 2 5-7"/>',
check:'<path d="m5 12 4 4L19 6"/>',
broom:'<path d="m15 3-6 11M8 13l-4 7h11l-3-7Z"/>',
repeat:'<path d="M4 7h13l-3-3M17 7l-3 3M20 17H7l3-3M7 17l3 3"/>',
arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
alert:'<path d="M12 3 2 21h20L12 3Zm0 7v5m0 3h.01"/>',
document:'<path d="M6 2h9l5 5v15H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm9 0v6h5M8 13h8M8 17h8"/>',
heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>'
};
return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[name]||paths.sparkle)+'</svg>';
}
const photo=(index,alt,cls)=>'<div class="'+(cls||'os-photo')+'"><img loading="lazy" src="'+imgs[index%imgs.length]+'" alt="'+E(alt||'Illustrative stock photo of a home interior')+'" onerror="this.hidden=true"><span class="os-photo-caption">Illustrative photo</span></div>';
const services=[
{title:'Standard clean',icon:'broom',duration:'Maintenance visit',description:'Dependable routine cleaning for busy households.',className:'standard'},
{title:'Deep clean',icon:'sparkle',duration:'Detailed service',description:'A more thorough visit for built-up cleaning needs.',className:'deep'},
{title:'Move-out clean',icon:'home',duration:'Turnover service',description:'Help prepare a property for its next occupants.',className:'move'},
{title:'Recurring care',icon:'repeat',duration:'Weekly or biweekly',description:'Consistent visits with a predictable schedule.',className:'recurring'}
];
const stageClass=s=>({Scheduled:'scheduled','En route':'route',Cleaning:'cleaning','Quality check':'quality','Completed':'completed',Skipped:'skipped'}[s]||'scheduled');
function hero(state){
const data=window.CleaningOperations.summary(state);
return '<section class="os-hero"><div class="os-hero-copy"><div class="os-hero-eyebrow">'+icon('sparkle',15)+' THE CALMER WAY TO RUN YOUR BUSINESS</div><h2>Less chasing.<br><em>More shining.</em></h2><p>Appointments, cleaners, quality checks, and the numbers behind every job. All in one beautifully simple workspace.</p><div class="os-hero-actions"><button class="btn" data-action="goto:planner">Explore your schedule '+icon('arrow',15)+'</button><button class="btn alt" data-action="goto:runsheet">Cleaner view</button></div><div class="os-hero-proof">'+icon('shield',16)+' Interactive fictional service business · No live customers</div></div><div class="os-hero-image"><img src="'+imgs[0]+'" alt="Illustrative stock photography of a bright, spotless interior" onerror="this.hidden=true"><span class="os-hero-image-tag">'+icon('check',13)+' A clearer day starts here</span><span class="os-photo-caption">Illustrative interior, not a client home</span><div class="os-floating-metric"><span>'+icon('calendar',17)+' THIS WEEK</span><strong>'+data.billable.length+' visits</strong><small>'+data.completed+' completed · '+data.skipped+' skipped</small></div></div></section>';
}
function homeCards(state){
const info=window.CleaningOperations.summary(state),lists=state.clients.slice(0,8);
return '<div class="os-homes-grid">'+lists.map((c,i)=>{const visits=info.all.filter(v=>v.clientId===c.id&&!v.skipped),next=visits[0],frequency=E(c.frequency||'On demand');return '<article class="os-home-card">'+photo((i%4)+1,'Illustrative example residential property for client card','os-home-photo')+'<div class="os-home-info"><div class="row"><span class="os-kicker">'+icon('home',13)+' HOUSEHOLD PROFILE</span><span class="os-status os-status-completed">'+frequency+'</span></div><h3>'+E(c.name)+'</h3><p>'+E(c.home||'Home details not specified')+'</p><div class="os-home-details"><span>'+icon('broom',15)+' '+E(c.type||'Cleaning service')+'</span><span>'+icon('calendar',15)+' '+(next?E(next.date)+' · '+E(next.time):'No visit this week')+'</span></div><div class="os-home-note">'+icon('heart',15)+' '+E(c.notes||'No special preferences saved')+'</div></div></article>'}).join('')+'</div>';
}
function serviceTiles(){return '<div class="os-services-grid">'+services.map((s,i)=>'<button class="os-service-tile os-service-'+s.className+'" data-os-service="'+E(s.title)+'"><span class="os-service-symbol">'+icon(s.icon,23)+'</span><span class="os-service-count">0'+(i+1)+'</span><strong>'+s.title+'</strong><small>'+s.duration+'</small><p>'+s.description+'</p><span class="os-service-open">Explore estimate '+icon('arrow',15)+'</span></button>').join('')+'</div>'}
function performance(state){
const info=window.CleaningOperations.summary(state),items=info.billable,rate=Number(state.pricing?.rate)||40,spend=items.reduce((sum,j)=>{const hours=j.actualMinutes?j.actualMinutes/60:(Number(j.duration)||Number(j.hours)*60||0)/60;return sum+hours*rate+j.price*.08},0);
return {info,rate,spend,contribution:info.revenue-spend};
}
function report(state){
const {info,rate,spend,contribution}=performance(state);
const summaries=[
['Scheduled visits',info.billable.length,'calendar'],
['Completed visits',info.completed,'check'],
['Quoted service value',money(info.revenue),'chart'],
['Estimated contribution',money(contribution),'sparkle']
];
return '<div class="os-report-intro"><div><div class="eyebrow">OWNER REPORT PREVIEW</div><h1>A beautiful recap, ready for review.</h1><p>This sample summary reflects the selected week in your CleaningOS demo. Print or save a copy for illustration; it contains no real client records.</p></div><button class="btn" data-os-print>'+icon('document',17)+' Print / Save PDF</button></div><article class="os-print-report" id="os-print-report"><div class="os-report-brand"><div><span class="os-logo-mark">'+icon('sparkle',20)+'</span><strong>'+E(state.company)+'</strong></div><span>WEEKLY OPERATIONS BRIEF</span></div><div class="os-report-top"><div><span class="os-kicker">A FRESH PERSPECTIVE ON YOUR WEEK</span><h2>Clean work.<br>Clear results.</h2><p>Prepared from fictional CleaningOS data. No customer messages were sent.</p></div><div class="os-report-thumb"><img src="'+imgs[0]+'" alt="Illustrative bright interior photograph" onerror="this.hidden=true"></div></div><div class="os-report-metrics">'+summaries.map(([label,n,ico])=>'<div><span>'+icon(ico,16)+'</span><strong>'+n+'</strong><small>'+label+'</small></div>').join('')+'</div><div class="os-report-columns"><section><h3>Appointment health</h3><div class="os-report-line"><span>Skipped visits</span><strong>'+info.skipped+'</strong></div><div class="os-report-line"><span>Crew schedule conflicts</span><strong>'+info.overlap.length+'</strong></div><div class="os-report-line"><span>Quality check pending</span><strong>'+info.billable.filter(j=>j.status==='Quality check'&&j.checklist.length<6).length+'</strong></div></section><section><h3>Operating assumptions</h3><p>Labor cost: '+money(rate)+'/hour. Additional modeled direct cost: 8% of quoted value.</p><p>Modeled direct costs: '+money(spend)+'. Estimate excludes travel, overhead, taxes, cancellations fees, and refunds.</p></section></div><section><h3>Selected-week visits</h3><div class="os-report-table"><div class="os-report-tr header"><span>Household</span><span>Service</span><span>Status</span><span>Quoted</span></div>'+info.all.map(j=>'<div class="os-report-tr"><span>'+E(state.clients.find(c=>c.id===j.clientId)?.name||'Client')+'</span><span>'+E(j.service)+'</span><span>'+E(j.status)+'</span><span>'+money(j.skipped?0:j.price)+'</span></div>').join('')+'</div></section><footer>CleaningOS demonstration · All identities, service values, and results are fictional. Photo is illustrative stock imagery and does not depict a customer home.</footer></article>';
}
window.CleaningVisual={icon,photo,stageClass,hero,homeCards,serviceTiles,report,performance};
})();