(()=>{'use strict';
const E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
function ensure(s){
 if(!s.aftercare||typeof s.aftercare!=='object'||Array.isArray(s.aftercare))s.aftercare={records:[]};
 if(!Array.isArray(s.aftercare.records))s.aftercare.records=[];
 s.aftercare.records=s.aftercare.records.filter(x=>x&&typeof x==='object'&&typeof x.key==='string');
 return s.aftercare;
}
function completedJobs(s){
 const jobs=[...(Array.isArray(s.jobs)?s.jobs:[]).filter(j=>j&&j.status==='Completed').map(j=>({...j,planned:false}))];
 if(window.CleaningOperations?.current){
   const current=window.CleaningOperations.current(s);
   for(const job of current){if(job.planned&&job.status==='Completed')jobs.push(job)}
 }
 return jobs;
}
function sync(s){
 const store=ensure(s),known=new Set(store.records.map(x=>x.key));let created=0;
 for(const j of completedJobs(s)){
   if(!j.id||j.skipped)continue;
   const key=(j.planned?'plan:':'job:')+j.id;
   if(known.has(key))continue;
   const customer=(s.clients||[]).find(c=>String(c.id)===String(j.clientId));
   store.records.push({
     key,jobId:String(j.id),clientId:String(j.clientId??''),sourceLeadId:j.sourceLeadId??null,
     customerName:customer?.name||'Customer',service:String(j.service||'cleaning'),
     completedDate:String(j.date||date()),contactedAt:'',feedbackRating:null,feedbackNote:'',
     recurringInterest:'Not discussed',requestedReviewAt:''
   });
   known.add(key);created++;
 }
 return created;
}
function find(s,key){return ensure(s).records.find(x=>x.key===String(key))}
function update(s,key,action,value){
 const r=find(s,key);if(!r)return {ok:false,reason:'Completed visit not found'};
 if(action==='contacted'){r.contactedAt=r.contactedAt||date();return {ok:true}}
 if(action==='review-request'){if(!r.contactedAt)return {ok:false,reason:'Record the post-service contact first'};r.requestedReviewAt=r.requestedReviewAt||date();return {ok:true}}
 if(action==='interest'&&['Not discussed','Interested','Declined','Scheduled elsewhere'].includes(value)){r.recurringInterest=value;return {ok:true}}
 if(action==='feedback'){
   const n=Number(value.rating);
   if(!Number.isInteger(n)||n<1||n>5)return {ok:false,reason:'Choose a rating from 1 to 5'};
   r.feedbackRating=n;r.feedbackNote=String(value.note||'').slice(0,500);return {ok:true}
 }
 return {ok:false,reason:'Invalid update'}
}
function message(s,key,kind){
 const r=find(s,key);if(!r)return '';
 const first=String(r.customerName).split(/\s+/)[0]||'there';
 if(kind==='review')return 'Hi '+first+', thanks for choosing us for your '+r.service+'. If you have a moment, we would appreciate your honest feedback about the service. Every experience helps us improve.';
 if(kind==='recurring')return 'Hi '+first+', thanks again for having us out! If regular cleaning would make life easier, we can discuss weekly or biweekly visits. No pressure at all.';
 return 'Hi '+first+', thank you for choosing us for your '+r.service+'. We wanted to check that everything went well and see if there is anything we can improve. We appreciate your feedback!';
}
const copyButton=(key,kind,label)=>'<button type="button" class="btn alt" data-ac-copy="'+E(key)+'" data-ac-kind="'+kind+'">'+label+'</button>';
function row(r){return '<article class="ac-item"><div class="ac-item-head"><div><strong>'+E(r.customerName)+'</strong><small>'+E(r.service)+' · '+E(r.completedDate)+'</small></div><span class="pill">'+(r.contactedAt?'Follow-up recorded':'Awaiting follow-up')+'</span></div>'
 +'<div class="ac-item-body"><span>Completed job '+E(r.jobId)+'</span><span>'+E(r.recurringInterest)+'</span></div>'
 +'<div class="ac-item-actions">'+copyButton(r.key,'checkin','Copy check-in')+(r.contactedAt?'<span class="ac-note">Contact recorded '+E(r.contactedAt)+'</span>':'<button type="button" class="btn" data-ac-contacted="'+E(r.key)+'">Mark externally contacted</button>')+'</div></article>'}
function flow(s){
 sync(s);const all=ensure(s).records,uncontacted=all.filter(r=>!r.contactedAt);
 return '<section class="ac-section"><div class="ac-head"><div><span class="eyebrow">FLOW → CUSTOMER CARE</span><h2>After the clean</h2><p>Completed visits automatically enter a browser-local follow-up queue. Nothing is sent automatically.</p></div><span class="pill">'+uncontacted.length+' need follow-up</span></div>'
 +(all.length?'<div class="ac-list">'+uncontacted.slice(0,8).map(row).join('')+(uncontacted.length===0?'<p class="ac-empty">All completed-visit check-ins have been marked as contacted.</p>':'')+'</div>':'<div class="ac-empty">Finish a job and its quality checklist in Flow to create the first follow-up.</div>')+'</section>'
}
function elevate(s){
 sync(s);const all=ensure(s).records;
 return '<section class="ac-section"><div class="ac-head"><div><span class="eyebrow">ELEVATE / POST-SERVICE GROWTH</span><h2>Turn quality service into repeat care</h2><p>Log interest in a recurring plan after the service. This does not schedule or charge a customer.</p></div><span class="pill">'+all.filter(r=>r.recurringInterest==='Interested').length+' interested</span></div>'
 +(all.length?'<div class="ac-list">'+all.slice(-12).reverse().map(r=>'<article class="ac-item"><div class="ac-item-head"><div><strong>'+E(r.customerName)+'</strong><small>'+E(r.service)+' · Completed '+E(r.completedDate)+'</small></div><span class="pill">'+(r.contactedAt?'Contacted':'Not contacted')+'</span></div><div class="ac-item-actions">'+copyButton(r.key,'recurring','Copy recurring offer')+'<label class="ac-interest">Customer interest <select aria-label="Recurring interest for '+E(r.customerName)+'" data-ac-interest="'+E(r.key)+'">'+['Not discussed','Interested','Declined','Scheduled elsewhere'].map(x=>'<option'+(r.recurringInterest===x?' selected':'')+'>'+x+'</option>').join('')+'</select></label></div></article>').join('')+'</div>':'<div class="ac-empty">No completed cleanings in the follow-up ledger yet. Finish a job in Flow first.</div>')+'</section>'
}
function echo(s){
 sync(s);const all=ensure(s).records;
 return '<section class="ac-section"><div class="ac-head"><div><span class="eyebrow">ECHO / POST-SERVICE TRUST</span><h2>Ask everyone. Learn from every response.</h2><p>Capture manually received service feedback. Review requests should be unbiased, regardless of rating.</p></div><span class="pill">'+all.filter(r=>r.feedbackRating!==null).length+' responses recorded</span></div>'
 +(all.length?'<div class="ac-list">'+all.slice(-12).reverse().map(r=>'<article class="ac-item"><div class="ac-item-head"><div><strong>'+E(r.customerName)+'</strong><small>Visit '+E(r.completedDate)+' · '+E(r.service)+'</small></div><span class="pill">'+(r.feedbackRating!==null?r.feedbackRating+'/5 recorded':'Awaiting feedback')+'</span></div>'
 +'<div class="ac-item-actions">'+copyButton(r.key,'review','Copy unbiased feedback request')+(r.requestedReviewAt?'<span class="ac-note">Request marked '+E(r.requestedReviewAt)+'</span>':'<button class="btn alt" type="button" data-ac-review="'+E(r.key)+'" '+(!r.contactedAt?'disabled title="Mark the check-in as contacted in Flow first"':'')+'>Mark request sent externally</button>')+'</div>'
 +'<form class="ac-feedback" data-ac-feedback="'+E(r.key)+'"><label>Service rating <select name="rating" required><option value="">Select a rating</option>'+[1,2,3,4,5].map(n=>'<option value="'+n+'"'+(r.feedbackRating===n?' selected':'')+'>'+n+' / 5</option>').join('')+'</select></label><label>Private feedback note <textarea name="note" rows="2" maxlength="500" placeholder="Customer feedback received outside CleaningOS">'+E(r.feedbackNote||'')+'</textarea></label><button class="btn" type="submit">Save received feedback</button></form></article>').join('')+'</div>':'<div class="ac-empty">Complete a service in Flow to begin collecting feedback here.</div>')+'</section>'
}
window.CleaningAftercare={ensure,sync,find,update,message,flow,elevate,echo};
})();