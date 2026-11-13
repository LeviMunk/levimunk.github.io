/* Official calendars read-only. Do not accept user-provided URLs or raw HTML.
 * No personal information or broker credentials are transmitted to sources.
 * Agency status always reflects each independent live fetch, not calendar truth.
 */
const ENDPOINTS=Object.freeze({
 BLS:"https://www.bls.gov/schedule/news_release/bls.ics",
 BEA:"https://apps.bea.gov/API/signup/release_dates.json"
});
const dateRE=/^\d{4}-\d{2}-\d{2}$/;
const descriptions={
 employment:{type:"labor",explain:"Payroll jobs, unemployment, wages and revisions help describe the labor market. A surprise is not a trading instruction.",question:"Which components changed relative to expectations and prior revisions?"},
 jolts:{type:"labor",explain:"Job openings, hires and quits describe labor demand. Monthly results can be volatile.",question:"Did openings and hiring change together?"},
 cpi:{type:"inflation",explain:"Consumer Price Index measures consumer prices, with headline and core readings.",question:"Which categories explain the month-over-month and year-over-year changes?"},
 ppi:{type:"inflation",explain:"Producer Price Index reflects selling prices received by producers, not guaranteed future CPI.",question:"Do the underlying categories corroborate the change?"},
 gdp:{type:"growth",explain:"Gross Domestic Product estimates total U.S. output and is subject to revision.",question:"Which components drove the report, and how did consensus estimates compare?"},
 pce:{type:"inflation",explain:"Personal Income and Outlays includes PCE inflation, spending and incomes.",question:"How do core and headline PCE compare with spending and expectations?"}
};
const dateET=d=>{
 const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(d);
 const find=t=>parts.find(x=>x.type===t)?.value;
 return {date:find("year")+"-"+find("month")+"-"+find("day"),time:find("hour")+":"+find("minute")};
};
const inWindow=(date,today)=> dateRE.test(date) && date>=today &&
 (Date.parse(date+"T00:00:00Z")-Date.parse(today+"T00:00:00Z"))<=120*86400000;
const cleanText=s=>String(s||"").replace(/\\([,;])/g,"$1").replace(/\s+/g," ").trim().slice(0,170);
function kindBLS(name){
 if(/^Employment Situation\b/i.test(name))return "employment";
 if(/^Job Openings and Labor Turnover/i.test(name))return "jolts";
 if(/^Consumer Price Index\b/i.test(name))return "cpi";
 if(/^Producer Price Index\b/i.test(name))return "ppi";
 return null;
}
function parseICSdate(raw,attribute){
 const value=String(raw||"").trim();
 const m=/^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)?(Z)?$/.exec(value);
 if(!m)return null;
 const date=`${m[1]}-${m[2]}-${m[3]}`,time=`${m[4]}:${m[5]}`;
 if(!Number.isFinite(Date.parse(date+"T00:00:00Z"))||+m[4]>23||+m[5]>59)return null;
 if(m[7])return dateET(new Date(`${date}T${time}:${m[6]||"00"}Z`));
 if(/TZID=/.test(attribute)&&!/TZID=(America\/New_York|US-Eastern)/i.test(attribute))return null;
 // BLS's unzoned values are advertised as ET; do not infer an unrelated zone.
 return {date,time};
}
export function parseBLS(text,today){
 if(typeof text!=="string"||text.length>650000||!text.includes("BEGIN:VCALENDAR"))throw Error("unexpected_bls_calendar");
 const unfolded=text.replace(/\r\n/g,"\n").replace(/\n[ \t]/g,"");
 const blocks=unfolded.split("BEGIN:VEVENT").slice(1);
 if(!blocks.length||blocks.length>1800)throw Error("unexpected_bls_event_count");
 const result=[],seen=new Set();
 for(const fragment of blocks){
   const block=fragment.split("END:VEVENT")[0];
   const lines=block.split("\n");
   const summary=cleanText(lines.find(x=>x.startsWith("SUMMARY:"))?.slice(8));
   const kind=kindBLS(summary);
   if(!kind)continue;
   const start=lines.find(x=>x.startsWith("DTSTART"));
   if(!start||!start.includes(":"))continue;
   const attr=start.slice(0,start.indexOf(":"));
   const parsed=parseICSdate(start.slice(start.indexOf(":")+1),attr);
   if(!parsed||!inWindow(parsed.date,today))continue;
   const id="bls-"+kind+"-"+parsed.date;
   if(seen.has(id))continue;seen.add(id);
   result.push({id,date:parsed.date,time:parsed.time,type:descriptions[kind].type,
     name:summary,agency:"BLS",url:"https://www.bls.gov/schedule/news_release/",
     explain:descriptions[kind].explain,question:descriptions[kind].question,source:"live"});
 }
 return result.sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time));
}
export function parseBEA(payload,today){
 if(!payload||typeof payload!=="object"||Array.isArray(payload))throw Error("invalid_bea_json");
 const keys=[["Gross Domestic Product","gdp"],["Personal Income and Outlays","pce"]];
 if(keys.some(([name])=>!Array.isArray(payload[name]?.release_dates)))throw Error("missing_bea_series");
 const result=[],seen=new Set();
 for(const [name,kind] of keys){
   const dates=payload[name].release_dates;
   if(dates.length>500)throw Error("invalid_bea_series_length");
   for(const raw of dates){
     if(typeof raw!=="string"||!/T\d\d:\d\d:\d\d(?:Z|[+-]\d\d:\d\d)$/.test(raw))continue;
     const ms=Date.parse(raw);
     if(!Number.isFinite(ms))continue;
     const et=dateET(new Date(ms));
     if(!inWindow(et.date,today))continue;
     const id="bea-"+kind+"-"+et.date;
     if(seen.has(id))continue;seen.add(id);
     result.push({id,date:et.date,time:et.time,type:descriptions[kind].type,
       name:name+" (scheduled release)",agency:"BEA",url:"https://www.bea.gov/news/schedule",
       explain:descriptions[kind].explain,question:descriptions[kind].question,source:"live"});
   }
 }
 return result.sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time));
}
async function sourceFetch(url,fetchImpl){
 const response=await fetchImpl(url,{method:"GET",redirect:"error",
   headers:{"Accept":"application/json,text/calendar,text/plain"},signal:AbortSignal.timeout(9000)});
 if(!response?.ok)throw Error("agency_http_error");
 const size=Number(response.headers?.get("content-length"));
 if(Number.isFinite(size)&&size>650000)throw Error("agency_payload_too_large");
 const raw=await response.text();
 if(raw.length>650000)throw Error("agency_payload_too_large");
 return raw;
}
export async function fetchOfficialEvents({fetchImpl=fetch,now=new Date()}={}){
 const today=dateET(now).date;
 const configured=[
  ["BLS",ENDPOINTS.BLS,async raw=>parseBLS(raw,today)],
  ["BEA",ENDPOINTS.BEA,async raw=>parseBEA(JSON.parse(raw),today)]
 ];
 const results=await Promise.all(configured.map(async ([agency,url,parse])=>{
   try{
     const events=await parse(await sourceFetch(url,fetchImpl));
     return {agency,status:"fresh",fetched_at:now.toISOString(),events};
   }catch{
     return {agency,status:"unavailable",fetched_at:null,events:[]};
   }
 }));
 return {version:"levios-agency-events-v1",sources:results,
   fed_status:"dated_snapshot_only",retrieved_at:now.toISOString()};
}
