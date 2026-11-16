(()=>{'use strict';
const H=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const USD=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
const dayLabels=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const dateKey=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const fromKey=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d,12)};
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const monday=d=>{const v=new Date(d.getFullYear(),d.getMonth(),d.getDate(),12);v.setDate(v.getDate()-(v.getDay()+6)%7);return v};
const moneyParse=n=>Math.max(0,Number(n)||0);
const cleanTime=t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(String(t))?t:'09:00';
const timeLabel=t=>{const [h,m]=cleanTime(t).split(':').map(Number);return (h%12||12)+':'+String(m).padStart(2,'0')+(h>=12?' PM':' AM')};
const minutes=t=>{const [h,m]=cleanTime(t).split(':').map(Number);return h*60+m};
function ensure(s){
if(!s.planner||typeof s.planner!=='object')s.planner={};
let p=s.planner;
if(!Array.isArray(p.plans))p.plans=[
{id:401,clientId:1,service:'Standard clean',frequency:'Weekly',weekday:0,time:'08:30',duration:150,crew:'Mia',price:160,start:dateKey(monday(new Date()))},
{id:402,clientId:4,service:'Recurring clean',frequency:'Every 2 weeks',weekday:2,time:'13:00',duration:120,crew:'Mia',price:145,start:dateKey(monday(new Date()))},
{id:403,clientId:2,service:'Deep clean',frequency:'Weekly',weekday:0,time:'09:30',duration:240,crew:'Crew A',price:325,start:dateKey(monday(new Date()))},
{id:404,clientId:3,service:'Move-out clean',frequency:'One-time',weekday:4,time:'11:00',duration:180,crew:'Crew B',price:245,start:dateKey(monday(new Date()))}
];
if(!p.overrides||typeof p.overrides!=='object')p.overrides={};
if(!Number.isInteger(p.weekOffset))p.weekOffset=0;
if(!p.crewFilter)p.crewFilter='All crews';
if(!p.selected)p.selected=null;
return p;
}
function instanceId(plan,base){return plan.id+'@'+base}
function occurrence(s,plan,d){
const base=dateKey(d),ov=s.planner.overrides[instanceId(plan,base)]||{};
if(ov.skip)return {...plan,base,date:base,skipped:true,visitId:instanceId(plan,base)};
return {...plan,...ov,base,date:ov.date||base,visitId:instanceId(plan,base),skipped:false};
}
function all(s,offset){
const p=ensure(s),start=monday(addDays(new Date(),offset*7)),out=[];
for(const plan of p.plans){
const anchor=fromKey(plan.start);
for(let k=-56;k<=56;k++){
const date=addDays(anchor,k);if(date<anchor)continue;
const days=Math.round((date-anchor)/86400000);
const weekDay=(date.getDay()+6)%7;
if(weekDay!==plan.weekday)continue;
if(plan.frequency==='One-time'&&days>=7)continue;
if(plan.frequency==='Every 2 weeks'&&Math.floor(days/7)%2!==0)continue;
if(plan.frequency==='Every 4 weeks'&&Math.floor(days/7)%4!==0)continue;
if(plan.frequency==='Monthly'&&Math.floor(days/7)%4!==0)continue;
if(days<0)continue;
const visit=occurrence(s,plan,date);
const actual=fromKey(visit.date),gap=Math.round((actual-start)/86400000);
if(gap>=0&&gap<7)out.push(visit);
}
}
return out.sort((a,b)=>a.date.localeCompare(b.date)||minutes(a.time)-minutes(b.time));
}
function show(s){const p=ensure(s),weekStart=monday(addDays(new Date(),p.weekOffset*7)),visits=all(s,p.weekOffset),filtered=visits.filter(v=>p.crewFilter==='All crews'||v.crew===p.crewFilter);
const conflicts=[];
for(let i=0;i<visits.length;i++)for(let j=i+1;j<visits.length;j++){
const a=visits[i],b=visits[j];if(a.date===b.date&&a.crew===b.crew&&!a.skipped&&!b.skipped&&minutes(a.time)<minutes(b.time)+b.duration&&minutes(b.time)<minutes(a.time)+a.duration)conflicts.push([a,b]);
}
const skipped=visits.filter(v=>v.skipped),gross=visits.filter(v=>!v.skipped).reduce((x,v)=>x+moneyParse(v.price),0);
let cards='<div class="clean-week-grid">'+Array.from({length:7},(_,i)=>{const d=addDays(weekStart,i),key=dateKey(d),v=filtered.filter(x=>x.date===key);
return '<div class="clean-day"><div class="clean-day-title"><strong>'+dayLabels[i]+'</strong><small>'+d.toLocaleDateString('en-US',{month:'short',day:'numeric'})+'</small></div>'+v.map(x=>{
const c=s.clients.find(c=>c.id===x.clientId);const check=conflicts.some(pair=>pair.some(y=>y.visitId===x.visitId));
return '<button type="button" class="clean-visit '+(x.skipped?'skipped':'')+(check?' conflict':'')+'" data-plan-visit="'+H(x.visitId)+'"><strong>'+H(c?.name||'Client')+'</strong><small>'+timeLabel(x.time)+' · '+H(x.crew)+'</small><small>'+H(x.service)+' · '+USD(x.price)+'</small>'+(x.skipped?'<span class="clean-tag">Skipped</span>':check?'<span class="clean-tag warning">Crew overlap</span>':'')+'</button>'}).join('')+(v.length?'':'<div class="clean-empty">No scheduled visits</div>')+'</div>'}).join('')+'</div>';
const selected=p.selected?visits.find(x=>x.visitId===p.selected):null;
const options=all(s,p.weekOffset);
const crews=[...new Set(p.plans.map(x=>x.crew))].sort();
const today=weekStart.toLocaleDateString('en-US',{month:'short',day:'numeric'}),last=addDays(weekStart,6).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
return '<div class="eyebrow">RECURRING SERVICE CONTROL</div><h1>Weekly schedule & exceptions.</h1><p>See recurring house cleanings, adjust one visit without changing the series, and spot crew scheduling conflicts. Everything is fictional and browser-local.</p><div class="clean-week-metrics"><div><span>Scheduled visits</span><strong>'+visits.filter(v=>!v.skipped).length+'</strong></div><div><span>Quoted weekly revenue</span><strong>'+USD(gross)+'</strong></div><div><span>Skipped visits</span><strong>'+skipped.length+'</strong></div><div><span>Crew overlaps</span><strong>'+conflicts.length+'</strong></div></div><div class="card section"><div class="clean-week-controls"><div class="row"><button class="btn alt" data-planner-week="-1" aria-label="Previous week">←</button><strong>'+today+' – '+last+'</strong><button class="btn alt" data-planner-week="1" aria-label="Next week">→</button><button class="btn alt" data-planner-week="0">This week</button></div><label class="field">Cleaner / team<select data-planner-crew><option>All crews</option>'+crews.map(c=>'<option '+(c===p.crewFilter?'selected':'')+'>'+H(c)+'</option>').join('')+'</select></label></div>'+cards+'</div>'+ (conflicts.length?'<div class="clean-warning"><strong>Scheduling overlap detected.</strong> '+conflicts.map(([a,b])=>H(a.crew)+' has two visits overlapping on '+H(a.date)).join('; ')+'. Adjust the crew or time for an affected visit.</div>':'<div class="clean-ok">No same-crew overlaps detected among this week’s planned visits.</div>')+(selected?'<div class="card section"><h2>Edit one service visit</h2><p>'+H(s.clients.find(c=>c.id===selected.clientId)?.name||'Client')+' · '+H(selected.service)+' · Original date: '+H(selected.base)+'. Changes below apply only to this occurrence.</p><form id="planner-override-form"><input type="hidden" name="visit" value="'+H(selected.visitId)+'"><div class="formgrid"><label class="field">Visit date<input type="date" name="date" required value="'+H(selected.date)+'"></label><label class="field">Start time<input type="time" name="time" value="'+H(selected.time)+'"></label><label class="field">Crew<input name="crew" maxlength="60" value="'+H(selected.crew)+'"></label><label class="field">Quoted amount ($)<input name="price" type="number" min="0" value="'+selected.price+'"></label><label class="field">Duration (minutes)<input name="duration" type="number" min="30" step="15" value="'+selected.duration+'"></label></div><label class="field"><input type="checkbox" name="skip" '+(selected.skipped?'checked':'')+'> Skip this visit (not the recurring series)</label><div class="row">'+ '<button class="btn" type="submit">Save occurrence</button><button class="btn alt" data-planner-close type="button">Close</button></div></form></div>':'')+'<div class="two section"><div class="card"><h2>Recurring service plans</h2>'+p.plans.map(x=>'<div class="line"><div><strong>'+H(s.clients.find(c=>c.id===x.clientId)?.name||'Client')+'</strong><small>'+H(x.frequency)+' · '+dayLabels[x.weekday]+' '+timeLabel(x.time)+' · '+H(x.crew)+'</small></div><span class="pill">'+USD(x.price)+'</span></div>').join('')+'</div><div class="card"><h2>Add a repeat service</h2><form id="planner-add-form"><div class="formgrid"><label class="field">Client<select name="clientId">'+s.clients.map(c=>'<option value="'+c.id+'">'+H(c.name)+'</option>').join('')+'</select></label><label class="field">Frequency<select name="frequency"><option>Weekly</option><option>Every 2 weeks</option><option>Every 4 weeks</option><option>One-time</option></select></label><label class="field">Day<select name="weekday">'+dayLabels.map((d,i)=>'<option value="'+i+'">'+d+'</option>').join('')+'</select></label><label class="field">Time<input name="time" type="time" value="09:00"></label><label class="field">Crew<input name="crew" required value="Mia" maxlength="60"></label><label class="field">Duration (min)<input name="duration" min="30" value="150" type="number"></label><label class="field">Price ($)<input name="price" min="0" value="175" type="number"></label></div><button class="btn" type="submit">Create sample recurring plan</button></form><p class="caption">Planning preview only: no calendar invite or customer notification is sent.</p></div></div><p class="footer">Recurrence currently models weekly, two-week, four-week or one-time visits. It does not yet support advanced calendar rules, holidays, timezone travel or automatic billing. Dates and revenue are fictional.</p>';
}
window.CleaningPlanner={ensure,show,select(s,id){ensure(s);s.planner.selected=id},week(s,delta){ensure(s);s.planner.weekOffset=delta===0?0:Math.max(-12,Math.min(12,s.planner.weekOffset+delta));s.planner.selected=null},filter(s,c){ensure(s);s.planner.crewFilter=c},saveVisit(s,values){ensure(s);const id=String(values.visit||''),p=s.planner.plans.find(x=>id.startsWith(x.id+'@'));if(!p)return false;const base=id.slice(String(p.id).length+1);if(!/^\d{4}-\d{2}-\d{2}$/.test(base))return false;s.planner.overrides[id]={date:values.date,time:cleanTime(values.time),crew:String(values.crew||p.crew).slice(0,60),price:moneyParse(values.price),duration:Math.max(30,Math.floor(Number(values.duration)||p.duration)),skip:values.skip===true};s.planner.selected=null;return true},addPlan(s,v){ensure(s);const id=Math.max(400,...s.planner.plans.map(p=>p.id))+1;s.planner.plans.push({id,clientId:Number(v.clientId),service:'Recurring clean',frequency:v.frequency,weekday:Math.min(6,Math.max(0,Number(v.weekday)||0)),time:cleanTime(v.time),duration:Math.max(30,Number(v.duration)||120),crew:String(v.crew||'Mia').slice(0,60),price:moneyParse(v.price),start:dateKey(monday(addDays(new Date(),s.planner.weekOffset*7)))});return id},occurrences:all};
})();