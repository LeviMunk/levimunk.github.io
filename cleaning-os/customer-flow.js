(()=>{'use strict';
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const phases=[
{id:'inquiry',label:'Inquiry',desc:'Capture the customer request',kpi:'New inquiries'},
{id:'engage',label:'Engage',desc:'Respond and learn their needs',kpi:'Response rate'},
{id:'quote',label:'Quote',desc:'Qualify and prepare an estimate',kpi:'Qualified lead rate'},
{id:'book',label:'Book',desc:'Confirm the appointment',kpi:'Booking conversion'},
{id:'serve',label:'Deliver',desc:'Finish service and quality checks',kpi:'Service completion'},
{id:'followup',label:'Follow up',desc:'Check satisfaction and resolve concerns',kpi:'Customer satisfaction'},
{id:'return',label:'Return',desc:'Earn a second paid booking',kpi:'Repeat booking rate'},
{id:'loyal',label:'Long-term',desc:'Maintain the relationship',kpi:'Retention rate'}
];
const addons=[
{id:'marketing',label:'Lead nurture',detail:'Consent-aware email follow-up drafts for unconverted leads',at:['engage','quote']},
{id:'reviews',label:'Reviews & reputation',detail:'Feedback checkpoints and review opportunities',at:['followup']},
{id:'plans',label:'Recurring-plan offers',detail:'Relevant maintenance-plan invitations after completed service',at:['return','loyal']},
{id:'revive',label:'Reactivation',detail:'Flag inactive customers and recommend win-back review',at:['return','loyal']},
{id:'social',label:'Social attribution',detail:'Potential social campaign source for new inquiries',at:['inquiry']}
];
const defaults=()=>({marketing:true,reviews:true,plans:true,revive:true,social:false});
function ensure(s){if(!s.customerFlow||typeof s.customerFlow!=='object')s.customerFlow={enabled:defaults(),selected:'inquiry'};const f=s.customerFlow;if(!f.enabled||typeof f.enabled!=='object')f.enabled=defaults();for(const a of addons)if(typeof f.enabled[a.id]!=='boolean')f.enabled[a.id]=defaults()[a.id];if(!phases.some(x=>x.id===f.selected))f.selected='inquiry';return f}
function toggle(s,id,value){const f=ensure(s);if(!addons.some(a=>a.id===id))return false;f.enabled[id]=Boolean(value);return true}
function select(s,id){if(!phases.some(x=>x.id===id))return false;ensure(s).selected=id;return true}
function customerPosition(p){const index={new:0,warm:1,hot:2,first:4,repeat:6,plan:7};return index[p?.stage]??0}
function applicable(p,flags){
const options=[];
if(p?.optOut)options.push('Marketing suppressed: customer unsubscribed');
else if(!p?.consent)options.push('Marketing suppressed: consent not recorded');
else if(flags.marketing&&['new','warm','hot'].includes(p?.stage))options.push('Lead nurture review available');
if(Object.values(p?.checkpoints||{}).includes('issue'))options.unshift('Service recovery needs owner attention');
else if(flags.reviews&&['first','repeat','plan'].includes(p?.stage))options.push('Feedback and review checkpoint');
if(flags.plans&&p?.stage==='first')options.push('Consider repeat-clean or care-plan invitation');
if(flags.revive&&p?.days>=90&&['first','repeat'].includes(p?.stage))options.push('Reactivation review opportunity');
return options.slice(0,4);
}
function view(s,p){
const f=ensure(s),pos=customerPosition(p),stage=phases.find(x=>x.id===f.selected),flags=f.enabled;
const enabled=addons.filter(a=>flags[a.id]);
const path=phases.map((x,i)=>'<button type="button" data-cf-phase="'+x.id+'" class="cf-step '+(i<=pos?'reached ':'')+(f.selected===x.id?'selected':'')+'"><span class="cf-node">'+String(i+1).padStart(2,'0')+'</span><strong>'+E(x.label)+'</strong><small>'+E(x.kpi)+'</small></button>').join('');
const services=addons.filter(a=>a.at.includes(stage.id)).map(a=>'<span class="cf-module '+(flags[a.id]?'on':'off')+'">'+(flags[a.id]?'✓ ':'○ ')+E(a.label)+'</span>').join('');
return '<section class="cf-shell"><div class="cf-header"><div><span class="cf-eyebrow">FULL CUSTOMER LIFECYCLE · CONFIGURABLE WORKSPACE</span><h2>One connected path. Your choice of tools.</h2><p>Each customer progresses through the same relationship journey. Turn optional capabilities on or off without losing customer history, feedback, or stage information.</p></div><span class="cf-legend">CORE PATH ALWAYS AVAILABLE</span></div>'
+'<div class="cf-flow" aria-label="Lifecycle pathway">'+path+'</div><div class="cf-flow-foot"><span>FIRST CONTACT</span><strong>GOAL: HEALTHY, LASTING RELATIONSHIPS</strong></div>'
+'<div class="cf-focused"><div><span class="cf-eyebrow">CURRENT CHECKPOINT</span><h3>'+E(stage.label)+'</h3><p>'+E(stage.desc)+'</p><div class="cf-signal"><b>Primary KPI</b><span>'+E(stage.kpi)+'</span></div><div class="cf-used"><b>Optional modules at this checkpoint</b><div>'+(services||'<span class="cf-module">Core workflow only</span>')+'</div></div></div><div class="cf-person"><span class="cf-eyebrow">SELECTED CUSTOMER</span><strong>'+E(p?.name||'Choose a customer below')+'</strong><p>Journey position: '+E(phases[pos].label)+'</p><div class="cf-person-progress"><i style="width:'+Math.round((pos+1)/phases.length*100)+'%"></i></div><small>'+Math.round((pos+1)/phases.length*100)+'% of illustrative pathway reached</small><div class="cf-actions"><b>Current relationship signals</b>'+(applicable(p,flags).map(t=>'<span>'+E(t)+'</span>').join('')||'<span>No additional action flagged</span>')+'</div></div></div>'
+'<details class="cf-customize"><summary><span><b>Customize the customer journey</b><small>Optional capabilities only. Toggle them for this browser demo.</small></span><span>Manage modules ＋</span></summary><div class="cf-module-grid">'+addons.map(a=>'<label class="cf-toggle"><span><strong>'+E(a.label)+'</strong><small>'+E(a.detail)+'</small></span><input type="checkbox" data-cf-toggle="'+a.id+'" '+(flags[a.id]?'checked':'')+' aria-label="Enable '+E(a.label)+'"></label>').join('')+'</div><p class="cf-disclaimer">These switches change the demo presentation and suggested actions only. They do not activate paid features, schedule campaigns or connect external providers.</p></details>'
+'<div class="cf-branches"><div><span class="cf-eyebrow">EXCEPTION PATH</span><h3>When something goes wrong, the journey adapts.</h3><p>Bad feedback, missed expectations or a service problem triggers a recovery checkpoint. The customer retains their place in the lifecycle while the owner resolves the issue.</p></div><div class="cf-branch-tags"><span>⚑ Concern flagged</span><span>→ Owner review</span><span>→ Service recovery</span><span>✓ Relationship restored</span></div></div></section>';
}
window.CleaningCustomerFlow={ensure,toggle,select,view,phases};
})();