/* Peer & investment-thesis research v1.
 * Candidate peers are hand-curated examples, NOT SIC verification or
 * independent evidence that their business models or accounting align.
 * An investment thesis is a set of research hypotheses, NOT a forecast.
 */
(function(scope){
"use strict";
const peers=Object.freeze({
 MSFT:[["ORCL","Enterprise software and cloud infrastructure overlap","Different cloud and license economics"],["CRM","Enterprise application subscriptions","Much narrower software portfolio"],["NOW","Enterprise workflow software","Different customer and revenue mix"]],
 ORCL:[["MSFT","Enterprise software and cloud infrastructure","Microsoft has much broader consumer and cloud exposure"],["CRM","Enterprise software subscriptions","Database and infrastructure are not CRM"],["NOW","Enterprise workflow software","Different product categories"]],
 CRM:[["NOW","Enterprise workflow subscriptions","CRM and workflow products differ"],["ORCL","Enterprise software","Licensing and infrastructure exposure differs"],["MSFT","Enterprise application software","Microsoft is much more diversified"]],
 NOW:[["CRM","Cloud software sold to enterprises","Different product focus"],["ORCL","Enterprise software","Large database and cloud infrastructure exposure"],["MSFT","Enterprise subscriptions","Much broader revenue mix"]],
 AAPL:[["DELL","Personal computing hardware","Apple integrates consumer services and devices"],["HPQ","Personal computing devices","Very different services and premium-device mix"],["MSFT","Consumer and enterprise computing ecosystems","Microsoft is mostly software and cloud"]],
 NVDA:[["AMD","Semiconductor compute accelerators","Different AI ecosystem and customer concentration"],["INTC","Compute semiconductor products","Foundry and manufacturing economics differ"],["AVGO","Compute/networking semiconductors","Infrastructure software and customer mix differ"]],
 AMD:[["NVDA","Compute accelerators and GPUs","AI ecosystem and software differentiation"],["INTC","PC/server processors","Manufacturing strategies differ"],["AVGO","Semiconductor exposure","Product portfolio substantially differs"]],
 GOOGL:[["META","Digital advertising monetization","Search differs from social and messaging"],["AMZN","Digital ads and cloud services overlap","Retail dominates Amazon's revenue"],["MSFT","Cloud and AI infrastructure","Search/advertising models differ"]],
 GOOG:[["META","Digital advertising monetization","Search differs from social and messaging"],["AMZN","Cloud and advertising","Retail revenue mix differs"],["MSFT","Cloud and AI","Different advertising exposure"]],
 META:[["GOOGL","Advertising-funded digital platforms","Search vs social monetization differs"],["SNAP","Social advertising","Different scale and profitability"],["PINS","Social advertising","Different engagement and advertiser base"]],
 AMZN:[["WMT","Large-scale retail and e-commerce","AWS and third-party marketplace change margins"],["GOOGL","Cloud and advertising revenue streams","Alphabet has no comparable retail business"],["COST","High-volume retail","Membership and wholesale economics differ"]],
 WMT:[["COST","Large-format retail","Membership fee economics differ"],["TGT","General merchandise retail","Store mix and online penetration differ"],["AMZN","Consumer retail and e-commerce","Cloud revenue makes Amazon different"]],
 COST:[["WMT","Large-format retail","Membership dependence differs"],["TGT","Consumer retail","Merchandise and margin models differ"],["BJ","Membership-based wholesale retail","Scale and assortment differ"]],
 KO:[["PEP","Global beverages","PepsiCo also has large snacks business"],["KDP","Branded drinks","Different portfolio and geography"]],
 PEP:[["KO","Global beverage brands","PepsiCo has substantial snacks operations"],["KDP","Beverages","Different distribution and brand mix"]]
});
function candidates(symbol){
 const key=String(symbol||"").trim().toUpperCase();
 return (peers[key]||[]).map(([ticker,overlap,difference])=>({
  ticker,overlap,difference,status:"editorial_candidate_not_verified",
  warning:"Candidate only. Financial comparability, same industry classification, accounting and valuations require independent verification."
 }));
}
const m=(a,name)=>a?.metrics?.find(x=>x.name===name)?.value??null;
const valid=x=>typeof x==="number"&&Number.isFinite(x);
function thesis(primary,secondary,comparison){
 if(!primary||!secondary||!comparison||comparison.first!==primary.ticker||
   comparison.second!==secondary.ticker)throw Error("Comparison evidence mismatch.");
 const bull=[],bear=[],unknown=[];
 const metric=(name,unit="")=>{
  const a=m(primary,name),b=m(secondary,name);
  return valid(a)&&valid(b)&&comparison.aligned?{a,b,name,unit}:null;
 };
 const growth=metric("Revenue growth","%"),margin=metric("Operating margin","%");
 const pe=metric("P/E proxy","x"),fcf=metric("P/FCF proxy","x");
 if(growth){
  if(growth.a>growth.b)bull.push("Higher historical annual revenue growth than "+secondary.ticker+
    " ("+growth.a.toFixed(1)+"% vs "+growth.b.toFixed(1)+"%); test its durability.");
  else if(growth.a<growth.b)bear.push("Lower historical annual revenue growth than "+secondary.ticker+
    " ("+growth.a.toFixed(1)+"% vs "+growth.b.toFixed(1)+"%); investigate the drivers.");
  else unknown.push("Revenue growth matches in the comparison period; future growth remains unverified.");
 }else unknown.push("Annual revenue growth comparison is missing or fiscal dates differ.");
 if(margin){
  if(margin.a>margin.b)bull.push("Higher reported annual operating margin ("+
    margin.a.toFixed(1)+"% vs "+margin.b.toFixed(1)+"%); check segment and accounting differences.");
  else if(margin.a<margin.b)bear.push("Lower annual operating margin ("+
    margin.a.toFixed(1)+"% vs "+margin.b.toFixed(1)+"%); verify business-model comparability.");
  else unknown.push("Same annual operating margin; determine whether the business mix is comparable.");
 }else unknown.push("Annual operating margin comparison is unavailable or misaligned.");
 if(pe){
  if(pe.a<pe.b)bull.push("Lower approximate annual P/E proxy ("+pe.a.toFixed(1)+
    "x vs "+pe.b.toFixed(1)+"x); check whether quality or outlook explains the discount.");
  else if(pe.a>pe.b)bear.push("Higher approximate annual P/E proxy ("+pe.a.toFixed(1)+
    "x vs "+pe.b.toFixed(1)+"x); assess the growth required to justify it.");
 }else unknown.push("Reliable positive-earnings P/E proxies are not available for both firms.");
 if(fcf){
  if(fcf.a>fcf.b)bear.push("Higher approximate price/free-cash-flow multiple ("+
    fcf.a.toFixed(1)+"x vs "+fcf.b.toFixed(1)+"x); investigate cash conversion and reinvestment.");
  else if(fcf.a<fcf.b)bull.push("Lower approximate price/free-cash-flow multiple ("+
    fcf.a.toFixed(1)+"x vs "+fcf.b.toFixed(1)+"x); compare accounting and capital needs.");
 }else unknown.push("Positive annual free-cash-flow valuation proxies cannot be compared.");
 const required=[
  "Review issuer disclosures for segment mix, competitive moat and cash-flow durability.",
  "Review earnings guidance, valuation assumptions, dilution, and current catalysts.",
  "Write a price-independent invalidation condition and a downside risk budget."
 ];
 if(!bull.length)bull.push("Bull evidence is insufficient from the available metrics; investigate competitive advantage and sustainable cash generation.");
 if(!bear.length)bear.push("Bear evidence is insufficient from the available metrics; stress-test valuation, concentration and downside scenarios.");
 if(!comparison.aligned)unknown.push("Fiscal periods differ by more than 120 days; do not infer relative advantage.");
 return {symbol:primary.ticker,peer:secondary.ticker,bull,bear,unknown,
  researchActions:required,
  status:"conditional_hypotheses_not_recommendations",
  conclusion:"No validated Buy/Hold/Sell rating or forecast. These are evidence-conditioned questions from historical SEC and IEX figures, not a forward-looking investment thesis. A low multiple or higher growth does not establish future performance."};
}
scope.LeviPeerThesis=Object.freeze({version:"levios-peer-thesis-v1",candidates,thesis});
})(globalThis);
