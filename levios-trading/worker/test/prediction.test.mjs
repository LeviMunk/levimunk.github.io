import test from "node:test";
import assert from "node:assert/strict";
import "../../prediction-engine.js";
const e=globalThis.LeviPaperPredictions;
const p=e.plan({symbol:"MSFT",entry:100,stop:95,target:115,expiryDays:30,riskBudget:10},
 {id:"paper-test-1",now:"2026-11-01T15:00:00.000Z"});
const bar=(time,open,high,low,close)=>({time,open,high,low,close});
test("never uses prices from plan creation or future unfinished session",()=>{
 assert.equal(e.replay(p,[bar("2026-11-01",100,120,90,110)],"2026-11-03").status,"awaiting_data");
});
test("unambiguous next-session target is a hypothetical win",()=>{
 const r=e.replay(p,[bar("2026-11-02",101,103,99,102),
 bar("2026-11-03",104,116,101,115)],"2026-11-04");
 assert.equal(r.status,"win");assert.equal(r.entryPrice,100);assert.equal(r.rMultiple,3);
});
test("gap through stop is a larger simulated loss",()=>{
 const r=e.replay(p,[bar("2026-11-02",101,102,99,100),
 bar("2026-11-03",92,94,90,91)],"2026-11-04");
 assert.equal(r.status,"loss");assert.equal(r.exitPrice,92);assert.ok(r.rMultiple< -1);
});
test("same daily candle hitting multiple thresholds is unresolved, not winning",()=>{
 const r=e.replay(p,[bar("2026-11-02",102,119,93,105)],"2026-11-04");
 assert.equal(r.status,"ambiguous");assert.equal(e.stats([r]).completed,0);
});
test("expired, waiting and open are not counted as losses or wins",()=>{
 const expired=e.replay(p,[bar("2026-11-03",122,130,120,125)],"2027-01-03");
 const waiting=e.replay(p,[bar("2026-11-03",122,130,120,125)],"2026-11-05");
 const open=e.replay(p,[bar("2026-11-02",101,103,99,100)],"2026-11-05");
 assert.equal(expired.status,"expired");
 assert.equal(waiting.status,"waiting");
 assert.equal(open.status,"open");
 assert.equal(e.stats([expired,waiting,open]).completed,0);
});
test("invalid plans cannot be admitted",()=>{
 assert.throws(()=>e.plan({symbol:"MSFT",entry:100,stop:120,target:130,expiryDays:30,riskBudget:10},{id:"paper-test-2",now:"2026-11-01T00:00:00Z"}));
 assert.throws(()=>e.plan({symbol:"MSFT",entry:100,stop:95,target:115,expiryDays:0,riskBudget:10},{id:"paper-test-2",now:"2026-11-01T00:00:00Z"}));
});
