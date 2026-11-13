/* LeviOS earnings research: source-aware and deterministic, no trades.
 * The curated event below is a company-confirmed announcement, NOT a feed.
 */
(function(scope){
"use strict";
const verifiedOn="2026-11-12";
const confirmed=Object.freeze([{
 symbol:"NVDA",date:"2026-11-17",callTimeET:"17:00",
 name:"NVIDIA fiscal Q3 2027 earnings conference call",
 status:"company_confirmed",
 source:"NVIDIA investor relations announcement (Oct. 28, 2026)",
 url:"https://investor.nvidia.com/news/press-release-details/2026/NVIDIA-Sets-Conference-Call-for-Third-Quarter-Financial-Results/default.aspx",
 published:"2026-10-28"
}]);
const investorRelations=Object.freeze({
 AAPL:"https://investor.apple.com/investor-relations/",
 MSFT:"https://www.microsoft.com/en-us/investor",
 NVDA:"https://investor.nvidia.com/events-and-presentations/events-and-presentations/default.aspx"
});
function forSymbols(symbols,today){
 if(!Array.isArray(symbols)||symbols.length>12||typeof today!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(today))throw Error("Invalid earnings query");
 const set=new Set(symbols);
 return confirmed.filter(e=>set.has(e.symbol)&&e.date>=today);
}
scope.LeviEarningsEducation=Object.freeze({
 version:"levios-earnings-v1",verifiedOn,confirmed,investorRelations,forSymbols,
 explain:"A projected earnings date is a third-party estimate. A company-confirmed date requires an issuer announcement; neither guarantees the stock's reaction.",
 questions:Object.freeze([
 "Did the company itself confirm the event date and time?",
 "How do reported results compare with analysts' expectations, and what changed in guidance?",
 "What risk would a price gap create for a paper-trade hypothesis?"
 ])
});
})(globalThis);
