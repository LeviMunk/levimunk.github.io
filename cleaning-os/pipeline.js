(()=>{'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stages=[['new','New lead'],['warm','Interested'],['hot','Ready to book'],['first','First clean'],['repeat','Returning'],['plan','Recurring plan']];
const sample=[
['Avery Morgan','new',4,true,false],['Jordan Rivera','warm',12,true,false],['Taylor Brooks','hot',3,true,false],
['Casey Reed','first',38,true,false],['Morgan Ellis','first',125,true,false],['Riley Chen','repeat',20,true,false],
['Jamie Stone','plan',9,true,false],['Drew Hart','warm',22,true,true],['Skylar Quinn','new',5,false,false]];
function seed(){return {people:sample.map((x,i)=>({id:i+1,name:x[0],stage:x[1],days:x[2],consent:x[3],optOut:x[4],events:['Sample record created']})),selected:4}}
function ensure(s){if(!s.pipelineDemo||!Array.isArray(s.pipelineDemo.people))s.pipelineDemo=seed();return s.pipelineDemo}
function route(p){
if(p.optOut)return ['Do not email','Unsubscribed: suppress all marketing email','blocked'];
if(!p.consent)return ['Consent required','No permission to send marketing emails','blocked'];
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
function view(s){
const d=ensure(s),p=d.people.find(x=>x.id===d.selected)||d.people[0],r=route(p),suppressed=d.people.filter(x=>route(x)[2]==='blocked').length;
const board=stages.map(([id,label],i)=>'<section class="pj-column"><header><span>0'+(i+1)+' / '+(i<3?'LEADS':'CUSTOMERS')+'</span><h3>'+label+'</h3><small>'+d.people.filter(x=>x.stage===id).length+' sample records</small></header>'+d.people.filter(x=>x.stage===id).map(person=>{const flow=route(person);return '<button class="pj-person '+(p.id===person.id?'active':'')+'" data-pj-select="'+person.id+'"><strong>'+esc(person.name)+'</strong><small>'+person.days+' days since activity</small><span class="pj-route '+flow[2]+'">'+esc(flow[0])+'</span></button>'}).join('')+'</section>').join('');
return '<div class="pj-root"><section class="pj-hero"><span>INTERACTIVE CUSTOMER LIFECYCLE DEMO</span><h1>From first inquiry to <em>lifelong customer.</em></h1><p>See customers progress from cold to warm to booked, then toward their next clean. Campaign assignments change as their status, activity and email permissions change.</p><div><button data-pj-reset>↺ Restart example</button><button data-page="modules">Explore modular tools ↗</button></div><small>Fictional, browser-local simulation. No messages are sent and no provider is connected.</small></section><div class="pj-stats"><div><small>Customers and leads</small><strong>'+d.people.length+'</strong></div><div><small>Suppressed from marketing</small><strong>'+suppressed+'</strong></div><div><small>Repeat or recurring</small><strong>'+d.people.filter(x=>['repeat','plan'].includes(x.stage)).length+'</strong></div></div><section class="pj-board-heading"><span>01 / CUSTOMER PROGRESSION</span><h2>Every customer has a next step.</h2><p>Select a person to see their history and the follow-up they qualify for.</p></section><div class="pj-board">'+board+'</div><div class="pj-details"><section class="pj-panel"><span>02 / CUSTOMER SPOTLIGHT</span><h2>'+esc(p.name)+'</h2><label>Journey stage<select data-pj-stage="'+p.id+'">'+stages.map(([id,name])=>'<option value="'+id+'" '+(p.stage===id?'selected':'')+'>'+name+'</option>').join('')+'</select></label><label>Days since last activity<input data-pj-days="'+p.id+'" type="number" min="0" max="999" value="'+p.days+'"></label><label><input data-pj-consent="'+p.id+'" type="checkbox" '+(p.consent?'checked':'')+'> Marketing email consent</label><label><input data-pj-optout="'+p.id+'" type="checkbox" '+(p.optOut?'checked':'')+'> Unsubscribed / do not email</label><h3>Activity history</h3>'+p.events.map(x=>'<p class="pj-event">✓ '+esc(x)+'</p>').join('')+'</section><section class="pj-panel"><span>03 / CAMPAIGN ASSIGNMENT</span><h2>Right message, right moment.</h2><div class="pj-assignment '+r[2]+'"><small>CURRENT ROUTING RULE</small><h3>'+esc(r[0])+'</h3><p>'+esc(r[1])+'</p></div><h3>What the automation would do</h3><p><b>Unconverted leads:</b> stay in a paced nurture sequence while eligible, stopping when they book, decline or unsubscribe.</p><p><b>One-time customers:</b> get an appropriate recurring-plan invitation.</p><p><b>Inactive past customers:</b> become eligible for a win-back draft after 90 days in this example.</p><p><b>Unsubscribes:</b> prevent marketing sends and would trigger a suppression event in production.</p><p class="pj-disclaimer">This demo only simulates assignments. Production requires consent records, provider event webhooks, scheduling safeguards and reviewable campaigns.</p></section></div><footer class="pj-footer"><strong>Built around your business. Not the other way around.</strong><p>The lifecycle and time thresholds should be configurable by company and service frequency.</p><button data-page="winback">See the existing Win-Back workspace ↗</button></footer></div>'}
window.CleaningPipeline={ensure,view,select,update,reset};
})();