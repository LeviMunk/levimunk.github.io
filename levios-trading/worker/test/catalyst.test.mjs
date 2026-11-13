import test from "node:test";
import assert from "node:assert/strict";
import "../../catalyst-engine.js";
const engine=globalThis.LeviCatalystContext;
const radar={symbol:"NVDA",ready:true,asOf:"2026-11-16",flags:1};
const official={date:"2026-11-13",name:"Producer Price Index",url:"https://www.bls.gov/schedule/news_release/",
  source:"live",agency:"BLS"};
const confirmed={date:"2026-11-17",name:"NVIDIA call",url:"https://investor.nvidia.com/news/press-release-details/2026/NVIDIA-Sets-Conference-Call-for-Third-Quarter-Financial-Results/default.aspx",
  symbol:"NVDA",status:"company_confirmed"};
test("future issuer event is upcoming context, not a past-move explanation",()=>{
 const out=engine.context(radar,[official],[confirmed],"2026-11-16");
 assert.equal(out.ready,true);
 assert.equal(out.items.length,2);
 const next=out.items.find(x=>x.scope==="company");
 assert.equal(next.sourceLevel,"issuer_confirmed");
 assert.equal(next.relation,"upcoming_seven_calendar_days");
 assert.match(next.interpretation,/cannot explain/);
});
test("same-day macro event is time-unverified and never inferred causal",()=>{
 const out=engine.context(radar,[{...official,date:"2026-11-16"}],[],"2026-11-16");
 assert.equal(out.items[0].relation,"same_calendar_date_time_unverified");
 assert.match(out.items[0].interpretation,/does not establish/);
});
test("other companies earnings never match current symbol",()=>{
 const out=engine.context(radar,[],[{...confirmed,symbol:"AAPL"}],"2026-11-16");
 assert.equal(out.items.length,0);
});
test("no backdated future events and no stale historical future claims",()=>{
 const out=engine.context(radar,[],[{...confirmed,date:"2026-11-17"}],"2026-11-19");
 assert.equal(out.items.length,0);
});
test("estimations retain unconfirmed label and bogus upstream URLs are refused",()=>{
 const estimate={...confirmed,source:"Alpha Vantage",status:"provider_estimate",
   url:"https://evil.invalid/phishing",date:"2026-11-17"};
 const out=engine.context(radar,[],[estimate],"2026-11-16");
 assert.equal(out.items.length,0);
});
test("provider estimates can be represented with a source link to issuer IR",()=>{
 const estimate={...confirmed,source:"Alpha Vantage",status:"provider_estimate",
   url:"https://investor.nvidia.com/events-and-presentations/events-and-presentations/default.aspx"};
 const out=engine.context(radar,[],[estimate],"2026-11-16");
 assert.equal(out.items[0].sourceLevel,"provider_estimate");
});
test("invalid scan or absent market history never manufactures catalyst evidence",()=>{
 assert.equal(engine.context({ready:false},[official],[confirmed],"2026-11-16").ready,false);
 assert.equal(engine.context(radar,[],[],"2026-11-16").items.length,0);
});
