import test from "node:test";
import assert from "node:assert/strict";
import {summarizeSecFacts,fetchSecFinancials} from "../src/sec-financials.mjs";
const cik="0000320193", accn="0000320193-26-000090";
const annual=(start,end,val)=>({start,end,val,form:"10-K",filed:"2026-10-30",accn});
const instant=(end,val)=>({end,val,form:"10-K",filed:"2026-10-30",accn});
const tag=(v)=>({units:{USD:v}});
const facts={cik:320193,facts:{"us-gaap":{
 RevenueFromContractWithCustomerExcludingAssessedTax:tag([
 annual("2024-09-29","2025-09-27",100000000000),
 annual("2025-09-28","2026-09-26",110000000000)]),
 OperatingIncomeLoss:tag([annual("2025-09-28","2026-09-26",22000000000)]),
 NetCashProvidedByUsedInOperatingActivities:tag([annual("2025-09-28","2026-09-26",18000000000)]),
 PaymentsToAcquirePropertyPlantAndEquipment:tag([annual("2025-09-28","2026-09-26",4000000000)]),
 StockholdersEquity:tag([instant("2026-09-26",50000000000)]),
 LongTermDebtCurrent:tag([instant("2026-09-26",10000000000)]),
 LongTermDebtNoncurrent:tag([instant("2026-09-26",20000000000)]),
 NetIncomeLoss:tag([annual("2025-09-28","2026-09-26",25000000000)]),
 WeightedAverageNumberOfDilutedSharesOutstanding:{units:{shares:[annual("2025-09-28","2026-09-26",1000000000)]}}
}}};
test("only coherent 10-K periods produce sourced annual metrics",()=>{
 const out=summarizeSecFacts(facts,{ticker:"AAPL",cik,name:"Apple Inc."});
 assert.equal(out.reportEnd,"2026-09-26");assert.equal(out.computed.revenueGrowthPct,10.000000000000009);
 assert.equal(out.computed.operatingMarginPct,20);
 assert.equal(out.computed.freeCashFlowMillions,14000);
 assert.equal(out.computed.longTermDebtToEquity,.6);
 assert.equal(out.measures.find(x=>x.key==="annualDilutedShares")?.value,1000000000);
 assert.equal(out.measures.find(x=>x.key==="netIncome")?.value,25000000000);
 assert.match(out.sourceUrl,/www.sec.gov\/Archives/);
});
test("absent XBRL concept is null, not zero",()=>{
 const input=structuredClone(facts);delete input.facts["us-gaap"].OperatingIncomeLoss;
 const out=summarizeSecFacts(input,{ticker:"AAPL",cik,name:"Apple"});
 assert.equal(out.computed.operatingMarginPct,null);
});
test("company CIK mismatch is rejected",()=>{
 assert.throws(()=>summarizeSecFacts(facts,{ticker:"MSFT",cik:"0000789019",name:"Microsoft"}));
});
test("SEC user agent must be configured; never call upstream otherwise",async()=>{
 const x=await fetchSecFinancials({},"AAPL",{fetchImpl:()=>{throw Error("Should not fetch");}});
 assert.equal(x.status,"not_configured");
});
test("strict SEC URLs and matched ticker only; no credentials in output",async()=>{
 const calls=[];
 const result=await fetchSecFinancials({SEC_USER_AGENT:"LeviOS Tests contact@example.test"},"AAPL",{
  fetchImpl:async (url,opts)=>{
    calls.push({url,headers:opts.headers,method:opts.method});
    return Response.json(url.includes("company_tickers")?
      {"0":{ticker:"AAPL",title:"Apple Inc.",cik_str:320193}}:facts);
  }
 });
 assert.equal(result.status,"available");
 assert.equal(result.ticker,"AAPL");assert.equal(calls.length,2);
 assert.ok(calls.every(c=>c.method==="GET"));
 assert.ok(!JSON.stringify(result).includes("contact@example.test"));
});
