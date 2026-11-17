/* LeviOS Outreach v0.1 — encrypted browser-local MVP.
   No cloud connectivity, analytics pixels, or automatic messaging. */
(() => {
  'use strict';
  const STORAGE_KEY = 'levios.outreach.encrypted.v1';
  const ITERATIONS = 320000;
  const STAGES = ['Discovered','Researched','Draft Ready','Contacted','Responded','Concept Shared','Interested','Meeting Booked','Proposal','Won','Closed','Saved','Applied','Recruiter Screen','Interview','Offer','Rejected','Withdrawn'];
  const STRATEGY_STARTERS = [{"id":"subject","name":"Subject line: direct vs curiosity","question":"Does a truthful, specific subject outperform a short open-ended one?","a":"Direct: 'Idea for [business] website'","b":"Curiosity: 'Quick question about [business]'","status":"planned","notes":"One accurate subject only. Never fake a reply, urgency, or existing relationship."},{"id":"length","name":"Email length: brief vs detailed","question":"For the same offer, does 60–90 words outperform 130–170 words?","a":"Brief: one observation, one value statement, one question","b":"Detailed: observation, example, proof, one question","status":"planned","notes":"Hold the offer and recipient type constant. Word count is captured when you confirm a send."},{"id":"angle","name":"Problem reveal vs opportunity","question":"Does a verifiable business friction point earn more positive replies than an upside-focused idea?","a":"Specific, independently checked problem or missed opportunity","b":"Plausible upside tied to the business, without inventing results","status":"active","notes":"Don't assert revenue losses without evidence. A helpful observation beats fabricated urgency."},{"id":"cta","name":"Call-to-action friction","question":"Does asking permission to share an example work better than asking for a call immediately?","a":"Low friction: 'Worth sending you a quick example?'","b":"Direct ask: 'Open to a 15-minute call next week?'","status":"active","notes":"Keep the rest of the message as similar as possible."},{"id":"personal","name":"Personalization depth","question":"Does a specific business observation improve replies compared with category-level messaging?","a":"One verified observation about that exact organization","b":"One accurate industry-specific observation","status":"planned","notes":"Do not invent research findings."},{"id":"stakeholders","name":"Stakeholder involvement","question":"Does appropriately involving a second relevant stakeholder help with routing?","a":"One directly relevant recipient only","b":"Two genuinely relevant stakeholders, introduced transparently","status":"planned","notes":"CC is not a pressure tactic. Do not include unrelated executives or use mass CC."},{"id":"sender","name":"Sender presentation: authentic identity","question":"Does a consistent professional signature outperform a shorter personal signature?","a":"Real sender name + function + legitimate business affiliation","b":"Same real sender name + brief human signoff","status":"planned","notes":"Never claim to be a woman, colleague, or employee who is not actually sending the email."},{"id":"followup","name":"Follow-up approach","question":"Does a useful new detail improve reply quality compared with a simple reminder?","a":"One new concrete observation or offer of a useful example","b":"Short courteous reminder referring to the original message","status":"planned","notes":"Honor no-contact requests; avoid repetitive nudges."}];
  const VIEWS = {
    intake:['Intake & approvals.','Review verified opportunities, approve contacts and messages, then advance each item.'],
    overview:['Your opportunity dashboard.','Every opportunity, conversation, and next action in one place.'],
    career:['Employment.','Track jobs, applications, recruiters, and next steps.'],
    business:['Business Development.','Find and nurture consulting clients and commercial opportunities.'],
    networking:['Networking.','Build genuine professional connections and follow through.'],
    queue:['Ready for a conversation.','Thoughtful outreach, one real relationship at a time.'],
    contacts:['People & companies.','Your growing directory of meaningful opportunities.'],
    pipeline:['Opportunity pipeline.','A clear picture of every conversation in motion.'],
    followups:['Stay in the conversation.','Thoughtful follow-through without losing track.'],
    insights:['Learn what works.','Actual sends, human replies, and useful outcomes.'],
    strategies:['Strategy Lab.','Track hypotheses, run controlled tests, and learn by industry.']
  };
  const $ = id => document.getElementById(id);
  let state = null, encryptionKey = null, salt = null, activeView = 'overview', editingId = null, pendingSendId = null, editingStrategyId = null, pendingReplyRecord = null, pendingReplyEvidence = null;
  let replyReviewResult = null, replyReviewError = '', replyReviewWorking = false;
  let filter = {query:'', type:'All', stage:'All'};
  let lastActivityAt = Date.now();
  const encoder = new TextEncoder(), decoder = new TextDecoder();
  const isoLocal = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const initials = value => String(value||'?').split(/\s+/).slice(0,2).map(word=>word[0]?.toUpperCase()||'').join('') || '?';
  const bytesToB64 = bytes => {let s='';for(let i=0;i<bytes.length;i+=8192) s+=String.fromCharCode(...bytes.subarray(i,i+8192)); return btoa(s);};
  const b64ToBytes = b64 => Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
  const today = () => isoLocal();
  const randomId = () => crypto.randomUUID();
  const safeUrl = value => {try{const u=new URL(String(value||''));return ['http:','https:'].includes(u.protocol)?u.href:null;}catch{return null;}};
  const validMail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value||''));
  const formatted = value => {if(!value)return '—'; const d=new Date(value.includes('T')?value:`${value}T12:00:00`);return Number.isNaN(d.valueOf())?'—':d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});};
  const timeFormatted = value => {if(!value)return '';const d=new Date(value);return Number.isNaN(d.valueOf())?'':d.toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});};
  const byNewest = items => [...items].sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')));
  const findRecord = id => state?.records.find(r=>r.id===id);
  const activity = (recordId,kind,summary,snapshot='',meta=null) => state.activities.unshift({id:randomId(),recordId,kind,summary,snapshot,meta,at:new Date().toISOString()});
  const workdaysFrom = (start,amount) => {let d=new Date(`${start}T12:00:00`),left=amount;while(left>0){d.setDate(d.getDate()+1);if(d.getDay()!==0&&d.getDay()!==6)left--;}return isoLocal(d);};
  const isActive = r => !r.optedOut&&!['Closed','Won','Rejected','Withdrawn'].includes(r.stage);
  const isDue = r => isActive(r)&&r.followup&&r.followup<=today();
  const isReady = r => !r.optedOut&&r.draft?.trim()&&!['Contacted','Responded','Concept Shared','Interested','Meeting Booked','Proposal','Won','Closed'].includes(r.stage);
  const isSent = rec => state.activities.some(a=>a.recordId===rec.id&&a.kind==='sent');
  const isReply = rec => state.activities.some(a=>a.recordId===rec.id&&a.kind==='replied');
  const humanReplyEvent = rec => state.activities.find(a=>a.recordId===rec.id&&a.kind==='replied');
  const firstSendEvent = rec => [...state.activities].reverse().find(a=>a.recordId===rec.id&&a.kind==='sent');
  const ensureStrategies = () => { if(!Array.isArray(state.strategies))state.strategies=STRATEGY_STARTERS.map(x=>({...x})); };
  const pct = (n,d) => d ? (100*n/d).toFixed(1)+'%' : '—';
  const stat = () => {
    const records=state.records;
    const sent=state.activities.filter(a=>a.kind==='sent').length;
    const replies=records.filter(isReply).length;
    const contacted=records.filter(isSent).length;
    return {total:records.length, ready:records.filter(isReady).length, due:records.filter(isDue).length, sent, replies, contacted, won:records.filter(r=>r.stage==='Won').length};
  };
  function setAuthMode(){
    const exists=!!localStorage.getItem(STORAGE_KEY);
    $('unlock-title').innerHTML=exists?'Welcome <em>back.</em>':'Your outreach,<br><em>organized.</em>';
    $('unlock-description').textContent=exists?'Enter your vault passphrase to unlock your private records on this device.':'Create your encrypted browser-local workspace. No account or paid service required.';
    $('confirm-pass-field').hidden=exists;
    $('vault-confirm').required=!exists;
    $('vault-submit').textContent=exists?'Unlock my workspace ↗':'Create my private workspace ↗';
    $('vault-pass').autocomplete=exists?'current-password':'new-password';
      }
  async function deriveKey(passphrase,saltBytes){
    const base=await crypto.subtle.importKey('raw',encoder.encode(passphrase),'PBKDF2',false,['deriveKey']);
    return crypto.subtle.deriveKey({name:'PBKDF2',salt:saltBytes,iterations:ITERATIONS,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  }
  async function writeVault(){
    if(!state||!encryptionKey||!salt)throw Error('Vault is locked');
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const plaintext=encoder.encode(JSON.stringify(state));
    const cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},encryptionKey,plaintext));
    localStorage.setItem(STORAGE_KEY,JSON.stringify({version:1,kdf:'PBKDF2-SHA256',iterations:ITERATIONS,salt:bytesToB64(salt),iv:bytesToB64(iv),ciphertext:bytesToB64(cipher)}));
  }
  async function openVault(passphrase){
    const stored=localStorage.getItem(STORAGE_KEY);
    if(stored){
      const saved=JSON.parse(stored);
      if(saved.version!==1||!saved.salt||!saved.iv||!saved.ciphertext)throw Error('Unsupported or corrupted vault file.');
      salt=b64ToBytes(saved.salt);encryptionKey=await deriveKey(passphrase,salt);
      const plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64ToBytes(saved.iv)},encryptionKey,b64ToBytes(saved.ciphertext));
      const restored=JSON.parse(decoder.decode(plaintext));
      if(!restored||!Array.isArray(restored.records)||!Array.isArray(restored.activities))throw Error('Invalid vault data');
      state=restored;
    }else{
      if(passphrase.length<12)throw Error('Use a passphrase of at least 12 characters.');
      salt=crypto.getRandomValues(new Uint8Array(16));encryptionKey=await deriveKey(passphrase,salt);
      state={version:1,createdAt:new Date().toISOString(),records:[],activities:[],strategies:STRATEGY_STARTERS.map(x=>({...x}))};
      await writeVault();
    }
    $('vault-pass').value='';$('vault-confirm').value='';
    $('unlock-screen').hidden=true;$('app-shell').hidden=false;
    lastActivityAt=Date.now();navigate('overview');window.LeviCloud?.onVaultOpen?.();
  }
  function lockVault(){state=null;encryptionKey=null;salt=null;pendingSendId=null;editingId=null;$('app-shell').hidden=true;$('unlock-screen').hidden=false;setAuthMode();window.LeviCloud?.onLock?.();}
  async function persist(){await writeVault();render();window.LeviCloud?.onLocalWrite?.();}
  function notify(message){let n=document.querySelector('.toast');if(n)n.remove();n=document.createElement('div');n.className='toast';n.textContent=message;Object.assign(n.style,{position:'fixed',bottom:'24px',right:'24px',background:'#caff67',color:'#0b121b',padding:'13px 19px',zIndex:'40',fontWeight:'700',borderRadius:'11px',boxShadow:'0 10px 40px #0007',maxWidth:'min(450px,calc(100vw - 34px))'});document.body.append(n);setTimeout(()=>n.remove(),3400);}
  const metricCard=(name,value,note)=>`<div class="metric-card"><small>${escapeHtml(name)}</small><strong>${escapeHtml(value)}</strong><div class="metric-hint">${escapeHtml(note)}</div></div>`;
  const cardHead=(title,view,actionText)=>`<div class="card-head"><h2>${escapeHtml(title)}</h2>${view?`<button class="button-ghost quiet-link" data-nav="${view}">${escapeHtml(actionText||'View all')} ↗</button>`:''}</div>`;
  const empty=(title,details,action)=>`<div class="empty"><div class="empty-icon">↗</div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(details)}</p>${action?`<button class="button button-primary button-small" data-action="new">+ Add first opportunity</button>`:''}</div>`;
  function recordRow(r){return `<div class="lead-row"><div class="avatar">${escapeHtml(initials(r.name))}</div><div class="lead-info"><div class="lead-name">${escapeHtml(r.name)}</div><div class="lead-meta">${escapeHtml(r.type)} · ${escapeHtml(r.location||r.industry||r.channel)} · ${escapeHtml(r.channel)}</div></div><span class="badge ${stageBadge(r.stage)}">${escapeHtml(r.stage)}</span><button data-action="edit" data-id="${r.id}" class="button button-small button-secondary">Open</button></div>`;}
  const stageBadge = stage => ['Won','Interested','Responded'].includes(stage)?'green':['Draft Ready','Contacted'].includes(stage)?'blue':['Proposal','Concept Shared'].includes(stage)?'amber':'';
  function recentActivity(limit=7){return state.activities.slice(0,limit).map(a=>{const r=findRecord(a.recordId);return `<div class="activity-item"><strong>${escapeHtml(a.summary)}</strong><p>${escapeHtml(r?.name||'Removed record')} · ${escapeHtml(timeFormatted(a.at))}</p></div>`;}).join('')||`<p class="small subtle">Activity will appear here as you save, send and receive messages.</p>`;}
  const stageFor = type => type==='Career'?['Discovered','Saved','Researched','Draft Ready','Applied','Contacted','Recruiter Screen','Interview','Offer','Rejected','Withdrawn','Closed']:type==='Networking'?['Discovered','Researched','Draft Ready','Contacted','Responded','Interested','Meeting Booked','Closed']:['Discovered','Researched','Draft Ready','Contacted','Responded','Concept Shared','Interested','Meeting Booked','Proposal','Won','Closed'];
  function syncRecordFormType(){const form=$('record-form'),type=form.elements.type.value;form.querySelectorAll('.career-field').forEach(el=>el.hidden=type!=='Career');const field=form.elements.stage,previous=field.value;field.innerHTML=stageFor(type).map(x=>'<option>'+escapeHtml(x)+'</option>').join('');field.value=stageFor(type).includes(previous)?previous:'Discovered';}
  const isApproved = r => r.intakeReview==='approved';
  const messageIsApproved = r => !!r.draft?.trim()&&!!r.messageApprovedAt&&r.approvedDraft===r.draft&&r.approvedSubject===(r.subject||'')&&r.approvedDestination===(r.channel==='Email'?(r.email||''):(r.profile||''))&&r.approvedCc===(r.cc||'');
  const isUnreviewed = r => !r.intakeReview || r.intakeReview==='pending';
  function reviewableSource(r){
    if(r.type==='Career')return !!safeUrl(r.jobUrl||r.sourceUrl);
    if(r.type==='Networking')return !!safeUrl(r.profile||r.sourceUrl);
    return !!safeUrl(r.sourceUrl)&&['official-site','directory'].includes(r.verification);
  }
  function intake(){
    const all=byNewest(state.records),pending=all.filter(isUnreviewed),approved=all.filter(isApproved),
      readyForMessage=approved.filter(r=>r.draft?.trim()&&!messageIsApproved(r)&&!r.optedOut),
      cleared=approved.filter(r=>messageIsApproved(r)&&!isSent(r)&&!r.optedOut),
      rejected=all.filter(r=>r.intakeReview==='rejected');
    const lane=(title,description,items,actions)=>'<section class="card intake-lane"><div class="card-head"><h2>'+escapeHtml(title)+' <span class="subtle">'+items.length+'</span></h2></div><p class="small subtle">'+escapeHtml(description)+'</p>'+(items.length?items.slice(0,50).map(r=>'<div class="intake-item"><div class="lead-info"><strong>'+escapeHtml(r.jobTitle||r.name)+'</strong><div class="lead-meta">'+escapeHtml(r.name)+' · '+escapeHtml(r.type)+' · '+escapeHtml(r.stage)+'</div>'+(r.sourceUrl||r.jobUrl?'<div class="lead-meta">Source: '+escapeHtml(r.sourceUrl||r.jobUrl)+'</div>':'')+'</div><div class="inline-actions">'+actions(r)+'</div></div>').join(''):'<p class="small subtle">Nothing in this lane.</p>')+'</section>';
    const button=(action,id,label,primary=false)=>'<button type="button" data-action="'+action+'" data-id="'+escapeHtml(id)+'" class="button button-small '+(primary?'button-primary':'button-secondary')+'">'+label+'</button>';
    return '<div class="cards">'+metricCard('Awaiting review',pending.length,'Verify before engaging')+metricCard('Messages to approve',readyForMessage.length,'Human approval required')+metricCard('Ready to engage',cleared.length,'Approved drafts only')+metricCard('Declined',rejected.length,'Excluded from active queue')+'</div><p class="section-intro intake-intro">Assembly line: Discover → Verify → Approve → Prepare → Approve message → Apply or send → Follow up. Imported research is never treated as verified automatically.</p><div class="intake-grid">'+
      lane('1 · Verify opportunities','Check the source, contact details, job eligibility and relevance before approving.',pending,r=>button('edit',r.id,'Review')+button('approvelead',r.id,'Approve',true)+button('rejectlead',r.id,'Decline'))+
      lane('2 · Approve messages','Review the exact text and destination. Editing the message later revokes approval.',readyForMessage,r=>button('edit',r.id,'Edit')+button('approvemessage',r.id,'Approve message',true))+
      lane('3 · Ready to execute','Approved messages can create Gmail drafts or be copied for social. Sends still require confirmation.',cleared,r=>button('gmaildraft',r.id,'Gmail draft')+button('copyopen',r.id,'Copy & open',true))+
      '</div><div class="card" style="margin-top:18px"><div class="card-head"><h2>Import researched opportunities</h2><button class="button button-primary button-small" data-action="import">Import JSON / CSV</button></div><p class="small subtle">New imports enter review, never the send queue. JobOS does not yet automatically retrieve live job or prospect feeds.</p></div>';
  }
  async function approveLead(id){
    const r=findRecord(id);if(!r||r.intakeReview==='approved')return;
    if(!reviewableSource(r))return notify('Add a valid source and verify the contact or posting before approving.');
    if(!confirm('Have you personally checked the source and fit of '+(r.jobTitle||r.name)+'? Approval will make this opportunity eligible for preparation.'))return;
    r.intakeReview='approved';r.reviewedAt=new Date().toISOString();r.updatedAt=r.reviewedAt;
    activity(r.id,'verified','Opportunity reviewed and approved');await persist();notify('Approved for preparation.');
  }
  async function rejectLead(id){
    const r=findRecord(id);if(!r||!confirm('Decline '+(r.jobTitle||r.name)+' from the intake queue?'))return;
    r.intakeReview='rejected';r.followup='';r.updatedAt=new Date().toISOString();
    activity(r.id,'declined','Opportunity declined during review');await persist();
  }
  async function approveMessage(id){
    const r=findRecord(id);if(!r||!isApproved(r))return notify('Approve the opportunity first.');
    if(r.optedOut||!r.draft?.trim()||!destinationFor(r))return notify('A message, verified destination and active contact are required.');
    if(!confirm('Approve this exact message and recipient for '+r.name+'? Later edits require reapproval.'))return;
    r.approvedDraft=r.draft;r.approvedSubject=r.subject||'';r.approvedCc=r.cc||'';
    r.approvedDestination=r.channel==='Email'?(r.email||''):(r.profile||'');
    r.messageApprovedAt=new Date().toISOString();r.updatedAt=r.messageApprovedAt;
    activity(r.id,'message-approved','Message approved for manual sending');await persist();
  }
  const workspaceType = view => ({career:'Career',business:'Business',networking:'Networking'})[view];
  const workspaceRecords = view => state.records.filter(r=>view==='business'?['Business','Collaboration'].includes(r.type):r.type===workspaceType(view));
  function workspace(view){
    const records=workspaceRecords(view), previous=filter.type;
    filter.type=view==='business'?'All':workspaceType(view);
    const list=byNewest(records).filter(r=>[r.name,r.jobTitle,r.location,r.person,r.email,r.notes,r.angle].join(' ').toLowerCase().includes(filter.query.toLowerCase()));
    const sent=list.filter(isSent).length,due=list.filter(isDue).length;
    const career=view==='career',business=view==='business';
    const stages=career?['Discovered','Saved','Researched','Draft Ready','Applied','Contacted','Recruiter Screen','Interview','Offer','Rejected','Withdrawn','Closed']:business?['Discovered','Researched','Draft Ready','Contacted','Responded','Interested','Meeting Booked','Proposal','Won','Closed']:['Discovered','Researched','Draft Ready','Contacted','Responded','Interested','Meeting Booked','Closed'];
    const grid=list.length?'<div class="pipeline">'+stages.map(stage=>'<section class="pipeline-column"><h3>'+escapeHtml(stage)+' <span class="subtle">'+list.filter(r=>r.stage===stage).length+'</span></h3>'+list.filter(r=>r.stage===stage).map(r=>'<button class="pipeline-card" data-action="edit" data-id="'+escapeHtml(r.id)+'"><strong>'+escapeHtml(r.jobTitle||r.name)+'</strong><span>'+escapeHtml(r.name+(r.jobTitle?' · '+r.stage:''))+'</span></button>').join('')+'</section>').join('')+'</div>':empty('No opportunities here yet',career?'Add a job manually. Automated job discovery is not connected yet.':'Add your first relationship or opportunity.',true);
    const careerActions=career?'<div class="card job-discovery"><div class="card-head"><h2>Job discovery inbox</h2><button class="button button-secondary button-small" data-action="import">Import jobs (CSV / JSON)</button></div><p class="small subtle">Import verified listings from Career Radar or another source. No automatic job feed connected yet.</p><div class="job-list">'+(list.length?list.slice(0,15).map(r=>'<div class="job-row"><div class="lead-info"><strong>'+escapeHtml(r.jobTitle||'Job title needed')+'</strong><div class="lead-meta">'+escapeHtml(r.name)+' · '+escapeHtml(r.salary||'Salary not supplied')+' · '+escapeHtml(r.location||'Location not supplied')+'</div><div class="lead-meta">'+escapeHtml(r.stage)+(r.appliedDate?' · Applied '+escapeHtml(formatted(r.appliedDate)):'')+'</div></div><div class="row-actions">'+(safeUrl(r.jobUrl)?'<a class="button button-secondary button-small" href="'+escapeHtml(safeUrl(r.jobUrl))+'" target="_blank" rel="noopener noreferrer">Posting ↗</a>':'')+(!['Applied','Recruiter Screen','Interview','Offer','Rejected','Withdrawn','Closed'].includes(r.stage)?'<button class="button button-primary button-small" data-action="applied" data-id="'+escapeHtml(r.id)+'">Mark applied</button>':'')+'<button class="button button-secondary button-small" data-action="edit" data-id="'+escapeHtml(r.id)+'">Details</button></div></div>').join(''):'<p class="small subtle">No jobs tracked yet. Import listings or add a job manually.</p>')+'</div></div>':'';
    filter.type=previous;
    return '<div class="cards">'+metricCard('Opportunities',records.length,'In this workspace')+metricCard(career?'Applied':'Messages sent',career?records.filter(r=>['Applied','Recruiter Screen','Interview','Offer'].includes(r.stage)).length:sent,career?'Recorded application stages':'Confirmed sends')+metricCard('Follow-ups due',due,'Today or overdue')+metricCard(career?'Interviews':'Replies',career?records.filter(r=>r.stage==='Interview').length:records.filter(isReply).length,'Confirmed outcomes')+'</div><div class="workspace-toolbar"><p class="section-intro">'+(career?'Add and manage verified job opportunities. Job discovery feed and existing Career database import are upcoming integration work.':'Manage records and outreach here. Each workspace shares the same encrypted vault and communication history.')+'</p><button class="button button-primary button-small" data-action="new" data-type="'+(career?'Career':business?'Business':'Networking')+'">+ Add '+(career?'job':'opportunity')+'</button></div><div class="toolbar"><input id="search-input" placeholder="Search this workspace..." aria-label="Search workspace" value="'+escapeHtml(filter.query)+'"></div>'+careerActions+grid;
  }
  function overview(){
    const all=state.records,s=stat(),due=all.filter(isDue).sort((a,b)=>a.followup.localeCompare(b.followup));
    const awaiting=all.filter(isUnreviewed).length,approvals=all.filter(r=>isApproved(r)&&r.draft?.trim()&&!messageIsApproved(r)).length;
    const groups=[['Employment','career',workspaceRecords('career')],['Business Development','business',workspaceRecords('business')],['Networking','networking',workspaceRecords('networking')]];
    const pending=byNewest(all.filter(r=>r.type==='Career'&&['Discovered','Saved','Researched','Draft Ready'].includes(r.stage)));
    const drafts=byNewest(all.filter(r=>r.type!=='Career'&&isReady(r)&&!messageIsApproved(r)));
    const tasks='<section class="card"><div class="card-head"><h2>Next best actions</h2><span class="badge">'+(due.length+pending.length+drafts.length)+' queued</span></div>'+
      (due.length?'<h3 class="action-group-heading">Follow-ups due</h3>'+due.slice(0,4).map(recordRow).join(''):'')+
      (pending.length?'<h3 class="action-group-heading">Jobs to review / apply</h3>'+pending.slice(0,4).map(recordRow).join(''):'')+
      (drafts.length?'<h3 class="action-group-heading">Outreach drafts ready</h3>'+drafts.slice(0,3).map(recordRow).join(''):'')+
      (!due.length&&!pending.length&&!drafts.length?empty('Nothing urgent','No due follow-ups or prepared actions.',false):'')+'</section>';
    return '<div class="cards">'+metricCard('All opportunities',s.total,'Across three workspaces')+metricCard('Jobs applied',all.filter(r=>r.type==='Career'&&['Applied','Recruiter Screen','Interview','Offer'].includes(r.stage)).length,'Current application stages')+metricCard('Messages sent',s.sent,'Confirmed sends only')+metricCard('Follow-ups due',s.due,'Today or overdue')+'</div>'+
      '<div class="intake-banner"><div><strong>Assembly line</strong><span>'+awaiting+' opportunities to verify · '+approvals+' messages to approve</span></div><button type="button" class="button button-primary button-small" data-nav="intake">Open intake →</button></div>'+
      '<div class="workspace-grid">'+groups.map(([label,view,records])=>'<button type="button" data-nav="'+view+'" class="card workspace-tile"><div class="eyebrow">'+escapeHtml(label)+'</div><strong>'+records.length+'</strong><span>tracked opportunities</span><small>'+records.filter(isDue).length+' follow-ups due · Open workspace ↗</small></button>').join('')+'</div>'+
      '<div class="main-grid">'+tasks+'<section class="card">'+cardHead('Recent activity',null)+recentActivity(7)+'</section></div>';
  }
  function filtered(){return byNewest(state.records).filter(r=>(filter.type==='All'||r.type===filter.type)&&(filter.stage==='All'||r.stage===filter.stage)&&[r.name,r.industry,r.location,r.person,r.email,r.notes,r.angle].join(' ').toLowerCase().includes(filter.query.toLowerCase()));}
  function toolbar({includeStage=true}={}){return `<div class="toolbar"><input id="search-input" placeholder="Search companies, contacts, notes..." aria-label="Search opportunities" value="${escapeHtml(filter.query)}"><select id="type-filter" aria-label="Filter category"><option ${filter.type==='All'?'selected':''}>All</option>${['Business','Career','Networking','Collaboration'].map(t=>`<option ${filter.type===t?'selected':''}>${t}</option>`).join('')}</select>${includeStage?`<select id="stage-filter" aria-label="Filter stage"><option ${filter.stage==='All'?'selected':''}>All</option>${STAGES.map(t=>`<option ${filter.stage===t?'selected':''}>${escapeHtml(t)}</option>`).join('')}</select>`:''}</div>`;}
  function destinationFor(r){if(r.channel==='Email'&&validMail(r.email)){let url='https://mail.google.com/mail/?view=cm&fs=1&to='+encodeURIComponent(r.email);if(r.subject)url+='&su='+encodeURIComponent(r.subject);if(r.draft)url+='&body='+encodeURIComponent(r.draft);if(r.cc)url+='&cc='+encodeURIComponent(r.cc);return url;} if(['LinkedIn','Instagram','Other'].includes(r.channel))return safeUrl(r.profile);return null;}
  function opportunityCard(r){const available=!!destinationFor(r);const already=isSent(r),approved=isApproved(r)&&messageIsApproved(r);return `<article class="card opportunity"><div class="top"><div><div class="eyebrow" style="margin:0 0 8px">${escapeHtml(r.type)} · ${escapeHtml(r.channel)}</div><h3>${escapeHtml(r.name)}</h3><p class="subtitle">${escapeHtml([r.industry,r.location].filter(Boolean).join(' · ')||'No location added')}</p></div><span class="badge ${stageBadge(r.stage)}">${escapeHtml(r.stage)}</span></div>${r.sourceUrl?`<p class="small subtle">Research source: <a target="_blank" rel="noopener noreferrer" href="${escapeHtml(safeUrl(r.sourceUrl)||'#')}">Open verified page ↗</a>${r.researchDate?' · '+escapeHtml(r.researchDate):''}</p>`:''}${r.angle?`<p class="angle">${escapeHtml(r.angle)}</p>`:''}<div class="draft-preview">${escapeHtml(r.draft?.trim()||'No message prepared yet. Open this opportunity to add a personalized draft.')}</div><div class="card-foot"><button class="button button-primary button-small" data-action="copyopen" data-id="${r.id}" ${!available||!r.draft?.trim()||!approved?'disabled title="Add a message and a valid destination first"':''}>Copy & Open ↗</button>${r.channel==="Email" ? `<button class="button button-secondary button-small" data-action="gmaildraft" data-id="${r.id}" ${!approved?'disabled title="Approve current message in Intake first"':''}>Gmail Draft</button>` : ""}<button class="button button-secondary button-small" data-action="edit" data-id="${r.id}">Edit draft</button><button class="button button-secondary button-small" data-action="reply" data-id="${r.id}" ${!already?'disabled title="Confirm a send first"':''}>Record reply</button></div>${!available?`<p class="small subtle" style="margin:0">Add a verified ${r.channel==='Email'?'email address':'profile URL'} to enable Copy & Open.</p>`:''}</article>`;}
  function queue(){const cards=filtered().filter(r=>r.draft?.trim());return `${toolbar()}<p class="section-intro">Review each draft, copy the message and open its destination. You'll confirm the send manually afterward. No messages are sent automatically.</p>${cards.length?`<div class="opportunity-grid">${cards.map(opportunityCard).join('')}</div>`:empty('No drafted messages yet','Create an opportunity and write or paste a message. It will appear in this outreach queue.',true)}`;}
  function contacts(){const rows=filtered();return `${toolbar()}<div class="card"><div class="card-head"><h2>${rows.length} opportunit${rows.length===1?'y':'ies'}</h2><button class="button button-secondary button-small" data-action="import">Import JSON / CSV</button></div>${rows.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>Organization</th><th>Category</th><th>Channel</th><th>Stage</th><th>Next follow-up</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr><td><strong>${escapeHtml(r.name)}</strong><span class="table-muted">${escapeHtml(r.person||r.location||r.industry||'No contact added')}</span></td><td>${escapeHtml(r.type)}</td><td>${escapeHtml(r.channel)}</td><td><span class="badge ${stageBadge(r.stage)}">${escapeHtml(r.stage)}</span></td><td>${escapeHtml(formatted(r.followup))}</td><td><button data-action="edit" data-id="${r.id}" class="table-link">Open ↗</button></td></tr>`).join('')}</tbody></table></div>`:empty('No opportunities match','Try changing your filters or adding a new prospect.',true)}</div>`;}
  function pipeline(){const records=filtered();return `${toolbar()}<p class="section-intro">Every stage is set deliberately. Drafts and replies never silently move an opportunity.</p><div class="pipeline">${STAGES.map(s=>{const list=records.filter(r=>r.stage===s);return `<section class="pipeline-column"><h3>${escapeHtml(s)} <span class="subtle">${list.length}</span></h3>${list.map(r=>`<button class="pipeline-card" data-action="edit" data-id="${r.id}"><strong>${escapeHtml(r.name)}</strong><span>${escapeHtml(r.type)} · ${escapeHtml(r.channel)}</span></button>`).join('')||'<p class="pipeline-muted">No records</p>'}</section>`;}).join('')}</div>`;}
  function followups(){const active=state.records.filter(r=>isActive(r)&&r.followup).sort((a,b)=>a.followup.localeCompare(b.followup));const due=active.filter(isDue);const upcoming=active.filter(r=>!isDue(r));const segment=(items,title)=>`<div class="card">${cardHead(`${title} · ${items.length}`,null)}${items.length?items.map(r=>`<div class="lead-row"><div class="avatar">◷</div><div class="lead-info"><div class="lead-name">${escapeHtml(r.name)}</div><div class="lead-meta">${escapeHtml(formatted(r.followup))} · ${escapeHtml(r.stage)} · ${escapeHtml(r.channel)}</div></div><button class="button button-secondary button-small" data-action="edit" data-id="${r.id}">Open</button><button class="button button-ghost button-small" data-action="snooze" data-id="${r.id}">+5 days</button></div>`).join(''):empty('Nothing to follow up on','Follow-up dates are scheduled after you confirm a send, or can be entered manually.',false)}</div>`;return `<p class="section-intro">LeviOS reminds you; it never sends an automatic follow-up. Replied, won and closed opportunities are excluded when appropriate.</p><div class="main-grid"><div>${segment(due,'Due now')}</div><div>${segment(upcoming,'Upcoming')}</div></div>`;}
