/* SEC EDGAR on-demand XBRL research. All SEC urls are hardcoded.
 * SEC_USER_AGENT must be privately configured and identify a contact.
 * Sources are public, but numbers are annual historical XBRL, not live prices.
 */
const TICKER=/^[A-Z][A-Z0-9.-]{0,9}$/;
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const TEN_K=new Set(["10-K","10-K/A"]);
const days=(a,b)=>(Date.parse(b+"T00:00:00Z")-Date.parse(a+"T00:00:00Z"))/86400000;
const finite=v=>typeof v==="number"&&Number.isFinite(v);
const TAGS=Object.freeze({
 revenue:["RevenueFromContractWithCustomerExcludingAssessedTax","RevenueFromContractWithCustomerIncludingAssessedTax","Revenues","SalesRevenueNet"],
 operating:["OperatingIncomeLoss"],
 cash:["NetCashProvidedByUsedInOperatingActivities"],
 capex:["PaymentsToAcquirePropertyPlantAndEquipment"],
 equity:["StockholdersEquity"],
 debtCurrent:["LongTermDebtCurrent"],
 debtLong:["LongTermDebtNoncurrent"],
 income:["NetIncomeLoss","ProfitLoss"],
 dilutedShares:["WeightedAverageNumberOfDilutedSharesOutstanding"]
});
function annual(f){
 return TEN_K.has(f.form)&&DATE.test(f.start||"")&&DATE.test(f.end||"")&&
   days(f.start,f.end)>=330&&days(f.start,f.end)<=400&&finite(f.val);
}
function validFact(f){return f&&DATE.test(f.end||"")&&finite(f.val)&&TEN_K.has(f.form)}
function concept(facts,tags,kind,anchor=null){
 const gaap=facts?.facts?.["us-gaap"]||{};
 const all=[];
 for(const tag of tags){
  const candidates=gaap[tag]?.units?.USD;
  if(!Array.isArray(candidates))continue;
  for(const f of candidates){
   if(!(kind==="annual"?annual(f):validFact(f)))continue;
   if(anchor&&(f.end!==anchor.end||
      (kind!=="instant"&&Math.abs(days(anchor.start,f.start))>15)))continue;
   all.push({...f,tag,tagPriority:tags.indexOf(tag)});
  }
 }
 all.sort((a,b)=>b.end.localeCompare(a.end)||
   String(b.filed||"").localeCompare(String(a.filed||""))||
   a.tagPriority-b.tagPriority);
 return all[0]||null;
}
function conceptShares(facts,tags,anchor){
 const gaap=facts?.facts?.["us-gaap"]||{};
 const candidates=[];
 for(const tag of tags){
  for(const row of gaap[tag]?.units?.shares||[]){
   if(annual(row)&&row.end===anchor.end&&
     Math.abs(days(anchor.start,row.start))<=15&&row.val>0)
    candidates.push({...row,tag});
  }
 }
 candidates.sort((a,b)=>String(b.filed||"").localeCompare(String(a.filed||"")));
 return candidates[0]||null;
}
function safeTickerMap(data,ticker){
 if(!data||typeof data!=="object"||Array.isArray(data))throw Error("sec_ticker_map_invalid");
 const entries=Object.values(data);
 if(entries.length<1||entries.length>25000)throw Error("sec_ticker_map_invalid");
 const matching=entries.find(x=>x?.ticker===ticker&&Number.isInteger(x.cik_str)&&x.cik_str>0);
 if(!matching)return null;
 return {cik:String(matching.cik_str).padStart(10,"0"),name:String(matching.title||"").slice(0,120)};
}
export function summarizeSecFacts(payload,{ticker,cik,name}){
 if(!payload||!payload.facts||!Number.isInteger(payload.cik)||
   String(payload.cik).padStart(10,"0")!==cik)throw Error("sec_company_mismatch");
 const revenue=concept(payload,TAGS.revenue,"annual");
 if(!revenue)throw Error("sec_annual_revenue_unavailable");
 const anchor={start:revenue.start,end:revenue.end};
 const gaap=payload.facts?.["us-gaap"]||{};
 const previousCandidates=[];
 for(const tag of TAGS.revenue){
  const values=gaap[tag]?.units?.USD;
  if(!Array.isArray(values))continue;
  for(const x of values){
   if(annual(x)&&x.end<anchor.end&&days(x.end,anchor.end)>=315&&
      days(x.end,anchor.end)<=420)previousCandidates.push({...x,tag});
  }
 }
 previousCandidates.sort((a,b)=>b.end.localeCompare(a.end)||
   String(b.filed||"").localeCompare(String(a.filed||"")));
 const previous=previousCandidates[0]||null;
 const op=concept(payload,TAGS.operating,"annual",anchor);
 const cash=concept(payload,TAGS.cash,"annual",anchor);
 const capex=concept(payload,TAGS.capex,"annual",anchor);
 const equity=concept(payload,TAGS.equity,"instant",anchor);
 const debtCur=concept(payload,TAGS.debtCurrent,"instant",anchor);
 const debtLong=concept(payload,TAGS.debtLong,"instant",anchor);
 const income=concept(payload,TAGS.income,"annual",anchor);
 const annualDiluted=conceptShares(payload,TAGS.dilutedShares,anchor);
 const growth=previous&&previous.val!==0?(revenue.val/previous.val-1)*100:null;
 const margin=op&&revenue.val!==0?op.val/revenue.val*100:null;
 const fcf=cash&&capex?(cash.val-capex.val)/1000000:null;
 const debtRatio=equity&&equity.val>0&&debtCur&&debtLong?
   (debtCur.val+debtLong.val)/equity.val:null;
 const accession=String(revenue.accn||"");
 if(!/^\d{10}-\d{2}-\d{6}$/.test(accession))throw Error("sec_accession_unavailable");
 const sourceUrl="https://www.sec.gov/Archives/edgar/data/"+
   String(Number(cik))+"/"+accession.replaceAll("-","")+"/";
 const measures=[
   {key:"revenue",name:"Annual revenue",value:revenue.val,unit:"USD",tag:revenue.tag,filingDate:revenue.filed},
   {key:"previousRevenue",name:"Prior annual revenue",value:previous?.val??null,unit:"USD",tag:previous?.tag||null,filingDate:previous?.filed||null},
   {key:"operatingIncome",name:"Operating income",value:op?.val??null,unit:"USD",tag:op?.tag||null,filingDate:op?.filed||null},
   {key:"operatingCashFlow",name:"Operating cash flow",value:cash?.val??null,unit:"USD",tag:cash?.tag||null,filingDate:cash?.filed||null},
   {key:"capitalExpenditure",name:"Property and equipment purchases",value:capex?.val??null,unit:"USD",tag:capex?.tag||null,filingDate:capex?.filed||null},
   {key:"stockholdersEquity",name:"Stockholders' equity",value:equity?.val??null,unit:"USD",tag:equity?.tag||null,filingDate:equity?.filed||null},
   {key:"longTermDebtCurrent",name:"Current portion of long-term debt",value:debtCur?.val??null,unit:"USD",tag:debtCur?.tag||null,filingDate:debtCur?.filed||null},
   {key:"longTermDebtNoncurrent",name:"Noncurrent long-term debt",value:debtLong?.val??null,unit:"USD",tag:debtLong?.tag||null,filingDate:debtLong?.filed||null},
   {key:"netIncome",name:"Annual net income",value:income?.val??null,unit:"USD",tag:income?.tag||null,filingDate:income?.filed||null},
   {key:"annualDilutedShares",name:"Annual diluted weighted-average shares",value:annualDiluted?.val??null,unit:"shares",tag:annualDiluted?.tag||null,filingDate:annualDiluted?.filed||null}
 ];
 const valid=n=>finite(n)&&Math.abs(n)<=1e8?n:null;
 return {status:"available",ticker,name,cik,reportEnd:anchor.end,reportStart:anchor.start,
   filingDate:revenue.filed,form:revenue.form,accession,sourceUrl,
   computed:{revenueGrowthPct:valid(growth),operatingMarginPct:valid(margin),
     freeCashFlowMillions:valid(fcf),longTermDebtToEquity:valid(debtRatio)},
   measures,
   caveats:"Annual 10-K XBRL only. US-GAAP concepts differ by filer; facts and amendments can be restated. Debt ratio includes only current/noncurrent long-term debt where both exist. No market P/E, valuation, or trade signal is inferred."};
}
async function getJson(url,agent,fetchImpl,limit){
 const response=await fetchImpl(url,{method:"GET",redirect:"manual",
  headers:{"User-Agent":agent,"Accept":"application/json"},signal:AbortSignal.timeout(9500)});
 if(!response?.ok||response.status>=300)throw Error("sec_upstream_unavailable");
 const len=Number(response.headers?.get("content-length"));
 if(Number.isFinite(len)&&len>limit)throw Error("sec_data_too_large");
 const txt=await response.text();
 if(txt.length>limit)throw Error("sec_data_too_large");
 return JSON.parse(txt);
}
export async function fetchSecFinancials(env,ticker,{fetchImpl=fetch}={}){
 if(typeof ticker!=="string"||!TICKER.test(ticker))return {status:"invalid_symbol"};
 const agent=String(env?.SEC_USER_AGENT||"").trim();
 if(agent.length<15||agent.length>180||!/\S+@\S+\.[A-Za-z]{2,}/.test(agent))
  return {status:"not_configured",message:"Set private SEC_USER_AGENT to a descriptive app name and working contact email."};
 try{
  const map=await getJson("https://www.sec.gov/files/company_tickers.json",agent,fetchImpl,1800000);
  const entry=safeTickerMap(map,ticker);
  if(!entry)return {status:"not_found",ticker};
  const payload=await getJson("https://data.sec.gov/api/xbrl/companyfacts/CIK"+entry.cik+".json",
    agent,fetchImpl,13000000);
  return summarizeSecFacts(payload,{ticker,...entry});
 }catch{return {status:"unavailable",ticker,message:"SEC unavailable, financial concepts absent, or source could not be validated. Try later or use the filing manually."};}
}
