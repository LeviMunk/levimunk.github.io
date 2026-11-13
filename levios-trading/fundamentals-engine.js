/* LeviOS evidence-first stock research: manual inputs from dated issuer/SEC
 * filings, not fabricated company data. No investment or order instructions.
 */
(function(scope){
"use strict";
const sym=/^[A-Z][A-Z0-9.-]{0,9}$/;
const date=/^\d{4}-\d{2}-\d{2}$/;
const bounded=(value,min,max,label)=>{
 const n=Number(value);
 if(value===""||value===null||value===undefined||!Number.isFinite(n)||n<min||n>max)
   throw Error(label+" must be a finite number from "+min+" to "+max+".");
 return n;
};
function assess(input,today){
 if(!input||!sym.test(input.symbol)||!date.test(input.periodEnd)||!date.test(today)||
   !Number.isFinite(Date.parse(input.periodEnd+"T00:00:00Z"))||input.periodEnd>today)
   throw Error("Valid ticker and historical reporting period required.");
 const source=String(input.sourceUrl||"").trim();
 if(!/^https:\/\/(www\.)?sec\.gov\//.test(source)&&
    !/^https:\/\/www\.annualreports\.com\//.test(source))
   throw Error("Link a public SEC filing or hosted annual report used for these inputs.");
 if(source.length>400||/[<>\s]/.test(source))throw Error("Invalid source URL.");
 const values={
   revenueGrowth:bounded(input.revenueGrowth,-100,500,"Revenue growth (%)"),
   operatingMargin:bounded(input.operatingMargin,-100,100,"Operating margin (%)"),
   debtToEquity:bounded(input.debtToEquity,0,100,"Debt/equity"),
   priceToEarnings:bounded(input.priceToEarnings,0,1000,"Price/earnings"),
   freeCashFlow:bounded(input.freeCashFlow,-1000000,1000000,"Free cash flow (millions)")
 };
 const fiscalDate=Date.parse(input.periodEnd+"T00:00:00Z");
 const asOf=Date.parse(today+"T00:00:00Z");
 const ageDays=Math.floor((asOf-fiscalDate)/86400000);
 const old=ageDays>450;
 const checks=[
   {label:"Revenue growth",good:values.revenueGrowth>5,caution:values.revenueGrowth<=0,explain:"Positive growth is useful, but compare it with industry peers, acquisitions and pricing effects."},
   {label:"Operating margin",good:values.operatingMargin>=15,caution:values.operatingMargin<5,explain:"Margins can be structurally different across industries. Check the trend and accounting quality."},
   {label:"Balance-sheet leverage",good:values.debtToEquity<=0.7,caution:values.debtToEquity>2,explain:"Debt/equity is not comparable across banks, insurers and industrial firms; negative equity can invalidate the measure."},
   {label:"Free cash flow",good:values.freeCashFlow>0,caution:values.freeCashFlow<=0,explain:"Free cash flow may swing with investments and working capital. Verify its definition and the reporting period."},
   {label:"Valuation context",good:values.priceToEarnings>0&&values.priceToEarnings<=25,caution:values.priceToEarnings===0||values.priceToEarnings>50,explain:"P/E depends on earnings quality, cyclicality and growth. A low multiple is not proof of undervaluation."}
 ];
 const favorable=checks.filter(c=>c.good).length;
 const cautions=checks.filter(c=>c.caution).length;
 let category,headline,next;
 if(old){
  category="outdated";headline="UPDATE FINANCIAL DATA";
  next="The reporting date is old. Find the latest filing and recompute before considering a transaction.";
 }else if(cautions>=2){
  category="high-caution";headline="INVESTIGATE RISKS BEFORE BUYING";
  next="Resolve the underlying financial concerns and compare against same-industry peers before making an entry plan.";
 }else if(favorable>=4&&cautions===0){
  category="research-candidate";headline="WORTH DEEPER RESEARCH";
  next="Compare valuation with similar firms, verify latest company guidance, examine earnings quality and write a downside scenario.";
 }else{
  category="incomplete-thesis";headline="MORE EVIDENCE NEEDED";
  next="Compare industry peers, cash-flow trends and valuation assumptions before forming a buy/hold/sell thesis.";
 }
 return {symbol:input.symbol,periodEnd:input.periodEnd,sourceUrl:source,
  values,ageDays,checks,favorable,cautions,category,headline,next,
  limitations:"Manual, user-entered figures; cross-period and sector comparability are not verified. These five coarse thresholds have no demonstrated predictive edge. No fair value, expected return, buy/sell order or suitability assessment."
 };
}
scope.LeviFundamentals=Object.freeze({version:"levios-fundamentals-v1",assess});
})(globalThis);
