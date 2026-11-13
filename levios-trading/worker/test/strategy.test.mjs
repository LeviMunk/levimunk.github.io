import test from "node:test";
import assert from "node:assert/strict";
import "../../strategy-engine.js";

const engine = globalThis.LeviStrategyEngine;
const series = (length=180, f=i=>100 + i * .22 + Math.sin(i / 7) * 4) =>
  Array.from({length},(_,i)=>{
    const date = new Date(Date.UTC(2025, 0, 1+i)).toISOString().slice(0,10);
    return {date,close:Number(f(i).toFixed(5))};
  });
const settings = {fast:5,slow:20,splitPct:70,feeBps:10,slippageBps:5};

test("strategy engine is a standalone deterministic client-side research module",()=>{
  assert.equal(engine.version,"levios-ma-v1");
  const rows=series();
  const first=engine.run(rows,settings);
  const again=engine.run(rows,settings);
  assert.deepEqual(first,again);
  assert.match(first.dataHash,/^[a-f0-9]{8}$/);
  assert.equal(first.settings.feeBps,10);
  assert.equal(first.splitAt,126);
  assert.equal(first.train.observations,126);
  assert.equal(first.test.observations,54);
  assert.equal(first.splitDate,rows[126].date);
  assert.equal(first.test.startDate,rows[126].date);
  assert.equal(first.train.endDate,rows[125].date);
  assert.equal(first.curve.length,rows.length);
  assert.equal(first.full.executions,first.executions.length);
});

test("trade signals use only prior completed data and execute at next close",()=>{
  const rows=series(80,i=>100+i);
  const result=engine.run(rows,{...settings,fast:2,slow:4,splitPct:70});
  assert.equal(result.executions[0].date,rows[4].date);
  assert.equal(result.executions[0].side,"BUY");
  assert.equal(result.executions[0].price,rows[4].close*1.0005);
});

test("all old curve points are identical when later unseen data is appended",()=>{
  const full=series(180);
  const prefix=full.slice(0,125);
  const early=engine.run(prefix,{...settings,splitPct:75});
  const later=engine.run(full,settings);
  assert.deepEqual(later.curve.slice(0,prefix.length),early.curve);
  assert.deepEqual(later.executions.filter(t=>t.date<=prefix.at(-1).date),early.executions);
});

test("fees and slippage lower returns under a rising buy/hold scenario",()=>{
  const rows=series(140,i=>100+i);
  const noCosts=engine.run(rows,{...settings,fast:2,slow:4,feeBps:0,slippageBps:0});
  const withCosts=engine.run(rows,{...settings,fast:2,slow:4,feeBps:25,slippageBps:25});
  assert.ok(withCosts.full.returnPct<noCosts.full.returnPct);
  assert.ok(withCosts.full.holdPct<noCosts.full.holdPct);
  assert.ok(noCosts.full.holdPct>0);
});

test("the benchmark charges its initial buy costs even with flat prices",()=>{
  const rows=series(90,()=>100);
  const result=engine.run(rows,{...settings,fast:2,slow:4});
  assert.ok(result.full.holdPct<0,"benchmark must include initial entry costs");
  assert.equal(result.full.returnPct,0,"strategy makes no purchases with flat SMAs");
  assert.equal(result.full.executions,0);
});

test("lookahead split, cost inputs, and price data reject invalid experiments",()=>{
  const rows=series();
  const fails=[
    {fast:0},{fast:20,slow:20},{fast:51,slow:50},
    {slow:251},{splitPct:95},{splitPct:20},{feeBps:-1},
    {slippageBps:-1},{feeBps:201},{slippageBps:201},
    {fast:2.5}
  ];
  for(const config of fails){
    assert.throws(()=>engine.run(rows,{...settings,...config}));
  }
  assert.throws(()=>engine.run(series(30),settings),/Not enough history/);
  assert.throws(()=>engine.run([{date:"2025-01-01",close:100},{date:"2025-01-01",close:102}],settings));
  assert.throws(()=>engine.run(series(180,()=>0),settings));
  assert.throws(()=>engine.run(series(180).reverse(),settings));
  assert.throws(()=>engine.run(series(180).map((row,i)=>i===20?{...row,close:NaN}:row),settings));
});

test("data fingerprint reflects changed input without relying on network or broker",()=>{
  const rows=series();
  const different=rows.map((r,i)=>i===12?{...r,close:r.close+1}:r);
  assert.notEqual(engine.checksum(rows),engine.checksum(different));
  assert.equal(engine.run(rows,settings).version,"levios-ma-v1");
});

test("robustness divides only the evaluation period into three non-overlapping windows",()=>{
  const run=engine.run(series(180),settings);
  const windows=engine.evaluationWindows(run);
  assert.equal(windows.length,3);
  assert.deepEqual(windows.map(w=>w.observations),[18,18,18]);
  assert.equal(windows[0].startDate,run.splitDate);
  assert.equal(windows[2].endDate,run.dataEnd);
  assert.equal(windows.reduce((s,w)=>s+w.executions,0),run.test.executions);
  assert.ok(windows.every(w=>Number.isFinite(w.returnPct)&&Number.isFinite(w.holdPct)&&Number.isFinite(w.excessPctPoints)&&w.maxDrawdownPct<=0));
  assert.equal(windows.at(-1).window,3);
});

test("robustness rejects too-short periods without inventing observations",()=>{
  const run=engine.run(series(90),{...settings,fast:2,slow:4,splitPct:70});
  assert.throws(()=>engine.evaluationWindows(run),/At least 30/);
});
