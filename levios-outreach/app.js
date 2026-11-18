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
    overview:['Today in JobOS.','Your opportunities and next steps, all in one place.'],
    detail:['Opportunity details.','Review the next step and take action.'],
    career:['Employment.','Apply to scored roles with tailored packages and verified recruiter outreach.'],
    careeroutreach:['Career Outreach.','Build relationships with employers outside advertised job listings.'],
    business:['MunkOS.','Build your consulting client pipeline with prepared outreach drafts.'],
    networking:['Networking.','Build genuine professional connections and follow through.'],
    queue:['Ready for a conversation.','Thoughtful outreach, one real relationship at a time.'],
    contacts:['People & companies.','Your growing directory of meaningful opportunities.'],
    pipeline:['Opportunity pipeline.','A clear picture of every conversation in motion.'],
    followups:['Stay in the conversation.','Thoughtful follow-through without losing track.'],
    insights:['Learn what works.','Actual sends, human replies, and useful outcomes.'],
    strategies:['Strategy Lab.','Track hypotheses, run controlled tests, and learn by industry.']
  };
  const $ = id => document.getElementById(id);
  let state = null, encryptionKey = null, salt = null, selectedRecordId = null, detailReturnView = 'overview', activeView = 'overview', editingId = null, pendingSendId = null, editingStrategyId = null, pendingReplyRecord = null, pendingReplyEvidence = null;
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
  const isActive = r => !r.optedOut&&r.intakeReview!=='passed'&&r.intakeReview!=='rejected'&&!['Closed','Won','Rejected','Withdrawn'].includes(r.stage);
  const isDue = r => isActive(r)&&r.followup&&r.followup<=today();
  const isReady = r => !r.optedOut&&r.intakeReview!=='passed'&&r.intakeReview!=='rejected'&&(r.type!=='Career'||jobMeetsThreshold(r)||!!r.appliedDate)&&r.draft?.trim()&&!['Contacted','Responded','Concept Shared','Interested','Meeting Booked','Proposal','Won','Closed'].includes(r.stage);
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
  async function importStarterResearch(){
    // The feed contains only public employer listings and business websites; no personal vault data.
    // Importing is local, encrypted, deduplicated and never constitutes a sent message or application.
    const resp=await fetch('./research-feed.json?v=munkos-contactable-20261118',{cache:'no-store',signal:AbortSignal.timeout(7000)});
    if(!resp.ok)throw Error('Research feed unavailable: HTTP '+resp.status);
    const feed=await resp.json();
    if(feed?.version!==1||!Array.isArray(feed.records)||feed.records.length>30)throw Error('Research feed format invalid.');
    const sanitized=feed.records.filter(r=>r&&['Business','Career'].includes(r.type)&&r.verification==='official-site'&&safeUrl(r.sourceUrl)&&r.researchDate);
    // Repair contact details in already-imported records: duplicate prevention must not block
    // public email/social enrichment. Preserve any user-entered contacts and edited/sent drafts.
    let repaired=0;
    for(const source of sanitized.filter(r=>r.type==='Business')){
      const existing=state.records.find(r=>r.type==='Business'&&canonical(r.website||r.sourceUrl)===canonical(source.website||source.sourceUrl)&&r.name.toLowerCase()===source.name.toLowerCase());
      if(!existing||isSent(existing)||existing.optedOut||isPassed(existing))continue;
      let changed=false;
      if(!validMail(existing.email)&&validMail(source.email)){existing.email=source.email;existing.channel='Email';changed=true;}
      if(!verifiedSocialUrl(existing.profile)&&verifiedSocialUrl(source.profile)){existing.profile=source.profile;changed=true;}
      if(existing.offerModule?.includes('CleaningOS')){existing.offerModule='Custom Revenue Dashboard';changed=true;}
      const legacy=!!existing.draft?.includes('I build practical tools for smaller companies through');
      if((!existing.draft||legacy)&&!existing.messageApprovedAt){
        const draft=businessDraft(existing);
        if(existing.draft!==draft.draft||existing.subject!==draft.subject){existing.draft=draft.draft;existing.subject=draft.subject;changed=true;}
      }
      if(changed){
        existing.messageApprovedAt='';existing.approvedDraft='';existing.approvedDestination='';
        existing.updatedAt=new Date().toISOString();repaired++;
      }
    }
    if(repaired){activity('','research-enriched',repaired+' existing MunkOS records enriched with verified public contact details');await persist();}
    return mergeImport(sanitized,[],{automatic:true});
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
    lastActivityAt=Date.now();navigate('overview');try{await importStarterResearch();}catch(e){console.warn('Starter research not loaded:',e.message);}window.LeviCloud?.onVaultOpen?.();
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
  const stageFor = type => type==='Career'?['Discovered','Saved','Researched','Draft Ready','Applied','Contacted','Recruiter Screen','Interview','Offer','Rejected','Withdrawn','Closed']:type==='Networking'?['Discovered','Researched','Draft Ready','Contacted','Responded','Interested','Meeting Booked','Closed']:type==='Career Outreach'?['Discovered','Researched','Draft Ready','Contacted','Responded','Interested','Meeting Booked','Interview','Closed']:['Discovered','Researched','Draft Ready','Contacted','Responded','Concept Shared','Interested','Meeting Booked','Proposal','Won','Closed'];
  function syncRecordFormType(){const form=$('record-form'),type=form.elements.type.value;form.querySelectorAll('.career-field').forEach(el=>el.hidden=type!=='Career');form.querySelectorAll('.business-field').forEach(el=>el.hidden=!['Business','Collaboration'].includes(type));form.querySelectorAll('.careeroutreach-field').forEach(el=>el.hidden=type!=='Career Outreach');const field=form.elements.stage,previous=field.value;field.innerHTML=stageFor(type).map(x=>'<option>'+escapeHtml(x)+'</option>').join('');field.value=stageFor(type).includes(previous)?previous:'Discovered';}
  const provenanceReady = r => {
    if(!safeUrl(r.sourceUrl||r.jobUrl||r.profile))return false;
    if(r.type==='Career')return !!safeUrl(r.jobUrl)&&r.verification==='official-site'&&!!r.researchDate;
    return ['official-site','directory'].includes(r.verification)&&!!r.researchDate;
  };
  const isApproved = r => r.intakeReview==='approved'||(r.intakeReview==='recommended'&&provenanceReady(r));
  const messageIsApproved = r => !!r.draft?.trim()&&!!r.messageApprovedAt&&r.approvedDraft===r.draft&&r.approvedSubject===(r.subject||'')&&r.approvedDestination===(r.channel==='Email'?(r.email||''):(r.profile||''))&&r.approvedCc===(r.cc||'');
  const isUnreviewed = r => !r.intakeReview || r.intakeReview==='pending';
  const isPassed = r => r.intakeReview==='rejected'||r.intakeReview==='passed';
  function rankOpportunity(r){
    // Source-provided priority is not independently trusted as a score.
    if(r.type!=='Career'){
      const verified=provenanceReady(r);
      const evidence=verified?25:safeUrl(r.sourceUrl)?10:0;
      const offer=r.offerModule?25:0,angle=r.painHypothesis||r.angle?20:0,contact=validMail(r.email)||safeUrl(r.profile)?20:0,local=r.location?10:0;
      return {score:evidence+offer+angle+contact+local,description:'Evidence '+evidence+'/25 · Offer '+offer+'/25 · Angle '+angle+'/20 · Contact '+contact+'/20 · Market '+local+'/10',source:'On-site heuristic'};
    }
    const locality=r.locationBucket==='local20'&&r.distanceMiles!==''&&r.distanceMiles!=null&&Number.isFinite(Number(r.distanceMiles))&&Number(r.distanceMiles)<=20;
    const remote=r.locationBucket==='remote'&&r.remoteWisconsinEligible==='yes';
    const location=locality?30:remote?22:0;
    const role= r.roleFit==='strong'?25:r.roleFit==='moderate'?15:0;
    const pay= r.compensationFit==='target'?20:r.compensationFit==='minimum'?12:0;
    const friction= r.applicationFriction==='low'?15:r.applicationFriction==='medium'?7:0;
    const evidence=provenanceReady(r)?10:0;
    return {score:location+role+pay+friction+evidence,description:'Location '+location+'/30 · Role '+role+'/25 · Pay '+pay+'/20 · Ease '+friction+'/15 · Evidence '+evidence+'/10',source:'On-site rubric'};
  }
  function opportunitySort(a,b){
    if(a.type==='Career'&&b.type==='Career'){
      const weight=r=>r.locationBucket==='local20'&&r.distanceMiles!==''&&r.distanceMiles!=null&&Number.isFinite(Number(r.distanceMiles))&&Number(r.distanceMiles)<=20?2:r.locationBucket==='remote'&&r.remoteWisconsinEligible==='yes'?1:0;
      if(weight(a)!==weight(b))return weight(b)-weight(a);
    }
    return rankOpportunity(b).score-rankOpportunity(a).score||String(b.updatedAt||'').localeCompare(String(a.updatedAt||''));
  }
  function scoreChip(r){const ranked=rankOpportunity(r);return '<div class="score-wrap" title="'+escapeHtml(ranked.description)+'"><strong>'+ranked.score+'/100</strong><small>'+escapeHtml(ranked.source)+'</small><span>'+escapeHtml(ranked.description)+'</span></div>';}
  const PASS_REASONS=['Not a fit','Skills mismatch','Pay too low','Outside preferred area','Application too cumbersome','Weak business opportunity','Duplicate / outdated','Other'];
  function passButton(r){
    return '<span class="pass-controls"><select data-pass-reason aria-label="Reason for passing on '+escapeHtml(r.jobTitle||r.name)+'">'+PASS_REASONS.map(x=>'<option value="'+escapeHtml(x)+'">'+escapeHtml(x)+'</option>').join('')+'</select><button class="button button-secondary button-small" data-action="passlead" data-id="'+escapeHtml(r.id)+'">Pass</button></span>';
  }
  async function passLead(id,reason='Not a fit'){
    const r=findRecord(id);if(!r||isPassed(r))return;
    const chosen=PASS_REASONS.includes(reason)?reason:'Not a fit',before=r.intakeReview||'pending';
    r.intakeReview='passed';r.passReason=chosen;r.passAt=new Date().toISOString();r.followup='';r.updatedAt=r.passAt;
    activity(r.id,'passed','Opportunity passed: '+chosen,'',{reason:chosen,previousReview:before,type:r.type,industry:r.industry||'',jobTitle:r.jobTitle||'',applicationFriction:r.applicationFriction||'',locationBucket:r.locationBucket||'',offerModule:r.offerModule||''});
    await persist();notify('Passed · '+chosen+'. Feedback saved.');
  }
  function reviewableSource(r){
    if(r.type==='Career')return !!safeUrl(r.jobUrl||r.sourceUrl);
    if(r.type==='Networking')return !!safeUrl(r.profile||r.sourceUrl);
    return !!safeUrl(r.sourceUrl)&&['official-site','directory'].includes(r.verification);
  }
  function intake(){
    const all=state.records,shown=all.filter(r=>!isPassed(r)).sort(opportunitySort),
      recommended=shown.filter(r=>isApproved(r)&&jobMeetsThreshold(r)),research=shown.filter(r=>isUnreviewed(r)||!jobMeetsThreshold(r)),
      messages=recommended.filter(r=>r.draft?.trim()&&!messageIsApproved(r)&&!r.optedOut),
      ready=recommended.filter(r=>messageIsApproved(r)&&!isSent(r)&&!r.optedOut),
      passed=all.filter(isPassed);
    const button=(action,id,label,primary=false)=>'<button type="button" data-action="'+action+'" data-id="'+escapeHtml(id)+'" class="button button-small '+(primary?'button-primary':'button-secondary')+'">'+label+'</button>';
    const cards=(items,actions)=>items.length?items.slice(0,50).map(r=>'<article class="intake-item"><div class="lead-info"><strong>'+escapeHtml(r.jobTitle||r.name)+'</strong><div class="lead-meta">'+escapeHtml(r.name)+' · '+escapeHtml(r.type)+' · '+escapeHtml(r.stage)+'</div>'+scoreChip(r)+'<p class="small subtle">'+escapeHtml(r.location||'Location not provided')+(r.locationBucket==='local20'&&r.distanceMiles?' · '+escapeHtml(r.distanceMiles)+' mi from Appleton':r.locationBucket==='remote'?' · Remote':'')+'</p>'+(safeUrl(r.jobUrl||r.sourceUrl)?'<a class="quiet-link" href="'+escapeHtml(safeUrl(r.jobUrl||r.sourceUrl))+'" target="_blank" rel="noopener noreferrer">View source ↗</a>':'<p class="small subtle">Source not documented</p>')+'</div><div class="inline-actions">'+actions(r)+passButton(r)+'</div></article>').join(''):'<p class="small subtle">Nothing here.</p>';
    return stagedResearchPanel('all')+'<div class="cards">'+metricCard('Recommended',recommended.length,'Source-backed intake')+metricCard('Needs more research',research.length,'Missing source or evidence')+metricCard('Messages to approve',messages.length,'Approval for sending only')+metricCard('Passed',passed.length,'Feedback saved')+'</div>'+
      '<p class="section-intro intake-intro">JobOS researches and ranks opportunities before they reach you. Local roles within 20 miles of Appleton appear first, then Wisconsin-eligible remote roles. Your job is to act or pass, not verify every listing. Missing evidence stays in research, not as a verified recommendation.</p>'+
      '<div class="intake-grid"><section class="card intake-lane"><div class="card-head"><h2>Recommended · '+recommended.length+'</h2></div>'+cards(recommended,r=>button('edit',r.id,'Open package',true)+(r.type==='Career'?button('applied',r.id,'Confirm applied'):'') )+'</section>'+
      '<section class="card intake-lane"><div class="card-head"><h2>Prepare / approve message · '+messages.length+'</h2></div>'+cards(messages,r=>button('edit',r.id,'Edit message')+button('approvemessage',r.id,'Approve message',true))+'</section>'+
      '<section class="card intake-lane"><div class="card-head"><h2>Ready to send · '+ready.length+'</h2></div>'+cards(ready,r=>(r.channel==='Email'?button('gmaildraft',r.id,'Gmail draft'):'')+button('copyopen',r.id,'Copy & open',true))+'</section></div>'+
      (research.length?'<details class="card intake-research"><summary>Needs additional research · '+research.length+'</summary><p class="small subtle">These records do not meet the source-evidence requirements for automatic recommendation.</p>'+cards(research,r=>button('edit',r.id,'Add evidence')+button('approvelead',r.id,'Manual override'))+'</details>':'')+
      '<div class="card" style="margin-top:18px"><div class="card-head"><h2>Research intake</h2><button class="button button-secondary button-small" data-action="import">Import sourced opportunities</button></div><p class="small subtle">Verified research packs become recommended automatically. Live direct job-feed synchronization is not yet connected. Passing a lead is stored locally and prevents re-importing exact duplicates while its record remains in your vault.</p></div>';
  }
  async function approveLead(id){
    const r=findRecord(id);if(!r||r.intakeReview==='approved')return;
    if(!reviewableSource(r))return notify('Add a valid source before overriding research review.');
    if(!confirm('Override evidence review for '+(r.jobTitle||r.name)+'? The source will remain distinguishable from an automatically recommended listing.'))return;
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
    if(r.optedOut||!r.draft?.trim())return notify('Save a message before approving it.');if(r.channel!=='Email'&&!destinationFor(r))return notify('Add a real professional profile URL before approving social outreach.');
    if(!confirm('Approve this exact message and recipient for '+r.name+'? Later edits require reapproval.'))return;
    r.approvedDraft=r.draft;r.approvedSubject=r.subject||'';r.approvedCc=r.cc||'';
    r.approvedDestination=r.channel==='Email'?(r.email||''):(r.profile||'');
    r.messageApprovedAt=new Date().toISOString();r.updatedAt=r.messageApprovedAt;
    activity(r.id,'message-approved','Message approved for manual sending');await persist();
  }
  const workspaceType = view => ({career:'Career',careeroutreach:'Career Outreach',business:'Business',networking:'Networking'})[view];
  const workspaceRecords = view => state.records.filter(r=>view==='business'?['Business','Collaboration'].includes(r.type):r.type===workspaceType(view));

  const MIN_JOB_SCORE=75;
  const jobMeetsThreshold=rec=>rec.type!=='Career'||(!['high','workday'].includes(rec.applicationFriction)&&rankOpportunity(rec).score>=MIN_JOB_SCORE);
  const firstName=full=>String(full||'').trim().split(/\s+/)[0]||'';
  const verifiedSocialUrl=value=>{
    const target=safeUrl(value);if(!target)return '';
    try{const u=new URL(target),host=u.hostname.toLowerCase().replace(/^www\./,'');
      return ['instagram.com','facebook.com','linkedin.com'].includes(host)&&u.pathname.replaceAll('/','').length>1?target:'';
    }catch{return '';}
  };
  const munkosContactReady=r=>r.type!=='Business'||validMail(r.email)||!!verifiedSocialUrl(r.profile);
  function businessDraft(rec){
    const name=String(rec.name||'your business').trim();
    const greeting=firstName(rec.person)?'Hi '+firstName(rec.person)+',':'Hi '+name+' team,';
    return {
      subject:'Quick idea for '+name,
      draft:greeting+'\n\nI\'m local to the Fox Valley and came across '+name+'. I build simple, custom dashboards that help business owners spot missed sales, follow up with past customers, and see what\'s actually bringing in work.\n\nThe idea is to make more from the leads and customers you already have before spending more money on ads.\n\nWould it be okay if I sent over a quick example?\n\nLevi'
    };
  }
  function businessSocialDraft(rec){
    const greeting=firstName(rec.person)?'Hey '+firstName(rec.person)+'!':'Hey!';
    return greeting+' I build simple dashboards for local businesses to spot missed sales, bring old customers back, and see what works without spending more on ads. Would it be okay if I sent over a quick example for '+String(rec.name||'your business')+'? - Levi';
  }

  function generalEmploymentDraft(rec){
    const greet=firstName(rec.person)?'Hi '+firstName(rec.person)+',':'Hello '+rec.name+' team,';
    const pitch=String(rec.employmentPitch||'marketing analytics, business operations, and process improvement').trim().slice(0,350);
    return {subject:'Exploring opportunities with '+rec.name,draft:greet+'\n\nI am exploring opportunities in '+pitch+' and wanted to reach out to '+rec.name+'. My background combines marketing, analytics, and cross-functional operations.\n\nIf your team anticipates openings in these areas, would you be open to a brief introduction? I would be happy to share my portfolio.\n\nThank you,\nLevi'};
  }
  function recruiterDraft(rec){
    if(rec.type!=='Career'||!rec.appliedDate||!rec.person||!['official','public-profile'].includes(rec.contactVerified))return null;
    const verifiedEmail=rec.contactVerified==='official'&&validMail(rec.email),verifiedLinkedIn=rec.contactVerified==='public-profile'&&safeUrl(rec.profile);
    const channel=rec.channel==='LinkedIn'&&verifiedLinkedIn?'LinkedIn':rec.channel==='Email'&&verifiedEmail?'Email':verifiedEmail?'Email':verifiedLinkedIn?'LinkedIn':null;
    if(!channel)return null;
    const greet=firstName(rec.person),role=rec.jobTitle||'the open position';
    if(channel==='LinkedIn')return {channel,subject:'',draft:'Hi '+greet+', I just applied for the '+role+' role at '+rec.name+'. My background spans marketing analytics, operations, and automation. I’d welcome the chance to connect. Thanks, Levi'};
    return {channel,subject:'Applied: '+role+' at '+rec.name,draft:'Hi '+greet+',\n\nI recently applied for the '+role+' role at '+rec.name+' and wanted to introduce myself. My background spans marketing analytics, cross-functional operations, and automation, and I would appreciate the chance to discuss how I could contribute.\n\nThanks for your consideration,\nLevi'};
  }
  const positiveReply = rec => state.activities.some(a=>a.recordId===rec.id&&a.kind==='replied'&&a.meta?.outcome==='positive');
  function readiness(rec){
    if(isPassed(rec))return {name:'Passed · '+(rec.passReason||'Not a fit'),ready:false};
    if(!isApproved(rec))return {name:'Needs research',ready:false};
    if(rec.type==='Career'){
      if(!rec.jobUrl)return {name:'Add verified job link',ready:false};
      if(['Applied','Recruiter Screen','Interview','Offer','Rejected','Withdrawn','Closed'].includes(rec.stage))return {name:'Application recorded',ready:true};
      if(window.JobOSDocuments?.has(rec))return {name:'Resume & cover letter ready to download',ready:true};
      if(!rec.resumeUrl)return {name:'Prepare ATS resume',ready:false};
      if(!rec.coverLetterUrl)return {name:'Resume linked · cover letter needs decision',ready:true};
      return {name:'Apply and confirm submission',ready:true};
    }
    if(rec.optedOut)return {name:'Do not contact',ready:false};
    if(!rec.draft?.trim())return {name:'Prepare message',ready:false};
    if(!messageIsApproved(rec))return {name:'Approve message',ready:false};
    return {name:'Draft or copy approved message',ready:true};
  }
  function packageCard(rec){
    const step=readiness(rec),career=rec.type==='Career',applied=career&&['Applied','Recruiter Screen','Interview','Offer'].includes(rec.stage);
    const link=(url,label)=>safeUrl(url)?'<a class="button button-secondary button-small" href="'+escapeHtml(safeUrl(url))+'" target="_blank" rel="noopener noreferrer">'+label+' ↗</a>':'';
    const emailLink=rec.contactVerified==='official'&&validMail(rec.email)?'<a class="button button-secondary button-small" href="mailto:'+encodeURIComponent(rec.email)+'">Verified email ↗</a>':'';
    const contact=career&&rec.person&&((rec.contactVerified==='official'&&validMail(rec.email))||(rec.contactVerified==='public-profile'&&safeUrl(rec.profile)));
    const recruiterSearch=career&&!contact?'<a class="button button-secondary button-small" href="https://www.linkedin.com/search/results/people/?keywords='+encodeURIComponent(rec.name+' recruiter talent acquisition marketing')+'" target="_blank" rel="noopener noreferrer">Find contact (unverified) ↗</a>':'';
    const resources=career?link(rec.jobUrl,'Apply on employer site')+link(rec.resumeUrl,'ATS resume')+link(rec.coverLetterUrl,'Cover letter')+(contact?(rec.profile?link(rec.profile,'Recruiter LinkedIn'):'')+emailLink:'')+recruiterSearch:link(rec.painEvidenceUrl,'Evidence')+link(rec.concept,'MunkOS concept');
    const suggested=rec.type==='Business'?businessDraft(rec):rec.type==='Career Outreach'?generalEmploymentDraft(rec):null;
    const draft=rec.draft||suggested?.draft||'',subject=rec.subject||suggested?.subject||'';
    const actions=career?
      (window.JobOSDocuments?.has(rec)?'<button class="button button-primary button-small" data-action="pdfresume" data-id="'+escapeHtml(rec.id)+'">Download resume PDF</button><button class="button button-secondary button-small" data-action="pdfcover" data-id="'+escapeHtml(rec.id)+'">Download cover letter PDF</button>':'<span class="small subtle">PDF package not prepared yet</span>')+
      (!applied?'<button class="button button-secondary button-small" data-action="applied" data-id="'+escapeHtml(rec.id)+'">Confirm applied</button>':'')+
      (applied&&contact?'<button class="button button-secondary button-small" data-action="recruiterdraft" data-id="'+escapeHtml(rec.id)+'">Recruiter message</button>':''):
      (!rec.draft&&suggested?'<button class="button button-primary button-small" data-action="savedraft" data-id="'+escapeHtml(rec.id)+'">Save suggested draft</button>':'')+
      (rec.draft&&!messageIsApproved(rec)?'<button class="button button-primary button-small" data-action="approvequick" data-id="'+escapeHtml(rec.id)+'">Approve message</button>':'')+
      (draft?'<button class="button button-secondary button-small" data-action="copydraft" data-id="'+escapeHtml(rec.id)+'">Copy</button>':'')+
      (draft&&rec.channel==='Email'?'<button class="button button-secondary button-small" data-action="opencompose" data-id="'+escapeHtml(rec.id)+'">Open Gmail compose</button>':'')+
      (rec.draft&&messageIsApproved(rec)&&validMail(rec.email)&&rec.channel==='Email'?'<button class="button button-secondary button-small" data-action="gmaildraft" data-id="'+escapeHtml(rec.id)+'">Create Gmail draft</button>':'')+
      (rec.draft&&!isSent(rec)?'<button class="button button-secondary button-small" data-action="confirmsent" data-id="'+escapeHtml(rec.id)+'">I sent it</button>':'');
    return '<article class="job-row package-row"><div class="lead-info"><strong>'+escapeHtml(rec.jobTitle||rec.name)+'</strong><div class="lead-meta">'+escapeHtml(rec.name)+' · '+escapeHtml(rec.type)+' · '+escapeHtml(rec.stage)+'</div><div class="lead-meta">'+escapeHtml(step.name)+(career?' · Friction: '+escapeHtml(rec.applicationFriction||'Unverified'):'')+'</div>'+
      (career?'<div class="lead-meta">'+(contact?'Verified contact: '+escapeHtml(rec.person):'Hiring contact not verified')+'</div>':'')+
      (rec.offerModule?'<div class="lead-meta">Offer: '+escapeHtml(rec.offerModule)+'</div>':'')+
      (draft&&!career?'<div class="draft-preview package-draft"><strong>'+(rec.draft?'Saved outreach draft':'Suggested outreach draft · not yet saved')+'</strong><div><b>Subject:</b> '+escapeHtml(subject)+'</div><p>'+escapeHtml(draft.slice(0,540))+(draft.length>540?'…':'')+'</p></div>':'')+
      '<div class="inline-actions package-links">'+resources+'</div>'+scoreChip(rec)+'</div><div class="row-actions">'+actions+'<button class="button button-secondary button-small" data-action="edit" data-id="'+escapeHtml(rec.id)+'">Edit</button>'+passButton(rec)+'</div></article>';
  }
  function simplifiedCard(r){
    const career=r.type==='Career',title=escapeHtml(r.jobTitle||r.name),score=rankOpportunity(r).score;
    const sub=career?[r.name,r.location,r.salary||'Pay undisclosed']:[r.industry||r.type,r.location,r.stage];
    const status=career?(r.appliedDate?'Applied · follow-up '+(r.followup||'not scheduled'):window.JobOSDocuments?.has(r)?'Application kit ready':r.resumeUrl?'Materials linked':'Package not prepared yet'):isSent(r)?'Sent':r.type==='Business'?(validMail(r.email)?'Email ready':safeUrl(r.profile)?'Social ready':'Contact research needed'):r.draft?.trim()?'Draft ready':'Suggested message ready';
    return '<article class="simple-opportunity"><div class="simple-opportunity-main"><div class="simple-opportunity-top"><strong>'+title+'</strong>'+(career?'<span class="simple-score">'+score+'/100</span>':'')+'</div><p>'+escapeHtml(sub.filter(Boolean).join(' · '))+'</p><small>'+escapeHtml(status)+'</small></div><div class="simple-opportunity-actions"><button class="button button-primary button-small" data-action="opendetail" data-id="'+escapeHtml(r.id)+'">'+(career?'View job':'Review')+'</button><button class="button button-secondary button-small" data-action="passlead" data-id="'+escapeHtml(r.id)+'">Pass</button></div></article>';
  }
  function workspace(view){
    const records=workspaceRecords(view).filter(r=>!isPassed(r)).sort(opportunitySort);
    const career=view==='career',business=view==='business',careerOutreach=view==='careeroutreach',type=workspaceType(view);
    const qualified=records.filter(r=>(!career||jobMeetsThreshold(r)||!!r.appliedDate)&&(!business||munkosContactReady(r)));
    const visible=qualified.filter(r=>[r.name,r.jobTitle,r.location,r.industry,r.person].join(' ').toLowerCase().includes(filter.query.toLowerCase()));
    const held=career?records.filter(r=>!jobMeetsThreshold(r)&&!r.appliedDate):[];
    const withoutContact=business?records.filter(r=>!munkosContactReady(r)):[];
    const heading=career?'Jobs worth applying to':business?'Businesses to contact':careerOutreach?'Employers to approach':'People to connect with';
    const explanation=career?'Jobs meeting your 75-point cutoff appear here.':business?'Only businesses with a verified email or social profile appear here. Every email opens with the To field filled in.':'Each prospect has a suggested outreach message to review.';
    return '<div class="simple-workspace-heading"><div><h2>'+heading+'</h2><p>'+explanation+'</p></div><button class="button button-secondary button-small" data-action="new" data-type="'+escapeHtml(type)+'">+ Add</button></div>'+
      '<div class="simple-search"><input id="search-input" placeholder="Search..." aria-label="Search opportunities" value="'+escapeHtml(filter.query)+'"></div>'+
      (visible.length?'<div class="simple-list">'+visible.slice(0,50).map(simplifiedCard).join('')+'</div>':'<div class="card simple-empty"><h3>Nothing ready here yet</h3><p>'+ (career?'No verified jobs above 75 have been imported into your vault yet. Check research updates below.':'Research is being collected. You can add a contact manually.')+'</p></div>')+
      (withoutContact.length?'<details class="simple-secondary"><summary>Still researching contact details ('+withoutContact.length+')</summary><p>These businesses are hidden from outreach until a public email address or genuine social profile is found.</p></details>':'')+
      (held.length?'<details class="simple-secondary"><summary>Other job research ('+held.length+')</summary><p>These leads are below the 75-point cutoff or missing information.</p>'+held.slice(0,20).map(simplifiedCard).join('')+'</details>':'')+
      '<details class="simple-secondary"><summary>Research updates and import tools</summary>'+stagedResearchPanel(career?'career':business?'business':careerOutreach?'careeroutreach':'all')+'</details>';
  }
  function detail(){
    const r=findRecord(selectedRecordId);
    if(!r)return '<div class="card"><p>That record is not available.</p><button class="button button-secondary" data-action="detailback">Back</button></div>';
    const career=r.type==='Career',suggested=career?null:r.type==='Business'?businessDraft(r):r.type==='Career Outreach'?generalEmploymentDraft(r):null;
    const legacyBusiness=r.type==='Business'&&!r.messageApprovedAt&&!!r.draft?.includes('I build practical tools for smaller companies through');
    const draft=legacyBusiness?businessDraft(r).draft:r.draft||suggested?.draft||'',subject=r.subject||suggested?.subject||'';
    const verifiedContact=!!r.person&&((r.contactVerified==='official'&&validMail(r.email))||(r.contactVerified==='public-profile'&&!!safeUrl(r.profile)));
    const source=safeUrl(career?r.jobUrl:r.sourceUrl||r.website);
    const contactPanel=r.type==='Business'?'<section class="munkos-contact"><div class="eyebrow">HOW TO REACH THEM</div>'+
      (validMail(r.email)?'<div class="munkos-contact-line"><strong>To:</strong> <span>'+escapeHtml(r.email)+'</span></div>':'')+
      (verifiedSocialUrl(r.profile)?'<div class="munkos-contact-line"><strong>Social:</strong> <a href="'+escapeHtml(safeUrl(r.profile))+'" target="_blank" rel="noopener noreferrer">Verified social profile ↗</a></div><div class="munkos-social-copy"><strong>Short DM draft</strong><p>'+escapeHtml(businessSocialDraft(r))+'</p></div>':'')+
      '<div class="simple-primary-actions">'+(validMail(r.email)?'<button class="button button-primary" data-action="opencompose" data-id="'+escapeHtml(r.id)+'">Open Gmail with To filled in</button>':'')+
      (verifiedSocialUrl(r.profile)?'<button class="button button-secondary" data-action="opensocial" data-id="'+escapeHtml(r.id)+'">Copy DM & open social</button>':'')+'</div></section>':'';

    const link=(url,label)=>safeUrl(url)?'<a class="button button-secondary" href="'+escapeHtml(safeUrl(url))+'" target="_blank" rel="noopener noreferrer">'+label+' ↗</a>':'';
    let actions='';
    if(career){
      actions=(window.JobOSDocuments?.has(r)?'<button class="button button-primary" data-action="downloadkit" data-id="'+escapeHtml(r.id)+'">Download both PDFs</button><button class="button button-secondary" data-action="pdfresume" data-id="'+escapeHtml(r.id)+'">Resume PDF</button><button class="button button-secondary" data-action="pdfcover" data-id="'+escapeHtml(r.id)+'">Cover letter PDF</button>':'<span class="simple-status">Tailored PDFs not yet prepared for this job</span>')+
        link(r.jobUrl,'Open application')+
        (!r.appliedDate?'<button class="button button-secondary" data-action="applied" data-id="'+escapeHtml(r.id)+'">I applied</button>':'')+
        (r.appliedDate&&verifiedContact?'<button class="button button-secondary" data-action="recruiterdraft" data-id="'+escapeHtml(r.id)+'">Message recruiter</button>':'');
    }else{
      actions=(!r.draft?.trim()?'<button class="button button-primary" data-action="savedraft" data-id="'+escapeHtml(r.id)+'">Use this draft</button>':!messageIsApproved(r)?'<button class="button button-primary" data-action="approvequick" data-id="'+escapeHtml(r.id)+'">Approve message</button>':
        r.channel==='Email'?'<button class="button button-primary" data-action="opencompose" data-id="'+escapeHtml(r.id)+'">Open email in Gmail</button>':
        '<button class="button button-primary" data-action="copyopen" data-id="'+escapeHtml(r.id)+'">Copy & open social</button>')+
        (draft?'<button class="button button-secondary" data-action="copydraft" data-id="'+escapeHtml(r.id)+'">Copy</button>':'')+
        (r.draft?.trim()&&!isSent(r)?'<button class="button button-secondary" data-action="confirmsent" data-id="'+escapeHtml(r.id)+'">I sent it</button>':'')+
        (r.draft?.trim()&&messageIsApproved(r)&&r.channel==='Email'&&validMail(r.email)?'<button class="button button-secondary" data-action="gmaildraft" data-id="'+escapeHtml(r.id)+'">Save Gmail draft</button>':'');
    }
    const recruiter=career?window.JobOSDocuments?.recruiter(r):null;
    const recruiterPanel=career&&recruiter?'<section class="job-recruiter"><div class="eyebrow">RECRUITER OUTREACH</div><h3>'+escapeHtml(recruiter.name||'Hiring team contact')+'</h3><p class="small subtle">'+escapeHtml(recruiter.note||'A role-specific recruiter is not confirmed.')+'</p>'+
      (recruiter.email?'<p class="small subtle">Public team inbox: '+escapeHtml(recruiter.email)+' · '+escapeHtml(recruiter.emailNote||'')+'</p>':'')+
      '<div class="simple-email"><span>LINKEDIN MESSAGE · '+(r.appliedDate?'POST-APPLICATION':'INTRODUCTION')+'</span><p>'+escapeHtml(window.JobOSDocuments.message(r,'LinkedIn'))+'</p></div>'+
      '<div class="simple-primary-actions"><button class="button button-secondary" data-action="copyrecruiter" data-id="'+escapeHtml(r.id)+'">Copy LinkedIn message</button>'+
      (recruiter.profile?'<a class="button button-secondary" href="'+escapeHtml(recruiter.profile)+'" target="_blank" rel="noopener noreferrer">View professional profile ↗</a>':'')+
      (recruiter.email?'<button class="button button-secondary" data-action="emailrecruiter" data-id="'+escapeHtml(r.id)+'">Open recruiter email</button>':'')+
      (recruiter.search?'<a class="button button-secondary" href="'+escapeHtml(recruiter.search)+'" target="_blank" rel="noopener noreferrer">Find Harrow recruiter ↗</a>':'')+
      '</div></section>':'';
    return '<button class="simple-back" data-action="detailback">← Back to '+escapeHtml(detailReturnView==='business'?'MunkOS':detailReturnView==='career'?'Employment':detailReturnView==='careeroutreach'?'Career Outreach':detailReturnView==='networking'?'Networking':'Dashboard')+'</button>'+
      '<div class="simple-detail card"><div class="eyebrow">'+escapeHtml(r.type)+'</div><h2>'+escapeHtml(r.jobTitle||r.name)+'</h2><p class="simple-detail-meta">'+escapeHtml([r.name,r.location,career?r.salary:r.industry].filter(Boolean).join(' · '))+'</p>'+
      (career?'<div class="simple-detail-note"><strong>'+rankOpportunity(r).score+'/100 JobOS fit score</strong><p>'+escapeHtml(r.angle||'Review the role and prepare your application.')+'</p><p>Hiring contact: '+(verifiedContact?escapeHtml(r.person):'Not verified yet')+'</p></div>':
      '<div class="simple-email"><span>EMAIL DRAFT</span><h3>'+escapeHtml(subject||'Suggested introduction')+'</h3><p>'+escapeHtml(draft||'No message prepared yet.')+'</p>'+(r.channel==='Email'&&!validMail(r.email)?'<small>Recipient not found. Gmail will open with an empty To field.</small>':'')+'</div>')+
      '<div class="simple-primary-actions">'+actions+'</div>'+contactPanel+recruiterPanel+'<div class="simple-detail-footer">'+link(source,'Research source')+'<button class="button button-secondary" data-action="edit" data-id="'+escapeHtml(r.id)+'">Edit details</button><button class="button button-secondary" data-action="passlead" data-id="'+escapeHtml(r.id)+'">Pass</button></div></div>';
  }
  function stagedResearchPanel(scope='all'){
    const data=window.JobOSResearchPreview||{records:[],state:'signed_out'};
    const all=Array.isArray(data.records)?data.records:[];
    const filteredAll=all.filter(r=>r.type!=='Career'||jobMeetsThreshold(r));
    const belowThreshold=all.filter(r=>r.type==='Career'&&!jobMeetsThreshold(r)).length;
    const items=scope==='career'?filteredAll.filter(r=>r.type==='Career'):scope==='business'?filteredAll.filter(r=>r.type==='Business'):scope==='careeroutreach'?filteredAll.filter(r=>r.type==='Career Outreach'):filteredAll;
    const notice=data.state==='unlinked'?'Cloud vault not linked: research is staged but not imported. Open Cloud & Gmail to resolve safely.':data.state==='locked'?'Unlock your existing encrypted vault to import.':data.state==='signed_out'?'Sign in under Cloud & Gmail to load your private research queue.':data.message||'Research inbox ready.';
    const cards=items.slice(0,15).map(r=>{
      const target=safeUrl(r.type==='Career'?r.jobUrl||r.sourceUrl:r.sourceUrl||r.website);
      const details=[r.name,r.location,r.type==='Career'?(r.salary||'Pay not listed'):(r.industry||'MunkOS prospect')].filter(Boolean);
      return '<div class="research-preview-item"><div class="lead-info"><strong>'+escapeHtml(r.type==='Career'?r.jobTitle||r.name:r.name)+'</strong><div class="lead-meta">'+escapeHtml(details.join(' · '))+'</div><div class="lead-meta">Queued in Research Inbox · Not yet imported</div>'+(r.type==='Business'?'<div class="research-preview-draft"><b>Prepared draft preview:</b> '+escapeHtml(businessDraft(r).subject)+'<p>'+escapeHtml(businessDraft(r).draft.slice(0,280))+'</p><small>Sync to edit, approve, and create a Gmail draft once a real email is verified.</small></div>':'')+'</div>'+(target?'<a class="button button-secondary button-small" target="_blank" rel="noopener noreferrer" href="'+escapeHtml(target)+'">Source ↗</a>':'')+'</div>';
    }).join('');
    return '<section class="card research-preview-panel"><div class="card-head"><h2>Research Inbox · '+filteredAll.length+' qualified waiting</h2><button class="button button-primary button-small" data-action="researchsync">Sync opportunities</button></div><p class="small subtle">'+escapeHtml(notice)+(belowThreshold?' · '+belowThreshold+' job(s) held below 75.':'')+'</p>'+(items.length?'<div class="research-preview-list">'+cards+'</div>':all.length&&scope!=='all'?'<p class="small subtle">No queued items in this workspace. '+all.length+' waiting overall.</p>':'')+'<button class="button button-secondary button-small" data-action="researchsetup">Cloud & Gmail settings</button></section>';
  }
  function overview(){
    const active=state.records.filter(r=>!isPassed(r)),career=active.filter(r=>r.type==='Career'&&(jobMeetsThreshold(r)||!!r.appliedDate)),due=active.filter(isDue);
    const group=[['Employment','career'],['Career Outreach','careeroutreach'],['MunkOS','business'],['Networking','networking']];
    const pending=career.filter(r=>!r.appliedDate).sort((a,b)=>Number(window.JobOSDocuments?.has(b))-Number(window.JobOSDocuments?.has(a))||opportunitySort(a,b));
    const drafts=active.filter(r=>r.type!=='Career'&&!isSent(r)&&munkosContactReady(r)).sort(opportunitySort);
    const actions=[...pending.slice(0,4),...due.slice(0,3),...drafts.slice(0,5)].filter((r,i,a)=>a.findIndex(x=>x.id===r.id)===i).slice(0,8);
    const feed=window.JobOSResearchPreview;
    const staged=Array.isArray(feed?.records)?feed.records.filter(r=>r.type!=='Career'||jobMeetsThreshold(r)):[];
    const waiting=staged.length?'<section class="simple-new-inbox card"><div><div class="eyebrow">NEW RESEARCH</div><h2>'+staged.length+' opportunities found for you</h2><p>'+staged.filter(r=>r.type==='Career').length+' qualifying jobs · '+staged.filter(r=>r.type==='Business').length+' MunkOS prospects · Ready to bring into your workspace</p></div><button class="button button-primary" data-action="researchsync">Add to JobOS</button></section>':'';
    return waiting+'<div class="simple-metrics">'+metricCard('Jobs to review',pending.length,'Verified 75+ listings')+metricCard('Messages sent',active.filter(isSent).length,'Confirmed')+metricCard('Replies',active.filter(isReply).length,'Tracked responses')+metricCard('Follow-ups',due.length,'Due now')+'</div>'+
      '<div class="simple-section"><div class="simple-section-head"><h2>Your next actions</h2><span>'+actions.length+' opportunities</span></div>'+
      (actions.length?'<div class="simple-list">'+actions.map(simplifiedCard).join('')+'</div>':'<div class="card simple-empty"><h3>Nothing requiring action yet</h3><p>Open a workspace to review contacts, or see research updates below.</p></div>')+'</div>'+
      '<div class="simple-workspaces">'+group.map(([label,view])=>'<button data-nav="'+view+'" class="simple-workspace-tile"><strong>'+label+'</strong><span>'+workspaceRecords(view).filter(r=>!isPassed(r)&&munkosContactReady(r)).length+' tracked →</span></button>').join('')+'</div>'+
      '<details class="simple-secondary"><summary>Research updates & advanced tools</summary>'+stagedResearchPanel('all')+'<div class="simple-links"><button class="button button-secondary button-small" data-nav="insights">View analytics</button><button class="button button-secondary button-small" data-nav="followups">View follow-ups</button><button class="button button-secondary button-small" data-nav="strategies">Experiments</button><button class="button button-secondary button-small" data-nav="intake">Research review</button></div></details>';
  }
  function filtered(){return byNewest(state.records).filter(r=>!isPassed(r)&&(filter.type==='All'||r.type===filter.type)&&(filter.stage==='All'||r.stage===filter.stage)&&[r.name,r.industry,r.location,r.person,r.email,r.notes,r.angle,r.jobTitle,r.offerModule,r.painHypothesis].join(' ').toLowerCase().includes(filter.query.toLowerCase()));}
  function toolbar({includeStage=true}={}){return `<div class="toolbar"><input id="search-input" placeholder="Search companies, contacts, notes..." aria-label="Search opportunities" value="${escapeHtml(filter.query)}"><select id="type-filter" aria-label="Filter category"><option ${filter.type==='All'?'selected':''}>All</option>${['Business','Career','Networking','Collaboration'].map(t=>`<option ${filter.type===t?'selected':''}>${t}</option>`).join('')}</select>${includeStage?`<select id="stage-filter" aria-label="Filter stage"><option ${filter.stage==='All'?'selected':''}>All</option>${STAGES.map(t=>`<option ${filter.stage===t?'selected':''}>${escapeHtml(t)}</option>`).join('')}</select>`:''}</div>`;}
  function destinationFor(r){if(r.channel==='Email'&&validMail(r.email)){let url='https://mail.google.com/mail/?view=cm&fs=1&to='+encodeURIComponent(r.email);if(r.subject)url+='&su='+encodeURIComponent(r.subject);if(r.draft)url+='&body='+encodeURIComponent(r.draft);if(r.cc)url+='&cc='+encodeURIComponent(r.cc);return url;} if(['LinkedIn','Instagram','Other'].includes(r.channel))return safeUrl(r.profile);return null;}
  function opportunityCard(r){
    const prepared=!!r.draft?.trim(),preview=prepared?r.draft:(r.type==='Business'?businessDraft(r).draft:r.type==='Career Outreach'?generalEmploymentDraft(r).draft:'');
    const proposedSubject=prepared?r.subject:(r.type==='Business'?businessDraft(r).subject:r.type==='Career Outreach'?generalEmploymentDraft(r).subject:'');
    const available=!!destinationFor(r),already=isSent(r),approved=isApproved(r)&&messageIsApproved(r);
    const email=r.channel==='Email',needsRecipient=email&&!validMail(r.email);
    const status=!prepared?'Draft suggested · save or edit before approving':!approved?'Draft saved · awaiting your approval':'Approved draft · ready to open';
    return '<article class="card opportunity"><div class="top"><div><div class="eyebrow">'+escapeHtml(r.type)+' · '+escapeHtml(r.channel)+'</div><h3>'+escapeHtml(r.name)+'</h3><p class="subtitle">'+escapeHtml([r.industry,r.location].filter(Boolean).join(' · ')||'No location added')+'</p></div><span class="badge '+stageBadge(r.stage)+'">'+escapeHtml(r.stage)+'</span></div>'+
      (r.sourceUrl?'<p class="small subtle">Research source: <a target="_blank" rel="noopener noreferrer" href="'+escapeHtml(safeUrl(r.sourceUrl)||'#')+'">View evidence ↗</a></p>':'')+
      '<p class="small subtle">'+escapeHtml(status)+'</p>'+
      (proposedSubject?'<div class="draft-subject"><strong>Subject:</strong> '+escapeHtml(proposedSubject)+'</div>':'')+
      '<div class="draft-preview">'+escapeHtml(preview||'No draft prepared yet. Open this opportunity to add one.')+'</div>'+
      '<div class="card-foot">'+
      (!prepared&&preview?'<button class="button button-primary button-small" data-action="savedraft" data-id="'+escapeHtml(r.id)+'">Save suggested draft</button>':'')+
      (prepared&&!approved?'<button class="button button-primary button-small" data-action="approvequick" data-id="'+escapeHtml(r.id)+'">Approve message</button>':'')+
      (preview?'<button class="button button-secondary button-small" data-action="copydraft" data-id="'+escapeHtml(r.id)+'">Copy message</button>':'')+
      (prepared&&approved&&email&&validMail(r.email)?'<button class="button button-primary button-small" data-action="gmaildraft" data-id="'+escapeHtml(r.id)+'">Create Gmail draft</button>':'')+
      (preview&&email?'<button class="button button-secondary button-small" data-action="opencompose" data-id="'+escapeHtml(r.id)+'">Open Gmail compose</button>':'')+
      (prepared&&approved&&!email&&available?'<button class="button button-secondary button-small" data-action="copyopen" data-id="'+escapeHtml(r.id)+'">Copy & open '+escapeHtml(r.channel)+'</button>':'')+
      '<button class="button button-secondary button-small" data-action="edit" data-id="'+escapeHtml(r.id)+'">Edit details</button>'+
      (prepared&&!already?'<button class="button button-secondary button-small" data-action="confirmsent" data-id="'+escapeHtml(r.id)+'">I sent it</button>':'')+
      '</div>'+
      (needsRecipient?'<p class="small subtle">No verified recipient yet. Copy or open the draft with an empty To field, then find and enter a real address yourself. JobOS cannot send to an unknown person.</p>':'')+
      (!available&&!email?'<p class="small subtle">Add a verified professional profile URL before opening the social conversation.</p>':'')+
      '</article>';
  }
  function queue(){
    const cards=filtered().filter(r=>(r.draft?.trim()||r.type==='Business'||r.type==='Career Outreach')&&munkosContactReady(r));
    return `${toolbar()}<p class="section-intro">Every business and career-outreach prospect can have a suggested draft. Preview or copy a message before a recipient is found; approve the saved message before sending. JobOS records only sends you confirm.</p>${cards.length?'<div class="opportunity-grid">'+cards.map(opportunityCard).join('')+'</div>':empty('No outreach prospects yet','Research and import businesses to prepare first drafts.',true)}`;
  }
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
  function insights(){
  const all=state.records,careers=all.filter(r=>r.type==='Career'),careerOutreach=all.filter(r=>r.type==='Career Outreach'),commercial=all.filter(r=>['Business','Collaboration'].includes(r.type)),network=all.filter(r=>r.type==='Networking');
  const applied=careers.filter(r=>['Applied','Contacted','Recruiter Screen','Interview','Offer'].includes(r.stage)||!!r.appliedDate);
  const interviews=careers.filter(r=>['Interview','Offer'].includes(r.stage));
  const businessSent=commercial.filter(isSent),businessReplies=businessSent.filter(isReply),businessPositive=businessSent.filter(positiveReply),wins=commercial.filter(r=>r.stage==='Won');
  const draftRevisions=state.activities.filter(a=>a.kind==='draft-revision'),passed=all.filter(isPassed),passedReasons=Object.entries(passed.reduce((acc,r)=>{const k=r.passReason||'No reason recorded';acc[k]=(acc[k]||0)+1;return acc;},{})).sort((a,b)=>b[1]-a[1]);
  const group=new Map();
  for(const r of commercial){const key=(r.offerModule||r.industry||'Unspecified industry').trim();if(!group.has(key))group.set(key,{leads:0,sent:0,replies:0,positive:0,wins:0});const k=group.get(key);k.leads++;if(isSent(r)){k.sent++;if(isReply(r))k.replies++;if(positiveReply(r))k.positive++;}if(r.stage==='Won')k.wins++;}
  const rows=[...group.entries()].sort((a,b)=>b[1].leads-a[1].leads).map(([name,k])=>'<tr><td>'+escapeHtml(name)+'</td><td>'+k.leads+'</td><td>'+k.sent+'</td><td>'+k.replies+'</td><td>'+k.positive+'</td><td>'+k.wins+'</td></tr>').join('');
  return '<div class="cards">'+metricCard('Applications recorded',applied.length,'Employment · confirmed or dated')+metricCard('Interview stages',interviews.length,'Employment · current stages')+metricCard('Business positive replies',businessPositive.length,'Classified human replies')+metricCard('Business wins',wins.length,'Confirmed won stages')+'</div>'+
    '<div class="insights-grid"><section class="card">'+cardHead('Business outreach funnel',null)+'<p class="small subtle">Real sends and manually classified responses only. Unsent drafts and automated replies are excluded.</p>'+
      '<div class="funnel-summary">'+[['Prospects',commercial.length],['Contacted',businessSent.length],['Human replies',businessReplies.length],['Positive replies',businessPositive.length],['Clients won',wins.length]].map(([label,value])=>'<div class="funnel-step"><strong>'+value+'</strong><span>'+label+'</span></div>').join('')+'</div>'+
      '<p class="small subtle">Reply rate: '+pct(businessReplies.length,businessSent.length)+' · Positive reply rate: '+pct(businessPositive.length,businessSent.length)+' · Win rate among contacted: '+pct(wins.filter(isSent).length,businessSent.length)+'</p>'+
      '<h3 class="section-heading">IndustryOS / industry segments</h3><div class="table-wrap"><table class="data-table"><thead><tr><th>Segment / module</th><th>Leads</th><th>Sent</th><th>Replies</th><th>Positive</th><th>Won</th></tr></thead><tbody>'+rows+'</tbody></table></div></section>'+
    '<section class="card">'+cardHead('Employment & networking',null)+
      '<div class="funnel-summary">'+[['Jobs tracked',careers.length],['Applications',applied.length],['Interviews',interviews.length],['Offers',careers.filter(r=>r.stage==='Offer').length],['Career outreach sent',careerOutreach.filter(isSent).length],['Network contacts',network.length]].map(([label,value])=>'<div class="funnel-step"><strong>'+value+'</strong><span>'+label+'</span></div>').join('')+'</div>'+
      '<p class="small subtle">These are current record stages, not a historical total of all interviews or offers. Recruiter outreach is tracked as messaging activity, separate from applications.</p>'+
      '<h3 class="section-heading">Career Outreach</h3><p class="small subtle">'+careerOutreach.length+' employers tracked · '+careerOutreach.filter(isSent).length+' messages sent · '+careerOutreach.filter(isReply).length+' human replies · '+careerOutreach.filter(r=>['Meeting Booked','Interview'].includes(r.stage)).length+' meetings/interviews at current stage.</p>'+'<h3 class="section-heading">Draft revisions captured</h3><p class="small subtle">'+draftRevisions.length+' draft edits stored in your encrypted vault. These examples do not automatically affect future AI research until the learning integration is connected.</p>'+'<h3 class="section-heading">Pass feedback · future ranking</h3>'+(passedReasons.length?passedReasons.map(([reason,n])=>'<div class="lead-row"><div class="lead-info"><span class="lead-name">'+escapeHtml(reason)+'</span></div><span class="badge">'+n+'</span></div>').join(''):'<p class="small subtle">No passes yet. Dismissing an opportunity records a reason and excludes that exact record from active queues.</p>')+'<h3 class="section-heading">Privacy & exports</h3><div class="inline-actions"><button class="button button-primary button-small" data-action="backup">Encrypted backup</button><button class="button button-secondary button-small" data-action="csv">Export CSV</button></div><p class="small subtle">CSV is unencrypted. Keep copies private.</p></section></div>'+replyReviewPanel();
}
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
  function navigate(view){selectedRecordId=view==='detail'?selectedRecordId:null;activeView=VIEWS[view]?view:'overview';filter={query:'',type:'All',stage:'All'};render();$('main-content').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
  function render(){if(!state)return;ensureStrategies();const [title,subtitle]=VIEWS[activeView];$('top-view').textContent=activeView.toUpperCase();$('page-title').innerHTML=escapeHtml(title.replace(/\.$/,''))+'<span class="lime-dot">.</span>';$('page-subtitle').textContent=subtitle;$('eyebrow').textContent=new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'}).toUpperCase();const s=stat();$('nav-ready').textContent=state.records.filter(r=>!isPassed(r)&&(r.draft?.trim()||['Business','Career Outreach'].includes(r.type))).length;$('nav-due').textContent=s.due;document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===activeView));$('view-root').innerHTML=({overview,detail,intake,career:()=>workspace('career'),careeroutreach:()=>workspace('careeroutreach'),business:()=>workspace('business'),networking:()=>workspace('networking'),queue,contacts,pipeline,followups,insights,strategies:strategiesView}[activeView])();}
  function editRecord(id=null,type=null){ensureStrategies();editingId=id;const r=id?findRecord(id):null;$('record-title').textContent=r?'Edit opportunity':'New opportunity';$('delete-record').hidden=!r;const form=$('record-form');form.reset();if(!r && type)form.elements.type.value=type;else if(!r && workspaceType(activeView))form.elements.type.value=workspaceType(activeView);form.elements.strategyId.innerHTML='<option value="">Not in an experiment</option>'+state.strategies.filter(x=>x.status!=='archived'||x.id===r?.strategyId).map(x=>'<option value="'+escapeHtml(x.id)+'">'+escapeHtml(x.name)+'</option>').join('');for(const el of form.elements){if(el.name&&r&&Object.hasOwn(r,el.name))el.value=r[el.name]??'';}$('record-error').textContent='';$('record-modal').showModal();syncRecordFormType();form.elements.name.focus();}
  function canonical(value){return String(value||'').toLowerCase().trim().replace(/^https?:\/\//,'').replace(/^www\./,'').replace(/\/$/,'');}
  function isDuplicatePair(a,b){if(a.type==='Career'&&b.type==='Career')return (a.jobUrl&&b.jobUrl&&canonical(a.jobUrl)===canonical(b.jobUrl))||(!a.jobUrl&&!b.jobUrl&&a.name.toLowerCase()===b.name.toLowerCase()&&a.jobTitle&&b.jobTitle&&a.jobTitle.toLowerCase()===b.jobTitle.toLowerCase());return a.type===b.type&&((a.email&&b.email&&a.email.toLowerCase()===b.email.toLowerCase())||(a.website&&b.website&&canonical(a.website)===canonical(b.website)&&a.name.toLowerCase()===b.name.toLowerCase()));}
  function duplicate(rec,id){return state.records.some(r=>r.id!==id&&isDuplicatePair(rec,r));}
  function normalized(raw,id,extraStrategyIds=[]){const fields=['name','type','industry','location','person','channel','email','profile','website','stage','followup','concept','angle','subject','draft','notes','strategyId','variant','cc','sourceUrl','researchDate','verification','priority','jobTitle','jobUrl','salary','appliedDate','resumeUrl','coverLetterUrl','applicationFriction','contactVerified','offerModule','painEvidenceUrl','painHypothesis','packageNotes','locationBucket','distanceMiles','remoteWisconsinEligible','roleFit','compensationFit','employmentPitch','contactSource','socialSource'];const result={};for(const key of fields)result[key]=String(raw[key]||'').trim();if(!result.name)throw Error('Organization name is required.');if(result.name.length>150)throw Error('Organization name is too long.');if(!['Business','Career','Career Outreach','Networking','Collaboration'].includes(result.type))result.type='Business';if(!['Email','LinkedIn','Instagram','Other'].includes(result.channel))result.channel='Email';if(!stageFor(result.type).includes(result.stage))result.stage='Discovered';if(!['A','B'].includes(result.variant))result.variant='A';if(result.strategyId&&!state.strategies.some(x=>x.id===result.strategyId)&&!extraStrategyIds.includes(result.strategyId))throw Error('Unknown outreach strategy.');if(result.email&&!validMail(result.email))throw Error('Invalid email address.');const ccAddresses=result.cc?result.cc.split(',').map(x=>x.trim()):[];if(ccAddresses.length>3||ccAddresses.some(x=>!validMail(x)||x.toLowerCase()===result.email.toLowerCase()))throw Error('CC must contain up to three valid, distinct stakeholder emails, excluding the main recipient.');if(new Set(ccAddresses.map(x=>x.toLowerCase())).size!==ccAddresses.length)throw Error('Duplicate CC address.');for(const k of ['profile','website','concept','sourceUrl','jobUrl','resumeUrl','coverLetterUrl','painEvidenceUrl','contactSource','socialSource'])if(result[k]&&!safeUrl(result[k]))throw Error(`Invalid ${k} URL. Only http(s) links are allowed.`);if(result.followup&&!/^\d{4}-\d{2}-\d{2}$/.test(result.followup))throw Error('Follow-up must use YYYY-MM-DD.');if(result.appliedDate&&!/^\d{4}-\d{2}-\d{2}$/.test(result.appliedDate))throw Error('Application date must use YYYY-MM-DD.');if(result.researchDate&&!/^\d{4}-\d{2}-\d{2}$/.test(result.researchDate))throw Error('Research date must use YYYY-MM-DD.');if(!['','official-site','directory','unverified'].includes(result.verification))throw Error('Invalid contact verification label.');if(result.priority&&!/^(100|[1-9]?\d)$/.test(result.priority))throw Error('Research priority must be 0–100.');if(!['','low','medium','high','workday'].includes(result.applicationFriction))throw Error('Invalid application friction.');if(!['','official','public-profile'].includes(result.contactVerified))throw Error('Invalid contact verification.');if(!['','local20','remote','other'].includes(result.locationBucket))throw Error('Invalid location bucket.');if(result.distanceMiles&&(!Number.isFinite(Number(result.distanceMiles))||Number(result.distanceMiles)<0||Number(result.distanceMiles)>10000))throw Error('Invalid distance.');if(!['','yes','no','unknown'].includes(result.remoteWisconsinEligible))throw Error('Invalid remote WI eligibility.');if(!['','strong','moderate','weak'].includes(result.roleFit))throw Error('Invalid role fit label.');if(!['','target','minimum','below','unknown'].includes(result.compensationFit))throw Error('Invalid compensation label.');if(result.draft.length>9000||result.notes.length>4000)throw Error('Draft or notes are too long.');result.id=id||randomId();return result;}
  async function saveRecord(event){event.preventDefault();const form=event.currentTarget;const raw=Object.fromEntries(new FormData(form).entries());try{const rec=normalized(raw,editingId);if(!editingId&&!rec.draft&&['Business','Career Outreach'].includes(rec.type)){const generated=rec.type==='Business'?businessDraft(rec):generalEmploymentDraft(rec);rec.subject=generated.subject;rec.draft=generated.draft;}if(duplicate(rec,editingId))throw Error('Possible duplicate found with the same email or business domain. Check the existing record.');const prior=editingId?findRecord(editingId):null;const now=new Date().toISOString();if(prior&&(prior.sourceUrl!==rec.sourceUrl||prior.jobUrl!==rec.jobUrl||prior.email!==rec.email||prior.profile!==rec.profile||prior.verification!==rec.verification)){rec.intakeReview=provenanceReady(rec)?'recommended':'pending';rec.reviewedAt='';}if(prior&&(prior.draft!==rec.draft||prior.subject!==rec.subject||prior.channel!==rec.channel||prior.email!==rec.email||prior.profile!==rec.profile||prior.cc!==rec.cc)){rec.messageApprovedAt='';}if(prior&&prior.draft!==rec.draft&&prior.draft){activity(rec.id,'draft-revision','Draft edited; approval revoked','',{previous:prior.draft.slice(0,9000),revised:rec.draft.slice(0,9000),source:prior.type});}
    if(prior){const idx=state.records.findIndex(r=>r.id===editingId);state.records[idx]={...prior,...rec,updatedAt:now};activity(rec.id,'edited','Opportunity updated');}else{state.records.unshift({...rec,intakeReview:provenanceReady(rec)?'recommended':'pending',createdAt:now,updatedAt:now});activity(rec.id,'created','Opportunity added');}await persist();$('record-modal').close();notify('Opportunity saved securely.');}catch(err){$('record-error').textContent=err.message;}}
  async function deleteRecord(){if(!editingId)return;const record=findRecord(editingId);if(!confirm(`Delete ${record.name} and its associated activity history? This cannot be undone without a backup.`))return;state.records=state.records.filter(r=>r.id!==editingId);state.activities=state.activities.filter(a=>a.recordId!==editingId);await persist();$('record-modal').close();notify('Record deleted.');}
  async function saveSuggestedDraft(id){
    const r=findRecord(id);if(!r||isPassed(r))return;
    if(!['Business','Career Outreach'].includes(r.type))return notify('Suggested drafts are available for business and employer outreach.');
    if(r.draft?.trim())return editRecord(id);
    const suggested=r.type==='Business'?businessDraft(r):generalEmploymentDraft(r);
    r.subject=suggested.subject;r.draft=suggested.draft;r.messageApprovedAt='';r.updatedAt=new Date().toISOString();
    activity(r.id,'draft-prepared','Suggested outreach draft saved for review');
    await persist();notify('Draft saved. Review or edit it before sending.');
  }
  async function openBusinessSocial(id){
    const r=findRecord(id);if(!r||r.type!=='Business'||isPassed(r)||r.optedOut)return;
    const target=verifiedSocialUrl(r.profile);if(!target)return notify('No company social profile found for this business.');
    const message=businessSocialDraft(r);
    try{await navigator.clipboard.writeText(message);}catch{notify('Clipboard not available. Copy the suggested DM from the card.');}
    window.open(target,'_blank','noopener,noreferrer');
    activity(r.id,'social-draft-opened','Social profile opened with a suggested DM, not sent','',{channel:'social',platform:new URL(target).hostname});
    await persist();notify('Social profile opened and short message copied. Nothing was sent.');
  }
  async function copyDraft(id){
    const r=findRecord(id);if(!r)return;
    const text=r.draft?.trim()||(['Business','Career Outreach'].includes(r.type)?(r.type==='Business'?businessDraft(r):generalEmploymentDraft(r)).draft:'');
    if(!text)return notify('No message is available to copy.');
    try{await navigator.clipboard.writeText(text);notify('Draft copied. This did not record a send.');}
    catch{notify('Clipboard permission denied. Select and copy the text shown in the card.');}
  }
  function openGmailComposer(id){
    const r=findRecord(id);if(!r||r.optedOut||isPassed(r))return;
    if(r.channel!=='Email')return notify('Choose Email as the contact channel first.');
    if(r.type==='Business'&&!validMail(r.email))return notify('No verified To address found. This prospect is held for contact research.');
    const proposed=r.type==='Business'?businessDraft(r):r.type==='Career Outreach'?generalEmploymentDraft(r):{subject:r.subject||'',draft:r.draft||''};
    const subject=r.subject||proposed.subject,body=r.draft||proposed.draft;
    if(!body.trim())return notify('No email draft is available yet.');
    let url='https://mail.google.com/mail/?view=cm&fs=1';
    if(validMail(r.email))url+='&to='+encodeURIComponent(r.email);
    url+='&su='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
    window.open(url,'_blank','noopener,noreferrer');
    notify(validMail(r.email)?'Gmail compose opened. This has not been sent.':'Gmail compose opened with an empty recipient. Add a real verified address before sending.');
  }
  async function confirmExternalSend(id){
    const r=findRecord(id);if(!r||isPassed(r)||r.optedOut)return;
    if(!r.draft?.trim())return notify('Save the draft before recording a send.');
    if(r.channel==='Email'&&!validMail(r.email)){
      const address=prompt('Which email address did you actually send this to? Enter the exact recipient address to record the send.','');
      if(address===null)return;
      const entered=String(address).trim();
      if(!validMail(entered))return notify('Enter a valid email recipient. No send was recorded.');
      if(!confirm('Confirm you actually sent this message to '+entered+'?'))return;
      r.email=entered;
      r.approvedDestination=entered;
      r.updatedAt=new Date().toISOString();
      activity(r.id,'recipient-confirmed','External email recipient entered after confirmed send','',{recipient:entered});
      await persist();
    }
    if(!isApproved(r)||!messageIsApproved(r))return notify('Approve the opportunity and exact saved message before recording a send.');
    pendingSendId=id;
    $('confirm-desc').textContent='Did you actually send this '+r.channel+' message to '+r.name+'? Opening Gmail or copying the draft does not count.';
    $('confirm-modal').showModal();
  }
  async function copyAndOpen(id){const r=findRecord(id);if(r&&isPassed(r))return notify('Passed opportunities cannot be contacted.');if(!isApproved(r)||!messageIsApproved(r))return notify('Approve the opportunity and current message in Intake first.');if(r?.optedOut)return notify('This prospect opted out. No further outreach.');if(!r||!r.draft?.trim())return notify('Save a draft first.');const target=destinationFor(r);if(!target)return notify('Add a verified email or profile URL first.');window.open(target,'_blank','noopener,noreferrer');try{await navigator.clipboard.writeText(r.draft);notify('Draft copied. Confirm the send only after sending externally.');}catch{notify('Opened destination, but clipboard permission was denied. Copy your draft manually.');}
    pendingSendId=id;$('confirm-desc').textContent=`Did you actually send your ${r.channel} message to ${r.name}? Copying a draft or opening a tab does not count as sending.`;$('confirm-modal').showModal();}
  async function markSent(){const r=findRecord(pendingSendId);if(!r)return;if(r.optedOut){$('confirm-modal').close();pendingSendId=null;return notify('Do not contact: this prospect opted out.');}$('confirm-modal').close();const now=new Date().toISOString();activity(r.id,'sent',`${r.channel} message confirmed sent`,r.draft,{strategyId:r.strategyId||'',variant:r.variant||'',industry:r.industry||'',wordCount:(r.draft||'').trim().split(/\s+/).filter(Boolean).length,subject:r.subject||'',ccCount:r.cc?r.cc.split(',').filter(Boolean).length:0,channel:r.channel});if(['Discovered','Researched','Draft Ready'].includes(r.stage))r.stage='Contacted';if(!r.followup)r.followup=workdaysFrom(today(),5);r.updatedAt=now;pendingSendId=null;await persist();notify('Send recorded. Follow-up scheduled if needed.');}
  async function downloadApplicationKit(id){
    const r=findRecord(id);if(!r||r.type!=='Career')return;
    if(!window.JobOSDocuments?.has(r))return notify('No prepared resume and cover letter are available for this job.');
    try{
      const names=await window.JobOSDocuments.downloadBoth(r);
      activity(r.id,'downloaded-documents','Separate resume and cover letter PDFs downloaded','',{jobTitle:r.jobTitle||'',files:names.join(', ')});
      await persist();
      notify('Both PDFs downloaded. If only one appears, allow multiple downloads for JobOS and click again.');
    }catch(error){notify('PDF downloads failed: '+error.message);}
  }
  async function downloadJobPDF(id,kind){
    const r=findRecord(id);if(!r||r.type!=='Career')return;
    if(!window.JobOSDocuments?.has(r))return notify('No reviewed PDF package is ready for this job.');
    try{
      await window.JobOSDocuments.ensure();
      const name=window.JobOSDocuments.save(r,kind);
      activity(r.id,'downloaded-document',kind+' PDF downloaded','',{jobTitle:r.jobTitle||'',file:name});
      await persist();notify(kind.replace('_',' ')+' downloaded: '+name);
    }catch(error){notify('PDF download failed: '+error.message);}
  }
  async function copyRecruiterNote(id){
    const r=findRecord(id);if(!r||!window.JobOSDocuments?.has(r))return;
    try{await navigator.clipboard.writeText(window.JobOSDocuments.message(r,'LinkedIn'));notify('LinkedIn message copied, not sent.');}
    catch{notify('Clipboard unavailable. You can select and copy the visible draft.');}
  }
  function openRecruiterEmail(id){
    const r=findRecord(id),contact=window.JobOSDocuments?.recruiter(r);
    if(!r||!contact?.email)return notify('No verified team email address is available.');
    const m=window.JobOSDocuments.message(r,'Email');
    const url='https://mail.google.com/mail/?view=cm&fs=1&to='+encodeURIComponent(contact.email)+'&su='+encodeURIComponent(m.subject)+'&body='+encodeURIComponent(m.body);
    window.open(url,'_blank','noopener,noreferrer');
    notify('Gmail compose opened for the public recruiting inbox. Nothing was sent.');
  }
  async function prepareATS(id){return downloadJobPDF(id,'Resume');}

  async function prepareRecruiterMessage(id){
    const r=findRecord(id);if(!r||r.type!=='Career')return;
    if(!r.appliedDate)return notify('Record your submitted application before drafting a “just applied” note.');
    const suggested=recruiterDraft(r);
    if(!suggested)return notify('A verified recruiter name plus email address or professional profile is required. No contact will be guessed.');
    if(r.draft&&r.draft!==suggested.draft&&!confirm('Replace the current message with a new post-application note? Your previous wording will be saved in the edit history.'))return editRecord(id);
    if(r.draft&&r.draft!==suggested.draft)activity(r.id,'draft-revision','Recruiter follow-up draft replaced','',{previous:r.draft.slice(0,9000),revised:suggested.draft.slice(0,9000)});
    r.subject=suggested.subject;r.draft=suggested.draft;r.channel=suggested.channel;
    r.messageApprovedAt='';r.updatedAt=new Date().toISOString();
    activity(r.id,'recruiter-draft','Post-application recruiter message prepared for approval');
    await persist();editRecord(id);
  }
  async function markApplied(id){const rec=findRecord(id);if(!rec||rec.type!=='Career')return;if(isPassed(rec))return notify('This opportunity was passed.');if(!isApproved(rec)||!jobMeetsThreshold(rec))return notify('Only verified jobs scoring at least 75 may enter the application queue.');if(['Applied','Recruiter Screen','Interview','Offer'].includes(rec.stage))return notify('Application already recorded.');if(!confirm('Confirm you submitted an application for '+(rec.jobTitle||'this job')+' at '+rec.name+'?'))return;rec.stage='Applied';rec.appliedDate=today();rec.updatedAt=new Date().toISOString();if(!rec.followup)rec.followup=workdaysFrom(today(),6);activity(rec.id,'application','Job application confirmed submitted','',{jobTitle:rec.jobTitle||'',jobUrl:rec.jobUrl||'',appliedDate:rec.appliedDate});const followUp=recruiterDraft(rec);if(followUp&&!rec.draft){rec.subject=followUp.subject;rec.draft=followUp.draft;rec.channel=followUp.channel;rec.messageApprovedAt='';activity(rec.id,'recruiter-draft','Verified-contact follow-up note prepared for approval');}await persist();notify('Application recorded and follow-up suggested.');}
  async function markReply(id){showReplyModal(id);}
  async function snooze(id){const r=findRecord(id);if(!r||!r.followup)return;r.followup=workdaysFrom(r.followup>today()?r.followup:today(),5);r.updatedAt=new Date().toISOString();activity(r.id,'followup','Follow-up rescheduled');await persist();notify('Follow-up moved five business days.');}
  const download=(filename,blob)=>{const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  function encryptedBackup(){const encrypted=localStorage.getItem(STORAGE_KEY);if(!encrypted)return;download(`levios-outreach-encrypted-${today()}.json`,new Blob([encrypted],{type:'application/json'}));notify('Encrypted vault backup downloaded.');}
  function exportCsv(){if(!confirm('CSV is plain text and will contain private contact information. Export an unencrypted CSV?'))return;const keys=['name','type','industry','location','person','channel','email','website','profile','stage','followup','concept','angle','subject','draft','notes','jobTitle','jobUrl','salary','appliedDate','sourceUrl','researchDate','resumeUrl','coverLetterUrl','applicationFriction','contactVerified','offerModule','painEvidenceUrl','painHypothesis','packageNotes','locationBucket','distanceMiles','remoteWisconsinEligible','roleFit','compensationFit','employmentPitch'];const esc = v=>{let s=String(v??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};const rows=[keys.map(esc).join(','),...state.records.map(r=>keys.map(k=>esc(r[k])).join(','))].join('\r\n');download(`levios-outreach-${today()}.csv`,new Blob([rows],{type:'text/csv;charset=utf-8'}));notify('Plain-text CSV exported. Keep it private.');}
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
        if(rec.type==='Career'&&!jobMeetsThreshold(rec)){skipped++;continue;}
        if(rec.type==='Business'&&!rec.draft){const generated=businessDraft(rec);rec.subject=generated.subject;rec.draft=generated.draft;}
        if(rec.type==='Career Outreach'&&!rec.draft){const generated=generalEmploymentDraft(rec);rec.subject=generated.subject;rec.draft=generated.draft;}
        if(duplicate(rec)||proposed.some(r=>isDuplicatePair(rec,r))){skipped++;continue;}
        const now=new Date().toISOString();proposed.push({...rec,intakeReview:provenanceReady(rec)?'recommended':'pending',createdAt:now,updatedAt:now});
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
  function handleAction(el){const action=el.dataset.action,id=el.dataset.id;if(action==='opensocial')return openBusinessSocial(id);if(action==='downloadkit')return downloadApplicationKit(id);if(action==='pdfresume')return downloadJobPDF(id,'Resume');if(action==='pdfcover')return downloadJobPDF(id,'Cover_Letter');if(action==='copyrecruiter')return copyRecruiterNote(id);if(action==='emailrecruiter')return openRecruiterEmail(id);if(action==='opendetail'){detailReturnView=activeView;selectedRecordId=id;return navigate('detail');}if(action==='detailback')return navigate(detailReturnView);if(action==='savedraft')return saveSuggestedDraft(id);if(action==='copydraft')return copyDraft(id);if(action==='opencompose')return openGmailComposer(id);if(action==='confirmsent')return confirmExternalSend(id);if(action==='approvequick')return approveMessage(id);if(action==='prepareats')return prepareATS(id);if(action==='recruiterdraft')return prepareRecruiterMessage(id);if(action==='researchsetup')return document.getElementById('cloud-open')?.click();if(action==='researchsync'){if(window.LeviCloud?.refreshResearch)return window.LeviCloud.refreshResearch().catch(e=>notify('Research inbox: '+e.message));return document.getElementById('cloud-open')?.click();}if(action==='passlead')return passLead(id,el.closest('.intake-item,.package-row')?.querySelector('[data-pass-reason]')?.value||'Not a fit');if(action==='approvelead')return approveLead(id);if(action==='rejectlead')return rejectLead(id);if(action==='approvemessage')return approveMessage(id);if(action==='applied')return markApplied(id);if(action==='scanreplies')return scanReplies();if(action==='classifyreply')return showReplyModal(id,el.dataset.message||'');if(action==='strategynew')return editStrategy();if(action==='strategyedit')return editStrategy(id);if(action==='new')return editRecord(null,el.dataset.type||null);if(action==='edit')return editRecord(id);if(action==='copyopen')return copyAndOpen(id);if(action==='gmaildraft'){const r=findRecord(id);if(r&&isPassed(r))return notify('Passed opportunities cannot be contacted.');if(!r||!isApproved(r)||!messageIsApproved(r))return notify('Approve the opportunity and current message in Intake first.');if(r?.optedOut)return notify('Do not contact: this prospect opted out.');if(!window.LeviCloud)return notify('Cloud integration unavailable.');window.LeviCloud.createDraft(r).then(()=>notify('Gmail draft created, not sent. Check Gmail Drafts.')).catch(e=>alert('Gmail draft was not created: '+e.message));return;}if(action==='reply')return markReply(id);if(action==='snooze')return snooze(id);if(action==='backup')return encryptedBackup();if(action==='csv')return exportCsv();if(action==='import')return $('import-file').click();}
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
  window.JobOSRefreshInbox=()=>{if(state)render();};
  window.LeviOutreachIsUnlocked=()=>!!state;
  window.LeviOutreachImportResearchPack=async(pack)=>{
    if(!state)throw Error('Unlock the encrypted workspace first.');
    if(!pack||!Array.isArray(pack.records)||pack.records.length>50||!(pack.strategies===undefined||Array.isArray(pack.strategies)))throw Error('Invalid research inbox batch.');
    // Preserve verified record type. The server gate permits only sourced Career and Business research.
    // Always strip outbound fields: research is never a send, application, or message approval.
    const rows=pack.records.map(r=>{
      if(!r||!['Business','Career','Career Outreach'].includes(r.type))throw Error('Unsupported research record category.');
      if(!safeUrl(r.sourceUrl)||!r.researchDate)throw Error('Research source or date missing.');
      if(r.type==='Career'&&(!safeUrl(r.jobUrl)||r.verification!=='official-site'))throw Error('Career posting missing a verified source.');
      if(r.type==='Career Outreach'&&(!safeUrl(r.profile)||r.contactVerified!=='public-profile'||!r.person))throw Error('Career Outreach requires a named public professional contact.');
      return {...r,stage:r.type==='Career'?'Discovered':'Researched',channel:r.type==='Career Outreach'?'LinkedIn':r.channel,draft:'',subject:'',cc:'',followup:''};
    });
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
  // Export only minimal negative signals for owner-only research suppression when cloud sync is active.
  // Never export resumes, message content, emails, or the encrypted vault to the research feedback table.
  window.LeviOutreachPassedFeedback=()=>{
    if(!state)return [];
    const out=[];
    for(const r of state.records.filter(x=>x.intakeReview==='passed')){
      let key='';
      if(r.type==='Career'&&safeUrl(r.jobUrl)){
        const u=new URL(r.jobUrl);key='career|'+u.origin.toLowerCase()+u.pathname.replace(/\/$/,'').toLowerCase();
      }else if(r.type==='Business'&&safeUrl(r.website)){
        const u=new URL(r.website);key='business|'+r.name.trim().toLowerCase()+'|'+u.hostname.toLowerCase().replace(/^www\./,'');
      }
      if(key)out.push({opportunity_key:key,reason:String(r.passReason||'Not a fit').slice(0,120),category:r.type,updated_at:r.passAt||new Date().toISOString()});
    }
    return out;
  };
  window.LeviOutreachTrackedEmails=()=>state?[...new Set(state.records.filter(r=>r.email&&isSent(r)).map(r=>r.email))]:[];
  setAuthMode();
})();