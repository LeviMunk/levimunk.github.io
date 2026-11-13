/* LeviOS Strategy Validation v1
 *
 * Deterministic research-only approval gates. This policy DOES NOT recommend,
 * deploy or execute orders. All records are browser-local, not authoritative
 * attestations. A chronological split stops being blind after users inspect
 * and tune against it. Independent forward validation is still required.
 */
(function (scope) {
  "use strict";
  const VERSION = "levios-validation-v1";
  const POLICY = Object.freeze({
    minEvaluationObservations: 30,
    minEvaluationExecutions: 2,
    minExcessVsHoldPctPoints: 1,
    maxDrawdownPct: 15,
    minStressExcessVsHoldPctPoints: 0,
    minGainVsChampionPctPoints: 0.5,
    maxDrawdownWorseningPctPoints: 2
  });
  const finite = x => typeof x === "number" && Number.isFinite(x);
  const percent = x => finite(x) ? x.toFixed(2) + "%" : "n/a";
  function researchContext(version) {
    if (!version || !version.settings) return null;
    const {splitPct, feeBps, slippageBps} = version.settings;
    if (!["string"].every(() => typeof version.symbol === "string") ||
        typeof version.source !== "string" ||
        typeof version.engine !== "string" ||
        !/^[a-f0-9]{8}$/.test(version.dataHash || "") ||
        !["dataStart", "dataEnd", "splitDate"].every(x =>
          typeof version[x] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(version[x])) ||
        !Number.isInteger(splitPct) || !finite(feeBps) || !finite(slippageBps)) {
      return null;
    }
    return [version.symbol,version.source,version.engine,
      version.dataHash,version.dataStart,version.dataEnd,
      version.splitDate,splitPct,feeBps,slippageBps].join("|");
  }
  function evaluate(candidate, champion = null, policy = POLICY) {
    const checks = [];
    const add = (code, ok, explanation) =>
      checks.push({code, pass:Boolean(ok), explanation});
    const context = researchContext(candidate);
    add("evidence", Boolean(context) && Number.isInteger(candidate?.version) &&
      finite(candidate?.trainReturnPct) && finite(candidate?.testReturnPct) &&
      finite(candidate?.testHoldPct) && finite(candidate?.testDrawdownPct) &&
      Number.isInteger(candidate?.testObservations) &&
      Number.isInteger(candidate?.testExecutions) &&
      finite(candidate?.stressTestReturnPct) &&
      finite(candidate?.stressTestHoldPct),
      "Requires a complete, saved, deterministic research run including a higher-cost stress test. Legacy runs must be rerun and saved.");
    if (!checks[0].pass) {
      return {version:VERSION, eligible:false, checks, contextKey:context,
        baselineType:champion ? "research_champion" : "buy_and_hold",
        baselineVersion:champion?.version ?? null};
    }
    add("history", candidate.testObservations >= policy.minEvaluationObservations,
      "At least " + policy.minEvaluationObservations + " later-period observations; candidate has " +
      candidate.testObservations + ".");
    add("executions", candidate.testExecutions >= policy.minEvaluationExecutions,
      "At least " + policy.minEvaluationExecutions + " simulated evaluation-period executions; candidate has " +
      candidate.testExecutions + ".");
    const excess = candidate.testReturnPct - candidate.testHoldPct;
    add("benchmark", excess >= policy.minExcessVsHoldPctPoints,
      "Evaluation strategy return exceeds the same-window buy-and-hold return by at least " +
      policy.minExcessVsHoldPctPoints.toFixed(2) + " percentage points; observed " +
      percent(excess) + ".");
    add("drawdown", candidate.testDrawdownPct >= -policy.maxDrawdownPct &&
      candidate.testDrawdownPct <= 0,
      "Evaluation drawdown must be no worse than −" +
      policy.maxDrawdownPct.toFixed(2) + "%; observed " + percent(candidate.testDrawdownPct) + ".");
    const stressed = candidate.stressTestReturnPct - candidate.stressTestHoldPct;
    add("stress", stressed >= policy.minStressExcessVsHoldPctPoints,
      "With fee and slippage doubled, evaluation return must still meet buy-and-hold; observed excess " +
      percent(stressed) + ".");
    if (champion) {
      const comparable = researchContext(champion) === context &&
        finite(champion.testReturnPct) && finite(champion.testDrawdownPct);
      add("comparable", comparable && champion.version !== candidate.version,
        "The existing research champion must have a different version and identical symbol, source, data fingerprint, dates, split, engine and transaction-cost settings.");
      if (comparable) {
        const delta = candidate.testReturnPct - champion.testReturnPct;
        add("champion_improvement", delta >= policy.minGainVsChampionPctPoints,
          "Candidate must improve evaluation return over the current champion by at least " +
          policy.minGainVsChampionPctPoints.toFixed(2) +
          " percentage points; observed " + percent(delta) + ".");
        const ddLoss = champion.testDrawdownPct - candidate.testDrawdownPct;
        add("champion_drawdown", ddLoss <= policy.maxDrawdownWorseningPctPoints,
          "Drawdown must not worsen by more than " +
          policy.maxDrawdownWorseningPctPoints.toFixed(2) +
          " percentage points versus the champion; observed worsening " +
          percent(ddLoss) + ".");
      }
    }
    return {
      version:VERSION, eligible:checks.every(x=>x.pass), checks,
      contextKey:context,
      baselineType:champion ? "research_champion" : "buy_and_hold",
      baselineVersion:champion?.version ?? null,
      metrics: {
        evaluationReturnPct:candidate.testReturnPct,
        benchmarkReturnPct:candidate.testHoldPct,
        benchmarkExcessPctPoints:excess,
        stressExcessPctPoints:stressed,
        maxDrawdownPct:candidate.testDrawdownPct,
        testObservations:candidate.testObservations,
        testExecutions:candidate.testExecutions
      }
    };
  }
  function comparableChampion(approvals, candidate) {
    const key=researchContext(candidate);
    if (!key || !Array.isArray(approvals)) return null;
    for (let i=approvals.length-1;i>=0;i--) {
      const record=approvals[i];
      if (record && record.kind==="approved_research" &&
          record.contextKey === key && record.snapshot &&
          researchContext(record.snapshot) === key) return record.snapshot;
    }
    return null;
  }
  scope.LeviStrategyValidation=Object.freeze({
    version:VERSION, policy:POLICY, researchContext, evaluate, comparableChampion
  });
})(globalThis);
