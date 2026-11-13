import test from "node:test";
import assert from "node:assert/strict";
import "../../valuation-engine.js";
const v=globalThis.LeviRelativeValuation;
function sec(ticker,reportEnd="2026-09-30"){
 return {status:"available",ticker,name:ticker+" Corporation",reportEnd,filingDate:"2026-10-25",
 sourceUrl:"https://www.sec.gov/Archives/edgar/data/123/",
 measures:[
  {key:"annualDilutedShares",value:1000000000},
  {key:"revenue",value:100000000000},
  {key:"netIncome",value:20000000000},
  {key:"operatingIncome",value:26000000000}
 ],computed:{freeCashFlowMillions:10000,operatingMarginPct:26,revenueGrowthPct:11}};
}
test("transparent SEC annual metrics plus IEX price yields explicit valuation proxies",()=>{
 const r=v.build({sec:sec("MSFT"),priceObservation:{symbol:"MSFT",date:"2026-11-12",close:200},today:"2026-11-13"});
 assert.equal(r.metrics[0].value,2);assert.equal(r.metrics[1].value,10);
 assert.equal(r.metrics[2].value,20);assert.equal(r.ready,true);
 assert.ok(!Object.hasOwn(r,"priceTarget")&&!Object.hasOwn(r,"recommendation"));
});
test("negative income and absent cash flow cannot be treated as cheap multiples",()=>{
 const x=sec("AAPL");x.measures[2].value=-1000000000;x.computed.freeCashFlowMillions=null;
 const r=v.build({sec:x,priceObservation:{symbol:"AAPL",date:"2026-11-12",close:100},today:"2026-11-13"});
 assert.equal(r.metrics[1].value,null);assert.equal(r.metrics[2].value,null);
});
test("stale exchange price abstains from market-multiple calculation",()=>{
 const r=v.build({sec:sec("GOOG"),priceObservation:{symbol:"GOOG",date:"2026-10-25",close:200},today:"2026-11-13"});
 assert.equal(r.ready,false);assert.equal(r.metrics[0].value,null);
});
test("different reporting years prevent peer comparisons",()=>{
 const priceObservation={symbol:"MSFT",date:"2026-11-12",close:200};
 const a=v.build({sec:sec("MSFT"),priceObservation,today:"2026-11-13"});
 const b=v.build({sec:sec("AAPL","2025-09-30"),priceObservation:{...priceObservation,symbol:"AAPL"},today:"2026-11-13"});
 const c=v.compare(a,b);
 assert.equal(c.aligned,false);assert.ok(c.items.every(x=>!x.comparable));
});
test("relative comparison does not rank or generate orders",()=>{
 const a=v.build({sec:sec("MSFT"),priceObservation:{symbol:"MSFT",date:"2026-11-12",close:200},today:"2026-11-13"});
 const b=v.build({sec:sec("AAPL"),priceObservation:{symbol:"AAPL",date:"2026-11-12",close:250},today:"2026-11-13"});
 const c=v.compare(a,b);
 assert.equal(c.items[0].comparable,true);assert.equal(Object.hasOwn(c,"winner"),false);
 assert.match(c.judgment,/No automatic winner/);
});
