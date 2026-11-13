import test from "node:test";
import assert from "node:assert/strict";
import "../../coach-engine.js";
const coach=globalThis.LeviTradingCoach;
const bars=(length=70)=>Array.from({length},(_,i)=>{
  const price=100+i*.4;
  return {time:new Date(Date.UTC(2025,0,1+i)).toISOString().slice(0,10),
    open:price,high:price+1,low:price-1,close:price+.2};
});
test("coach describes real candle observations reproducibly",()=>{
  const result=coach.analyze(bars());
  assert.equal(result.ready,true);
  assert.equal(result.sessions,70);
  assert.ok(result.observations.length>=4);
  assert.ok(result.ma20>0&&result.ma50>0);
  assert.deepEqual(coach.analyze(bars()),result);
  assert.ok(result.observations.every(x=>x.question&&x.explain));
});
test("coach withholds incomplete, invalid, stale-format and missing candles",()=>{
  assert.equal(coach.analyze([]).ready,false);
  assert.equal(coach.analyze(bars(20)).ready,false);
  assert.equal(coach.analyze(bars().reverse()).ready,false);
  assert.equal(coach.analyze(bars().map((b,i)=>i===4?{...b,high:0}:b)).ready,false);
});
test("coach never generates orders or buy/sell decisions",()=>{
  const result=coach.analyze(bars());
  assert.equal(result.feed,"IEX daily bars");
  assert.equal(result.observations.some(x=>/buy now|sell now/i.test(x.fact)),false);
  assert.equal(Object.hasOwn(result,"orders"),false);
});
