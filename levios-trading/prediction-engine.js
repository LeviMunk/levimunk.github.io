/* PAPER-ONLY trade prediction scorecard. Long-only hypothetical limit entry.
 * This is retrospective candle observation, NOT real orders or fill evidence.
 * Requires bars strictly after creation to prevent look-ahead.
 * Same-bar entry/stop/target ambiguities remain unresolved.
 */
(function(scope) {
"use strict";
const TICKER=/^[A-Z][A-Z0-9.-]{0,9}$/;
const DAY=86400000;
const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+"T00:00:00Z"));
function price(x,name){
 const n=Number(x);
 if(x===null||x===undefined||String(x).trim()===""||!Number.isFinite(n)||n<=0||n>1000000)
  throw Error(name+" needs a positive price.");
 return n;
}
function plan(input,{id,now}={}){
 const symbol=String(input?.symbol||"").trim().toUpperCase();
 if(!TICKER.test(symbol)||typeof id!=="string"||!/^[a-zA-Z0-9_-]{8,80}$/.test(id)||
  typeof now!=="string"||Number.isNaN(Date.parse(now)))
   throw Error("Provide a valid ticker, identifier and timestamp.");
 const entry=price(input.entry,"Entry"),stop=price(input.stop,"Stop");
 const target=price(input.target,"Target");
 if(!(stop<entry&&entry<target))throw Error("Long PAPER plan requires stop < entry < target.");
 const days=Number(input.expiryDays);
 if(!Number.isInteger(days)||days<1||days>60)throw Error("Expiry must be 1–60 calendar days.");
 const risk=price(input.riskBudget,"Hypothetical risk budget");
 if(risk>1000000)throw Error("Risk budget exceeds safe limit.");
 return Object.freeze({id,symbol,createdAt:now,entry,stop,target,expiryDays:days,riskBudget:risk,
  plannedShares:Math.floor(risk/(entry-stop)),mode:"PAPER_SIM_ONLY",
  rules:"Long limit-entry experiment, post-creation completed IEX candles; no order placement. Entry/exit fills approximate, gaps can exceed planned losses."});
}
function replay(plan,bars,today){
 if(!plan||plan.mode!=="PAPER_SIM_ONLY"||!validDate(today)||!Array.isArray(bars))
  throw Error("Invalid PAPER plan or price observations.");
 const cutoff=plan.createdAt.slice(0,10);
 if(!validDate(cutoff))throw Error("Invalid creation date.");
 const expiration=new Date(Date.parse(cutoff+"T00:00:00Z")+plan.expiryDays*DAY).toISOString().slice(0,10);
 if(today<cutoff)throw Error("Cannot evaluate before plan creation.");
 const rows=bars.filter(b=>b&&validDate(b.time||b.date)&&
  (b.time||b.date)>cutoff&&(b.time||b.date)<today)
  .map(b=>({date:b.time||b.date,open:Number(b.open),high:Number(b.high),
   low:Number(b.low),close:Number(b.close)}))
  .sort((a,b)=>a.date.localeCompare(b.date));
 for(let i=0;i<rows.length;i++){
  const b=rows[i];
  if([b.open,b.high,b.low,b.close].some(n=>!Number.isFinite(n)||n<=0)||
     b.low>Math.min(b.open,b.close)||b.high<Math.max(b.open,b.close)||
     (i>0&&b.date===rows[i-1].date))
   return {status:"unverifiable",reason:"Invalid or duplicate OHLC evidence.",symbol:plan.symbol};
 }
 if(!rows.length)return {status:"awaiting_data",symbol:plan.symbol,reason:"No completed post-plan daily candles yet."};
 let fill=null;
 for(const b of rows){
  if(b.date>expiration)break;
  if(!fill){
   if(b.low>plan.entry)continue;
   // If price opens below stop, entry and invalidation sequencing cannot be established.
   if(b.open<=plan.stop)return {status:"ambiguous",symbol:plan.symbol,
     reason:"Price opened through entry and stop. A limit order's path/fill is unknown.",date:b.date};
   if(b.low<=plan.stop || b.high>=plan.target&&b.low<=plan.entry)
    return {status:"ambiguous",symbol:plan.symbol,
     reason:"Entry and stop/target touched in one daily candle; intraday sequence unknown.",date:b.date};
   fill={date:b.date,price:b.open<=plan.entry?b.open:plan.entry};
   continue; // Do not assume an intraday exit on the entry candle.
  }
  const stopHit=b.low<=plan.stop,targetHit=b.high>=plan.target;
  if(stopHit&&targetHit)return {status:"ambiguous",symbol:plan.symbol,
   entryDate:fill.date,entryPrice:fill.price,date:b.date,
   reason:"Both exit prices touched in one candle; order of events unknown."};
  if(stopHit||targetHit){
   // Downward stop gaps can be worse than planned; target fills conservatively at target.
   const exit=stopHit?Math.min(b.open,plan.stop):plan.target;
   const delta=(exit-fill.price)/fill.price*100;
   return {status:stopHit?"loss":"win",symbol:plan.symbol,
    entryDate:fill.date,entryPrice:fill.price,exitDate:b.date,exitPrice:exit,
    returnPct:delta,rMultiple:(exit-fill.price)/(plan.entry-plan.stop),
    reason:stopHit?"Hypothetical stop touched. Gap losses may exceed plan.":"Hypothetical profit target touched.",
    isSimulation:true};
  }
 }
 if(fill)return {status:"open",symbol:plan.symbol,entryDate:fill.date,
  entryPrice:fill.price,reason:"Hypothetical limit entry occurred; no unambiguous exit yet."};
 if(today>expiration)return {status:"expired",symbol:plan.symbol,
  reason:"Entry price was never touched before the planned expiration."};
 return {status:"waiting",symbol:plan.symbol,reason:"Entry not touched yet."};
}
function stats(results){
 const completed=results.filter(x=>x.status==="win"||x.status==="loss");
 const wins=completed.filter(x=>x.status==="win").length;
 const losses=completed.length-wins;
 const avgR=completed.length?completed.reduce((a,x)=>a+x.rMultiple,0)/completed.length:null;
 const counts={};
 for(const r of results)counts[r.status]=(counts[r.status]||0)+1;
 return {plans:results.length,wins,losses,completed:completed.length,
  winRatePct:completed.length?wins/completed.length*100:null,
  averageR:avgR,statusCounts:counts,
  warning:"Hypothetical fills from IEX daily OHLC only; not broker executions. Never treat an unresolved or untriggered plan as a win. Win rate alone cannot establish a profitable edge. No costs, spreads, slippage or benchmark adjustment."};
}
scope.LeviPaperPredictions=Object.freeze({version:"levios-paper-predictions-v1",plan,replay,stats});
})(globalThis);
