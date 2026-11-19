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
function ensure(s){if(!s.socialPlan||!Array.isArray(s.socialPlan.posts))s.socialPlan=initial();return s.socialPlan}
function shift(s,step){const d=ensure(s),t=new Date(d.year,d.month+Number(step),1);d.year=t.getFullYear();d.month=t.getMonth();d.selected=dateString(d.year,d.month,1)}
function select(s,date){if(/^\d{4}-\d\d-\d\d$/.test(date))ensure(s).selected=date}
function add(s,values){
const d=ensure(s),title=String(values.title||'').trim().slice(0,100),date=String(values.date||'');
if(title.length<3||!(/^\d{4}-\d\d-\d\d$/).test(date)||Number.isNaN(new Date(date+'T12:00:00').getTime()))return {ok:false};
d.posts.push({id:Date.now(),date,title,category:categories.includes(values.category)?values.category:categories[0],platform:['Instagram','Facebook'].includes(values.platform)?values.platform:'Instagram',status:'Draft'});d.selected=date;return {ok:true}
}
function view(s){
const d=ensure(s),first=new Date(d.year,d.month,1),monthName=first.toLocaleString('en-US',{month:'long',year:'numeric'}),count=new Date(d.year,d.month+1,0).getDate(),offset=(first.getDay()+6)%7,posts=d.posts.filter(p=>p.date.startsWith(d.year+'-'+pad(d.month+1)+'-')),published=posts.filter(p=>p.status==='Published').length;
const days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const cells=Array.from({length:Math.ceil((offset+count)/7)*7},(_,i)=>{const day=i-offset+1;if(day<1||day>count)return '<div class="sp-cell sp-outside" aria-hidden="true"></div>';const dt=dateString(d.year,d.month,day),items=posts.filter(p=>p.date===dt);return '<button type="button" class="sp-cell '+(d.selected===dt?'sp-selected':'')+'" data-sp-date="'+dt+'"><span class="sp-day">'+day+'</span>'+items.map(p=>'<span class="sp-event">'+E(p.title)+'</span>').join('')+'</button>'}).join('');
const selectedPosts=d.posts.filter(p=>p.date===d.selected);
return '<div class="sp-root"><section class="sp-hero"><span>SOCIAL PLANNER · OPTIONAL MODULE PREVIEW</span><h1>A full month of content. <em>One clear plan.</em></h1><p>See what is planned, where it will be published, and how content connects to leads and booked services. Customize the schedule for your cleaning business.</p><small>Browser-local prototype. All sample posts and performance figures are fictional. No social media accounts are connected or posts published.</small></section>'
+'<section class="sp-sample-stats"><div><span>Posts planned this month</span><strong>'+posts.length+'</strong><small>Drafts + scheduled posts</small></div><div><span>Posts published</span><strong>'+published+'</strong><small>Locally marked status only</small></div><div><span>Sample reach</span><strong>18.4K</strong><small>Illustrative, not connected analytics</small></div><div><span>Sample website inquiries</span><strong>12</strong><small>Illustrative, not attributed conversions</small></div></section>'
+'<section class="sp-calendar"><div class="sp-calendar-top"><div><span>CONTENT CALENDAR</span><h2>'+E(monthName)+'</h2></div><div class="sp-controls"><button type="button" data-sp-month="-1" aria-label="Previous month">←</button><button type="button" data-sp-month="1" aria-label="Next month">→</button></div></div><div class="sp-weekdays">'+days.map(x=>'<span>'+x+'</span>').join('')+'</div><div class="sp-grid">'+cells+'</div></section>'
+'<div class="sp-lower"><section class="sp-detail"><span>SELECTED DAY</span><h2>'+E(d.selected)+'</h2>'+(selectedPosts.length?selectedPosts.map(p=>'<article class="sp-post"><div><strong>'+E(p.title)+'</strong><span>'+E(p.category)+' · '+E(p.platform)+'</span></div><small>'+E(p.status)+'</small></article>').join(''):'<p class="sp-empty">No posts planned. Add a draft for this day.</p>')+'<h3>Plan a post</h3><form id="sp-new-post"><label>Posting date<input type="date" name="date" value="'+E(d.selected)+'" required></label><label>Post idea<input name="title" maxlength="100" placeholder="e.g. Spring refresh checklist" required></label><label>Content theme<select name="category">'+categories.map(x=>'<option>'+E(x)+'</option>').join('')+'</select></label><label>Platform<select name="platform"><option>Instagram</option><option>Facebook</option></select></label><button type="submit">Save draft locally</button></form></section>'
+'<section class="sp-detail"><span>PERFORMANCE INSIGHTS · CONCEPT</span><h2>Beyond likes and reach.</h2><p>For a connected production version, track engagement, website visits, inquiries, qualified leads, and bookings from each social campaign.</p><div class="sp-metric-list"><div><strong>Awareness</strong><span>Reach and video views</span></div><div><strong>Engagement</strong><span>Comments, saves and shares</span></div><div><strong>Interest</strong><span>Profile and website clicks</span></div><div><strong>Conversion</strong><span>Inquiries and booked cleans where attribution is available</span></div></div><p class="sp-note">These would require supported platform integrations, campaign links, consent-aware attribution, and clear limitations. The figures above are intentionally sample-only.</p><button type="button" data-page="pipeline" class="sp-secondary">View Customer Journey →</button></section></div></div>';
}
window.CleaningSocial={ensure,view,shift,select,add};
})();