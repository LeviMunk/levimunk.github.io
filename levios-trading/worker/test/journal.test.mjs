import test from "node:test";
import assert from "node:assert/strict";
import "../../journal-engine.js";
const j=globalThis.LeviHypothesisJournal;
const input={symbol:"AAPL",direction:"long",thesis:"A testable thesis about a trend",
 evidence:"Trend versus benchmark",counterpoint:"Volume may be misleading",
 invalidation:"Two closes below support",timeHorizon:"10 trading days",
 referencePrice:100,invalidationPrice:95,riskBudget:50};
const time="2026-11-12T10:00:00Z";
const p=()=>j.create(input,{id:"research-001",now:time});
test("forces thesis, counterpoint, invalidation and risk into original immutable plan",()=>{
 const x=p();assert.ok(Object.isFrozen(x));assert.equal(x.riskPerShare,5);
 assert.equal(x.theoreticalShares,10);
 assert.throws(()=>j.create({...input,thesis:"short"},{id:"research-001",now:time}));
 assert.throws(()=>j.create({...input,invalidationPrice:101},{id:"research-001",now:time}));
});
test("review is a separate immutable reflection with explicit hypothetical changes",()=>{
 const x=p(),r=j.review(x,{grade:"mixed",reviewPrice:103,observation:"Price rose but volume stayed weak",
 lesson:"A price increase does not verify the rationale"},"2026-11-20T10:00:00Z");
 assert.equal(r.originalReferencePrice,100);assert.equal(r.hypotheticalChangePct,3);
 assert.equal(x.createdAt,time);assert.ok(Object.isFrozen(r));
});
test("plans cannot be silently overwritten or reviewed twice",()=>{
 const data=j.addPlan({version:1,plans:[],reviews:[]},p());
 assert.throws(()=>j.addPlan(data,p()));
 const r=j.review(p(),{grade:"inconclusive",reviewPrice:100,observation:"Still sideways",lesson:"Need stronger evidence"},"2026-11-20T10:00:00Z");
 const next=j.addReview(data,r);
 assert.throws(()=>j.addReview(next,r));
});
test("invalid or tampered browser data is discarded on import",()=>{
 const x=p();
 const changed={...x,thesis:"x"};
 const result=j.sanitize({version:1,plans:[x,changed],reviews:[{planId:x.id,reviewedAt:"bad"}]});
 assert.equal(result.plans.length,1);assert.equal(result.reviews.length,0);
});
test("no order placement or live broker data fields",()=>{
 const x=p();assert.equal(Object.hasOwn(x,"orderId"),false);
 assert.equal(Object.hasOwn(j,"placeOrder"),false);
});
