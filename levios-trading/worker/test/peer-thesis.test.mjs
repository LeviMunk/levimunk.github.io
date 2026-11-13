import test from "node:test";
import assert from "node:assert/strict";
import "../../peer-thesis-engine.js";
const e=globalThis.LeviPeerThesis;
const company=(ticker,growth,margin,pe,fcf)=>({
 ticker,metrics:[{name:"Revenue growth",value:growth},
 {name:"Operating margin",value:margin},
 {name:"P/E proxy",value:pe},
 {name:"P/FCF proxy",value:fcf}]
});
test("peers are explicitly editorial candidates rather than verified equivalents",()=>{
 const options=e.candidates("MSFT");
 assert.ok(options.some(x=>x.ticker==="ORCL"));
 assert.ok(options.every(x=>x.status==="editorial_candidate_not_verified"));
 assert.deepEqual(e.candidates("UNKNOWN"),[]);
});
test("supported comparison produces both bull and bear evidence, no orders",()=>{
 const a=company("MSFT",14,35,32,42);
 const b=company("ORCL",9,38,24,31);
 const r=e.thesis(a,b,{first:"MSFT",second:"ORCL",aligned:true});
 assert.ok(r.bull.some(x=>x.includes("growth")));
 assert.ok(r.bear.some(x=>x.includes("margin")));
 assert.equal(Object.hasOwn(r,"buy"),false);
 assert.equal(Object.hasOwn(r,"targetPrice"),false);
});
test("unknown and mismatched financials lead to explicit unknowns",()=>{
 const a=company("AAPL",null,null,null,null);
 const b=company("DELL",5,20,18,10);
 const r=e.thesis(a,b,{first:"AAPL",second:"DELL",aligned:false});
 assert.ok(r.unknown.length>=4);
 assert.match(r.conclusion,/No validated Buy\/Hold\/Sell/);
});
test("company identity mismatch cannot create a thesis",()=>{
 assert.throws(()=>e.thesis(company("MSFT",10,30,20,20),
 company("ORCL",10,30,20,20),{first:"NVDA",second:"ORCL",aligned:true}));
});
