/* LeviOS Learning Lab: standalone local-first, no market predictions or orders. */
(function(scope){
"use strict";
const courses=Object.freeze({
 long:[
  {id:"long-1",name:"Why stocks grow in value",level:"Beginner",
   lesson:"Buying a stock means owning a tiny share of a business. Over years, a company may become more valuable when its earnings and cash generation improve. But a successful company is not automatically a profitable stock purchase: the price you pay matters.",
   example:"If a business earns $1 per share and trades at $30, that is a 30× price-to-earnings multiple. Paying $60 for the same $1 of earnings needs much stronger future growth to work out.",
   question:"Which factor matters when investing in a strong business?",
   answers:["Only whether the company is popular","What the business earns AND the price you pay","Only whether the share price rose yesterday"],correct:1,
   takeaway:"Business quality and valuation are different questions."},
  {id:"long-2",name:"Diversification and index funds",level:"Beginner",
   lesson:"An index fund holds pieces of many businesses. This spreads company-specific risk, though broad markets can still fall. Long-term investors often compare stock picking against a low-cost broad-market index rather than assuming activity improves returns.",
   example:"Putting all hypothetical capital into one tech company exposes the portfolio to a single failure. A broad diversified fund reduces that single-company dependence.",
   question:"What risk does broad diversification mainly reduce?",
   answers:["Every possible loss","Single-company concentration","The chance of any market downturn"],correct:1,
   takeaway:"A simple benchmark is the hurdle active strategies should beat."},
  {id:"long-3",name:"Compounding and time horizon",level:"Beginner",
   lesson:"Compounding happens when gains earn further gains. Higher expected returns usually come with more uncertainty. Short-term volatility is not the same thing as a permanent loss, but money needed soon should not depend on a volatile stock market.",
   example:"A hypothetical $1,000 portfolio gaining 8% one year becomes $1,080. Another 8% brings it to $1,166.40, not $1,160. Real returns fluctuate.",
   question:"Why can long-term investing benefit from time?",
   answers:["Every year must be profitable","Gains can compound over time","Losses become mathematically impossible"],correct:1,
   takeaway:"Plan around your real time horizon, not an imaginary guaranteed return."},
  {id:"long-4",name:"What makes a valuation reasonable?",level:"Intermediate",
   lesson:"P/E compares share price with earnings, while free cash flow reflects operating cash after capital expenditures. A lower multiple may mean a bargain, but it can also signal weaker future profits, accounting differences or a riskier business.",
   example:"Company A trades at 12× earnings and Company B at 25×. Without comparing growth, debt, margins and business models, neither is automatically a better investment.",
   question:"Does a lower P/E always mean the better buy?",
   answers:["Yes, by definition","No, the business outlook and accounting matter","Only when the company is large"],correct:1,
   takeaway:"A valuation metric is a starting clue, not the verdict."}
 ],
 short:[
  {id:"short-1",name:"Entry, target and stop",level:"Beginner",
   lesson:"A trade plan states the entry condition, a profit objective and an exit if the idea fails. Stops control your planned risk but are not guaranteed fill prices; overnight gaps can produce losses beyond the intended threshold.",
   example:"A PAPER plan buys near $100, targets $115 and stops at $95. Its reward-to-planned-risk is 15 ÷ 5 = 3:1. That does not mean it has a 75% chance of winning.",
   question:"What does a 3:1 reward-to-risk ratio guarantee?",
   answers:["Nothing about win probability","A profitable strategy","That a stop fills at the exact quoted price"],correct:0,
   takeaway:"A good-looking ratio is not enough without win rate and actual execution assumptions."},
  {id:"short-2",name:"Position sizing",level:"Beginner",
   lesson:"Position sizing connects the distance from entry to stop with the amount you are prepared to lose. Planned loss per share is entry minus stop for a long trade. Fractional shares, buying power, costs and gaps change real outcomes.",
   example:"With a hypothetical $20 risk budget and a $5 gap from entry to stop, the planned size is at most four whole shares, provided sufficient buying power.",
   question:"At $100 entry and $95 stop, how many whole shares match a $15 planned risk budget?",
   answers:["3","15","20"],correct:0,
   takeaway:"Size the position from the risk plan, not from excitement."},
  {id:"short-3",name:"Backtest versus forward test",level:"Beginner",
   lesson:"Backtesting simulates rules on past prices. Forward PAPER testing records decisions before future prices are known. Repeatedly editing a strategy until the historical chart looks good is a common way to fool yourself.",
   example:"Testing 40 variations and reporting only the most profitable one hides the 39 attempts that may have failed. A fixed strategy should face unseen dates and realistic costs.",
   question:"Which is stronger evidence of a strategy's edge?",
   answers:["A perfect-looking chart optimized repeatedly","Forward PAPER trades made under fixed rules","One large winning trade"],correct:1,
   takeaway:"Measure out-of-sample results without changing the rules mid-test."},
  {id:"short-4",name:"Win rate versus profitability",level:"Intermediate",
   lesson:"A strategy can win often and still lose money if each loss is large. Evaluate average winner, average loser, costs, total return and drawdown. Keep unfilled or ambiguous trade plans separate from resolved outcomes.",
   example:"Nine trades win $10 each and one loses $150: a 90% win rate still loses $60 before costs.",
   question:"Can a 90% win rate strategy lose money?",
   answers:["Never","Yes, if losses outweigh gains","Only when using options"],correct:1,
   takeaway:"Expectancy and drawdown matter more than the headline win percentage."}
 ]
});
const all=[...courses.long,...courses.short];
function get(track,id){return (courses[track]||[]).find(x=>x.id===id)||null;}
function score(courseId,answerIndex){
 const lesson=all.find(x=>x.id===courseId);
 if(!lesson||!Number.isInteger(answerIndex)||answerIndex<0||answerIndex>=lesson.answers.length)
  throw Error("Invalid lesson or answer.");
 return {correct:answerIndex===lesson.correct,correctIndex:lesson.correct,lessonId:courseId,
  takeaway:lesson.takeaway};
}
function sanitizeProgress(raw){
 const valid=new Set(all.map(x=>x.id));
 if(!Array.isArray(raw))return [];
 return [...new Set(raw.filter(x=>typeof x==="string"&&valid.has(x)))];
}
scope.LeviLearning=Object.freeze({version:"levios-learning-v1",courses,get,score,sanitizeProgress});
})(globalThis);
