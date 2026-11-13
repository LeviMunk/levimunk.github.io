import test from "node:test";
import assert from "node:assert/strict";
import {fetchEarnings,parseEarningsCSV,validateSymbols} from "../src/earnings-feed.mjs";
const csv='symbol,name,reportDate,fiscalDateEnding,estimate,currency,timeOfTheDay\n'+
'AAPL,Apple Inc,2026-12-08,2026-09-30,1.20,USD,After Market\n'+
'MSFT,"Microsoft, Corp",2026-12-09,2026-09-30,,USD,Before Market\n'+
'AAPL,Apple Inc,2026-12-08,2026-09-30,1.20,USD,After Market\n'+
'TESLA,Tesla,2026-12-09,2026-09-30,1.55,USD,Unknown\n';
test("CSV parser respects watchlist and distinguishes unconfirmed estimate",()=>{
 const rows=parseEarningsCSV(csv,["AAPL","MSFT"],"2026-11-12");
 assert.equal(rows.length,2);
 assert.equal(rows[0].status,"provider_estimate");
 assert.equal(rows[1].name,"Microsoft, Corp");
 assert.equal(rows[1].epsEstimate,null);
 assert.equal(rows[1].timing,"before_market");
});
test("reject malformed calendar and ticker injections",()=>{
 assert.throws(()=>validateSymbols(["AAPL","AAPL"]));
 assert.throws(()=>validateSymbols(["AAPL?apikey=secret"]));
 assert.throws(()=>parseEarningsCSV('<html>bad</html>',["AAPL"],"2026-11-12"));
});
test("missing key fails closed without network calls",async()=>{
 const data=await fetchEarnings({},["AAPL"],{fetchImpl:()=>{throw Error("unexpected request");}});
 assert.equal(data.status,"not_configured");
});
test("one secure upstream request returns estimated earnings without key disclosure",async()=>{
 let request="";
 const data=await fetchEarnings({ALPHAVANTAGE_API_KEY:"PRIVATE_TEST_KEY"},["AAPL"],{
   now:new Date("2026-11-12T18:00:00Z"),
   fetchImpl:async (url,options)=>{request=url;
     assert.equal(options.method,"GET");
     assert.equal(options.redirect,"error");
     return new Response(csv,{status:200});
   }
 });
 assert.equal(data.events.length,1);
 assert.equal(data.events[0].symbol,"AAPL");
 assert.equal(data.status,"fetched");
 assert.ok(request.includes("EARNINGS_CALENDAR"));
 assert.ok(!JSON.stringify(data).includes("PRIVATE_TEST_KEY"));
});
