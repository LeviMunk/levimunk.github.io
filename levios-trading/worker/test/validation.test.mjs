import test from "node:test";
import assert from "node:assert/strict";
import "../../validation-engine.js";

const gate = globalThis.LeviStrategyValidation;
const base = {
  version:1, savedAt:"2026-11-12T10:00:00.000Z",
  symbol:"SPY", source:"IEX-only Alpaca daily close",
  engine:"levios-ma-v1",
  dataHash:"0123abcd",dataStart:"2025-11-01",
  dataEnd:"2026-11-01",splitDate:"2026-08-01",
  settings:{fast:20,slow:50,splitPct:70,feeBps:10,slippageBps:5},
  trainReturnPct:6,testReturnPct:8,testHoldPct:5,
  testDrawdownPct:-8,testObservations:60,testExecutions:4,
  stressFeeBps:20,stressSlippageBps:10,
  stressTestReturnPct:7,stressTestHoldPct:4
};
const make = (updates={}) => ({...base,...updates,settings:{...base.settings,...updates.settings}});

test("passing strategy satisfies independent period, execution, benchmark, drawdown and cost gates", () => {
  const result=gate.evaluate(make());
  assert.equal(result.version,"levios-validation-v1");
  assert.equal(result.eligible,true);
  assert.ok(result.checks.length >= 7);
  assert.ok(result.checks.every(x=>x.pass));
  assert.equal(result.baselineType,"buy_and_hold");
  assert.equal(result.baselineVersion,null);
  assert.equal(result.metrics.benchmarkExcessPctPoints,3);
  assert.equal(result.metrics.stressExcessPctPoints,3);
});

test("an earlier saved run missing stress measurements fails closed", () => {
  const candidate=make();
  delete candidate.stressTestReturnPct;
  const result=gate.evaluate(candidate);
  assert.equal(result.eligible,false);
  assert.deepEqual(result.checks.filter(x=>!x.pass).map(x=>x.code),["evidence"]);
  assert.match(result.checks[0].explanation,/Legacy runs/);
});

test("rejects fictional DEMO prices even when paper metrics look outstanding", () => {
  const result=gate.evaluate(make({source:"FICTIONAL DEMO daily close",symbol:"DEMO",
    testReturnPct:1000}));
  assert.equal(result.eligible,false);
  assert.ok(result.checks.some(x=>x.code==="source"&&!x.pass));
});

test("returns explicit failures for short holdout, few executions and weak benchmark results", () => {
  const result=gate.evaluate(make({testObservations:15,testExecutions:1,
    testReturnPct:4.8,testHoldPct:5}));
  assert.equal(result.eligible,false);
  const reasons=result.checks.filter(x=>!x.pass).map(x=>x.code);
  assert.deepEqual(reasons,["history","executions","benchmark"]);
});

test("rejects excessive drawdown even if raw return and benchmark excess pass", () => {
  const result=gate.evaluate(make({testDrawdownPct:-20}));
  assert.equal(result.eligible,false);
  assert.ok(result.checks.some(x=>x.code==="drawdown"&&!x.pass));
});

test("stress costs must really increase and the stressed test must still beat its baseline", () => {
  const fakeStress=gate.evaluate(make({stressFeeBps:10,stressSlippageBps:5}));
  assert.equal(fakeStress.eligible,false);
  assert.equal(fakeStress.checks[0].code,"evidence");
  const stressedLoss=gate.evaluate(make({stressTestReturnPct:1,stressTestHoldPct:4}));
  assert.equal(stressedLoss.eligible,false);
  assert.ok(stressedLoss.checks.some(x=>x.code==="stress"&&!x.pass));
});

test("approved research champion must match data source, dates, fingerprint, split and cost protocol", () => {
  const old=make({version:1,testReturnPct:7,testDrawdownPct:-7});
  const better=make({version:2,testReturnPct:8});
  const review=gate.evaluate(better,old);
  assert.equal(review.eligible,true);
  assert.equal(review.baselineType,"research_champion");
  assert.equal(review.baselineVersion,1);
  assert.ok(review.checks.some(x=>x.code==="champion_improvement"&&x.pass));
  for(const changes of [
    {symbol:"QQQ"},{source:"Browser-imported CSV daily close"},
    {dataHash:"abcdef12"},{dataEnd:"2026-11-02"},
    {splitDate:"2026-08-02"},{engine:"levios-ma-v2"},
    {settings:{splitPct:75}},{settings:{feeBps:20}},{settings:{slippageBps:10}}
  ]){
    const candidate=make({version:2,...changes});
    // Preserve a valid high-cost stress test when the base execution costs
    // change, so this test isolates the same-data comparability gate.
    candidate.stressFeeBps=Math.max(5,candidate.settings.feeBps*2);
    candidate.stressSlippageBps=Math.max(5,candidate.settings.slippageBps*2);
    const rejected=gate.evaluate(candidate,old);
    assert.equal(rejected.eligible,false,JSON.stringify(changes));
    assert.ok(rejected.checks.some(x=>x.code==="comparable"&&!x.pass));
  }
});

test("approval gates prevent champion replacement without meaningful improvement", () => {
  const champion=make({version:1,testReturnPct:8,testDrawdownPct:-8});
  const weak=gate.evaluate(make({version:2,testReturnPct:8.2}),champion);
  assert.equal(weak.eligible,false);
  assert.ok(weak.checks.some(x=>x.code==="champion_improvement"&&!x.pass));
  const tooRisky=gate.evaluate(make({version:2,testReturnPct:9,
    testDrawdownPct:-12}),champion);
  assert.equal(tooRisky.eligible,false);
  assert.ok(tooRisky.checks.some(x=>x.code==="champion_drawdown"&&!x.pass));
});

test("does not compare a version against itself or unrelated context", () => {
  const self=gate.evaluate(make(),make());
  assert.equal(self.eligible,false);
  assert.ok(self.checks.some(x=>x.code==="comparable"&&!x.pass));
});

test("finds last matching explicitly approved champion and ignores mere passing reviews", () => {
  const run1=make({version:1});
  const run2=make({version:2});
  const decisions=[
    {kind:"approved_research",contextKey:gate.researchContext(run1),
      snapshot:run1,candidateVersion:1},
    {kind:"review",contextKey:gate.researchContext(run2),
      passed:true,snapshot:run2,candidateVersion:2}
  ];
  assert.equal(gate.comparableChampion(decisions,make({version:3})).version,1);
  decisions.push({kind:"approved_research",contextKey:gate.researchContext(run2),
    snapshot:run2,candidateVersion:2});
  assert.equal(gate.comparableChampion(decisions,make({version:3})).version,2);
  assert.equal(gate.comparableChampion(decisions,make({
    version:3,dataHash:"ffffeeee"})),null);
});

test("validation engine remains read-only and never includes trading commands", () => {
  assert.equal(typeof gate.evaluate,"function");
  assert.equal(typeof gate.comparableChampion,"function");
  assert.equal("execute" in gate,false);
  assert.equal("trade" in gate,false);
  assert.equal("submit" in gate,false);
});
