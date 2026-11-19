(()=>{'use strict';
const E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=x=>String(x).padStart(2,'0');
const dateString=(year,month,day)=>year+'-'+pad(month+1)+'-'+pad(day);
const categories=['Before & after','Cleaning tip','Customer trust','Seasonal offer','Behind the scenes','Recurring care'];
function initial(){
const now=new Date(),year=now.getFullYear(),month=now.getMonth();
const suggestions=[
[2,'Cleaning tip','3 ways to refresh your kitchen','Instagram','Draft'],
[5,'Before & after','A satisfying bathroom reset','Instagram','Scheduled'],
[9,'Customer trust','What our quality checklist covers','Facebook','Draft'],
[12,'Recurring care','Why biweekly cleaning saves time','Instagram','Scheduled'],
[16,'Behind the scenes','Meet the crew: a day on the route','Facebook','Draft'],
[19,'Seasonal offer','Seasonal deep-clean availability','Facebook','Scheduled'],
[23,'Cleaning tip','How to keep hardwood floors looking great','Instagram','Draft'],
[27,'Customer trust','What to expect at your first clean','Instagram','Draft']
];
return {year,month,selected:dateString(year,month,Math.min(now.getDate(),28)),posts:suggestions.map((x,i)=>({id:i+1,date:dateString(year,month,x[0]),category:x[1],title:x[2],platform:x[3],status:x[4]}))};
}

const categoryImages={
'Before & after':'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=640&q=80',
'Cleaning tip':'https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=640&q=80',
'Customer trust':'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=640&q=80',
'Seasonal offer':'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=640&q=80',
'Behind the scenes':'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=640&q=80',
'Recurring care':'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=640&q=80'
};
const statuses=['Draft','Scheduled','Published'];
function ensure(s){
if(!s.socialPlan||!Array.isArray(s.socialPlan.posts))s.socialPlan=initial();
const d=s.socialPlan;
for(const p of d.posts){
if(!p.imageUrl)p.imageUrl=categoryImages[p.category]||'';
if(typeof p.caption!=='string')p.caption=p.title;
if(!statuses.includes(p.status))p.status='Draft';
}
if(!d.editingId||!d.posts.some(p=>String(p.id)===String(d.editingId)))d.editingId=null;
return d;
}
function shift(s,step){const d=ensure(s),t=new Date(d.year,d.month+Number(step),1);d.year=t.getFullYear();d.month=t.getMonth();d.selected=dateString(d.year,d.month,1);d.editingId=null}
function select(s,date){if(/^\d{4}-\d\d-\d\d$/.test(date)){const d=ensure(s);d.selected=date;d.editingId=null}}
function edit(s,id){const d=ensure(s),p=d.posts.find(x=>String(x.id)===String(id));if(!p)return false;d.editingId=p.id;d.selected=p.date;const dt=new Date(p.date+'T12:00:00');d.year=dt.getFullYear();d.month=dt.getMonth();return true}
function validDate(value){return /^\d{4}-\d\d-\d\d$/.test(value)&&!Number.isNaN(new Date(value+'T12:00:00').getTime())&&new Date(value+'T12:00:00').toISOString().slice(0,10)===value}
function safeImage(value){
const x=String(value||'').trim();
if(!x)return '';
if(x.startsWith('data:image/jpeg;base64,')||x.startsWith('data:image/png;base64,')||x.startsWith('data:image/webp;base64,'))return x.length<=220000?x:'';
return /^https:\/\/[a-z0-9][a-z0-9.-]*(?::[0-9]{1,5})?(?:[/?#][^\\s<>]*)?$/i.test(x)&&x.length<=600?x:''
}
function add(s,values){
const d=ensure(s),title=String(values.title||'').trim().slice(0,100),date=String(values.date||'');
if(title.length<3||!validDate(date))return {ok:false};
const post={id:Date.now(),date,title,category:categories.includes(values.category)?values.category:categories[0],platform:['Instagram','Facebook'].includes(values.platform)?values.platform:'Instagram',status:'Draft',caption:title,imageUrl:categoryImages[values.category]||''};
d.posts.push(post);d.selected=date;d.editingId=post.id;return {ok:true};
}
function savePost(s,values){
const d=ensure(s),p=d.posts.find(x=>String(x.id)===String(values.id));if(!p)return {ok:false,reason:'Post not found.'};
const title=String(values.title||'').trim().slice(0,100),date=String(values.date||'');
if(title.length<3||!validDate(date))return {ok:false,reason:'Provide a title and valid date.'};
const image=String(values.imageUrl||'').trim();
if(image&&!safeImage(image))return {ok:false,reason:'Use a valid HTTPS image URL, or clear the field.'};
p.title=title;p.date=date;p.caption=String(values.caption||'').trim().slice(0,1200);
p.category=categories.includes(values.category)?values.category:categories[0];
p.platform=['Instagram','Facebook'].includes(values.platform)?values.platform:'Instagram';
p.status=statuses.includes(values.status)?values.status:'Draft';
p.imageUrl=safeImage(image);
d.selected=date;const dt=new Date(date+'T12:00:00');d.year=dt.getFullYear();d.month=dt.getMonth();d.editingId=p.id;
return {ok:true};
}
function remove(s,id){
const d=ensure(s),i=d.posts.findIndex(x=>String(x.id)===String(id));
if(i<0)return false;d.posts.splice(i,1);d.editingId=null;return true;
}
function imageTag(p,cls){
const url=safeImage(p.imageUrl||'');
return url?'<img class="'+cls+'" src="'+E(url)+'" alt="Illustrative image for '+E(p.title)+'" loading="lazy" onerror="this.hidden=true">':'<span class="'+cls+' sp-no-image">No image</span>';
}

function performanceView(p){
const d=p.performance;
if(p.status!=='Published')return '<section class="sp-performance"><span>POST INSIGHTS</span><h3>Performance begins after publishing.</h3><p>This post is not published. In this simulation, set its status to Published and save to explore example analytics.</p></section>';
if(!d)return '<section class="sp-performance"><span>POST INSIGHTS</span><h3>Connect attention to bookings.</h3><p>No performance data is connected. Load an example dataset to preview this report.</p><button type="button" data-sp-example="'+E(p.id)+'">Load fictional example analytics</button></section>';
const fmt=n=>Number(n||0).toLocaleString('en-US'),pct=(n,base)=>base?(n/base*100).toFixed(1)+'%':'—';
const metrics=[['Impressions',d.impressions],['Reach',d.reach],['Engagements',d.engagements],['Website clicks',d.clicks],['Inquiries',d.inquiries],['Booked cleans',d.bookings]];
const funnel=[['Reached',d.reach],['Engaged',d.engagements],['Clicked',d.clicks],['Inquired',d.inquiries],['Qualified',d.qualified],['Booked',d.bookings]];
return '<section class="sp-performance"><div class="sp-performance-top"><div><span>POST INSIGHTS / FICTIONAL RESULTS</span><h3>From attention to booked cleans.</h3></div><small>Sample data only</small></div><div class="sp-performance-kpis">'+metrics.map(([name,value])=>'<div><span>'+name+'</span><strong>'+fmt(value)+'</strong></div>').join('')+'</div><div class="sp-performance-lower"><div><h4>Customer acquisition funnel</h4>'+funnel.map(([name,value])=>'<div class="sp-funnel-row"><span>'+name+'</span><div><i style="width:'+Math.max(3,Math.min(100,100*value/Math.max(1,d.reach)))+'%"></i></div><b>'+fmt(value)+'</b></div>').join('')+'</div><div class="sp-performance-context"><h4>What actually matters</h4><div><span>Engagement / reach</span><b>'+pct(d.engagements,d.reach)+'</b></div><div><span>Clicks / impressions</span><b>'+pct(d.clicks,d.impressions)+'</b></div><div><span>Inquiry / click</span><b>'+pct(d.inquiries,d.clicks)+'</b></div><div><span>Booking / inquiry</span><b>'+pct(d.bookings,d.inquiries)+'</b></div><p>These are invented linked outcomes for demonstration, NOT verified attribution. Production reporting needs platform APIs, campaign tags, CRM events and consent-aware measurement.</p></div></div><button type="button" class="sp-example-clear" data-sp-clear-example="'+E(p.id)+'">Clear example analytics</button></section>';
}
function loadExample(s,id){
const p=ensure(s).posts.find(x=>String(x.id)===String(id));
if(!p||p.status!=='Published')return {ok:false,reason:'Save the post with Published status first.'};
const examples={2:[6240,4860,390,137,14,7,3],6:[3810,2970,211,89,9,4,2]};
const vals=examples[p.id]||[4200,3300,260,95,8,4,2];
p.performance=Object.fromEntries(['impressions','reach','engagements','clicks','inquiries','qualified','bookings'].map((x,i)=>[x,vals[i]]));
return {ok:true};
}
function clearExample(s,id){const p=ensure(s).posts.find(x=>String(x.id)===String(id));if(!p)return false;delete p.performance;return true}

function editor(p){
if(!p)return '';
return '<section class="sp-editor" id="sp-editor"><div class="sp-editor-heading"><div><span>EDIT POST · LOCAL DEMO</span><h2>'+E(p.title)+'</h2><p>Changes update the calendar immediately when saved. Nothing is sent or published.</p></div><button type="button" data-sp-close aria-label="Close editor">✕</button></div><div class="sp-editor-layout"><div class="sp-preview">'+imageTag(p,'sp-preview-img')+'<div class="sp-preview-info"><strong>'+E(p.platform)+' preview</strong><p>'+E(p.caption||p.title)+'</p></div></div><form id="sp-edit-post"><input type="hidden" name="id" value="'+E(p.id)+'"><label>Post title<input name="title" maxlength="100" required value="'+E(p.title)+'"></label><label>Posting date<input type="date" name="date" value="'+E(p.date)+'" required></label><label>Platform<select name="platform">'+['Instagram','Facebook'].map(x=>'<option '+(p.platform===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label><label>Status (demo only)<select name="status">'+statuses.map(x=>'<option '+(p.status===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label><label>Content theme<select name="category">'+categories.map(x=>'<option '+(p.category===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label><label class="sp-span-two">Caption<textarea name="caption" rows="5" maxlength="1200">'+E(p.caption)+'</textarea></label><label class="sp-span-two">Post image URL (HTTPS)<input name="imageUrl" type="text" placeholder="https://example.com/photo.jpg" value="'+E(p.imageUrl)+'"></label><p class="sp-span-two sp-image-help">Paste an image link, or upload a JPEG, PNG, or WebP. Uploaded images are resized and stored only in this browser.</p><label class="sp-span-two sp-upload-label">Upload a post image<input type="file" accept="image/png,image/jpeg,image/webp" data-sp-image-upload></label><div class="sp-editor-actions sp-span-two"><button type="submit">Save post changes</button><button type="button" class="sp-delete" data-sp-delete="'+E(p.id)+'">Delete post</button></div></form></div>'+performanceView(p)+'</section>';
}

function view(s){
const d=ensure(s),first=new Date(d.year,d.month,1),monthName=first.toLocaleString('en-US',{month:'long',year:'numeric'}),count=new Date(d.year,d.month+1,0).getDate(),offset=(first.getDay()+6)%7,posts=d.posts.filter(p=>p.date.startsWith(d.year+'-'+pad(d.month+1)+'-')),published=posts.filter(p=>p.status==='Published').length;
const days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const cells=Array.from({length:Math.ceil((offset+count)/7)*7},(_,i)=>{
const day=i-offset+1;if(day<1||day>count)return '<div class="sp-cell sp-outside" aria-hidden="true"></div>';
const dt=dateString(d.year,d.month,day),items=posts.filter(p=>p.date===dt);
return '<div class="sp-cell '+(d.selected===dt?'sp-selected':'')+'"><button type="button" class="sp-day-button" data-sp-date="'+dt+'" aria-label="Select '+dt+'"><span class="sp-day">'+day+'</span></button>'+items.map(p=>'<button type="button" class="sp-calendar-post" data-sp-edit="'+p.id+'" aria-label="Edit '+E(p.title)+'">'+imageTag(p,'sp-calendar-thumb')+'<span><strong>'+E(p.title)+'</strong><small>'+E(p.status)+'</small></span></button>').join('')+'</div>'
}).join('');
const selectedPosts=d.posts.filter(p=>p.date===d.selected),active=d.posts.find(p=>String(p.id)===String(d.editingId));
return '<div class="sp-root"><section class="sp-hero"><span>SOCIAL PLANNER · OPTIONAL MODULE PREVIEW</span><h1>A full month of content. <em>One clear plan.</em></h1><p>See the creative, caption, date and status for every planned post. Select a thumbnail to edit the post in your calendar.</p><small>Browser-local prototype. Sample photography and metrics are illustrative. No social account is connected or content published.</small></section>'
+'<section class="sp-sample-stats"><div><span>Posts planned this month</span><strong>'+posts.length+'</strong><small>Drafts + scheduled posts</small></div><div><span>Posts published</span><strong>'+published+'</strong><small>Locally marked status only</small></div><div><span>Sample reach</span><strong>18.4K</strong><small>Illustrative, not connected analytics</small></div><div><span>Sample website inquiries</span><strong>12</strong><small>Illustrative, not attributed conversions</small></div></section>'
+'<section class="sp-calendar"><div class="sp-calendar-top"><div><span>CONTENT CALENDAR</span><h2>'+E(monthName)+'</h2></div><div class="sp-controls"><button type="button" data-sp-month="-1" aria-label="Previous month">←</button><button type="button" data-sp-month="1" aria-label="Next month">→</button></div></div><div class="sp-weekdays">'+days.map(x=>'<span>'+x+'</span>').join('')+'</div><div class="sp-grid">'+cells+'</div></section>'
+editor(active)
+'<div class="sp-lower"><section class="sp-detail"><span>SELECTED DAY</span><h2>'+E(d.selected)+'</h2>'+(selectedPosts.length?selectedPosts.map(p=>'<button type="button" class="sp-post sp-post-clickable" data-sp-edit="'+p.id+'">'+imageTag(p,'sp-list-thumb')+'<span><strong>'+E(p.title)+'</strong><small>'+E(p.category)+' · '+E(p.platform)+' · '+E(p.status)+'</small></span><b>Edit ↗</b></button>').join(''):'<p class="sp-empty">No posts planned. Add a draft for this day.</p>')+'<h3>Plan a post</h3><form id="sp-new-post"><label>Posting date<input type="date" name="date" value="'+E(d.selected)+'" required></label><label>Post idea<input name="title" maxlength="100" placeholder="e.g. Spring refresh checklist" required></label><label>Content theme<select name="category">'+categories.map(x=>'<option>'+E(x)+'</option>').join('')+'</select></label><label>Platform<select name="platform"><option>Instagram</option><option>Facebook</option></select></label><button type="submit">Create & edit draft</button></form></section>'
+'<section class="sp-detail"><span>PERFORMANCE INSIGHTS · CONCEPT</span><h2>Beyond likes and reach.</h2><p>A connected production version should track engagement, website visits, inquiries, qualified leads, and bookings for each campaign when attribution is available.</p><div class="sp-metric-list"><div><strong>Awareness</strong><span>Reach and video views</span></div><div><strong>Engagement</strong><span>Comments, saves and shares</span></div><div><strong>Interest</strong><span>Profile and website clicks</span></div><div><strong>Conversion</strong><span>Inquiries and booked cleans</span></div></div><p class="sp-note">Supported platform integrations and consent-aware attribution are required for real analytics. Numbers above are fictional.</p><button type="button" data-page="pipeline" class="sp-secondary">View Customer Journey →</button></section></div></div>';
}
window.CleaningSocial={ensure,view,shift,select,add,edit,savePost,remove,safeImage,loadExample,clearExample};
})();