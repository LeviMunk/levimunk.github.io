/* Single allowlisted Alpha Vantage calendar source. No untrusted URLs.
 * All-calendar request uses one call to conserve free-tier quota.
 * Dates are third-party estimates, not issuer confirmations.
 */
const SYMBOL=/^[A-Z][A-Z0-9.-]{0,9}$/;
export function validateSymbols(values){
 if(!Array.isArray(values)||values.length<1||values.length>12||
   values.some(x=>!SYMBOL.test(x))||new Set(values).size!==values.length)
   throw Error("invalid_symbols");
 return values;
}
function csvRows(text){
 if(typeof text!=="string"||text.length>2000000)throw Error("invalid_calendar_csv");
 const rows=[],row=[];let cell="",quoted=false;
 for(let i=0;i<text.length;i++){
   const c=text[i];
   if(c==='"'){
     if(quoted&&text[i+1]==='"'){cell+='"';i++;}
     else quoted=!quoted;
   }else if(c===","&&!quoted){row.push(cell);cell="";}
   else if((c==="\n"||c==="\r")&&!quoted){
     if(c==="\r"&&text[i+1]==="\n")i++;
     row.push(cell);if(row.some(v=>v.length))rows.push(row.slice());
     row.length=0;cell="";
     if(rows.length>30000)throw Error("too_many_rows");
   }else cell+=c;
 }
 if(quoted)throw Error("unterminated_csv_quote");
 row.push(cell);
 if(row.some(v=>v.length))rows.push(row);
 return rows;
}
export function parseEarningsCSV(text,symbols,today){
 validateSymbols(symbols);
 const rows=csvRows(text);
 if(rows.length===0)throw Error("empty_calendar");
 const head=rows.shift().map(x=>x.trim());
 const names=["symbol","name","reportDate","fiscalDateEnding","estimate","currency"];
 const ix=Object.fromEntries(names.map(n=>[n,head.indexOf(n)]));
 if(names.some(n=>ix[n]<0))throw Error("wrong_calendar_format");
 const periods=["before_market","after_market","unknown"];
 const wanted=new Set(symbols);
 const output=[],seen=new Set();
 for(const row of rows){
   const sym=String(row[ix.symbol]||"").trim().toUpperCase();
   const date=String(row[ix.reportDate]||"").trim();
   if(!wanted.has(sym)||!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<today||
      (Date.parse(date+"T00:00:00Z")-Date.parse(today+"T00:00:00Z"))>93*86400000||
      !Number.isFinite(Date.parse(date+"T00:00:00Z")))continue;
   const key=sym+":"+date;
   if(seen.has(key))continue;seen.add(key);
   const timeOfDay=head.indexOf("timeOfTheDay")<0?"":String(row[head.indexOf("timeOfTheDay")]||"").trim().toLowerCase();
   const timing= /before/.test(timeOfDay)?"before_market":/after/.test(timeOfDay)?"after_market":"unknown";
   const fiscal=String(row[ix.fiscalDateEnding]||"").trim();
   const eps=Number(row[ix.estimate]);
   output.push({
     symbol:sym,date,status:"provider_estimate",provider:"Alpha Vantage",
     name:String(row[ix.name]||sym).trim().slice(0,100),
     fiscalPeriod:/^\d{4}-\d{2}-\d{2}$/.test(fiscal)?fiscal:null,
     epsEstimate:row[ix.estimate]!==""&&Number.isFinite(eps)?eps:null,
     currency:/^[A-Z]{3}$/.test(row[ix.currency]||"")?row[ix.currency]:null,
     timing:periods.includes(timing)?timing:"unknown"
   });
 }
 return output.sort((a,b)=>a.date.localeCompare(b.date)||a.symbol.localeCompare(b.symbol));
}
export async function fetchEarnings(env,symbols,{fetchImpl=fetch,now=new Date()}={}){
 validateSymbols(symbols);
 const key=String(env?.ALPHAVANTAGE_API_KEY||"").trim();
 if(!key)return {configured:false,provider:"Alpha Vantage",status:"not_configured",events:[]};
 if(key.length>256) return {configured:true,provider:"Alpha Vantage",status:"unavailable",events:[]};
 const today=new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
 const params=new URLSearchParams({function:"EARNINGS_CALENDAR",horizon:"3month",apikey:key});
 try{
   const response=await fetchImpl("https://www.alphavantage.co/query?"+params.toString(),{
     method:"GET",redirect:"error",signal:AbortSignal.timeout(9000),headers:{Accept:"text/csv"}
   });
   if(!response.ok)return {configured:true,provider:"Alpha Vantage",status:"unavailable",events:[]};
   const size=Number(response.headers?.get("content-length"));
   if(Number.isFinite(size)&&size>2000000)throw Error("oversized");
   const body=await response.text();
   if(body.length>2000000)throw Error("oversized");
   const events=parseEarningsCSV(body,symbols,today);
   return {configured:true,provider:"Alpha Vantage",status:"fetched",
     fetched_at:now.toISOString(),events};
 }catch{return {configured:true,provider:"Alpha Vantage",status:"unavailable",events:[]};}
}
