import test from "node:test";
import assert from "node:assert/strict";
import "../../decision-brief-engine.js";
const generate=globalThis.LeviDecisionBrief.generate;
const base={symbol:"MSFT",kind:"entry-research",ready:true,holdingsVerified:true,
 held:false,lastClose:400,asOf:"2026-11-12",why:"Price is above moving averages."};
const sec={status:"available",ticker:"MSFT",reportEnd:"2026-06-30",
 sourceUrl:"https://www.sec.gov/Archives/edgar/data/789019/",
 computed:{revenueGrowthPct:17,operatingMarginPct:40,freeCashFlowMillions:60000,longTermDebtToEquity:.1}};
const run=(overrides={},otherSec=sec)=>generate({symbol:"MSFT",decision:{...base,...overrides},sec:otherSec,today:"2026-11-13"});
test("a nonheld uptrend with sourced annuals gets research, not a buy",()=>{
 const r=run();assert.equal(r.action,"RESEARCH ENTRY");
 assert.ok(r.bull.some(x=>x.includes("Sales expanded")));
 assert.equal(Object.hasOwn(r,"buy"),false);
});
test("concentration takes precedence over a bullish signal",()=>{
 const r=run({kind:"risk-review",held:true,weightPct:39});
 assert.equal(r.action,"REVIEW RISK");assert.ok(r.bear.some(x=>x.includes("25%")));
});
test("missing account or financials abstain from entry claims",()=>{
 assert.equal(run({holdingsVerified:false},null).action,"VERIFY ACCOUNT");
 assert.equal(run({},null).action,"RESEARCH FIRST");
});
test("old prices and mismatched sources cannot generate confidence",()=>{
 const old=run({asOf:"2026-10-03"});assert.equal(old.action,"CHECK DATA");
 const other=run({}, {...sec,ticker:"AAPL"});assert.equal(other.secDate,null);
});
test("local original thesis is preserved as evidence, never embellished",()=>{
 const r=generate({symbol:"MSFT",decision:base,sec,today:"2026-11-13",
  thesis:{symbol:"MSFT",thesis:"Track secular cloud demand growth"}});
 assert.equal(r.thesis,"Track secular cloud demand growth");
});
