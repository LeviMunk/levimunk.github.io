/* LeviOS Market Events Intelligence v1.
 * Offline, date-stamped government schedule SNAPSHOT, not a live calendar feed.
 * Official source pages are linked for last-minute changes. No broker actions.
 */
(function(scope) {
  "use strict";
  const VERIFIED_ON = "2026-11-12";
  const EVENTS = Object.freeze([
  {
    "id": "ppi-2026-11",
    "date": "2026-11-13",
    "time": "08:30",
    "type": "inflation",
    "name": "Producer Price Index (October)",
    "agency": "BLS",
    "url": "https://www.bls.gov/schedule/2026/",
    "explain": "Measures changes in prices received by domestic producers. It can help analysts study upstream price pressures, but a PPI surprise does not mechanically predict CPI or stock returns.",
    "question": "How does the reported change compare with expectations, and which components moved?"
  },
  {
    "id": "gdp-2026-q3-2",
    "date": "2026-11-25",
    "time": "08:30",
    "type": "growth",
    "name": "GDP second estimate (Q3 2026)",
    "agency": "BEA",
    "url": "https://www.bea.gov/news/schedule",
    "explain": "A revised estimate of economic output. Look for which components changed rather than assuming a higher GDP figure benefits every stock.",
    "question": "Was the revision driven by consumption, inventories, investment or trade?"
  },
  {
    "id": "pce-2026-10",
    "date": "2026-11-25",
    "time": "08:30",
    "type": "inflation",
    "name": "Personal Income and Outlays (October)",
    "agency": "BEA",
    "url": "https://www.bea.gov/news/schedule",
    "explain": "Includes the PCE price index, an inflation measure central to Federal Reserve analysis, alongside spending and income.",
    "question": "What do headline and core PCE show, and how did market expectations differ?"
  },
  {
    "id": "jolts-2026-10",
    "date": "2026-12-01",
    "time": "10:00",
    "type": "labor",
    "name": "Job Openings and Labor Turnover (October)",
    "agency": "BLS",
    "url": "https://www.bls.gov/schedule/2026/",
    "explain": "Tracks job openings, hires, quits and separations. One month alone rarely establishes a labor-market trend.",
    "question": "Are openings changing alongside hires and quits, or are the indicators diverging?"
  },
  {
    "id": "jobs-2026-11",
    "date": "2026-12-04",
    "time": "08:30",
    "type": "labor",
    "name": "Employment Situation (November)",
    "agency": "BLS",
    "url": "https://www.bls.gov/schedule/2026/",
    "explain": "Includes payroll employment, unemployment and wage measures. Revisions and participation also matter.",
    "question": "How do payrolls, unemployment, labor-force participation and wage growth compare?"
  },
  {
    "id": "fomc-2026-12",
    "date": "2026-12-09",
    "time": null,
    "type": "policy",
    "name": "FOMC scheduled decision day (Dec. 8–9 meeting)",
    "agency": "Federal Reserve",
    "url": "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
    "explain": "Federal Reserve policy affects short-term rates and investor expectations. The statement, projections and press conference can matter as much as the decision itself.",
    "question": "What changed in the policy guidance relative to market expectations?"
  },
  {
    "id": "cpi-2026-11",
    "date": "2026-12-10",
    "time": "08:30",
    "type": "inflation",
    "name": "Consumer Price Index (November)",
    "agency": "BLS",
    "url": "https://www.bls.gov/schedule/2026/",
    "explain": "Measures changes in consumer prices. Distinguish headline CPI, core CPI and the composition of the monthly move.",
    "question": "Which categories drove inflation, and how does the trend compare with prior months?"
  },
  {
    "id": "ppi-2026-12",
    "date": "2026-12-15",
    "time": "08:30",
    "type": "inflation",
    "name": "Producer Price Index (November)",
    "agency": "BLS",
    "url": "https://www.bls.gov/schedule/2026/",
    "explain": "Tracks producer price changes, which can inform questions about input costs and margins.",
    "question": "Which producer-price categories moved, and is there corroborating evidence?"
  },
  {
    "id": "pce-2026-11",
    "date": "2026-12-23",
    "time": "08:30",
    "type": "inflation",
    "name": "Personal Income and Outlays (November)",
    "agency": "BEA",
    "url": "https://www.bea.gov/news/schedule",
    "explain": "Provides consumer spending, income and PCE price-index information.",
    "question": "Is the spending trend consistent with inflation-adjusted income?"
  },
  {
    "id": "fomc-2027-01",
    "date": "2027-01-27",
    "time": null,
    "type": "policy",
    "name": "Tentative FOMC decision day (Jan. 26–27 meeting)",
    "agency": "Federal Reserve",
    "url": "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
    "explain": "A scheduled policy meeting, subject to revision. Read the latest central bank calendar before relying on the date.",
    "question": "What changed since the preceding meeting, and which expectations were priced in?"
  },
  {
    "id": "gdp-2026-q4-advance",
    "date": "2027-01-28",
    "time": "08:30",
    "type": "growth",
    "name": "GDP advance estimate (Q4 2026)",
    "agency": "BEA",
    "url": "https://www.bea.gov/news/schedule/next-year",
    "explain": "First estimate for the quarter, subject to later revisions. Consider components and uncertainty.",
    "question": "What surprised relative to the consensus and what might be revised later?"
  }
]);
  const SOURCE_LINKS=Object.freeze([
    {name:"BLS release calendar",url:"https://www.bls.gov/schedule/2026/"},
    {name:"BEA release schedule",url:"https://www.bea.gov/news/schedule"},
    {name:"Federal Reserve meeting calendar",url:"https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm"}
  ]);
  const TYPES=Object.freeze(["all","inflation","labor","growth","policy"]);
  function upcoming(today,type="all",days=120) {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(today)||!TYPES.includes(type)||
       !Number.isInteger(days)||days<1||days>366)throw Error("Invalid calendar filter");
    const start=Date.parse(today+"T00:00:00Z");
    if(!Number.isFinite(start))throw Error("Invalid current date");
    return EVENTS.filter(e=>{
      const diff=Math.round((Date.parse(e.date+"T00:00:00Z")-start)/86400000);
      return diff>=0&&diff<=days&&(type==="all"||e.type===type);
    }).map(e=>({...e,daysAway:Math.round((Date.parse(e.date+"T00:00:00Z")-start)/86400000)}))
      .sort((a,b)=>a.date.localeCompare(b.date)||(a.time||"99:99").localeCompare(b.time||"99:99"));
  }
  function snapshotAge(today){
    const now=Date.parse(today+"T00:00:00Z"),asof=Date.parse(VERIFIED_ON+"T00:00:00Z");
    if(!Number.isFinite(now))throw Error("Invalid current date");
    const days=Math.floor((now-asof)/86400000);
    return {days,possiblyStale:days>14,expired:days>60};
  }
  scope.LeviMarketEvents=Object.freeze({
    version:"levios-events-v1",verifiedOn:VERIFIED_ON,events:EVENTS,
    sourceLinks:SOURCE_LINKS,types:TYPES,upcoming,snapshotAge
  });
})(globalThis);
