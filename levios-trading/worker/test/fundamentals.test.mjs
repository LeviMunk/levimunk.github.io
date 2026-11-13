import test from "node:test";
import assert from "node:assert/strict";
import "../../fundamentals-engine.js";
const assess=globalThis.LeviFundamentals.assess;
const input={symbol:"MSFT",periodEnd:"2026-09-30",
 sourceUrl:"https://www.sec.gov/Archives/edgar/data/0000000000/test",
 revenueGrowth:12,operatingMargin:30,debtToEquity:.3,priceToEarnings:22,freeCashFlow:1000};
test("five dated supplied metrics produce explainable research, not a trade",()=>{
 const r=assess(input,"2026-11-12");
 assert.equal(r.category,"research-candidate");
 assert.equal(r.checks.length,5);
 assert.equal(r.favorable,5);
 assert.ok(!Object.hasOwn(r,"order")&&!Object.hasOwn(r,"targetPrice"));
});
test("multiple concerning metrics require deeper risk investigation",()=>{
 const r=assess({...input,revenueGrowth:-10,freeCashFlow:-80,debtToEquity:4},"2026-11-12");
 assert.equal(r.category,"high-caution");
});
test("stale financial period cannot produce positive research category",()=>{
 const r=assess({...input,periodEnd:"2024-01-01"},"2026-11-12");
 assert.equal(r.category,"outdated");
});
test("missing inputs, future dates and untrusted source links cannot pass",()=>{
 assert.throws(()=>assess({...input,operatingMargin:""},"2026-11-12"));
 assert.throws(()=>assess({...input,periodEnd:"2027-01-01"},"2026-11-12"));
 assert.throws(()=>assess({...input,sourceUrl:"javascript:alert(1)"},"2026-11-12"));
 assert.throws(()=>assess({...input,sourceUrl:"https://evil.com/"},"2026-11-12"));
});
