"use strict";
/* Standalone educational long-term allocation models; no broker access. */
(() => {
  const MODELS = Object.freeze([
    {id:"global_equity",label:"Global stocks",risk:"High",mix:[60,40,0],description:"All stocks. Broad U.S. and international exposure with no bond cushion.",horizon:15},
    {id:"growth_80_20",label:"Growth 80/20",risk:"Medium-high",mix:[48,32,20],description:"80% global stocks, 20% U.S. investment-grade bonds. Growth-oriented with some ballast.",horizon:10},
    {id:"balanced_60_40",label:"Balanced 60/40",risk:"Medium",mix:[36,24,40],description:"60% global stocks, 40% bonds. A more defensive long-term mix.",horizon:5},
    {id:"conservative_40_60",label:"Conservative 40/60",risk:"Lower",mix:[24,16,60],description:"40% global stocks, 60% bonds. Lower stock exposure, but still subject to losses.",horizon:3},
  ]);
  const $=id=>document.getElementById(id);
  const money=x=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(x);
  let selected="growth_80_20";
  function futureValue(initial,monthly,years,annual){
    const months=years*12;
    const rate=Math.pow(1+annual/100,1/12)-1;
    if(!Number.isFinite(rate)||!Number.isFinite(monthly)||!Number.isFinite(initial)) return null;
    // Contributions at end of month; constant hypothetical annual rate, not a forecast.
    return initial*Math.pow(1+rate,months)+(rate===0?monthly*months:monthly*(Math.pow(1+rate,months)-1)/rate);
  }
  function chooseProfile(){
    const horizon=Number($("allocation-horizon").value);
    const tolerance=$("allocation-risk").value;
    // A short horizon cannot be rescued by answering "aggressive" on risk tolerance.
    if(horizon<3)return null;
    if(horizon<5)return "conservative_40_60";
    if(tolerance==="low")return horizon>=5?"conservative_40_60":null;
    if(tolerance==="medium")return horizon>=7?"balanced_60_40":"conservative_40_60";
    if(horizon>=15)return "global_equity";
    if(horizon>=10)return "growth_80_20";
    return "balanced_60_40";
  }
  function renderCards(){
    const container=$("allocation-models");
    container.replaceChildren();
    for(const model of MODELS){
      const button=document.createElement("button");
      button.type="button";button.className="allocation-model"+(model.id===selected?" selected":"");
      button.setAttribute("aria-pressed",String(model.id===selected));
      const title=document.createElement("strong");title.textContent=model.label;
      const risk=document.createElement("small");risk.textContent=model.risk+" risk";
      const bars=document.createElement("div");bars.className="allocation-bar";
      bars.setAttribute("role","img");
      bars.setAttribute("aria-label","U.S. stocks "+model.mix[0]+"%, international stocks "+model.mix[1]+"%, bonds "+model.mix[2]+"%");
      for(const [index,percentage] of model.mix.entries()){
        if(!percentage)continue;
        const span=document.createElement("span");span.className="allocation-bar-part allocation-part-"+index;span.style.width=percentage+"%";bars.append(span);
      }
      const desc=document.createElement("p");desc.textContent=model.description;
      const mix=document.createElement("small");mix.textContent="VTI "+model.mix[0]+"% · VXUS "+model.mix[1]+"% · BND "+model.mix[2]+"%";
      button.append(title,risk,bars,desc,mix);
      button.addEventListener("click",()=>{selected=model.id;render();});
      container.append(button);
    }
  }
  function render(){
    renderCards();
    const model=MODELS.find(m=>m.id===selected);
    $("allocation-selected-name").textContent=model.label;
    const allocation=$("allocation-breakdown");allocation.replaceChildren();
    for(const [symbol,index,label] of [["VTI",0,"Total U.S. stocks"],["VXUS",1,"Total international stocks"],["BND",2,"U.S. bond market"]]){
      const row=document.createElement("div");row.className="allocation-breakdown-row";
      const left=document.createElement("span");left.textContent=symbol+" · "+label;
      const right=document.createElement("strong");right.textContent=model.mix[index]+"%";
      row.append(left,right);allocation.append(row);
    }
    const initial=Number($("allocation-initial").value);
    const monthly=Number($("allocation-monthly").value);
    const years=Number($("allocation-years").value);
    const annual=Number($("allocation-assumption").value);
    if(![initial,monthly,years,annual].every(Number.isFinite) || initial<0 || initial>100000000 ||
        monthly<0 || monthly>1000000 || years<1 || years>50 || annual< -20 || annual>20){
      $("allocation-calculation-status").textContent="Please enter values within the permitted ranges.";
      $("allocation-projected").textContent="—";
      return;
    }
    const total=futureValue(initial,monthly,years,annual);
    const contributed=initial+monthly*years*12;
    $("allocation-projected").textContent=money(total);
    $("allocation-contributions").textContent=money(contributed);
    $("allocation-change").textContent=money(total-contributed);
    $("allocation-calculation-status").textContent=
      "Illustration uses a constant "+annual.toFixed(1)+"% annual return, monthly compounding and end-of-month contributions; it is not a prediction. Actual returns vary and can be negative. Taxes, inflation and fees are excluded.";
  }
  function onMatch(){
    const id=chooseProfile();
    const target=$("allocation-match");
    if(!id){
      target.textContent="For a goal under three years away, cash or short-duration savings may be more appropriate than these market portfolios. No model selected.";
      return;
    }
    selected=id;
    const model=MODELS.find(m=>m.id===id);
    target.textContent="Illustrative fit: "+model.label+". This is a starting point based on your answers, not a personalized recommendation. Check your emergency fund, debts, actual loss tolerance, and account type.";
    render();
  }
  function init(){
    if(!$("allocation-models"))return;
    for(const id of ["allocation-initial","allocation-monthly","allocation-years","allocation-assumption"]){
      $(id).addEventListener("input",render);
    }
    $("allocation-match-button").addEventListener("click",onMatch);
    render();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);
  else init();
})();
