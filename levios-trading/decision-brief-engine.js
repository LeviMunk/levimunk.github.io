/* Action-first research brief. Evidence-conditioned and deliberately not a
 * personalized trade instruction. No network or brokerage write capabilities.
 */
(function(scope){
"use strict";
const DAY=86400000,DATE=/^\d{4}-\d{2}-\d{2}$/;
const finite=n=>typeof n==="number"&&Number.isFinite(n);
const age=(from,to)=>DATE.test(from||"")&&DATE.test(to||"")?
 (Date.parse(to+"T00:00:00Z")-Date.parse(from+"T00:00:00Z"))/DAY:Infinity;
function generate({symbol,decision,sec,today,thesis=null}){
 if(typeof symbol!=="string"||!/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol)||
   !DATE.test(today||""))throw Error("Choose a valid stock ticker and date.");
 if(!decision||decision.symbol!==symbol||decision.ready!==true)
  return {symbol,action:"CHECK DATA",tone:"wait",confidence:"insufficient",
   headline:"Market history unavailable",why:"Cannot assess a stock without verified completed prices.",
   bull:[],bear:[],unknown:["Completed IEX data not available."],
   next:"Check your market-data connection and retry.",sourceDate:null};
 const statements=[],bull=[],bear=[],unknown=[];
 const held=decision.held===true;
 const weight=finite(decision.weightPct)?decision.weightPct:null;
 const priced=finite(decision.lastClose)&&decision.lastClose>0;
 if(!priced)throw Error("Invalid reference price.");
 if(age(decision.asOf,today)>7 || age(decision.asOf,today)<0)
  return {symbol,action:"CHECK DATA",tone:"wait",confidence:"insufficient",
   headline:"Price data needs refreshing",why:"The last completed price is more than seven days old or dated in the future.",
   bull:[],bear:[],unknown:["Fresh market observation unavailable."],
   next:"Refresh completed daily data before considering any action.",sourceDate:decision.asOf};
 const secFresh=sec?.status==="available"&&sec.ticker===symbol&&
   age(sec.reportEnd,today)>=0&&age(sec.reportEnd,today)<=550;
 if(secFresh){
  const growth=sec.computed?.revenueGrowthPct,margin=sec.computed?.operatingMarginPct,
        fcf=sec.computed?.freeCashFlowMillions,leverage=sec.computed?.longTermDebtToEquity;
  if(finite(growth)){
   statements.push("Annual revenue growth: "+growth.toFixed(1)+"%.");
   if(growth>5)bull.push("Sales expanded "+growth.toFixed(1)+"% over the reported prior year.");
   else if(growth<0)bear.push("Annual revenue declined "+Math.abs(growth).toFixed(1)+"%.");
  }else unknown.push("Comparable prior-year revenue is unavailable.");
  if(finite(margin)){
   statements.push("Annual operating margin: "+margin.toFixed(1)+"%.");
   if(margin>=15)bull.push("Reported operating margin was "+margin.toFixed(1)+"%; compare margins with real peers.");
   else if(margin<5)bear.push("Operating margin was "+margin.toFixed(1)+"%; investigate profitability and industry norms.");
  }else unknown.push("Operating profit margin is unavailable.");
  if(finite(fcf)){
   if(fcf>0)bull.push("Reported annual free cash flow was positive; review its durability.");
   else bear.push("Annual free cash flow was nonpositive; assess investment and working-capital effects.");
  }else unknown.push("Annual free cash flow is unavailable.");
  if(finite(leverage)&&leverage>2)bear.push("Reported long-term debt/equity proxy exceeded 2; check leverage and sector definitions.");
  if(!finite(leverage))unknown.push("Comparable long-term debt and equity figures are missing.");
 }else{
  unknown.push("Current comparable SEC financial evidence is unavailable.");
 }
 if(!held && !decision.holdingsVerified) unknown.push("PAPER holdings are not verified; ownership is unknown.");
 if(held&&weight!==null&&weight>25)bear.push("PAPER position exceeds 25% of reported account equity; examine concentration risk.");
 if(decision.kind==="exit-review")bear.push("Last completed close is below both 20-day and 50-day IEX averages.");
 if(decision.kind==="entry-research")bull.push("Last completed price is above both 20-day and 50-day IEX averages; trend alone does not establish value.");
 const hasThesis=Boolean(thesis&&thesis.symbol===symbol&&typeof thesis.thesis==="string");
 if(!hasThesis)unknown.push("No documented investment thesis with an invalidation condition was supplied.");
 let action,headline,tone,next;
 if(!decision.holdingsVerified){
  action="VERIFY ACCOUNT";headline="Confirm holdings before deciding";tone="wait";
  next="Connect your PAPER account and rerun the brief. Avoid assuming this stock is unowned.";
 }else if(held&&weight!==null&&weight>25){
  action="REVIEW RISK";headline="Concentration deserves attention";tone="risk";
  next="Review your position size, downside limit and diversification before deciding whether to reduce exposure.";
 }else if(held&&decision.kind==="exit-review"){
  action="REVIEW HOLD / EXIT";headline="Check whether the thesis still holds";tone="risk";
  next="Compare the original invalidation rule with current evidence; consider an exit only if your documented plan supports it.";
 }else if(held){
  action="REVIEW HOLD";headline="Recheck your holding thesis";tone="neutral";
  next="Review concentration, company fundamentals, upcoming announcements and your exit conditions.";
 }else if(!secFresh){
  action="RESEARCH FIRST";headline="Not enough evidence for an entry";tone="wait";
  next="Inspect financial filings, valuation, alternatives and position risk before writing a PAPER trade plan.";
 }else if(decision.kind==="entry-research"){
  action="RESEARCH ENTRY";headline="A candidate for deeper study";tone="neutral";
  next="Test valuation against peers, verify upcoming events, then write an entry and invalidation plan before any PAPER purchase.";
 }else{
  action="WAIT / STUDY";headline="No clear entry case yet";tone="wait";
  next="Investigate business quality and valuation; you do not need to trade to make progress.";
 }
 unknown.push("Fair value, forward earnings, market-wide consolidated quote and your personal financial suitability are not established.");
 return {symbol,action,headline,tone,confidence:secFresh?"partial":"limited",
  sourceDate:decision.asOf,secDate:secFresh?sec.reportEnd:null,
  why:decision.why,referencePrice:decision.lastClose,held,
  bull,bear,unknown,next,
  thesis:hasThesis?thesis.thesis:null,
  sourceUrl:secFresh?sec.sourceUrl:null,
  disclosure:"Conditional research only; not a price target, forecast, brokerage order or personalized buy/sell instruction. IEX is a single-exchange price source."};
}
scope.LeviDecisionBrief=Object.freeze({version:"levios-decision-brief-v1",generate});
})(globalThis);
