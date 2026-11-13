import test from "node:test";
import assert from "node:assert/strict";
import "../../decision-guide.js";
const g=globalThis.LeviDecisionGuide;
const dates=n=>Array.from({length:n},(_,i)=>new Date(Date.UTC(2026,6,1+i)).toISOString().slice(0,10));
function history(fn,n=65){return dates(n).map((time,i)=>({time,close:fn(i)}));}
const rising=history(i=>100+i*.4),declining=history(i=>150-i*.5);
test("unowned uptrend is an entry research prompt, not an order",()=>{
 const x=g.examine({symbol:"AAPL",bars:rising,asOfLimit:"2026-11-12"});
 assert.equal(x.kind,"entry-research");assert.equal(x.held,false);
 assert.match(x.next,/fundamentals, valuation/);
 assert.equal(Object.hasOwn(x,"order"),false);
});
test("holding under both averages prompts risk review without automatic sale",()=>{
 const x=g.examine({symbol:"AAPL",bars:declining,
 holding:{qty:"5",market_value:"500"},equity:10000,asOfLimit:"2026-11-12"});
 assert.equal(x.kind,"exit-review");assert.match(x.next,/before considering/);
});
test("concentration takes precedence over trend and is about paper holdings",()=>{
 const x=g.examine({symbol:"MSFT",bars:rising,
 holding:{qty:"5",market_value:"6000"},equity:10000,asOfLimit:"2026-11-12"});
 assert.equal(x.kind,"risk-review");assert.ok(x.weightPct>25);
});
test("insufficient and unfinished IEX history cannot produce guidance",()=>{
 assert.equal(g.examine({symbol:"SPY",bars:rising.slice(0,20)}).ready,false);
 assert.equal(g.examine({symbol:"SPY",bars:rising,asOfLimit:"2026-08-10"}).ready,false);
});
test("guide sorts attention priority deterministically",()=>{
 const a=g.examine({symbol:"AAPL",bars:declining,
 holding:{qty:"2",market_value:"200"},equity:10000});
 const b=g.examine({symbol:"MSFT",bars:rising});
 assert.deepEqual(g.summarize([b,a]).ready.map(x=>x.kind),["exit-review","entry-research"]);
});
