/* LeviOS Strategy Engine v1.
 * Deterministic close-only research engine inspired by Freqtrade's anti-lookahead
 * methodology: signals use only completed bars; trades execute at the NEXT bar's
 * close. Execution at a next close remains an approximation, not a tradable fill.
 * No broker connection, no network, and no random data.
 */
(function (scope) {
  "use strict";
  const VERSION = "levios-ma-v1";
  const CASH = 10000;
  function finite(value) { return typeof value === "number" && Number.isFinite(value); }
  function checksum(rows) {
    // Portable FNV-1a fingerprint for research reproducibility, not cryptographic.
    let h = 2166136261;
    for (const row of rows) {
      for (const c of row.date + ":" + row.close + ";") {
        h ^= c.charCodeAt(0);
        h = Math.imul(h, 16777619);
      }
    }
    return ("00000000" + (h >>> 0).toString(16)).slice(-8);
  }
  function validate(rows, settings) {
    const {fast, slow, splitPct, feeBps, slippageBps} = settings;
    if (![fast, slow, splitPct, feeBps, slippageBps].every(finite) ||
        !Number.isInteger(fast) || !Number.isInteger(slow) ||
        fast < 2 || slow > 250 || fast >= slow ||
        !Number.isInteger(splitPct) || splitPct < 50 || splitPct > 85 ||
        feeBps < 0 || feeBps > 200 || slippageBps < 0 || slippageBps > 200) {
      throw Error("Use 2 ≤ fast < slow ≤ 250; split 50–85%; fee and slippage 0–200 bps.");
    }
    if (!Array.isArray(rows) || rows.length > 10000) {
      throw Error("Provide up to 10,000 daily historical closing prices.");
    }
    const seen = new Set();
    let last = "";
    for (const row of rows) {
      if (!row || typeof row.date !== "string" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(row.date) ||
          !Number.isFinite(Date.parse(row.date + "T00:00:00Z")) ||
          row.date <= last || seen.has(row.date) ||
          !finite(row.close) || row.close <= 0) {
        throw Error("Historical prices must be valid, positive, unique and sorted oldest first.");
      }
      last = row.date;
      seen.add(row.date);
    }
    const splitAt = Math.floor(rows.length * splitPct / 100);
    if (splitAt < slow + 2 || rows.length - splitAt < 10) {
      throw Error("Not enough history for this split: need a training warmup and at least ten evaluation observations.");
    }
    return splitAt;
  }
  function metrics(curve, start, end, tradeDays, benchmark) {
    // start and end are INCLUSIVE, using day BEFORE the evaluation slice as
    // baseline (where possible), so no in-sample gains leak into test return.
    const first = curve[start].equity;
    const last = curve[end].equity;
    let peak = first;
    let maxDD = 0;
    for (let i = start; i <= end; i++) {
      peak = Math.max(peak, curve[i].equity);
      if (peak > 0) maxDD = Math.min(maxDD, (curve[i].equity / peak - 1) * 100);
    }
    return {
      startDate: curve[start].date,
      endDate: curve[end].date,
      observations: end - start + 1,
      returnPct: (last / first - 1) * 100,
      // At inception the buy-and-hold entry fee/slippage must count against
      // the initial $10k, not disappear into its first marked equity.
      holdPct: (benchmark[end] / (start === 0 ? CASH : benchmark[start]) - 1) * 100,
      maxDrawdownPct: maxDD,
      executions: tradeDays.filter(i => i > start && i <= end).length
    };
  }
  function run(rows, settings) {
    const splitAt = validate(rows, settings);
    const prices = rows.map(row => row.close);
    const {fast, slow, splitPct, feeBps, slippageBps} = settings;
    const fee = feeBps / 10000;
    const slip = slippageBps / 10000;
    // O(N) moving averages, with no future observations.
    const prefix = [0];
    for (const value of prices) prefix.push(prefix[prefix.length - 1] + value);
    const avg = (end, n) => (prefix[end + 1] - prefix[end + 1 - n]) / n;
    let cash = CASH, shares = 0, pending = "", trades = 0;
    let holdingCash = CASH, holdingShares = 0;
    const curve = [], benchmark = [], tradeDays = [], executions = [];
    for (let i = 0; i < prices.length; i++) {
      const price = prices[i];
      // Baseline invests on the first available close, with identical costs.
      if (i === 0) {
        holdingShares = holdingCash / (price * (1 + slip) * (1 + fee));
        holdingCash = 0;
      }
      // Orders decided at close of bar i-1 execute at close of bar i.
      if (pending === "BUY" && cash > 0) {
        const amount = cash;
        shares = amount / (price * (1 + slip) * (1 + fee));
        cash = 0;
        trades++;
        tradeDays.push(i);
        executions.push({date: rows[i].date, side: "BUY", price: price * (1 + slip), notional: amount});
      } else if (pending === "SELL" && shares > 0) {
        const amount = shares * price * (1 - slip) * (1 - fee);
        cash = amount;
        shares = 0;
        trades++;
        tradeDays.push(i);
        executions.push({date: rows[i].date, side: "SELL", price: price * (1 - slip), notional: amount});
      }
      pending = "";
      if (i >= slow - 1) {
        const f = avg(i, fast), s = avg(i, slow);
        if (f > s && shares === 0) pending = "BUY";
        else if (f <= s && shares > 0) pending = "SELL";
      }
      const equity = cash + shares * price;
      curve.push({date: rows[i].date, equity});
      benchmark.push(holdingCash + holdingShares * price);
    }
    // Training ends at splitAt-1; evaluation begins at splitAt, using
    // splitAt-1 as the return baseline. Position state is carried forward.
    const train = metrics(curve, 0, splitAt - 1, tradeDays, benchmark);
    const test = metrics(curve, splitAt - 1, rows.length - 1, tradeDays, benchmark);
    test.startDate = rows[splitAt].date;
    test.observations = rows.length - splitAt;
    return {
      version: VERSION,
      dataHash: checksum(rows),
      dataStart: rows[0].date,
      dataEnd: rows[rows.length - 1].date,
      settings: {fast, slow, splitPct, feeBps, slippageBps},
      splitAt, splitDate: rows[splitAt].date,
      train, test,
      full: metrics(curve, 0, rows.length - 1, tradeDays, benchmark),
      curve, benchmark, executions,
      caveat: "Close-only, next-close fill approximation. Unadjusted series may omit dividends/splits; future data and repeated holdout review can bias interpretation."
    };
  }
  // Diagnostic only: three consecutive, non-overlapping segments inside the
  // existing evaluation window. Fixed parameters and the same historical
  // simulation are used throughout. These are NOT three blind tests.
  function evaluationWindows(result) {
    if (!result || !Array.isArray(result.curve) ||
        !Array.isArray(result.benchmark) ||
        result.curve.length !== result.benchmark.length ||
        !Number.isInteger(result.splitAt) ||
        result.splitAt < 1 || result.splitAt >= result.curve.length) {
      throw Error("Run a complete strategy backtest before analyzing windows.");
    }
    const n = result.curve.length - result.splitAt;
    if (n < 30) throw Error("At least 30 evaluation observations are needed for three windows.");
    const boundaries = [0, Math.floor(n / 3), Math.floor(2 * n / 3), n];
    const executions = Array.isArray(result.executions) ? result.executions : [];
    return [0, 1, 2].map(index => {
      const from = result.splitAt + boundaries[index];
      const to = result.splitAt + boundaries[index + 1] - 1;
      const baseline = from - 1;
      const startEquity = result.curve[baseline].equity;
      const endEquity = result.curve[to].equity;
      const startHold = result.benchmark[baseline];
      const endHold = result.benchmark[to];
      if (![startEquity, endEquity, startHold, endHold].every(
        value => Number.isFinite(value) && value > 0)) {
        throw Error("Invalid equity or benchmark observations.");
      }
      let peak = startEquity, dd = 0;
      for (let k = from; k <= to; k++) {
        const equity = result.curve[k].equity;
        if (!Number.isFinite(equity) || equity <= 0) {
          throw Error("Invalid evaluation equity observation.");
        }
        peak = Math.max(peak, equity);
        dd = Math.min(dd, (equity / peak - 1) * 100);
      }
      const returnPct = (endEquity / startEquity - 1) * 100;
      const holdPct = (endHold / startHold - 1) * 100;
      return {
        window: index + 1,
        startDate: result.curve[from].date,
        endDate: result.curve[to].date,
        observations: to - from + 1,
        returnPct, holdPct,
        excessPctPoints: returnPct - holdPct,
        maxDrawdownPct: dd,
        executions: executions.filter(x =>
          x.date >= result.curve[from].date && x.date <= result.curve[to].date).length
      };
    });
  }
  scope.LeviStrategyEngine = Object.freeze({version: VERSION, run, checksum, evaluationWindows});
})(globalThis);
