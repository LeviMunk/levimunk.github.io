"use strict";
/* Public-safe LeviOS paper research display. No account or broker fetches. */
(() => {
  const $ = id => document.getElementById(id);
  const dollars = n => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n);
  const dec = n => Number(n).toFixed(2);
  const S = "levios-public-paper-v1";
  function renderCurve(points) {
    const svg=$("public-research-curve");
    svg.replaceChildren();
    if (!points.length) return;
    const values=points.map(p=>p.equity);
    const lo=Math.min(...values),hi=Math.max(...values),spread=hi-lo||1;
    const ns="http://www.w3.org/2000/svg";
    function el(tag,attributes) {
      const node=document.createElementNS(ns,tag);
      for(const [key,value] of Object.entries(attributes)) node.setAttribute(key,String(value));
      return node;
    }
    svg.append(el("line",{x1:14,y1:108,x2:786,y2:108,stroke:"#355459","stroke-dasharray":"4 6"}));
    if(points.length===1){
      svg.append(el("circle",{cx:400,cy:62,r:5,fill:"#6ee2b4"}));
      return;
    }
    svg.append(el("polyline",{
      points:points.map((p,i)=>[
        14+(772*i/(points.length-1)),
        108-84*((p.equity-lo)/spread)
      ].map(v=>v.toFixed(1)).join(",")).join(" "),
      fill:"none",stroke:"#6ee2b4","stroke-width":3,"stroke-linejoin":"round",
      "vector-effect":"non-scaling-stroke"
    }));
  }
  function valid(x) {
    const n = v => typeof v==="number" && Number.isFinite(v);
    return x && x.schema===S && x.broker_orders_enabled===false &&
      x.mode==="PUBLIC_AGGREGATE_PAPER_SIMULATION" &&
      /^\d{4}-\d{2}-\d{2}$/.test(x.as_of) &&
      n(x.simulated_equity) && n(x.simulated_pnl) &&
      n(x.simulated_return_pct) && n(x.max_drawdown_pct) &&
      Number.isSafeInteger(x.recorded_predictions) &&
      Number.isSafeInteger(x.resolved_predictions) &&
      Array.isArray(x.strategy_leaderboard) &&
      x.strategy_leaderboard.length<=30 &&
      Array.isArray(x.equity_curve) && x.equity_curve.length<=260 &&
      x.equity_curve.every(p=>/^\d{4}-\d{2}-\d{2}$/.test(p.date) && n(p.equity));
  }
  function update(x) {
    $("public-research-equity").textContent=dollars(x.simulated_equity);
    $("public-research-pnl").textContent=(x.simulated_pnl>0?"+":"")+dollars(x.simulated_pnl);
    $("public-research-return").textContent=dec(x.simulated_return_pct)+"%";
    $("public-research-predictions").textContent=String(x.recorded_predictions);
    $("public-research-resolved").textContent=String(x.resolved_predictions);
    $("public-research-drawdown").textContent=dec(x.max_drawdown_pct)+"%";
    $("public-research-date").textContent="Market data through "+x.as_of;
    const count=x.resolved_predictions;
    $("public-research-note").textContent=count
      ? count+" five-session predictions resolved; overlapping outcomes are not independent trades."
      : "No forward outcomes yet. P/L remains flat until a screened paper position is simulated.";
    const rows=$("public-research-rows");
    rows.replaceChildren();
    for(const entry of x.strategy_leaderboard){
      const tr=document.createElement("tr");
      const fields=[
        String(entry.name).replaceAll("_"," "),
        String(entry.family), String(entry.recorded),String(entry.resolved),
        entry.average_excess_pp===null ? "Pending" :
          (Number(entry.average_excess_pp)>0?"+":"")+dec(entry.average_excess_pp)+" pp"
      ];
      for(const value of fields){
        const td=document.createElement("td");td.textContent=value;tr.append(td);
      }
      rows.append(tr);
    }
    renderCurve(x.equity_curve);
    $("public-research-status").textContent=
      "Published aggregate research. Separate from your authenticated Alpaca brokerage account.";
  }
  async function load() {
    const status=$("public-research-status");
    if(!status)return;
    try{
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),8000);
      let response;
      try{
        response=await fetch("./data/research-summary.json",{method:"GET",cache:"no-store",credentials:"omit",signal:controller.signal});
      }finally{clearTimeout(timeout);}
      if(!response.ok) throw Error("HTTP "+response.status);
      const x=await response.json();
      if(!valid(x))throw Error("Invalid or unavailable research summary");
      update(x);
    }catch(error){
      status.textContent="Public paper-research snapshot is unavailable. No results have been invented; your private research workflow is separate.";
      console.warn("LeviOS public research summary:",error);
    }
  }
  load();
})();