function replyReviewPanel(){
  const eligible=state.records.filter(r=>r.channel==='Email'&&isSent(r)&&!isReply(r)&&!r.optedOut&&r.email?.toLowerCase()!=='levivanstap@gmail.com');
  const groups=replyReviewResult?.reviewed||[];
  const rows=groups.map(g=>{
    const r=findRecord(g.recordId);if(!r)return '';
    const hits=g.matched.map(m=>'<div class="lead-row"><div class="lead-info"><strong>'+escapeHtml(r.name)+'</strong><div class="lead-meta">'+escapeHtml(m.subject||'(No subject)')+' · '+escapeHtml(timeFormatted(m.receivedAt))+' · same Gmail thread</div></div><button class="button button-small button-primary" data-action="classifyreply" data-id="'+escapeHtml(r.id)+'" data-message="'+escapeHtml(m.messageId)+'">Classify</button></div>').join('');
    return hits||'<div class="lead-row"><div class="lead-info"><strong>'+escapeHtml(r.name)+'</strong><div class="lead-meta">No matching reply found'+(g.uncheckedInbound?' · '+g.uncheckedInbound+' unrelated incoming message(s) ignored':'')+(g.outboundFound?'':' · no sent message matched')+(g.truncated?' · results truncated':'')+'</div></div></div>';
  }).join('');
  return '<section class="card" style="margin-top:20px"><div class="card-head"><h2>Gmail reply review</h2><button class="button button-primary button-small" data-action="scanreplies" '+(replyReviewWorking||!eligible.length?'disabled':'')+'>'+(replyReviewWorking?'Checking…':'Scan Gmail for replies')+'</button></div><p class="small subtle">Read-only check of 12 manually confirmed sent prospects; counts only inbound messages matching a real Gmail Sent thread. No message bodies are read. You decide whether the reply was positive, negative, neutral or automated.</p><p class="small subtle">'+eligible.length+' eligible record(s) · '+Math.max(0,eligible.length-12)+' beyond scan limit. No automatic polling.</p>'+(replyReviewError?'<p class="error">'+escapeHtml(replyReviewError)+'</p>':'')+(replyReviewResult?'<p class="small subtle">'+groups.reduce((n,g)=>n+g.matched.length,0)+' candidate(s) for human review.</p>'+rows:'<p class="small subtle">Confirm real sends inside Outreach Queue before scanning.</p>')+'</section>';
}
async function scanReplies(){
  if(replyReviewWorking)return;
  const records=state.records.filter(r=>r.channel==='Email'&&isSent(r)&&!isReply(r)&&!r.optedOut&&r.email?.toLowerCase()!=='levivanstap@gmail.com').map(r=>({id:r.id,email:r.email,sentAt:firstSendEvent(r)?.at})).filter(r=>r.sentAt).sort((a,b)=>b.sentAt.localeCompare(a.sentAt)).slice(0,12);
  replyReviewError='';replyReviewResult=null;replyReviewWorking=true;render();
  try{if(!window.LeviCloud?.reviewReplies)throw Error('Gmail review unavailable. Refresh the app.');replyReviewResult=await window.LeviCloud.reviewReplies(records);}
  catch(e){replyReviewError=e.message||'Unable to inspect Gmail replies';}
  finally{replyReviewWorking=false;render();}
}
function showReplyModal(id,messageId=''){
  const r=findRecord(id);if(!r||!isSent(r)||isReply(r))return notify('Only unclassified sent contacts can be reviewed.');
  pendingReplyRecord=r.id;pendingReplyEvidence=String(messageId||'').slice(0,100);
  $('reply-record-label').textContent=r.name+(pendingReplyEvidence?' · matched Gmail conversation':' · manual entry');
  $('reply-form').reset();$('reply-error').textContent='';$('reply-modal').showModal();
}
async function saveReplyReview(e){
  e.preventDefault();const r=findRecord(pendingReplyRecord);if(!r||!isSent(r)||isReply(r))return;
  const outcome=String($('reply-outcome').value||''),notes=String($('reply-notes').value||'').trim().slice(0,1000);
  if(!['positive','neutral','negative','optout','automatic'].includes(outcome))return;
  const meta={outcome,source:pendingReplyEvidence?'matched_gmail_thread':'manual',gmailMessageId:pendingReplyEvidence||null};
  if(outcome==='automatic')activity(r.id,'automated','Automated response excluded from human metrics',notes,meta);
  else{activity(r.id,'replied','Human reply: '+outcome,notes,meta);r.stage=outcome==='positive'?'Interested':outcome==='neutral'?'Responded':'Closed';if(outcome==='optout')r.optedOut=true;r.followup='';}
  r.updatedAt=new Date().toISOString();$('reply-modal').close();pendingReplyRecord=null;pendingReplyEvidence=null;
  await persist();notify(outcome==='automatic'?'Automatic reply excluded.':'Reply classification saved.');
}
  function insights(){const s=stat();const responseRate=s.contacted?Math.round(s.replies/s.contacted*100):0;const grouped=Object.entries(state.records.reduce((obj,r)=>{obj[r.type]=(obj[r.type]||0)+1;return obj;},{}));return `<div class="cards">${metricCard('Confirmed sends',s.sent,'Including repeat outreach')}${metricCard('People contacted',s.contacted,'Unique records with sends')}${metricCard('Records with replies',s.replies,'Recorded manually')}${metricCard('Clients / wins',s.won,'Confirmed stage only')}</div><div class="insights-grid"><div class="card">${cardHead('Outreach response rate',null)}<h3 style="font-size:42px;margin:4px 0">${responseRate}%</h3><p class="small subtle">${s.replies} record${s.replies!==1?'s':''} with replies / ${s.contacted} contacted. With small samples, avoid drawing strong conclusions.</p><div class="progress-bar"><span style="width:${responseRate}%"></span></div><h3 class="section-heading">Current tracked categories</h3>${grouped.length?grouped.map(([category,num])=>`<div class="lead-row"><div class="lead-info"><div class="lead-name">${escapeHtml(category)}</div></div><span class="badge">${num}</span></div>`).join(''):'<p class="small subtle">No records added yet.</p>'}</div><div class="card">${cardHead('Data & backups',null)}<p class="small subtle" style="line-height:1.8">Your private records are encrypted on this device using your vault passphrase. GitHub only hosts the app code. Encrypted Supabase cloud sync is available. Export backups before replacing any revision.</p><div class="inline-actions"><button class="button button-primary button-small" data-action="backup">Download encrypted backup</button><button class="button button-secondary button-small" data-action="import">Import data</button><button class="button button-secondary button-small" data-action="csv">Export CSV</button></div><p class="small subtle" style="margin-top:18px">CSV exports are unencrypted. Handle them as private files. Encrypted backup files require your original passphrase.</p><div class="card" style="background:#101b25;padding:15px;margin-top:22px"><strong>Cloud & Gmail connection</strong><p class="small subtle" style="line-height:1.6;margin:8px 0 0">Gmail connection and encrypted cloud sync are available under Cloud & Gmail. Reply review requires manual confirmation.</p></div></div></div>`+replyReviewPanel();}
