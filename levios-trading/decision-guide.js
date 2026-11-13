/* LeviOS Decision Guide v1.
 * No order placement, no forecasts, no recommendations of expected returns.
 * Observations from completed IEX daily bars, interpreted conditionally.
 */
(function(scope){
"use strict";
const NUM=x=>typeof x==="number"&&Number.isFinite(x);
const mean=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;
const SYMBOL=/^[A-Z][A-Z0-9.-]{0,9}$/;
function examine({symbol,bars,holding=null,equity=null,asOfLimit=null,holdingsVerified=false}){
 if(!SYMBOL.test(symbol)||!Array.isArray(bars)||bars.length<50)
  return {symbol,ready:false,reason:"At least 50 completed historical daily IEX candles are required."};
 const rows=bars.map(b=>({date:String(b.time||b.date||""),close:Number(b.close)}));
 for(let i=0;i<rows.length;i++){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(rows[i].date)||!NUM(rows[i].close)||rows[i].close<=0||
     (i>0&&rows[i].date<=rows[i-1].date)||
     (asOfLimit&&rows[i].date>=asOfLimit))
   return {symbol,ready:false,reason:"Incomplete, unordered or unfinished candles; guidance withheld."};
 }
 const last=rows.at(-1),ma20=mean(rows.slice(-20).map(x=>x.close));
 const ma50=mean(rows.slice(-50).map(x=>x.close));
 const held=Boolean(holding && Math.abs(Number(holding.qty))>0);
 const quantity=held?Number(holding.qty):0;
 const mv=held?Number(holding.market_value):0;
 const weight=NUM(equity)&&equity>0&&NUM(mv)?Math.abs(mv)/equity*100:null;
 const above20=last.close>ma20,above50=last.close>ma50;
 let kind,title,why,next,changes;
 if(!holdingsVerified){
   kind="verify-portfolio";title="VERIFY PAPER HOLDINGS FIRST";
   why="The PAPER account has not confirmed its positions, so ownership and exposure are unknown.";
   next="Connect the private read-only PAPER account and rerun the brief before choosing an entry or exit.";
   changes="Reassess when holdings and equity are verified.";
 }else if(held&&weight!==null&&weight>25){
   kind="risk-review";title="REVIEW CONCENTRATION";
   why="This position is above 25% of your PAPER equity by absolute reported market value.";
   next="Review diversification, your original thesis, and whether reducing exposure fits your risk plan.";
   changes="Reassess after weights, total exposure or your risk limits change.";
 }else if(held&&!above20&&!above50){
   kind="exit-review";title="REVIEW HOLD / REDUCE";
   why="The last completed close sits below both its 20-day and 50-day IEX averages.";
   next="Check the original thesis and invalidation rule before considering a paper reduction or exit.";
   changes="Reassess if the thesis remains valid or the price regains both averages.";
 }else if(held){
   kind="hold-review";title="REVIEW HOLD";
   why="An open PAPER holding is present; the simple trend screen does not justify an automatic exit.";
   next="Review position sizing, event risk, and whether your thesis still holds. Do not assume positive momentum guarantees gains.";
   changes="Reassess on a thesis invalidation, material news, excess concentration or a significant trend shift.";
 }else if(above20&&above50){
   kind="entry-research";title="RESEARCH AN ENTRY";
   why="Last completed close is above its 20-day and 50-day IEX averages; this is trend context, not valuation.";
   next="Check fundamentals, valuation, earnings, spread, and a written risk plan before even considering a PAPER buy.";
   changes="Reassess if trend weakens or valuation, catalysts or risk budget contradict the idea.";
 }else{
   kind="wait";title="WAIT / INVESTIGATE";
   why="The simple daily-trend screen lacks two-average confirmation; that alone is not evidence of a bad company.";
   next="Wait for better evidence and evaluate the company rather than trading to stay busy.";
   changes="Reassess if trend, fundamentals or your time horizon changes.";
 }
 return {ready:true,symbol,asOf:last.date,lastClose:last.close,ma20,ma50,
  held,qty:quantity,weightPct:weight,kind,title,why,next,changes,
  coverage:"IEX single-exchange historical daily closes. Not a valuation, full-market quote, price target or trade recommendation."};
}
function summarize(results){
 const ready=results.filter(x=>x.ready),unavailable=results.length-ready.length;
 const priorities={"verify-portfolio":0,"risk-review":1,"exit-review":2,"hold-review":3,"entry-research":4,"wait":5};
 return {ready:ready.sort((a,b)=>priorities[a.kind]-priorities[b.kind]||a.symbol.localeCompare(b.symbol)),
   unavailable,observed:ready.length};
}
scope.LeviDecisionGuide=Object.freeze({version:"levios-decision-guide-v1",examine,summarize});
})(globalThis);
