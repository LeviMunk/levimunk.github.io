import test from "node:test";
import assert from "node:assert/strict";
import "../../radar-engine.js";
const radar=globalThis.LeviMarketRadar;
function series(length=45,fn=()=>100,vol=()=>1000){
  return Array.from({length},(_,i)=>{
    const c=fn(i);
    return {time:new Date(Date.UTC(2025,0,i+1)).toISOString().slice(0,10),
      open:c,high:c*1.01,low:c*.99,close:c,volume:vol(i)};
  });
}
test("radar identifies exceptional moves, IEX volume and range with evidence",()=>{
  const bars=series(45,i=>i===44?112:100,i=>i===44?5000:1000);
  const out=radar.analyze("SPY",bars);
  assert.equal(out.ready,true);
  assert.deepEqual(out.findings.map(f=>f.kind),
    ["PRICE_MOVE","VOLUME_SPIKE","RANGE_HIGH"]);
  assert.equal(out.asOf,bars.at(-1).time);
  assert.ok(out.findings.every(f=>f.evidence&&f.explain&&f.question));
  assert.deepEqual(radar.analyze("SPY",bars),out);
});
test("radar does not flag quiet history or treat missing volume as a spike",()=>{
  const bars=series(45,i=>100+i*.02,()=>null);
  const out=radar.analyze("QQQ",bars);
  assert.equal(out.ready,true);
  assert.equal(out.flags,0);
  assert.match(out.quiet,/does not mean/);
});
test("radar withholds sparse, malformed and reversed data",()=>{
  assert.equal(radar.analyze("SPY",series(21)).ready,false);
  assert.equal(radar.analyze("SPY",series().reverse()).ready,false);
  assert.equal(radar.analyze("SPY",series(45,i=>i===20?0:100)).ready,false);
  assert.throws(()=>radar.analyze("../bad",series()));
});
test("radar has no order or predictive output",()=>{
  const x=radar.analyze("AAPL",series());
  assert.equal(Object.hasOwn(x,"orders"),false);
  assert.equal(Object.hasOwn(x,"targetPrice"),false);
});
