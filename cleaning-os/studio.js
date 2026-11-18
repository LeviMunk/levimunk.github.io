(()=>{'use strict';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const services=[
 ['calendar','Google Calendar','Scheduling','View appointments; future create/reschedule with permission'],
 ['gmail','Gmail','Communications','Review or draft customer replies with approval'],
 ['meta','Facebook / Instagram','Marketing','Eligible business-account publishing and messaging'],
 ['business','Google Business Profile','Local presence','Listing data and supported review workflows'],
 ['wordpress','WordPress','Website','Supported editing and lead-form integration'],
 ['squarespace','Squarespace','Website','Link existing site; supported API access varies']
];
const platforms=['Other / unsure','WordPress','Squarespace','Wix','Shopify','Custom site','No website'];
const ways=['Not decided','Existing website','Hosted website'];
const states=['Not configured','Setup planned','Reference saved only'];
function safeUrl(raw){
 const v=String(raw||'').trim();
 if(!v)return '';
 try{const u=new URL(v);return (u.protocol==='https:'||u.protocol==='http:')&&u.username===''&&u.password===''?u.href:''}catch(e){return ''}
}
function ensure(s){
 if(!s.studio||typeof s.studio!=='object'||Array.isArray(s.studio))s.studio={};
 const st=s.studio;
 if(!ways.includes(st.websiteMode))st.websiteMode='Not decided';
 if(!platforms.includes(st.platform))st.platform='Other / unsure';
 if(typeof st.websiteUrl!=='string')st.websiteUrl='';
 if(typeof st.domainIdea!=='string')st.domainIdea='';
 if(typeof st.notes!=='string')st.notes='';
 if(typeof st.supportEmail!=='string')st.supportEmail='';
 if(!st.connections||typeof st.connections!=='object'||Array.isArray(st.connections))st.connections={};
 if(!Array.isArray(st.requests))st.requests=[];
 st.requests=st.requests.filter(r=>r&&typeof r==='object').slice(0,100);
 if(!st.siteDraft||typeof st.siteDraft!=='object')st.siteDraft={};
 if(typeof st.siteDraft.imageUrl!=='string')st.siteDraft.imageUrl='';
 if(!['draft','preview'].includes(st.siteDraft.editorState))st.siteDraft.editorState='draft';
 return st
}
function setMode(s,mode){
 if(!ways.includes(mode))return {ok:false,reason:'Unknown website option'};
 ensure(s).websiteMode=mode;return {ok:true}
}
function configure(s,id,values){
 const item=services.find(x=>x[0]===id);if(!item)return {ok:false,reason:'Unknown integration'};
 const st=ensure(s),url=String(values.url||'').trim();
 if(url&&!safeUrl(url))return {ok:false,reason:'Use a complete http:// or https:// resource URL, without credentials'};
 const record={
  status:url?'Reference saved only':'Setup planned',
  url:url?safeUrl(url):'',
  goal:['Read data','Prepare drafts','Take approved actions'].includes(values.goal)?values.goal:'Read data',
  notes:String(values.notes||'').trim().slice(0,300)
 };
 st.connections[id]=record;
 return {ok:true}
}
function forget(s,id){if(!services.some(x=>x[0]===id))return false;delete ensure(s).connections[id];return true}
function websiteConfig(s,values){
 const st=ensure(s);const url=String(values.websiteUrl||'').trim();
 if(url&&!safeUrl(url))return {ok:false,reason:'Enter a complete website URL starting with https://'};
 const mode=values.websiteMode;
 if(!ways.includes(mode))return {ok:false,reason:'Choose a website setup'};
 st.websiteMode=mode;st.websiteUrl=url?safeUrl(url):'';
 st.platform=platforms.includes(values.platform)?values.platform:'Other / unsure';
 st.domainIdea=String(values.domainIdea||'').trim().slice(0,150).replace(/[<>]/g,'');
 st.notes=String(values.notes||'').trim().slice(0,500);
 return {ok:true}
}
function saveImage(s,imageUrl){
 const raw=String(imageUrl||'').trim();if(raw&&!safeUrl(raw))return {ok:false,reason:'Image URLs must be http:// or https://'};
 ensure(s).siteDraft.imageUrl=raw?safeUrl(raw):'';
 return {ok:true}
}
function addRequest(s,values){
 const st=ensure(s),title=String(values.title||'').trim().slice(0,110),description=String(values.description||'').trim().slice(0,1500);
 if(title.length<3||description.length<10)return {ok:false,reason:'Add a clear title and at least 10 characters of detail'};
 const category=['Text or image','New page','Redesign','New functionality','Domain / hosting','Other'].includes(values.category)?values.category:'Other';
 const priority=['Routine','Time-sensitive'].includes(values.priority)?values.priority:'Routine';
 const r={id:String(Date.now())+'-'+Math.random().toString(36).slice(2,7),title,description,category,priority,status:'Saved locally / not delivered',createdAt:new Date().toISOString().slice(0,10)};
 st.requests.unshift(r);return {ok:true,id:r.id}
}
function requestText(s,id){
 const r=ensure(s).requests.find(x=>x.id===String(id));if(!r)return '';
 return ['Website change request','Title: '+r.title,'Category: '+r.category,'Priority: '+r.priority,'Website: '+(ensure(s).websiteUrl||'Not specified'),'','Details:',r.description,'','Prepared in CleaningOS; please send to your site manager.'].join('\n');
}
function options(arr,selected){return arr.map(x=>'<option value="'+esc(x)+'"'+(selected===x?' selected':'')+'>'+esc(x)+'</option>').join('')}
function statusText(st){return st?.status==='Reference saved only'?'REFERENCE ONLY':st?.status==='Setup planned'?'SETUP PLANNED':'NOT CONFIGURED'}
function connections(s){
 const st=ensure(s);
 return '<div class="lc-header lc-header-convert"><div class="lc-header-inner"><span class="lc-number">↗</span><div><div class="eyebrow">CLEANINGOS / YOUR BUSINESS TOOLS</div><h1>Connections</h1><p>Keep your current tools. Plan what you want CleaningOS to read, draft or manage.</p></div></div></div>'
 +'<div class="studio-disclaimer"><strong>Integration setup workspace</strong><span>Connections here are setup plans and saved links, not live OAuth connections. Never paste passwords, API keys or customer secrets. Real syncing needs a secure backend and provider permissions.</span></div>'
 +'<div class="studio-service-grid">'+services.map(([id,name,category,description])=>{
 const record=st.connections[id],url=record?.url;
 return '<article class="studio-service"><div class="studio-service-top"><div><span class="eyebrow">'+esc(category)+'</span><h2>'+esc(name)+'</h2></div><span class="studio-chip">'+statusText(record)+'</span></div><p>'+esc(description)+'</p>'
 +(record?'<div class="studio-connection-summary"><strong>Desired access:</strong> '+esc(record.goal)+(url?' · <a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">Open reference ↗</a>':'')+(record.notes?'<p>'+esc(record.notes)+'</p>':'')+'</div>':'')
 +'<form data-studio-connection="'+id+'"><label class="field">Access to plan<select name="goal">'+options(['Read data','Prepare drafts','Take approved actions'],record?.goal||'Read data')+'</select></label><label class="field">Existing account or website URL (optional)<input name="url" type="url" placeholder="https://example.com" value="'+esc(url||'')+'"></label><label class="field">Setup notes<textarea name="notes" rows="2" maxlength="300" placeholder="e.g. calendar for cleaning appointments">'+esc(record?.notes||'')+'</textarea></label><div class="studio-actions"><button type="submit" class="btn">Save setup plan</button>'+(record?'<button type="button" class="btn alt" data-studio-forget="'+id+'">Clear plan</button>':'')+'</div></form></article>'
 }).join('')+'</div><div class="studio-nextstep"><h2>What will make these live?</h2><p>Owner authentication, encrypted OAuth credentials, an integration worker, approval controls, sync logs and secure tenant data. The next production integration to implement is Google Calendar.</p><button class="btn alt" data-page="convert">Open FrontDoor →</button></div>'
}
function choice(s){
 const st=ensure(s);
 return '<section class="studio-choices"><div class="studio-section-top"><div><span class="eyebrow">WEBSITE STUDIO / START HERE</span><h2>How do you manage your website?</h2><p>Use an existing website, request a hosted site, or decide later.</p></div><button class="btn alt" data-page="connections">Manage connections ↗</button></div>'
 +'<div class="studio-choice-grid">'+[
 ['Existing website','I already have a website','Record its platform and URL. Request changes or connect supported tools later.'],
 ['Hosted website','Build or host a site for me','Use a CleaningOS-branded template preview and collect domain preferences. No site is published yet.'],
 ['Not decided','Help me choose','Explore both paths before making a decision.']
 ].map(([mode,title,desc])=>'<button type="button" data-studio-mode="'+mode+'" class="studio-choice '+(st.websiteMode===mode?'selected':'')+'" aria-pressed="'+(st.websiteMode===mode?'true':'false')+'"><strong>'+esc(title)+'</strong><small>'+esc(desc)+'</small><span>'+(st.websiteMode===mode?'✓ Selected':'Choose path →')+'</span></button>').join('')+'</div>'
 +'<form class="studio-config" id="studio-website-config"><div class="studio-config-grid"><label class="field">Current website platform<select name="platform">'+options(platforms,st.platform)+'</select></label><label class="field">Existing website URL<input type="url" name="websiteUrl" placeholder="https://yourbusiness.com" value="'+esc(st.websiteUrl)+'"></label><label class="field">Domain you might like to purchase<input name="domainIdea" maxlength="150" placeholder="freshstartcleaning.com" value="'+esc(st.domainIdea)+'"></label><label class="field">Setup details<textarea name="notes" rows="2" maxlength="500" placeholder="What should the website do for your business?">'+esc(st.notes)+'</textarea></label></div><input type="hidden" name="websiteMode" value="'+esc(st.websiteMode)+'"><div class="studio-actions"><button class="btn" type="submit">Save website plan</button></div></form>'
 +(st.websiteMode==='Existing website'?'<p class="studio-hint"><strong>Existing website:</strong> Your saved URL is a reference only. CleaningOS does not claim access to edit the external site.</p>':st.websiteMode==='Hosted website'?'<p class="studio-hint"><strong>Hosted website:</strong> The domain preference is not a purchase or availability check. Publishing requires a real hosting account, registered domain, and client approval.</p>':'<p class="studio-hint">Choose a route to tailor your setup; the demo editor below is always a local preview.</p>')
 +'</section>'
}
function previewTools(s){
 const st=ensure(s);
 return '<section class="studio-tools"><div class="studio-section-top"><div><span class="eyebrow">QUICK CONTENT EDITS</span><h2>Manage imagery & content</h2><p>Make simple changes to the demo preview. Save larger requests below for your web manager.</p></div><span class="studio-chip">PREVIEW ONLY</span></div>'
 +'<form id="studio-image-form"><label class="field">Hero image URL (optional)<input type="url" name="imageUrl" value="'+esc(st.siteDraft.imageUrl)+'" placeholder="https://example.com/your-photo.jpg"></label><button type="submit" class="btn alt">Update preview image</button><p class="caption">Only use images you own or are licensed to use. This does not upload a file or publish a real site.</p></form></section>'
}
function tickets(s){
 const st=ensure(s);
 return '<section class="studio-requests"><div class="studio-section-top"><div><span class="eyebrow">CUSTOM WEBSITE HELP</span><h2>Request a change</h2><p>Small text and image edits can be self-service. Save larger jobs here and copy them to your website manager.</p></div><span class="studio-chip">'+st.requests.length+' LOCAL DRAFTS</span></div><div class="studio-requests-grid"><form id="studio-ticket-form"><label class="field">What needs changing?<input name="title" required minlength="3" maxlength="110" placeholder="Add commercial cleaning page"></label><label class="field">Type of work<select name="category">'+options(['Text or image','New page','Redesign','New functionality','Domain / hosting','Other'],'New page')+'</select></label><label class="field">Priority<select name="priority">'+options(['Routine','Time-sensitive'],'Routine')+'</select></label><label class="field">Describe the request<textarea name="description" required minlength="10" maxlength="1500" rows="4" placeholder="What should change and why?"></textarea></label><button class="btn" type="submit">Save request draft</button><p class="caption">A saved draft is not submitted to a support team. Copy it to send manually.</p></form><div class="studio-tickets">'+(st.requests.length?st.requests.slice(0,12).map(t=>'<article class="studio-ticket"><div><strong>'+esc(t.title)+'</strong><small>'+esc(t.createdAt)+' · '+esc(t.category)+' · '+esc(t.priority)+'</small></div><span class="studio-chip">NOT SENT</span><p>'+esc(t.description)+'</p><button type="button" class="btn alt" data-studio-copy="'+esc(t.id)+'">Copy request</button></article>').join(''):'<div class="studio-empty">No change requests saved yet. Start with a description of what the site needs.</div>')+'</div></div></section>'
}
window.CleaningStudio={ensure,safeUrl,setMode,configure,forget,websiteConfig,saveImage,addRequest,requestText,connections,choice,previewTools,tickets};
})();