/* LeviOS Catalyst Context v1. Research associations, not causation or signals.
 * No IO, broker access or predictions. All dates are calendar days, not
 * intraday event timestamps. "Same date" never claims before/after the move.
 */
(function(scope) {
  "use strict";
  const DAY=86400000;
  const dateRE=/^\d{4}-\d{2}-\d{2}$/;
  const day=d=>dateRE.test(String(d))?Date.parse(d+"T00:00:00Z"):NaN;
  function safeEvent(e){
    return !!e && dateRE.test(String(e.date||"")) && Number.isFinite(day(e.date)) &&
      typeof e.name==="string" && e.name.length>0 && e.name.length<=180 &&
      typeof e.url==="string" &&
      (/^https:\/\/www\.bls\.gov\//.test(e.url)||
       /^https:\/\/www\.bea\.gov\//.test(e.url)||
       /^https:\/\/www\.federalreserve\.gov\//.test(e.url)||
       /^https:\/\/investor\.nvidia\.com\//.test(e.url)||
       /^https:\/\/investor\.apple\.com\//.test(e.url)||
       /^https:\/\/www\.microsoft\.com\/en-us\/investor(?:\/|$)/.test(e.url)||
       (e.sourceLevel==="provider_estimate"&&
        /^https:\/\/www\.alphavantage\.co\/documentation\/$/.test(e.url))) ;
  }
  function context(radar,macroeconomic=[],earnings=[],today){
    if(!radar || radar.ready!==true ||
       typeof radar.symbol!=="string" || !/^[A-Z][A-Z0-9.-]{0,9}$/.test(radar.symbol) ||
       !Number.isFinite(day(radar.asOf)) || !Number.isFinite(day(today))) {
      return {ready:false,reason:"No verified completed-session radar observation."};
    }
    const reference=day(radar.asOf);
    const current=day(today);
    const outputs=[],seen=new Set();
    const candidates=[
      ...macroeconomic.map(e=>({...e,scope:"marketwide",sourceLevel:e.source==="live"?"official_feed":"dated_snapshot"})),
      ...earnings.filter(e=>e.symbol===radar.symbol).map(e=>({
        ...e,scope:"company",sourceLevel:e.status==="company_confirmed"?"issuer_confirmed":"provider_estimate"
      }))
    ];
    for(const e of candidates){
      if(!safeEvent(e))continue;
      const timestamp=day(e.date);
      // Never display an event as upcoming if it has already passed today.
      const gap=Math.round((timestamp-reference)/DAY);
      let relation=null;
      if(gap>=-3 && gap<0)relation="prior_three_calendar_days";
      else if(gap===0)relation="same_calendar_date_time_unverified";
      else if(timestamp>=current && gap>0 && gap<=7)relation="upcoming_seven_calendar_days";
      if(!relation)continue;
      const key=e.scope+":"+e.name+":"+e.date+":"+e.sourceLevel;
      if(seen.has(key))continue;seen.add(key);
      outputs.push({
        date:e.date,name:e.name,url:e.url,scope:e.scope,
        sourceLevel:e.sourceLevel,relation,
        symbol:e.scope==="company"?radar.symbol:null,
        interpretation:relation==="upcoming_seven_calendar_days"?
          "This event occurs after the price observation and cannot explain that earlier move.":
          relation==="same_calendar_date_time_unverified"?
          "Same date does not establish whether the event preceded the trading session or price movement.":
          "The event was scheduled on an earlier calendar date; timing alone does not establish causation.",
        question:e.scope==="company"?
          "What did the issuer actually report or guide, and does the price move align with the timing?":
          "Did this event actually occur as scheduled, and did broader indices or the sector move too?"
      });
    }
    outputs.sort((a,b)=>{
      const rank={"same_calendar_date_time_unverified":0,"prior_three_calendar_days":1,"upcoming_seven_calendar_days":2};
      return rank[a.relation]-rank[b.relation]||a.date.localeCompare(b.date)||
        a.name.localeCompare(b.name);
    });
    return {ready:true,symbol:radar.symbol,asOf:radar.asOf,
      items:outputs.slice(0,12),
      limited:outputs.length>12,
      note:"Temporal proximity is not causation. Official schedules may change, and estimated earnings dates are unconfirmed. IEX single-exchange prices do not establish why a stock moved."
    };
  }
  scope.LeviCatalystContext=Object.freeze({version:"levios-catalyst-v1",context});
})(globalThis);
