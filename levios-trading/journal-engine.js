/* Hypothesis journal model; no brokerage/order operations.
 * Original plans are immutable; reflections are separate records.
 * Browser storage is editable and NOT a cryptographic/audit guarantee.
 */
(function(scope){
"use strict";
const MAX=100, LIMIT=1400, SYMBOL=/^[A-Z][A-Z0-9.-]{0,9}$/;
const required=(v,n,min=8)=>{
  const s=String(v||"").trim();
  if(s.length<min||s.length>LIMIT)throw Error(n+" must be "+min+"–"+LIMIT+" characters.");
  return s;
};
const positive=(v,n)=>{
  const x=Number(v);if(!Number.isFinite(x)||x<=0||x>100000000)throw Error(n+" must be positive and finite.");
  return x;
};
function create(input,{id,now}={}){
  if(!input||!id||!/^[a-zA-Z0-9_-]{8,80}$/.test(id)||
    !Number.isFinite(Date.parse(now)))throw Error("Invalid journal identifier or timestamp.");
  const symbol=String(input.symbol||"").trim().toUpperCase();
  if(!SYMBOL.test(symbol))throw Error("Choose a valid ticker.");
  const direction=String(input.direction||"");
  if(!["long","short","observation"].includes(direction))throw Error("Select a valid idea direction.");
  const entry=positive(input.referencePrice,"Reference price");
  const invalidation=positive(input.invalidationPrice,"Invalidation price");
  if(direction==="long" && invalidation>=entry)throw Error("Long invalidation should be below the reference price.");
  if(direction==="short" && invalidation<=entry)throw Error("Short invalidation should be above the reference price.");
  const riskBudget=positive(input.riskBudget,"Hypothetical loss budget");
  const riskPerShare=Math.abs(entry-invalidation);
  const theoreticalShares=direction==="observation"?null:Math.floor(riskBudget/riskPerShare);
  return Object.freeze({
    id,createdAt:now,symbol,direction,
    thesis:required(input.thesis,"Thesis",12),
    evidence:required(input.evidence,"Supporting evidence",8),
    counterpoint:required(input.counterpoint,"Counterargument",8),
    invalidation:required(input.invalidation,"Invalidation condition",8),
    timeHorizon:required(input.timeHorizon,"Time horizon",3),
    referencePrice:entry,invalidationPrice:invalidation,riskBudget,
    riskPerShare,theoreticalShares,
    note:"Planning exercise only. Share estimate excludes gaps, fees, slippage and buying power."
  });
}
function review(plan,input,now){
 if(!plan||!plan.id||!Number.isFinite(Date.parse(now))||
   (Date.parse(now)<Date.parse(plan.createdAt)))throw Error("Invalid review timestamp.");
 const grade=String(input.grade||"");
 if(!["supported","mixed","disproved","inconclusive"].includes(grade))throw Error("Select a reasoning assessment.");
 const reviewPrice=positive(input.reviewPrice,"Observed review price");
 return Object.freeze({
  planId:plan.id,reviewedAt:now,grade,reviewPrice,
  observation:required(input.observation,"What happened",8),
  lesson:required(input.lesson,"Lesson learned",8),
  originalReferencePrice:plan.referencePrice,
  hypotheticalChangePct:100*(reviewPrice/plan.referencePrice-1),
  note:"Price comparison is hypothetical, NOT realized P/L or proof of strategy quality."
 });
}
function sanitize(data){
 if(!data||data.version!==1||!Array.isArray(data.plans)||!Array.isArray(data.reviews))return {version:1,plans:[],reviews:[]};
 const plans=[],ids=new Set();
 for(const p of data.plans.slice(0,MAX)){
  try{
   const fresh=create(p,{id:p.id,now:p.createdAt});
   if(ids.has(fresh.id))continue;ids.add(fresh.id);plans.push(fresh);
  }catch{}
 }
 const reviews=[],seen=new Set();
 for(const r of data.reviews.slice(0,MAX)){
  try{
   const p=plans.find(x=>x.id===r.planId);
   if(!p||seen.has(p.id))continue;
   const fresh=review(p,r,r.reviewedAt);
   reviews.push(fresh);seen.add(p.id);
  }catch{}
 }
 return {version:1,plans,reviews};
}
function addPlan(data,plan){
 if(data.plans.length>=MAX)throw Error("Journal limit reached: export a backup before adding entries.");
 if(data.plans.some(x=>x.id===plan.id))throw Error("Entry already exists.");
 return {version:1,plans:[plan,...data.plans],reviews:data.reviews.slice()};
}
function addReview(data,entry){
 if(!data.plans.some(x=>x.id===entry.planId)||data.reviews.some(x=>x.planId===entry.planId))
   throw Error("Plan missing or already reviewed.");
 return {version:1,plans:data.plans.slice(),reviews:[entry,...data.reviews]};
}
scope.LeviHypothesisJournal=Object.freeze({version:"levios-hypothesis-journal-v1",
 create,review,sanitize,addPlan,addReview});
})(globalThis);
