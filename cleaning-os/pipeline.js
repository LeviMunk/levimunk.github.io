(()=>{'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stages=[['new','New lead'],['warm','Interested'],['hot','Ready to book'],['first','First clean'],['repeat','Returning'],['plan','Recurring plan']];
const sample=[
['Avery Morgan','new',4,true,false],['Jordan Rivera','warm',12,true,false],['Taylor Brooks','hot',3,true,false],
['Casey Reed','first',38,true,false],['Morgan Ellis','first',125,true,false],['Riley Chen','repeat',20,true,false],
['Jamie Stone','plan',9,true,false],['Drew Hart','warm',22,true,true],['Skylar Quinn','new',5,false,false]];
function seed(){return {people:sample.map((x,i)=>({id:i+1,name:x[0],stage:x[1],days:x[2],consent:x[3],optOut:x[4],events:['Sample record created']})),selected:4}}
const checkpointFields=[['onboard','Onboarding'],['service','Service quality'],['feedback','Customer feedback'],['recovery','Service recovery']];
function ensure(s){if(!s.pipelineDemo||!Array.isArray(s.pipelineDemo.people))s.pipelineDemo=seed();for(const p of s.pipelineDemo.people){if(!p.checkpoints){p.checkpoints=['new','warm','hot'].includes(p.stage)?{onboard:'pending',service:'pending',feedback:'pending',recovery:'pending'}:{onboard:'good',service:'good',feedback:'pending',recovery:'pending'};if(p.id===4)p.checkpoints.feedback='issue';}if(!Array.isArray(p.events))p.events=[]}return s.pipelineDemo}
function health(p){if(Object.values(p.checkpoints).includes('issue'))return ['Needs attention','risk'];if(p.days>=90&&['first','repeat'].includes(p.stage))return ['Needs re-engagement','watch'];if(Object.values(p.checkpoints).includes('resolved'))return ['Recovering','recovery'];return ['On track','healthy']}
function nextAction(p){const c=p.checkpoints;if(c.onboard==='issue')return 'Clarify expectations and repair onboarding';if(c.service==='issue')return 'Investigate service quality and contact the customer';if(c.feedback==='issue')return 'Address negative feedback before promotional outreach';if(c.recovery==='issue')return 'Escalate unresolved service recovery';if(p.optOut)return 'Respect unsubscribe and pause marketing';if(!p.consent)return 'Confirm marketing permission before outreach';if(p.days>=90&&['first','repeat'].includes(p.stage))return 'Review an appropriate reactivation opportunity';if(p.stage==='first')return 'Check satisfaction and discuss another clean';if(p.stage==='repeat')return 'Explore a recurring plan if it fits';if(p.stage==='plan')return 'Maintain high service quality';return 'Help the lead take the next step'}
function checkpoint(s,id,key,status){const p=ensure(s).people.find(x=>x.id===Number(id));if(!p||!checkpointFields.some(x=>x[0]===key)||!['pending','good','issue','resolved'].includes(status))return false;p.checkpoints[key]=status;p.events.unshift('Checkpoint '+key+' updated: '+status);p.events=p.events.slice(0,8);return true}
function checkpointView(p){const h=health(p),idx=stages.findIndex(x=>x[0]===p.stage);return '<section class="pj-relationship"><div><span>RELATIONSHIP PROGRESS</span><h2>'+esc(p.name)+'</h2><p>'+esc(stages[idx][1])+'</p></div><strong class="pj-health-large '+h[1]+'">'+h[0]+'</strong></section>'+'<div class="pj-progress">'+stages.map((x,i)=>'<span class="'+(i<=idx?'complete':'')+'" title="'+esc(x[1])+'"></span>').join('')+'</div><div class="pj-progress-label"><small>First inquiry</small><strong>Long-term customer</strong></div>'+'<section class="pj-checkpoints"><div><span>RELATIONSHIP CHECKPOINTS</span><h2>Is the journey going well?</h2><p>Track concerns and recovery without moving customers backward.</p></div><div class="pj-checkpoint-grid">'+checkpointFields.map(([id,name])=>'<label class="pj-checkpoint '+p.checkpoints[id]+'"><strong>'+name+'</strong><select data-pj-checkpoint="'+p.id+'" data-checkpoint-key="'+id+'">'+[['pending','Not assessed'],['good','On track'],['issue','Issue flagged'],['resolved','Resolved']].map(([v,label])=>'<option value="'+v+'" '+(p.checkpoints[id]===v?'selected':'')+'>'+label+'</option>').join('')+'</select></label>').join('')+'</div></section>'+'<section class="pj-next-action"><span>NEXT RECOMMENDED ACTION</span><h3>'+esc(nextAction(p))+'</h3><p>Suggested owner action only. No messages are sent.</p></section>'}

function route(p){
if(p.optOut)return ['Do not email','Unsubscribed: suppress all marketing email','blocked'];
if(!p.consent)return ['Consent required','No permission to send marketing emails','blocked'];
if(Object.values(p.checkpoints||{}).includes('issue'))return ['Owner review','Unresolved customer issue: pause promotional campaigns for review','blocked'];
if(p.stage==='plan')return ['Active plan','Keep existing plan; no win-back campaign','service'];
if(['first','repeat'].includes(p.stage)&&p.days>=90)return ['Win-back sequence','Inactive past customer: eligible for reviewed reactivation drafts','recover'];
if(p.stage==='first')return ['Recurring plan invitation','First paid clean completed: introduce ongoing care','retain'];
if(p.stage==='repeat')return ['Retention program','Returning customer: maintain the relationship','retain'];
if(p.stage==='hot')return ['Quote follow-up','Interested prospect: help finish their booking','sales'];
if(p.stage==='warm')return ['Lead nurture','Engaged prospect: provide relevant service information','sales'];
return ['Welcome sequence','New eligible lead: introduce services','sales']}
function select(s,id){const p=ensure(s).people.find(x=>x.id===Number(id));if(p)ensure(s).selected=p.id}
function update(s,id,field,value){const p=ensure(s).people.find(x=>x.id===Number(id));if(!p)return;
if(field==='stage'&&stages.some(x=>x[0]===value)){p.stage=value;p.days=0}
else if(field==='days')p.days=Math.max(0,Math.min(999,Number(value)||0));
else if(field==='consent'||field==='optOut')p[field]=Boolean(value);
else return;
p.events.unshift('Changed '+field+' · '+route(p)[0]);p.events=p.events.slice(0,6)}
function reset(s){s.pipelineDemo=seed()}
const transitionKpis=[
{from:'new',to:'warm',label:'Lead engagement',metric:'Lead response rate',detail:'Responding leads / contacted eligible leads'},
{from:'warm',to:'hot',label:'Sales readiness',metric:'Qualified lead rate',detail:'Qualified leads / engaged leads'},
{from:'hot',to:'first',label:'First conversion',metric:'Paid first-clean conversion',detail:'First paid cleans / qualified opportunities'},
{from:'first',to:'repeat',label:'Customer retention',metric:'Repeat customer rate',detail:'Customers with second paid visit / eligible first-time customers'},
{from:'repeat',to:'plan',label:'Recurring relationships',metric:'Recurring plan adoption',detail:'Active plan customers / eligible returning customers'}
];
function kpiView(people){
const index=id=>stages.findIndex(s=>s[0]===id);
return '<section class="pj-funnel"><div class="pj-funnel-heading"><div><span>TRANSITION HEALTH · SAMPLE SNAPSHOT</span><h2>Measure every step, not just the finish line.</h2><p>Each transition has a core business KPI. Counts below show how many fictional records have reached each stage or beyond; they are not historical conversion rates.</p></div><span class="pj-funnel-note">Demo cohort · '+people.length+' records</span></div><div class="pj-funnel-grid">'+transitionKpis.map((k,i)=>{const reached=people.filter(p=>index(p.stage)>=index(k.to)).length;const preceding=people.filter(p=>index(p.stage)>=index(k.from)).length;return '<article class="pj-funnel-card"><div class="pj-funnel-track"><span style="width:'+((i+1)/transitionKpis.length*100)+'%"></span></div><small>TRANSITION 0'+(i+1)+'</small><h3>'+k.label+'</h3><div class="pj-funnel-value"><strong>'+reached+' <span>/ '+preceding+'</span></strong><span>sample records reached next stage</span></div><p><b>Production KPI:</b> '+k.metric+'</p><small>'+k.detail+'</small></article>'}).join('')+'</div><div class="pj-quality-bar"><div><strong>Onboarding quality</strong><span>Confirmed expectations before first service</span></div><div><strong>Service reliability</strong><span>Completed and quality-approved visits</span></div><div><strong>Customer feedback</strong><span>Ratings, concerns and review response</span></div><div><strong>Recovery effectiveness</strong><span>Resolved issues / opened service issues</span></div></div></section>';
}

function operationalSignals(s){
const records=window.CleaningAftercare?.ensure(s)?.records||[];
const clients=Array.isArray(s.clients)?s.clients:[];
const byCustomer=new Map();
for(const r of records){
const key=String(r.clientId||'');
if(!key)continue;
if(!byCustomer.has(key))byCustomer.set(key,[]);
byCustomer.get(key).push(r);
}
const rows=[];
for(const [key,visits] of byCustomer){
const customer=clients.find(c=>String(c.id)===key);
if(!customer)continue;
const sorted=[...visits].sort((a,b)=>String(b.completedDate||'').localeCompare(String(a.completedDate||'')));
const latest=sorted[0];
const poor=sorted.find(r=>Number(r.feedbackRating)>=1&&Number(r.feedbackRating)<=3);
const feedback=latest.feedbackRating!=null?'Feedback: '+latest.feedbackRating+'/5':'Feedback pending';
const signals=[];
if(poor)signals.push('Service concern');
else if(!latest.contactedAt)signals.push('Post-clean check-in due');
if(latest.recurringInterest==='Interested')signals.push('Recurring interest');
const action=poor?'Review the customer concern':!latest.contactedAt?'Review post-clean follow-up':latest.recurringInterest==='Interested'?'Discuss scheduling the next clean':'Monitor satisfaction and repeat interest';
rows.push({name:customer.name,visits:visits.length,feedback,action,signals});
}
rows.sort((a,b)=>Number(b.signals.includes('Service concern'))-Number(a.signals.includes('Service concern'))||Number(b.signals.length>0)-Number(a.signals.length>0)||a.name.localeCompare(b.name));
return {rows,completed:records.length,attention:rows.filter(x=>x.signals.includes('Service concern')).length,followups:rows.filter(x=>x.signals.includes('Post-clean check-in due')).length};
}
function operationalView(s){
const v=operationalSignals(s);
return '<section class="pj-connected"><div class="pj-connected-heading"><div><span>CONNECTED WORKSPACE SIGNALS</span><h2>Actual actions should move the journey.</h2><p>Read-only signals from the demo service completion and aftercare records. These are separate from the fictional pipeline personas above.</p></div><button type="button" data-page="deliver">Open service operations ↗</button></div>'
+'<div class="pj-connected-stats"><div><strong>'+v.completed+'</strong><span>Completed-service records</span></div><div><strong>'+v.followups+'</strong><span>Customers awaiting check-in</span></div><div><strong>'+v.attention+'</strong><span>Customer concerns identified</span></div></div>'
+(v.rows.length?'<div class="pj-connected-list">'+v.rows.slice(0,8).map(x=>'<article><div><strong>'+esc(x.name)+'</strong><span>'+x.visits+' completed service record'+(x.visits===1?'':'s')+' · '+esc(x.feedback)+'</span></div><div><span class="pj-connected-signal '+(x.signals.includes('Service concern')?'issue':'')+'">'+esc(x.signals[0]||'Monitoring')+'</span><small>'+esc(x.action)+'</small></div></article>').join('')+'</div>':'<p class="pj-connected-empty">No completed services recorded yet. Complete a fictional visit with its quality checklist to populate this view.</p>')
+'<p class="pj-connected-note">Completion is not proof of payment or repeat purchase. No customer is automatically promoted to a paid lifecycle stage from a scheduled or completed visit alone. No emails are sent.</p></section>';
}
function view(s){
const d=ensure(s),p=d.people.find(x=>x.id===d.selected)||d.people[0],r=route(p),h=health(p);
const healthIssues=d.people.filter(x=>health(x)[1]==='risk').length;
const pending=d.people.filter(x=>route(x)[2]==='recover').length;
const loyal=d.people.filter(x=>['repeat','plan'].includes(x.stage)).length;
const groups=stages.map(([id,label],i)=>'<section class="pj-simple-stage"><header><span class="pj-stage-track" style="--pj-step:'+i+'"></span><strong>'+esc(label)+'</strong><small>'+d.people.filter(x=>x.stage===id).length+' people</small></header><div class="pj-simple-people">'+d.people.filter(x=>x.stage===id).map(x=>'<button type="button" data-pj-select="'+x.id+'" class="pj-simple-person '+(p.id===x.id?'active':'')+'"><span class="pj-simple-avatar">'+esc(x.name.split(' ').map(n=>n[0]).join(''))+'</span><span><strong>'+esc(x.name)+'</strong><small>'+esc(health(x)[0])+'</small></span><i class="'+health(x)[1]+'"></i></button>').join('')+'</div></section>').join('');
const directoryMode=d.directoryMode==='directory'?'directory':'board';
const sorted=[...d.people].sort((a,b)=>a.name.localeCompare(b.name,'en',{sensitivity:'base'}));
const directory='<section class="pj-directory" aria-label="Alphabetical customer directory"><div class="pj-directory-search"><label for="pj-directory-query">Find a customer</label><input id="pj-directory-query" data-pj-directory-search type="search" placeholder="Search customer names..." autocomplete="off" aria-controls="pj-directory-list"><span>'+sorted.length+' customers · A–Z</span></div><div id="pj-directory-list" class="pj-directory-list">'+sorted.map(person=>'<button type="button" data-pj-select="'+person.id+'" class="pj-directory-row" data-pj-directory-name="'+esc(person.name.toLocaleLowerCase())+'"><span class="pj-directory-initial">'+esc(person.name.trim().charAt(0).toUpperCase())+'</span><span class="pj-directory-identity"><strong>'+esc(person.name)+'</strong><small>'+esc(stages.find(x=>x[0]===person.stage)?.[1]||'Customer')+'</small></span><span class="pj-directory-status '+health(person)[1]+'">'+esc(health(person)[0])+'</span><span class="pj-directory-open">View profile →</span></button>').join('')+'</div><p class="pj-directory-empty" data-pj-directory-empty hidden>No matching customers found.</p></section>';
const checks=checkpointFields.filter(([id])=>p.checkpoints[id]==='issue').map(([id,label])=>'<span class="pj-simple-issue">'+esc(label)+' needs review</span>').join('');
return '<div class="pj-root pj-simple"><section class="pj-simple-hero"><div><span class="pj-simple-eyebrow">CUSTOMER JOURNEY · DEMO</span><h1>Know every customer. Know what comes next.</h1><p>One clear view of your customers, their progress, and where you can help.</p></div><button type="button" data-page="modules">Customize workspace ↗</button></section>'
+'<div class="pj-simple-overview"><div><strong>'+d.people.length+'</strong><span>People in your journey</span></div><div><strong>'+healthIssues+'</strong><span>Need attention</span></div><div><strong>'+pending+'</strong><span>Ready for re-engagement</span></div><div><strong>'+loyal+'</strong><span>Returning and recurring</span></div></div>'
+'<section class="pj-simple-board-wrap"><div class="pj-simple-head"><div><h2>Customers</h2><p>Follow their journey or find someone by name.</p></div><span>One click opens their profile</span></div><div class="pj-directory-tabs" role="group" aria-label="Customer list layout"><button type="button" data-pj-directory-mode="board" class="'+(directoryMode==='board'?'active':'')+'" aria-pressed="'+(directoryMode==='board')+'">Journey board</button><button type="button" data-pj-directory-mode="directory" class="'+(directoryMode==='directory'?'active':'')+'" aria-pressed="'+(directoryMode==='directory')+'">A–Z Directory</button></div>'+(directoryMode==='directory'?directory:'<div class="pj-simple-board">'+groups+'</div>')+'</section>'
+'<section class="pj-simple-detail"><div class="pj-simple-profile"><div><span class="pj-simple-eyebrow">SELECTED CUSTOMER</span><h2>'+esc(p.name)+'</h2><p>'+esc(stages.find(x=>x[0]===p.stage)[1])+' · '+p.days+' days since activity</p></div><span class="pj-simple-health '+h[1]+'">'+esc(h[0])+'</span></div><div class="pj-simple-progress">'+stages.map((x,i)=>'<span title="'+esc(x[1])+'" class="'+(i<=stages.findIndex(y=>y[0]===p.stage)?'reached':'')+'"></span>').join('')+'</div><div class="pj-simple-goal"><span>First inquiry</span><strong>Long-term relationship</strong></div><div class="pj-simple-action"><div><span>NEXT BEST STEP</span><h3>'+esc(nextAction(p))+'</h3>'+(checks?'<div class="pj-simple-issues">'+checks+'</div>':'')+'</div><button type="button" data-page="convert">Customer tools ↗</button></div><div class="pj-simple-inline"><label>Customer progress<select data-pj-stage="'+p.id+'">'+stages.map(([id,label])=>'<option value="'+id+'" '+(p.stage===id?'selected':'')+'>'+esc(label)+'</option>').join('')+'</select></label><span>Suggested campaign: <strong>'+esc(r[0])+'</strong></span></div></section>'
+'<details class="pj-simple-more"><summary><span><strong>More customer details</strong><small>Feedback, history, permissions and follow-up rules</small></span><span>Show details ⌄</span></summary>'+checkpointView(p)+'<div class="pj-details"><section class="pj-panel"><h2>Customer details</h2><label>Days since activity<input data-pj-days="'+p.id+'" type="number" min="0" max="999" value="'+p.days+'"></label><label><input data-pj-consent="'+p.id+'" type="checkbox" '+(p.consent?'checked':'')+'> Marketing consent</label><label><input data-pj-optout="'+p.id+'" type="checkbox" '+(p.optOut?'checked':'')+'> Unsubscribed / do not email</label><h3>Customer history</h3>'+p.events.map(x=>'<p class="pj-event">'+esc(x)+'</p>').join('')+'</section><section class="pj-panel"><h2>Follow-up recommendation</h2><div class="pj-assignment '+r[2]+'"><h3>'+esc(r[0])+'</h3><p>'+esc(r[1])+'</p></div><p>Suggestions only. No email is sent by the demo.</p></section></div></details>'
+'<details class="pj-simple-more"><summary><span><strong>Reports & settings</strong><small>Lifecycle KPIs, optional modules, and operational signals</small></span><span>Show settings ⌄</span></summary>'+window.CleaningCustomerFlow.view(s,p)+kpiView(d.people)+operationalView(s)+'<button type="button" class="pj-simple-reset" data-pj-reset>Restore fictional customer examples</button></details>'
+'<p class="pj-simple-disclaimer">Fictional demonstration. Changes stay in this browser. No real campaigns, bookings or social accounts are connected.</p></div>';
}
function directoryMode(s,mode){if(!['board','directory'].includes(mode))return false;ensure(s).directoryMode=mode;return true}
window.CleaningPipeline={ensure,view,select,update,reset,checkpoint,directoryMode};
})();