function strategiesView(){
  ensureStrategies();
  const sent=state.records.filter(r=>isSent(r)&&r.id!=='levios-gmail-draft-test-v1');
  const humans=sent.filter(isReply), positives=sent.filter(r=>humanReplyEvent(r)?.meta?.outcome==='positive');
  const meetings=sent.filter(r=>r.stage==='Meeting Booked'||r.stage==='Won');
  const segment=new Map();
  for(const r of sent){
    const k=firstSendEvent(r)?.meta?.industry||r.industry||'Unspecified industry';
    if(!segment.has(k))segment.set(k,{n:0,replies:0,positive:0,meetings:0});
    const x=segment.get(k);x.n++;if(isReply(r))x.replies++;if(humanReplyEvent(r)?.meta?.outcome==='positive')x.positive++;if(r.stage==='Meeting Booked'||r.stage==='Won')x.meetings++;
  }
  const industryRows=[...segment.entries()].sort((a,b)=>b[1].n-a[1].n).map(([name,x])=>'<tr><td>'+escapeHtml(name)+'</td><td>'+x.n+'</td><td>'+pct(x.replies,x.n)+'</td><td>'+pct(x.positive,x.n)+'</td><td>'+x.meetings+'</td></tr>').join('');
  const cards=state.strategies.map(s=>{
    const snapshot=sent.map(r=>({r,e:firstSendEvent(r)})).filter(x=>x.e?.meta?.strategyId===s.id&&['A','B'].includes(x.e.meta.variant));
    const summarize=v=>{const cohort=snapshot.filter(x=>x.e.meta.variant===v);return {n:cohort.length, replies:cohort.filter(x=>isReply(x.r)).length, positive:cohort.filter(x=>humanReplyEvent(x.r)?.meta?.outcome==='positive').length};};
    const A=summarize('A'),B=summarize('B');
    const arm=(v,desc,x)=>'<div class="lab-arm"><strong>'+v+' · '+escapeHtml(desc)+'</strong><p class="small subtle">'+x.n+' contacted · '+pct(x.replies,x.n)+' human replies · '+pct(x.positive,x.n)+' positive</p></div>';
    return '<article class="card lab-card"><div class="card-head"><div><div class="eyebrow">'+escapeHtml(s.status||'planned')+'</div><h3>'+escapeHtml(s.name)+'</h3></div><button class="button button-secondary button-small" data-action="strategyedit" data-id="'+escapeHtml(s.id)+'">Edit</button></div><p class="small">'+escapeHtml(s.question)+'</p><div class="lab-arms">'+arm('A',s.a,A)+arm('B',s.b,B)+'</div><p class="small subtle">'+escapeHtml(s.notes||'No notes yet')+'</p><p class="small subtle">'+(Math.min(A.n,B.n)<25?'Exploratory: too few prospects per variant to declare a winner.':'Compare cohorts within the same industry before interpreting the difference.')+'</p></article>';
  }).join('');
  return '<div class="cards">'+metricCard('People contacted',sent.length,'Unique records, not emails')+metricCard('Human replies',humans.length,pct(humans.length,sent.length)+' per contact')+metricCard('Positive replies',positives.length,pct(positives.length,sent.length)+' per contact')+metricCard('Meetings / wins',meetings.length,'Confirmed stage only')+'</div>'+
   '<section class="card lab-intro"><div class="card-head"><h2>Experiment library</h2><button class="button button-primary button-small" data-action="strategynew">+ New experiment</button></div><p class="small subtle">Use A/B variations against comparable prospects in the same industry. Change one variable, alternate assignments, and confirm actual sends. Rates are descriptive, not proof of causality. Reply labels are always human-reviewed.</p></section>'+
   '<div class="lab-grid">'+cards+'</div>'+
   '<section class="card"><div class="card-head"><h2>Performance by industry</h2></div><p class="small subtle">Based on confirmed unique contacts. Positive requires your explicit classification; opens and clicks are deliberately excluded.</p><div class="table-wrap"><table class="data-table"><thead><tr><th>Industry</th><th>Sent</th><th>Human reply rate</th><th>Positive reply rate</th><th>Meetings / wins</th></tr></thead><tbody>'+(industryRows||'<tr><td colspan="5">No confirmed real prospect sends yet.</td></tr>')+'</tbody></table></div></section>';
}
function editStrategy(id=null){
  ensureStrategies();editingStrategyId=id;
  const s=id?state.strategies.find(x=>x.id===id):null;
  if(id&&!s)return;
  $('strategy-title').textContent=s?'Edit experiment':'New experiment';
  $('strategy-form').reset();
  for(const el of $('strategy-form').elements){if(el.name&&s&&Object.hasOwn(s,el.name))el.value=s[el.name]??'';}
  $('strategy-error').textContent='';
  $('strategy-modal').showModal();
}
async function saveStrategy(e){
  e.preventDefault();const raw=Object.fromEntries(new FormData(e.currentTarget).entries());
  const name=String(raw.name||'').trim(),question=String(raw.question||'').trim(),a=String(raw.a||'').trim(),b=String(raw.b||'').trim(),notes=String(raw.notes||'').trim();
  if(!name||!question||!a||!b){$('strategy-error').textContent='Name, hypothesis and both variants are required.';return;}
  if([name,question,a,b,notes].some(x=>x.length>1500)){$('strategy-error').textContent='One or more descriptions are too long.';return;}
  const strategy={id:editingStrategyId||randomId(),name,question,a,b,notes,status:['planned','active','paused','archived'].includes(raw.status)?raw.status:'planned'};
  const idx=state.strategies.findIndex(x=>x.id===strategy.id);
  if(idx>=0)state.strategies[idx]=strategy;else state.strategies.push(strategy);
  await persist();$('strategy-modal').close();notify('Strategy saved in your encrypted vault.');
}
  function navigate(view){activeView=VIEWS[view]?view:'overview';filter={query:'',type:'All',stage:'All'};render();$('main-content').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
  function render(){if(!state)return;ensureStrategies();const [title,subtitle]=VIEWS[activeView];$('top-view').textContent=activeView.toUpperCase();$('page-title').innerHTML=escapeHtml(title.replace(/\.$/,''))+'<span class="lime-dot">.</span>';$('page-subtitle').textContent=subtitle;$('eyebrow').textContent=new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'}).toUpperCase();const s=stat();$('nav-ready').textContent=s.ready;$('nav-due').textContent=s.due;document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===activeView));$('view-root').innerHTML=({overview,intake,career:()=>workspace('career'),business:()=>workspace('business'),networking:()=>workspace('networking'),queue,contacts,pipeline,followups,insights,strategies:strategiesView}[activeView])();}
  function editRecord(id=null,type=null){ensureStrategies();editingId=id;const r=id?findRecord(id):null;$('record-title').textContent=r?'Edit opportunity':'New opportunity';$('delete-record').hidden=!r;const form=$('record-form');form.reset();if(!r && type)form.elements.type.value=type;else if(!r && workspaceType(activeView))form.elements.type.value=workspaceType(activeView);form.elements.strategyId.innerHTML='<option value="">Not in an experiment</option>'+state.strategies.filter(x=>x.status!=='archived'||x.id===r?.strategyId).map(x=>'<option value="'+escapeHtml(x.id)+'">'+escapeHtml(x.name)+'</option>').join('');for(const el of form.elements){if(el.name&&r&&Object.hasOwn(r,el.name))el.value=r[el.name]??'';}$('record-error').textContent='';$('record-modal').showModal();syncRecordFormType();form.elements.name.focus();}
  function canonical(value){return String(value||'').toLowerCase().trim().replace(/^https?:\/\//,'').replace(/^www\./,'').replace(/\/$/,'');}
  function isDuplicatePair(a,b){if(a.type==='Career'&&b.type==='Career')return (a.jobUrl&&b.jobUrl&&canonical(a.jobUrl)===canonical(b.jobUrl))||(!a.jobUrl&&!b.jobUrl&&a.name.toLowerCase()===b.name.toLowerCase()&&a.jobTitle&&b.jobTitle&&a.jobTitle.toLowerCase()===b.jobTitle.toLowerCase());return a.type===b.type&&((a.email&&b.email&&a.email.toLowerCase()===b.email.toLowerCase())||(a.website&&b.website&&canonical(a.website)===canonical(b.website)&&a.name.toLowerCase()===b.name.toLowerCase()));}
  function duplicate(rec,id){return state.records.some(r=>r.id!==id&&isDuplicatePair(rec,r));}
  function normalized(raw,id,extraStrategyIds=[]){const fields=['name','type','industry','location','person','channel','email','profile','website','stage','followup','concept','angle','subject','draft','notes','strategyId','variant','cc','sourceUrl','researchDate','verification','priority','jobTitle','jobUrl','salary','appliedDate'];const result={};for(const key of fields)result[key]=String(raw[key]||'').trim();if(!result.name)throw Error('Organization name is required.');if(result.name.length>150)throw Error('Organization name is too long.');if(!['Business','Career','Networking','Collaboration'].includes(result.type))result.type='Business';if(!['Email','LinkedIn','Instagram','Other'].includes(result.channel))result.channel='Email';if(!stageFor(result.type).includes(result.stage))result.stage='Discovered';if(!['A','B'].includes(result.variant))result.variant='A';if(result.strategyId&&!state.strategies.some(x=>x.id===result.strategyId)&&!extraStrategyIds.includes(result.strategyId))throw Error('Unknown outreach strategy.');if(result.email&&!validMail(result.email))throw Error('Invalid email address.');const ccAddresses=result.cc?result.cc.split(',').map(x=>x.trim()):[];if(ccAddresses.length>3||ccAddresses.some(x=>!validMail(x)||x.toLowerCase()===result.email.toLowerCase()))throw Error('CC must contain up to three valid, distinct stakeholder emails, excluding the main recipient.');if(new Set(ccAddresses.map(x=>x.toLowerCase())).size!==ccAddresses.length)throw Error('Duplicate CC address.');for(const k of ['profile','website','concept','sourceUrl','jobUrl'])if(result[k]&&!safeUrl(result[k]))throw Error(`Invalid ${k} URL. Only http(s) links are allowed.`);if(result.followup&&!/^\d{4}-\d{2}-\d{2}$/.test(result.followup))throw Error('Follow-up must use YYYY-MM-DD.');if(result.appliedDate&&!/^\d{4}-\d{2}-\d{2}$/.test(result.appliedDate))throw Error('Application date must use YYYY-MM-DD.');if(result.researchDate&&!/^\d{4}-\d{2}-\d{2}$/.test(result.researchDate))throw Error('Research date must use YYYY-MM-DD.');if(!['','official-site','directory','unverified'].includes(result.verification))throw Error('Invalid contact verification label.');if(result.priority&&!/^(100|[1-9]?\d)$/.test(result.priority))throw Error('Research priority must be 0–100.');if(result.draft.length>9000||result.notes.length>4000)throw Error('Draft or notes are too long.');result.id=id||randomId();return result;}
  async function saveRecord(event){event.preventDefault();const form=event.currentTarget;const raw=Object.fromEntries(new FormData(form).entries());try{const rec=normalized(raw,editingId);if(duplicate(rec,editingId))throw Error('Possible duplicate found with the same email or business domain. Check the existing record.');const prior=editingId?findRecord(editingId):null;const now=new Date().toISOString();if(prior&&(prior.sourceUrl!==rec.sourceUrl||prior.jobUrl!==rec.jobUrl||prior.email!==rec.email||prior.profile!==rec.profile||prior.verification!==rec.verification)){rec.intakeReview='pending';rec.reviewedAt='';}if(prior&&(prior.draft!==rec.draft||prior.subject!==rec.subject||prior.channel!==rec.channel||prior.email!==rec.email||prior.profile!==rec.profile||prior.cc!==rec.cc)){rec.messageApprovedAt='';}if(prior){const idx=state.records.findIndex(r=>r.id===editingId);state.records[idx]={...prior,...rec,updatedAt:now};activity(rec.id,'edited','Opportunity updated');}else{state.records.unshift({...rec,intakeReview:'pending',createdAt:now,updatedAt:now});activity(rec.id,'created','Opportunity added');}await persist();$('record-modal').close();notify('Opportunity saved securely.');}catch(err){$('record-error').textContent=err.message;}}
  async function deleteRecord(){if(!editingId)return;const record=findRecord(editingId);if(!confirm(`Delete ${record.name} and its associated activity history? This cannot be undone without a backup.`))return;state.records=state.records.filter(r=>r.id!==editingId);state.activities=state.activities.filter(a=>a.recordId!==editingId);await persist();$('record-modal').close();notify('Record deleted.');}
  async function copyAndOpen(id){const r=findRecord(id);if(!isApproved(r)||!messageIsApproved(r))return notify('Approve the opportunity and current message in Intake first.');if(r?.optedOut)return notify('This prospect opted out. No further outreach.');if(!r||!r.draft?.trim())return notify('Save a draft first.');const target=destinationFor(r);if(!target)return notify('Add a verified email or profile URL first.');window.open(target,'_blank','noopener,noreferrer');try{await navigator.clipboard.writeText(r.draft);notify('Draft copied. Confirm the send only after sending externally.');}catch{notify('Opened destination, but clipboard permission was denied. Copy your draft manually.');}
    pendingSendId=id;$('confirm-desc').textContent=`Did you actually send your ${r.channel} message to ${r.name}? Copying a draft or opening a tab does not count as sending.`;$('confirm-modal').showModal();}
  async function markSent(){const r=findRecord(pendingSendId);if(!r)return;if(r.optedOut){$('confirm-modal').close();pendingSendId=null;return notify('Do not contact: this prospect opted out.');}$('confirm-modal').close();const now=new Date().toISOString();activity(r.id,'sent',`${r.channel} message confirmed sent`,r.draft,{strategyId:r.strategyId||'',variant:r.variant||'',industry:r.industry||'',wordCount:(r.draft||'').trim().split(/\s+/).filter(Boolean).length,subject:r.subject||'',ccCount:r.cc?r.cc.split(',').filter(Boolean).length:0,channel:r.channel});if(['Discovered','Researched','Draft Ready'].includes(r.stage))r.stage='Contacted';if(!r.followup)r.followup=workdaysFrom(today(),5);r.updatedAt=now;pendingSendId=null;await persist();notify('Send recorded. Follow-up scheduled if needed.');}
  async function markApplied(id){const rec=findRecord(id);if(!rec||rec.type!=='Career')return;if(!isApproved(rec))return notify('Verify and approve this job in Intake before recording an application.');if(['Applied','Recruiter Screen','Interview','Offer'].includes(rec.stage))return notify('Application already recorded.');if(!confirm('Confirm you submitted an application for '+(rec.jobTitle||'this job')+' at '+rec.name+'?'))return;rec.stage='Applied';rec.appliedDate=today();rec.updatedAt=new Date().toISOString();if(!rec.followup)rec.followup=workdaysFrom(today(),6);activity(rec.id,'application','Job application confirmed submitted','',{jobTitle:rec.jobTitle||'',jobUrl:rec.jobUrl||'',appliedDate:rec.appliedDate});await persist();notify('Application recorded and follow-up suggested.');}
  async function markReply(id){showReplyModal(id);}
  async function snooze(id){const r=findRecord(id);if(!r||!r.followup)return;r.followup=workdaysFrom(r.followup>today()?r.followup:today(),5);r.updatedAt=new Date().toISOString();activity(r.id,'followup','Follow-up rescheduled');await persist();notify('Follow-up moved five business days.');}
  const download=(filename,blob)=>{const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  function encryptedBackup(){const encrypted=localStorage.getItem(STORAGE_KEY);if(!encrypted)return;download(`levios-outreach-encrypted-${today()}.json`,new Blob([encrypted],{type:'application/json'}));notify('Encrypted vault backup downloaded.');}
  function exportCsv(){if(!confirm('CSV is plain text and will contain private contact information. Export an unencrypted CSV?'))return;const keys=['name','type','industry','location','person','channel','email','website','profile','stage','followup','concept','angle','subject','draft','notes','jobTitle','jobUrl','salary','appliedDate','sourceUrl','researchDate'];const esc = v=>{let s=String(v??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};const rows=[keys.map(esc).join(','),...state.records.map(r=>keys.map(k=>esc(r[k])).join(','))].join('\r\n');download(`levios-outreach-${today()}.csv`,new Blob([rows],{type:'text/csv;charset=utf-8'}));notify('Plain-text CSV exported. Keep it private.');}
  function parseCsv(text){const lines=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(Boolean))lines.push(row);row=[];cell='';}else cell+=c;}if(quoted)throw Error('Unterminated CSV quoted field.');if(cell||row.length){row.push(cell);lines.push(row);}const header=lines.shift()?.map(v=>v.trim())||[];if(!header.includes('name'))throw Error('CSV needs a name column.');return lines.map(cols=>Object.fromEntries(header.map((key,i)=>[key,cols[i]||''])));}
  async function importFile(file){if(!file)return;try{if(file.size>5_000_000)throw Error('File is too large for a browser-local vault.');const content=await file.text();if(file.name.toLowerCase().endsWith('.csv')){const rows=parseCsv(content);await mergeImport(rows);return;}const value=JSON.parse(content);if(value?.ciphertext&&value?.salt&&value?.iv){if(!confirm('Restore this encrypted vault? Your current browser-local records will be replaced. Export a backup first. You will need the imported vault passphrase to unlock it.'))return;localStorage.setItem(STORAGE_KEY,content);lockVault();notify('Encrypted backup restored. Unlock using its original passphrase.');return;}const rows=Array.isArray(value)?value:Array.isArray(value?.records)?value.records:null;const strategies=Array.isArray(value?.strategies)?value.strategies:[];if(!rows&&!strategies.length)throw Error('Expected an array of prospects, {records:[...]}, {strategies:[...]}, or an encrypted vault backup.');await mergeImport(rows||[],strategies);}catch(err){alert(`Import failed: ${err.message}`);}finally{$('import-file').value='';}}
  async function mergeImport(rows,strategyRows=[],options={}){
    ensureStrategies();
    if(!Array.isArray(rows)||!Array.isArray(strategyRows))throw Error('Invalid research pack.');
    if(rows.length>500||strategyRows.length>50)throw Error('Maximum 500 prospects and 50 strategies per import.');
    const addedStrategies=[];let skippedStrategies=0;
    for(const source of strategyRows){
      try{
        if(!source||typeof source!=='object')throw Error('Invalid strategy');
        const name=String(source.name||'').trim(),question=String(source.question||'').trim(),a=String(source.a||'').trim(),b=String(source.b||'').trim(),notes=String(source.notes||'').trim();
        const id=String(source.id||'').trim()||randomId();
        if(!/^[A-Za-z0-9_-]{3,80}$/.test(id)||!name||!question||!a||!b||[name,question,a,b,notes].some(x=>x.length>1500))throw Error('Invalid strategy fields');
        if(state.strategies.some(x=>x.id===id||x.name.toLowerCase()===name.toLowerCase())||addedStrategies.some(x=>x.id===id||x.name.toLowerCase()===name.toLowerCase())){skippedStrategies++;continue;}
        const status=['planned','active','paused','archived'].includes(source.status)?source.status:'planned';
        addedStrategies.push({id,name,question,a,b,notes,status});
      }catch{skippedStrategies++;}
    }
    const proposed=[];let skipped=0;
    for(const source of rows){
      try{
        if(!source||typeof source!=='object')throw Error('Invalid prospect');
        const rec=normalized(source,null,addedStrategies.map(s=>s.id));
        if(duplicate(rec)||proposed.some(r=>isDuplicatePair(rec,r))){skipped++;continue;}
        const now=new Date().toISOString();proposed.push({...rec,intakeReview:'pending',createdAt:now,updatedAt:now});
      }catch{skipped++;}
    }
    const report={added:proposed.length,strategiesAdded:addedStrategies.length,skipped,strategiesSkipped:skippedStrategies};
    if(!proposed.length&&!addedStrategies.length){if(options.automatic)return report;notify('Nothing new to import. '+(skipped+skippedStrategies)+' duplicate or invalid entries skipped.');return report;}
    const summary='Import '+proposed.length+' prospect(s) and '+addedStrategies.length+' new strategies into your encrypted vault? '+skipped+' prospect(s) and '+skippedStrategies+' strategy entry/entries skipped. No messages will be sent.';
    if(!options.automatic&&!confirm(summary))return null;
    state.strategies.push(...addedStrategies);
    state.records.push(...proposed);
    for(const r of proposed)activity(r.id,'imported',r.type==='Career'?'Career opportunity imported':'Research prospect imported');
    await persist();
    notify(proposed.length+' prospects and '+addedStrategies.length+' strategies imported. No email sent.');
    return report;
  }
  function handleAction(el){const action=el.dataset.action,id=el.dataset.id;if(action==='approvelead')return approveLead(id);if(action==='rejectlead')return rejectLead(id);if(action==='approvemessage')return approveMessage(id);if(action==='applied')return markApplied(id);if(action==='scanreplies')return scanReplies();if(action==='classifyreply')return showReplyModal(id,el.dataset.message||'');if(action==='strategynew')return editStrategy();if(action==='strategyedit')return editStrategy(id);if(action==='new')return editRecord(null,el.dataset.type||null);if(action==='edit')return editRecord(id);if(action==='copyopen')return copyAndOpen(id);if(action==='gmaildraft'){const r=findRecord(id);if(!r||!isApproved(r)||!messageIsApproved(r))return notify('Approve the opportunity and current message in Intake first.');if(r?.optedOut)return notify('Do not contact: this prospect opted out.');if(!window.LeviCloud)return notify('Cloud integration unavailable.');window.LeviCloud.createDraft(r).then(()=>notify('Gmail draft created, not sent. Check Gmail Drafts.')).catch(e=>alert('Gmail draft was not created: '+e.message));return;}if(action==='reply')return markReply(id);if(action==='snooze')return snooze(id);if(action==='backup')return encryptedBackup();if(action==='csv')return exportCsv();if(action==='import')return $('import-file').click();}
  document.addEventListener('pointerdown',()=>lastActivityAt=Date.now(),{passive:true});document.addEventListener('keydown',()=>lastActivityAt=Date.now());
  document.addEventListener('click',e=>{const nav=e.target.closest('[data-nav],[data-view]');if(nav&&!nav.disabled){navigate(nav.dataset.nav||nav.dataset.view);return;}const close=e.target.closest('[data-close]');if(close){$(close.dataset.close).close();return;}const action=e.target.closest('[data-action]');if(action&&!action.disabled)handleAction(action);});
  document.addEventListener('input',e=>{if(e.target.id==='search-input'){filter.query=e.target.value;const pos=e.target.selectionStart;render();const input=$('search-input');if(input){input.focus();input.setSelectionRange(pos,pos);}}});
  document.addEventListener('change',e=>{if(e.target.matches('#record-form [name="type"]')){syncRecordFormType();}else if(e.target.id==='type-filter'){filter.type=e.target.value;render();}else if(e.target.id==='stage-filter'){filter.stage=e.target.value;render();}});
  $('vault-form').addEventListener('submit',async e=>{e.preventDefault();$('vault-error').textContent='';const pass=$('vault-pass').value;if(!localStorage.getItem(STORAGE_KEY)&&pass!==$('vault-confirm').value){$('vault-error').textContent='Passphrases do not match.';return;}const btn=$('vault-submit');btn.disabled=true;btn.textContent='Opening encrypted vault...';try{await openVault(pass);}catch(err){encryptionKey=null;salt=null;state=null;$('vault-error').textContent='Unable to unlock. Check the passphrase or backup file.';console.warn('Vault unlock error:',err.message);}finally{btn.disabled=false;if(state)setAuthMode();else{const btnText=localStorage.getItem(STORAGE_KEY)?'Unlock my workspace ↗':'Create my private workspace ↗';btn.textContent=btnText;}}});
  $('record-form').addEventListener('submit',saveRecord);
  $('strategy-form').addEventListener('submit',saveStrategy);
  $('reply-form').addEventListener('submit',saveReplyReview);
  $('delete-record').addEventListener('click',deleteRecord);
  $('confirm-sent').addEventListener('click',markSent);
  $('confirm-not-sent').addEventListener('click',()=>{pendingSendId=null;$('confirm-modal').close();notify('Kept as draft. No send recorded.');});
  $('add-main').addEventListener('click',()=>editRecord());$('add-top').addEventListener('click',()=>editRecord());
  $('lock-button').addEventListener('click',lockVault);
  $('import-file').addEventListener('change',e=>importFile(e.target.files?.[0]));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&state&&Date.now()-lastActivityAt>20*60*1000)lockVault();});
  setInterval(()=>{if(state&&Date.now()-lastActivityAt>20*60*1000)lockVault();},60_000);
  if(!globalThis.crypto?.subtle){$('vault-error').textContent='Secure browser encryption is unavailable. Use HTTPS or localhost in a modern browser.';$('vault-submit').disabled=true;}
  // Internal integration smoke test: save a plainly marked prospect to the encrypted browser vault.
  // No real business is contacted, and the Gmail draft uses the owner's own email address.
  window.LeviOutreachIsUnlocked=()=>!!state;
  window.LeviOutreachImportResearchPack=async(pack)=>{
    if(!state)throw Error('Unlock the encrypted workspace first.');
    if(!pack||!Array.isArray(pack.records)||pack.records.length>50||!(pack.strategies===undefined||Array.isArray(pack.strategies)))throw Error('Invalid research inbox batch.');
    // Import only public business research. Do not mark as contacted or create an email draft.
    const rows=pack.records.map(r=>({...r,type:'Business',stage:'Researched',draft:'',subject:'',cc:'',followup:''}));
    return mergeImport(rows,pack.strategies||[],{automatic:true});
  };
  window.LeviOutreachCreateTestProspect=async()=>{
    if(!state)throw Error('Unlock your private outreach vault first.');
    const testId='levios-gmail-draft-test-v1';
    const existing=findRecord(testId);
    if(existing){
      if(existing.email!=='levivanstap@gmail.com')throw Error('The existing test record has a different address. Edit or delete it before retrying.');
      navigate('queue');
      return existing;
    }
    const rec=normalized({
      name:'LeviOS Gmail Integration Test',
      type:'Networking',industry:'Internal integration test',location:'',
      channel:'Email',email:'levivanstap@gmail.com',stage:'Draft Ready',
      angle:'Safe self-addressed test of the LeviOS Outreach Gmail Draft workflow.',
      subject:'[TEST] LeviOS Outreach Gmail draft integration',
      draft:'This is a safe, self-addressed Gmail draft created through LeviOS Outreach. No email was sent. You can delete this draft after confirming it appeared in Gmail.',
      notes:'INTERNAL TEST ONLY. Not a real prospect; safe to delete after verification.'
    },testId);
    const now=new Date().toISOString();
    const saved={...rec,createdAt:now,updatedAt:now};
    state.records.unshift(saved);
    activity(saved.id,'created','Internal Gmail integration test prospect added');
    await persist();
    navigate('queue');
    return saved;
  };
  window.LeviOutreachTrackedEmails=()=>state?[...new Set(state.records.filter(r=>r.email&&isSent(r)).map(r=>r.email))]:[];
  setAuthMode();
})();