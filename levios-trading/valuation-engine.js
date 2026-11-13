/* Relative valuation v1: deterministic explainable, approximate historical
 * enterprise metrics. No price targets, rankings, earnings forecasts or orders.
 * Share counts are diluted weighted-AVERAGE across annual period; using them
 * with later IEX prices yields proxies, NOT authoritative market caps.
 */
(function(scope){
"use strict";
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const SYMBOL=/^[A-Z][A-Z0-9.-]{0,9}$/;
const finite=x=>typeof x==="number"&&Number.isFinite(x);
const days=(a,b)=>(Date.parse(b+"T00:00:00Z")-Date.parse(a+"T00:00:00Z"))/86400000;
const metric=(name,value,description)=>({name,value:finite(value)?value:null,description});
function build({sec,priceObservation,today}){
 if(!sec||sec.status!=="available"||!SYMBOL.test(sec.ticker)||
   !DATE.test(sec.reportEnd||"")||!DATE.test(today||"")||
   !Array.isArray(sec.measures)||!priceObservation||
   priceObservation.symbol!==sec.ticker||
   !DATE.test(priceObservation.date||"")||
   !finite(priceObservation.close)||priceObservation.close<=0 ||
   priceObservation.date>today)throw Error("Source data incomplete or inconsistent.");
 const pricesAge=days(priceObservation.date,today),financialAge=days(sec.reportEnd,today);
 if(!finite(pricesAge)||!finite(financialAge)||financialAge<0||pricesAge<0)
   throw Error("Invalid observation dates.");
 const measure=key=>{
  const x=sec.measures.find(y=>y.key===key);
  return x&&finite(x.value)?x.value:null;
 };
 const shares=measure("annualDilutedShares");
 const revenue=measure("revenue");
 const earnings=measure("netIncome");
 const op=measure("operatingIncome");
 const fcf=finite(sec.computed?.freeCashFlowMillions)?
   sec.computed.freeCashFlowMillions*1000000:null;
 const price=priceObservation.close;
 // Ratios require aligned annual numerator, same-fiscal-period diluted
 // average shares, and near-term valid IEX reference price.
 const inputReady=shares!==null&&shares>0&&pricesAge<=7&&financialAge<=550;
 const perShare=(v)=>inputReady&&v!==null&&v>0?v/shares:null;
 const ratio=(v)=>v!==null&&v>0&&finite(price/v)?price/v:null;
 const salesPerShare=perShare(revenue);
 const incomePerShare=perShare(earnings);
 const fcfPerShare=perShare(fcf);
 const metrics=[
  metric("P/S proxy",ratio(salesPerShare),
   "IEX close divided by annual sales per diluted weighted-average share."),
  metric("P/E proxy",ratio(incomePerShare),
   "IEX close divided by annual net income per diluted weighted-average share; not a quoted trailing-12-month P/E."),
  metric("P/FCF proxy",ratio(fcfPerShare),
   "IEX close divided by annual free cash flow per diluted weighted-average share. Negative or zero FCF is unavailable."),
  metric("Operating margin",finite(sec.computed?.operatingMarginPct)?sec.computed.operatingMarginPct:null,
   "Annual operating profit as percentage of annual reported sales."),
  metric("Revenue growth",finite(sec.computed?.revenueGrowthPct)?sec.computed.revenueGrowthPct:null,
   "Historical year-over-year annual revenue growth.")
 ];
 return {ticker:sec.ticker,name:sec.name,reportEnd:sec.reportEnd,
  filingDate:sec.filingDate,sourceUrl:sec.sourceUrl,
  asOf:priceObservation.date,price,priceFeed:"IEX single-exchange close",
  shares,financialAgeDays:financialAge,priceAgeDays:pricesAge,
  ready:inputReady,metrics,
  limitations:"Approximate annual per-share valuations using SEC diluted weighted-average shares and IEX-only recent closes. Annual filing and price dates differ. No forecasts, share issuance/buybacks since filing, peer-sector adjustments, enterprise value, or validated fair value. Not a Buy/Hold/Sell signal."};
}
function compare(a,b){
 if(!a?.ticker||!b?.ticker||a.ticker===b.ticker)throw Error("Select different stocks.");
 const aligned=DATE.test(a.reportEnd)&&DATE.test(b.reportEnd)&&
   Math.abs(days(a.reportEnd,b.reportEnd))<=120;
 const output=a.metrics.map((m,i)=>{
  const other=b.metrics[i];
  const eligible=m.value!==null&&other?.value!==null&&aligned&&
    (!m.name.startsWith("P/")||(a.ready&&b.ready));
  return {name:m.name,first:m.value,second:other?.value??null,
    comparable:eligible,
    evidence:eligible?
      "Arithmetic comparison only. Different industry economics and growth expectations can justify different multiples.":
      "Not comparable: financial periods differ by >120 days, an input is missing, or market data is stale."};
 });
 return {first:a.ticker,second:b.ticker,aligned,items:output,
  judgment:"No automatic winner. Lower multiples can signal value, deterioration, accounting differences or different prospects; check peer sector, growth, risk, capital allocation and management guidance."};
}
scope.LeviRelativeValuation=Object.freeze({version:"levios-relative-valuation-v1",build,compare});
})(globalThis);
