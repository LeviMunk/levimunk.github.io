/* LeviOS Trading Coach v1: deterministic education, not signals.
 * Accepts real historical daily OHLC data; never fabricates market data.
 * No orders, predictions, recommendations or network calls.
 */
(function(scope) {
  "use strict";
  const mean=a=>a.reduce((s,n)=>s+n,0)/a.length;
  function analyze(bars) {
    if(!Array.isArray(bars)||bars.length<21) {
      return {ready:false,reason:"Need at least 21 completed daily candles to discuss trend and volatility."};
    }
    const rows=bars.map(b=>({
      date:String(b.time||b.date||""),
      close:Number(b.close),
      high:Number(b.high),low:Number(b.low),open:Number(b.open)
    }));
    if(rows.some((b,i)=> !/^\d{4}-\d{2}-\d{2}$/.test(b.date) ||
      (i>0&&b.date<=rows[i-1].date) ||
      ![b.close,b.high,b.low,b.open].every(v=>Number.isFinite(v)&&v>0) ||
      b.high<Math.max(b.open,b.close,b.low) ||
      b.low>Math.min(b.open,b.close,b.high))) {
      return {ready:false,reason:"Daily candles are incomplete or invalid; analysis was withheld."};
    }
    const last=rows.at(-1), previous=rows.at(-2);
    const ma20=mean(rows.slice(-20).map(b=>b.close));
    const ma50=rows.length>=50?mean(rows.slice(-50).map(b=>b.close)):null;
    const movePct=(last.close/previous.close-1)*100;
    const highs=rows.slice(-20).map(b=>b.high);
    const lows=rows.slice(-20).map(b=>b.low);
    const high20=Math.max(...highs),low20=Math.min(...lows);
    const returns=rows.slice(-21).map((b,i,a)=>i?Math.log(b.close/a[i-1].close):null).slice(1);
    const avg=mean(returns);
    const vol=Math.sqrt(mean(returns.map(x=>(x-avg)**2)))*Math.sqrt(252)*100;
    const observations=[];
    observations.push({
      title:"Trend: 20-session average",
      fact:last.close>=ma20?"Last close is above its 20-session average.":"Last close is below its 20-session average.",
      explain:"A moving average smooths recent prices. It can describe trend direction, but lags turning points and does not predict the next move.",
      question:"Has this relationship persisted across several completed sessions, or is it a one-day crossing?"
    });
    if(ma50!==null) observations.push({
      title:"Trend: short versus longer average",
      fact:ma20>=ma50?"20-session average is at or above the 50-session average.":"20-session average is below the 50-session average.",
      explain:"Comparing averages can reveal trend structure. Crossovers are lagging observations and may repeatedly reverse in sideways markets.",
      question:"What happened to the same setup during previous choppy periods?"
    });
    observations.push({
      title:"Range: recent highs and lows",
      fact:last.close>=high20*.98?"Close is within 2% of the last 20-session high.":last.close<=low20*1.02?"Close is within 2% of the last 20-session low.":"Close lies between the most recent 20-session high and low.",
      explain:"A recent price range offers context for potential support/resistance discussions. Prior highs and lows do not guarantee reversals or breakouts.",
      question:"Would the interpretation change if a later candle crosses the level and quickly reverses?"
    });
    observations.push({
      title:"Volatility: historical movement",
      fact:"Annualized 20-session close-to-close volatility: "+vol.toFixed(1)+"%.",
      explain:"This is a backward-looking annualized standard deviation of daily log returns, not a probability of a given price move or forecast. IEX-only aggregates can differ from consolidated data.",
      question:"How would position size and a possible gap move affect losses if the hypothesis fails?"
    });
    return {ready:true,asOf:last.date,sessions:rows.length,lastClose:last.close,
      movePct,ma20,ma50,high20,low20,volatilityPct:vol,
      observations,feed:"IEX daily bars",label:"Educational observations, not trade signals"};
  }
  scope.LeviTradingCoach=Object.freeze({version:"levios-coach-v1",analyze});
})(globalThis);
