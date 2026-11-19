(()=>{'use strict';
const E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const roomTemplates=['Kitchen','Living room','Primary bedroom','Additional bedrooms','Main bathroom','Additional bathroom','Entry & hallway'];
const path=[['new','Inquiry','New customer request'],['warm','Interested','Engagement and follow-up'],['hot','Ready to book','Estimate and booking'],['first','First clean','Service delivery'],['repeat','Returning','Repeat service'],['plan','Recurring plan','Long-term relationship']];
function ensure(s){
window.CleaningPipeline.ensure(s);
if(!s.customerProfiles||typeof s.customerProfiles!=='object')s.customerProfiles={};
return s.customerProfiles;
}
function forPerson(s,id){
const profiles=ensure(s),person=s.pipelineDemo.people.find(x=>String(x.id)===String(id));
if(!person)return null;
if(!profiles[person.id])profiles[person.id]={property:null,notes:'',activity:[]};
const profile=profiles[person.id];
if(!Array.isArray(profile.activity))profile.activity=[];
if(profile.property&&!Array.isArray(profile.property.rooms))profile.property.rooms=[];
return {person,profile};
}
function setTab(s,id,tab){const p=forPerson(s,id);if(!p||!['journey','home'].includes(tab))return false;s.customerProfileTab=tab;return true}
function addHome(s,id){const found=forPerson(s,id);if(!found||found.profile.property)return false;found.profile.property={label:'Primary home',type:'House',rooms:roomTemplates.map((name,i)=>({id:i+1,name,instructions:'',done:false})),generalNotes:''};found.profile.activity.unshift({type:'home',label:'Home profile created',date:new Date().toISOString().slice(0,10)});return true}
function updateHome(s,id,values){
const found=forPerson(s,id);if(!found||!found.profile.property)return false;
const home=found.profile.property;
home.label=String(values.label||'Primary home').trim().slice(0,60);
home.type=['House','Apartment','Office','Other'].includes(values.type)?values.type:'House';
home.generalNotes=String(values.generalNotes||'').slice(0,800);
for(const room of home.rooms){const value=values.rooms?.[String(room.id)];if(typeof value==='string')room.instructions=value.slice(0,500)}
found.profile.activity.unshift({type:'home',label:'Home instructions updated',date:new Date().toISOString().slice(0,10)});
found.profile.activity=found.profile.activity.slice(0,15);
return true;
}
function addRoom(s,id,name){
const found=forPerson(s,id),home=found?.profile.property,n=String(name||'').trim().slice(0,50);
if(!home||n.length<2||home.rooms.length>=25)return false;
home.rooms.push({id:Math.max(0,...home.rooms.map(x=>Number(x.id)||0))+1,name:n,instructions:'',done:false});return true;
}
function removeRoom(s,id,roomId){const home=forPerson(s,id)?.profile.property;if(!home)return false;const before=home.rooms.length;home.rooms=home.rooms.filter(x=>String(x.id)!==String(roomId));return before!==home.rooms.length}
function event(s,id,label){const found=forPerson(s,id);if(!found)return false;const value=String(label||'').trim().slice(0,140);if(!value)return false;found.profile.activity.unshift({type:'note',label:value,date:new Date().toISOString().slice(0,10)});found.profile.activity=found.profile.activity.slice(0,15);return true}
function timeline(person,profile){
const ix=path.findIndex(x=>x[0]===person.stage);
return '<div class="cp-timeline">'+path.map(([key,name,description],i)=>'<div class="cp-step '+(i<ix?'complete':i===ix?'current':'future')+'"><div class="cp-step-mark">'+(i<ix?'✓':i===ix?'●':'○')+'</div><div class="cp-step-body"><div class="cp-step-top"><strong>'+E(name)+'</strong><span>'+(i<ix?'Previous phase':i===ix?'Current phase':'Not reached')+'</span></div><p>'+E(description)+'</p>'+(i===ix?'<div class="cp-now">'+E(person.stage==='new'?'Respond to the new inquiry':person.stage==='warm'?'Review the customer’s active conversations and next contact':person.stage==='hot'?'Confirm the estimate and booking details':person.stage==='first'?'Check service quality and satisfaction':person.stage==='repeat'?'Help plan their next service':'Maintain quality and long-term retention')+'</div>':'')+'</div></div>').join('')+'</div>'
+'<details class="cp-history"><summary>Activity and notes ('+(profile.activity.length+person.events.length)+')</summary><div>'+[...profile.activity.map(e=>E(e.date)+' · '+E(e.label)),...person.events.map(E)].map(x=>'<p>'+x+'</p>').join('')+'</div></details>';
}
function homeView(person,profile){
const h=profile.property;
if(!h)return '<div class="cp-home-empty"><div class="cp-home-visual">⌂</div><h3>No home profile yet</h3><p>Add a home when service details become relevant. Room notes will be available to the owner or an assigned cleaner in a future permission-aware workspace.</p><button type="button" data-cp-add-home="'+person.id+'">Create home profile</button></div>';
return '<div class="cp-home-header"><div><span>PROPERTY RECORD · DEMO</span><h3>'+E(h.label)+'</h3><p>'+h.rooms.length+' rooms · private service instructions · browser-local</p></div><span class="cp-home-label">'+E(h.type)+'</span></div>'
+'<form id="cp-home-form"><input type="hidden" name="personId" value="'+person.id+'"><div class="cp-home-fields"><label>Property label<input name="label" maxlength="60" value="'+E(h.label)+'"></label><label>Property type<select name="type">'+['House','Apartment','Office','Other'].map(x=>'<option '+(h.type===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label></div><label class="cp-wide-label">General service instructions<textarea name="generalNotes" rows="3" maxlength="800" placeholder="Products, surfaces, priorities and helpful access instructions. Avoid sensitive codes in public demos.">'+E(h.generalNotes)+'</textarea></label><h4>Room-by-room instructions</h4><div class="cp-room-grid">'+h.rooms.map(room=>'<div class="cp-room"><div><strong>'+E(room.name)+'</strong><button type="button" aria-label="Remove '+E(room.name)+'" data-cp-remove-room="'+room.id+'">×</button></div><textarea name="room-'+room.id+'" rows="3" maxlength="500" placeholder="What should the cleaner know?">'+E(room.instructions)+'</textarea></div>').join('')+'</div><div class="cp-home-actions"><button type="submit">Save home instructions</button></div></form>'
+'<form id="cp-room-form" class="cp-add-room"><input type="hidden" name="personId" value="'+person.id+'"><input name="name" maxlength="50" placeholder="Add another room" required><button type="submit">Add room</button></form>'
+'<p class="cp-home-footnote">These room templates belong to this demonstration customer. They are not yet integrated with cleaner permissions or job-level checklists.</p>';
}
function view(s){
const d=window.CleaningPipeline.ensure(s),id=d.selected,found=forPerson(s,id);
if(!found)return '<section class="cp-root"><h2>Choose a customer from the pipeline.</h2><button data-page="pipeline">View customer pipeline</button></section>';
const {person,profile}=found,tab=s.customerProfileTab==='home'?'home':'journey',needs=Object.values(person.checkpoints||{}).includes('issue');
return '<div class="cp-root"><button class="cp-back" data-page="pipeline">← All customers</button><section class="cp-hero"><div class="cp-avatar">'+E(person.name.split(' ').map(x=>x[0]).join(''))+'</div><div><span>CUSTOMER PROFILE · FICTIONAL DEMO</span><h1>'+E(person.name)+'</h1><p>'+E(path.find(x=>x[0]===person.stage)?.[1]||'Customer')+' · '+person.days+' days since activity</p></div><span class="cp-health '+(needs?'risk':'')+'">'+(needs?'Needs attention':'On track')+'</span></section>'
+'<section class="cp-summary"><div><small>Current stage</small><strong>'+E(path.find(x=>x[0]===person.stage)?.[1]||'Customer')+'</strong></div><div><small>Next action</small><strong>'+E(needs?'Review customer issue':person.stage==='new'?'Contact lead':person.stage==='warm'?'Follow up':person.stage==='hot'?'Confirm booking':person.stage==='first'?'Check satisfaction':person.stage==='repeat'?'Plan next clean':'Maintain relationship')+'</strong></div><div><small>Home profile</small><strong>'+(profile.property?profile.property.rooms.length+' rooms':'Not created')+'</strong></div></section>'
+'<div class="cp-tabs"><button type="button" data-cp-tab="journey" class="'+(tab==='journey'?'active':'')+'">Journey timeline</button><button type="button" data-cp-tab="home" class="'+(tab==='home'?'active':'')+'">Home profile</button></div>'
+'<section class="cp-main">'+(tab==='journey'?'<div class="cp-timeline-header"><h2>The customer’s journey</h2><p>Lifecycle position and activity are tracked separately. Earlier phases are illustrative, not proof that every task occurred.</p></div>'+timeline(person,profile)+'<form id="cp-note-form"><input name="note" maxlength="140" placeholder="Record a brief customer interaction" required><button type="submit">Add note</button></form>':homeView(person,profile))+'</section>'
+'<p class="cp-footer">Fictional, browser-local records. Nothing here sends messages, shares property details or publishes changes externally.</p></div>';
}
window.CleaningCustomerProfile={ensure,view,forPerson,setTab,addHome,updateHome,addRoom,removeRoom,event};
})();