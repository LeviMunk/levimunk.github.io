/* LeviOS Market Radar v1. Read-only, deterministic market observations.
 * Uses only completed, chronologically ordered Alpaca IEX daily OHLCV.
 * No trading orders, push notifications, or forecast outputs.
 */
(function(scope){
"use strict";
const numeric=x=>typeof x==="number"&&Number.isFinite(x);
const average=arr=>arr.reduce((a,b)=>a+b,0)/arr.length;
function analyze(symbol,bars){
  if(typeof symbol!=="string"||!/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol))throw Error("Invalid ticker");
  if(!Array.isArray(bars)||bars.length<22)return {symbol,ready:false,reason:"Requires at least 22 completed IEX daily bars."};
  const data=bars.map(b=>({date:b.time,open:b.open,high:b.high,low:b.low,close:b.close,volume:b.volume}));
  for(let i=0;i<data.length;i++){
    const b=data[i];
    if(!b||typeof b.date!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(b.date)||
      (i>0&&b.date<=data[i-1].date)||
      ![b.open,b.high,b.low,b.close].every(x=>numeric(x)&&x>0)||
      b.high<Math.max(b.open,b.close,b.low)||
      b.low>Math.min(b.open,b.close,b.high)||
      (b.volume!==null&&b.volume!==undefined&&(!numeric(b.volume)||b.volume<0))){
      return {symbol,ready:false,reason:"Missing, duplicate, unordered or invalid candle data."};
    }
  }
  const last=data.at(-1),previous=data.at(-2);
  const movePct=(last.close/previous.close-1)*100;
  const baseline=data.slice(-22,-1);
  const moves=baseline.slice(1).map((r,i)=>Math.abs((r.close/baseline[i].close-1)*100));
  const avgMove=average(moves);
  const findings=[];
  // Threshold is intentionally descriptive, never a directional signal.
  if(Math.abs(movePct)>=2&&Math.abs(movePct)>=2*avgMove&&avgMove>0){
    findings.push({kind:"PRICE_MOVE",title:"Large daily close-to-close move",
      evidence:movePct.toFixed(2)+"% versus "+avgMove.toFixed(2)+"% mean absolute daily move over the previous 20 comparisons.",
      explain:"A relative outlier deserves investigation, not an automatic buy or sell.",
      question:"Was there an earnings release, macroeconomic headline or broader sector move? Verify outside LeviOS."});
  }
  const volumes=baseline.map(b=>b.volume);
  const validVolumes=volumes.filter(v=>numeric(v)&&v>0);
  if(numeric(last.volume)&&last.volume>0&&validVolumes.length>=15){
    const typical=average(validVolumes);
    const multiple=last.volume/typical;
    if(multiple>=2){
      findings.push({kind:"VOLUME_SPIKE",title:"Unusually high IEX daily volume",
        evidence:multiple.toFixed(2)+"× the average of "+validVolumes.length+" earlier IEX session volumes.",
        explain:"IEX is only one exchange. Its traded volume can shift for venue-specific reasons and does not represent consolidated U.S. share volume.",
        question:"Does the volume expansion appear on other exchanges, and was it tied to news or a corporate event?"});
    }
  }
  const recent=data.slice(-21,-1);
  const high=Math.max(...recent.map(b=>b.high)),low=Math.min(...recent.map(b=>b.low));
  if(last.close>high){
    findings.push({kind:"RANGE_HIGH",title:"Close above prior 20-session IEX high",
      evidence:"Close "+last.close.toFixed(2)+" versus previous-session range high "+high.toFixed(2)+".",
      explain:"A price-range breach can be a useful observation; it may reverse and is not a confirmed breakout.",
      question:"Does the move persist into later sessions or return inside the earlier range?"});
  }else if(last.close<low){
    findings.push({kind:"RANGE_LOW",title:"Close below prior 20-session IEX low",
      evidence:"Close "+last.close.toFixed(2)+" versus previous-session range low "+low.toFixed(2)+".",
      explain:"A breach of a prior low alone does not establish a continuing trend.",
      question:"Is this a security-specific move or a broader market decline?"});
  }
  const absMove=Math.abs(movePct);
  return {symbol,ready:true,asOf:last.date,observations:data.length,
    lastClose:last.close,movePct,findings,flags:findings.length,
    attention:findings.length>=2?"multiple observations":findings.length===1?"one observation":"no threshold crossed",
    methodology:"IEX-only completed daily OHLCV; fixed descriptive thresholds, not trades.",
    quiet:findings.length===0?"No rule crossed its descriptive threshold. This does not mean the stock is safe or risk-free.":null};
}
scope.LeviMarketRadar=Object.freeze({version:"levios-market-radar-v1",analyze});
})(globalThis);
