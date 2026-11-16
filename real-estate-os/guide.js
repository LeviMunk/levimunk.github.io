(()=>{'use strict';
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const M=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
const steps={
buyer:[
['Inquiry received','Create a fictional buyer in Contacts & CRM.','Contact created with source, owner and potential deal value'],
['Property matched','Associate that buyer with an existing fictional listing.','Connected lead and property relationship'],
['Follow-up assigned','Create an actionable task for the assigned agent.','Contact activity and task queue updated'],
['Appointment scheduled','Advance the lead to Appointment.','CRM stage and pipeline metrics updated'],
['Business insight','Analyze the current opportunity and show recommended next action.','Explainable simulated analysis']
],
listing:[
['Listing reviewed','Select an active listing with limited recorded showings.','Listing activity and market-time context'],
['Issue identified','Compare its listing age and showing activity against demo thresholds.','Evidence-based watchlist item'],
['Agent task created','Add a property-specific review task.','Task queue and listing record connected'],
['Seller update prepared','Generate a fictional seller-update preview for approval.','Draft, not an actual message'],
['Insights refreshed','Show the resulting exception and human-review next step.','Dashboard intelligence']
],
closing:[
['Offer accepted','Advance a fictional buyer opportunity to Under contract.','Pipeline updated'],
['Transaction created','Associate the opportunity with a property and transaction.','Linked record in Transaction Center'],
['Milestones generated','Populate a closing checklist for the new transaction.','Inspection, financing and closing tasks'],
['Milestone reviewed','Complete the inspection checklist item.','Live transaction progress updates'],
['Forecast reviewed','Summarize expected transaction value and remaining deadlines.','Transparent, illustrative financial outlook']
]
};
const names={buyer:'New buyer inquiry',listing:'Listing needs attention',closing:'From offer to closing'};
function ensure(state){
if(!state.guide||typeof state.guide!=='object')state.guide={scenario:'buyer',progress:{buyer:0,listing:0,closing:0},refs:{},events:[],draft:''};
for(const id of Object.keys(steps)){if(!Number.isInteger(state.guide.progress?.[id]))state.guide.progress[id]=0}
if(!Array.isArray(state.guide.events))state.guide.events=[];
if(!state.guide.refs)state.guide.refs={};
if(!Array.isArray(state.transactions))state.transactions=[];
state.transactions.forEach(t=>{if(!Array.isArray(t.milestones))t.milestones=[]});
}
function makeId(state){return Math.max(Date.now(),...state.leads.map(l=>Number(l.id)||0),...state.tasks.map(t=>Number(t.id)||0),...state.transactions.map(t=>Number(t.id)||0))+Math.floor(Math.random()*1000000)}
function log(state,kind,detail){state.guide.events.unshift({time:new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}),kind,detail});state.guide.events=state.guide.events.slice(0,20)}
function activity(state,leadId,title,detail){state.crm??={};state.crm.activity??=[];state.crm.activity.unshift({id:makeId(state),leadId,title,detail,time:new Date().toLocaleString()})}
function transact(state,lead,listing){let t=state.transactions.find(x=>x.leadId===lead.id);if(t)return t;t={id:makeId(state),leadId:lead.id,listingId:listing.id,owner:lead.owner,status:'Under contract',grossValue:lead.value,milestones:[],created:'Demo'};state.transactions.unshift(t);return t}
const milestoneTypes=['Inspection','Financing approval','Appraisal','Final walkthrough','Closing'];
function perform(state,scenario,index){
ensure(state);const refs=state.guide.refs;
if(scenario==='buyer'){
if(index===0){
let l=state.leads.find(x=>x.id===refs.buyerLeadId);
if(!l){l={id:makeId(state),name:'Dakota Lane',source:'Website',stage:'New inquiry',value:425000,owner:'Alex',days:0,notes:'Fictional buyer: interested in a 3-bedroom property'};state.leads.unshift(l);refs.buyerLeadId=l.id;activity(state,l.id,'Website inquiry received','New demo lead assigned to Alex');}log(state,'CRM','New lead Dakota Lane created in Contacts & CRM');
}
if(index===1){const l=state.leads.find(x=>x.id===refs.buyerLeadId);const listing=state.listings.find(x=>x.status==='Active')||state.listings[0];if(l&&listing){l.listingId=listing.id;activity(state,l.id,'Listing linked',listing.address);log(state,'Property',l.name+' linked to '+listing.address)}}
if(index===2){const l=state.leads.find(x=>x.id===refs.buyerLeadId);if(l){state.tasks.unshift({id:makeId(state),title:'Call '+l.name+' about matched property',owner:l.owner,due:'Today',done:false,leadId:l.id,listingId:l.listingId});activity(state,l.id,'Follow-up created','Agent task created for today');log(state,'Task','New follow-up assigned to '+l.owner)}}
if(index===3){const l=state.leads.find(x=>x.id===refs.buyerLeadId);if(l){l.stage='Appointment';l.days=0;activity(state,l.id,'Appointment scheduled','Simulated stage change: New inquiry → Appointment');log(state,'Pipeline',l.name+' advanced to Appointment')}}
if(index===4)log(state,'Insight','The inquiry now has an assigned agent, linked property and next action; follow-up remains subject to human review');
}
if(scenario==='listing'){
const listing=state.listings.find(x=>x.status==='Active'&&x.days>=30)||state.listings.find(x=>x.status==='Active')||state.listings[0];if(!listing)return;
refs.listingId=listing.id;
if(index===0)log(state,'Listing','Reviewed '+listing.address+' ('+listing.days+' days; '+listing.showings+' showings)');
if(index===1)log(state,'Insight','Review listing engagement and buyer feedback; low showing activity alone does not establish the reason');
if(index===2){state.tasks.unshift({id:makeId(state),title:'Review showing feedback for '+listing.address,owner:listing.owner,due:'Today',done:false,listingId:listing.id});log(state,'Task','Created listing review task for '+listing.owner)}
if(index===3){state.guide.draft='DRAFT · Seller activity update\nProperty: '+listing.address+'\nAsking price: '+M(listing.price)+'\nDays on market: '+listing.days+'\nRecorded showings: '+listing.showings+'\nNext step: Review feedback and market context with the listing agent.\n\nFor agent review only. Fictional demo data.';log(state,'Draft','Prepared seller report draft; no message sent')}
if(index===4)log(state,'Insight','Listing health flagged for agent review. Recommend verifying feedback and comparable listings before making changes');
}
if(scenario==='closing'){
const lead=state.leads.find(l=>l.id===refs.closingLeadId)||state.leads.find(l=>l.stage==='Offer')||state.leads.find(l=>l.stage==='Under contract')||state.leads[0];const listing=state.listings.find(l=>l.status==='Active')||state.listings[0];if(!lead||!listing)return;
refs.closingLeadId=lead.id;
if(index===0){lead.stage='Under contract';lead.days=0;activity(state,lead.id,'Offer accepted','Simulated offer acceptance; transaction checklist needed');log(state,'Pipeline',lead.name+' advanced to Under contract')}
if(index===1){const t=transact(state,lead,listing);refs.closingTxId=t.id;lead.listingId=listing.id;log(state,'Transaction','Linked '+lead.name+' with '+listing.address)}
if(index===2){const t=state.transactions.find(x=>x.id===refs.closingTxId)||transact(state,lead,listing);if(!t.milestones.length)t.milestones=milestoneTypes.map((name,i)=>({id:i+1,name,done:false}));log(state,'Milestones','Generated '+t.milestones.length+' closing checklist items')}
if(index===3){const t=state.transactions.find(x=>x.id===refs.closingTxId);if(t){const m=t.milestones.find(x=>x.name==='Inspection');if(m)m.done=true;log(state,'Milestones','Inspection checklist marked reviewed')}}
if(index===4){const t=state.transactions.find(x=>x.id===refs.closingTxId);if(t)log(state,'Forecast','Transaction value '+M(t.grossValue)+'; expected commission requires actual negotiated terms and costs')}
}
}
function view(state){
ensure(state);const guide=state.guide,scenario=steps[guide.scenario]?guide.scenario:'buyer',items=steps[scenario],progress=Math.min(items.length,guide.progress[scenario]);
const event=guide.events.slice(0,6).map(e=>'<div class="reos-tour-event"><span>'+E(e.time)+'</span><div><strong>'+E(e.kind)+'</strong><p>'+E(e.detail)+'</p></div></div>').join('');
return '<div class="reos-tour-hero"><span>INTERACTIVE BUSINESS WALKTHROUGH</span><h1>See the entire workflow, not just the features.</h1><p>Take control of a fictional brokerage. Each step updates the real demo records across CRM, properties, tasks and transaction reporting.</p><div class="reos-tour-scenarios">'+Object.keys(steps).map(k=>'<button type="button" data-tour-scenario="'+k+'" class="'+(k===scenario?'active':'')+'">'+E(names[k])+'</button>').join('')+'</div></div><div class="reos-tour-columns"><div class="card"><div class="row"><h2>'+E(names[scenario])+'</h2><span class="pill">'+progress+' / '+items.length+' steps</span></div><div class="reos-tour-progress"><div style="width:'+(progress/items.length*100)+'%"></div></div><div class="reos-tour-steps">'+items.map(([title,desc,out],i)=>'<div class="reos-tour-step '+(i<progress?'done':i===progress?'current':'')+'"><div class="reos-tour-step-number">'+(i<progress?'✓':i+1)+'</div><div><strong>'+E(title)+'</strong><p>'+E(desc)+'</p>'+(i===progress?'<small>Outcome: '+E(out)+'</small>':'')+'</div></div>').join('')+'</div><div class="reos-tour-actions">'+(progress<items.length?'<button class="btn" data-tour-next>Run next step →</button>':'<span class="pill">✓ Scenario complete</span>')+'<button class="btn alt" data-tour-restart>Restart walkthrough</button></div><p class="caption">Simulated actions only. No emails, contracts, real AI calls, MLS updates or payments occur.</p></div><div class="card"><h2>Live demo activity</h2><p class="caption">Changes are reflected in other Real Estate OS screens and saved in this browser.</p><div class="reos-tour-feed">'+(event||'<p class="caption">Start the walkthrough to see actions appear here.</p>')+'</div>'+(scenario==='listing'&&guide.draft?'<div class="reos-tour-draft"><h3>Seller report draft</h3><pre>'+E(guide.draft)+'</pre></div>':'')+'<h3>Inspect the results</h3><div class="reos-tour-links"><button class="btn alt" data-action="goto:contacts">Contacts & CRM</button><button class="btn alt" data-action="goto:pipeline">Pipeline</button><button class="btn alt" data-action="goto:transactions">Transactions</button><button class="btn alt" data-action="goto:insights">Business intelligence</button></div></div></div>';
}
function transactionsView(state){
ensure(state);const rows=state.transactions.map(t=>{const lead=state.leads.find(l=>l.id===t.leadId),listing=state.listings.find(l=>l.id===t.listingId),done=t.milestones.filter(m=>m.done).length,total=t.milestones.length;return '<div class="reos-transaction"><div class="row"><div><h3>'+E(lead?.name||'Unknown contact')+'</h3><p>'+E(listing?.address||'Unlinked property')+' · '+M(t.grossValue||0)+' transaction value</p></div><span class="pill">'+E(t.status)+'</span></div><div class="reos-tour-progress"><div style="width:'+(total?done/total*100:0)+'%"></div></div><p class="caption">'+done+' of '+total+' milestone items completed</p>'+(t.milestones.length?t.milestones.map(m=>'<label class="reos-milestone"><input type="checkbox" data-transaction="'+t.id+'" data-milestone="'+m.id+'" '+(m.done?'checked':'')+'><span>'+E(m.name)+'</span></label>').join(''):'<p class="caption">No milestones generated yet. Use the guided simulation to populate a checklist.</p>')+'</div>'}).join('');
return '<div class="eyebrow">OPERATIONS / TRANSACTIONS</div><h1>Transaction command center.</h1><p>Connected opportunities, listings, and closing milestones. This is a browser-only demo, not a legal transaction or compliance system.</p><div class="grid"><div class="card"><div class="statname">Tracked transactions</div><div class="metric">'+state.transactions.length+'</div></div><div class="card"><div class="statname">Open milestones</div><div class="metric">'+state.transactions.reduce((n,t)=>n+t.milestones.filter(m=>!m.done).length,0)+'</div></div><div class="card"><div class="statname">Illustrative deal value</div><div class="metric">'+M(state.transactions.reduce((n,t)=>n+(Number(t.grossValue)||0),0))+'</div></div></div><div class="reos-transactions">'+(rows||'<div class="card"><h2>No transactions yet</h2><p>Use the guided demo’s From offer to closing scenario to create a connected transaction with milestones.</p><button class="btn" data-action="goto:tour">Open guided demo →</button></div>')+'</div>';
}
function analyst(state){
ensure(state);const late=state.leads.filter(l=>l.days>=7&&l.stage!=='Closed'),listings=state.listings.filter(l=>l.status==='Active'&&l.days>=30&&l.showings<=4),tasks=state.tasks.filter(t=>!t.done),txn=state.transactions.flatMap(t=>t.milestones.filter(m=>!m.done));
const insights=[
{title:'Leads needing a review',metric:late.length,detail:'Current stage age of seven days or more in the sample data.',action:'Review owner assignment and follow-up timing',target:'contacts'},
{title:'Listings to investigate',metric:listings.length,detail:'Active listings at least 30 days old with four or fewer sample showings.',action:'Check seller feedback and comparable properties',target:'map'},
{title:'Open commitments',metric:tasks.length,detail:'Tasks not marked completed, including those generated during the tour.',action:'Review deadlines and workloads',target:'tasks'},
{title:'Transaction checklist items',metric:txn.length,detail:'Outstanding fictional milestones in the transaction center.',action:'Confirm responsibilities and actual due dates',target:'transactions'}];
return '<div class="card section"><div class="row"><div><span class="eyebrow">EXPLAINABLE AUTOMATED ANALYSIS</span><h2>Business briefing</h2><p class="caption">Rule-based analysis of the current fictional demo data. No language model or external API is connected.</p></div><span class="pill">Live sample insights</span></div><div class="reos-analyst-grid">'+insights.map(i=>'<div class="reos-analyst-item"><strong>'+i.metric+' · '+E(i.title)+'</strong><p>'+E(i.detail)+'</p><small>Suggested next step: '+E(i.action)+'</small><div><button class="btn alt" data-action="goto:'+i.target+'">Investigate →</button></div></div>').join('')+'</div></div>';
}
window.REOSGuided={ensure,view,transactionsView,analyst,select(state,k){ensure(state);if(steps[k])state.guide.scenario=k},next(state){ensure(state);const g=state.guide,k=g.scenario,i=g.progress[k];if(i>=steps[k].length)return false;perform(state,k,i);g.progress[k]++;return true},restart(state){ensure(state);const k=state.guide.scenario;state.guide.progress[k]=0;state.guide.events=[];state.guide.draft='';/* Re-running a walkthrough can create new sample items, but does not delete unrelated demo records. */},toggle(state,tx,milestone,done){const t=state.transactions.find(t=>t.id===tx);const m=t?.milestones.find(m=>m.id===milestone);if(m)m.done=done}};
})();