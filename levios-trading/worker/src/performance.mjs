/**
 * Minimal, auditable equity-series statistics.
 *
 * Design reference: quantitative-performance libraries such as QuantStats.
 * This is independent JavaScript (not QuantStats itself), so it runs inside
 * our existing Cloudflare Worker without a separate Python service.
 *
 * Important: raw brokerage equity is NOT cash-flow-adjusted. Deposits and
 * withdrawals can distort peak-to-trough drawdown. We label it accordingly.
 * Never calculate closed-trade win rate from partial executions alone.
 */
const round = (value, decimals = 2) =>
  Number.isFinite(value) ? Number(value.toFixed(decimals)) : null;

export function equityScorecard(input) {
  const ordered = Array.isArray(input) ? input.filter(item =>
    item && Number.isSafeInteger(item.timestamp) && item.timestamp > 0 &&
    Number.isFinite(item.equity) && item.equity >= 0
  ).sort((a, b) => a.timestamp - b.timestamp) : [];
  // Ignore duplicate timestamps; otherwise coverage and drawdown can be skewed.
  const points = ordered.filter((point, index) =>
    index === 0 || point.timestamp !== ordered[index - 1].timestamp
  );
  if (!points.length) {
    return {
      observations: 0, first_timestamp: null, last_timestamp: null,
      observed_peak_equity: null, observed_low_equity: null,
      max_observed_drawdown_pct: null, max_observed_drawdown_usd: null
    };
  }
  let peak = points[0].equity;
  let observedHigh = peak;
  let observedLow = peak;
  let worstPercentage = 0;
  let worstDollars = 0;
  for (const point of points) {
    observedHigh = Math.max(observedHigh, point.equity);
    observedLow = Math.min(observedLow, point.equity);
    peak = Math.max(peak, point.equity);
    const decline = peak - point.equity;
    if (peak > 0) {
      const percent = decline / peak * 100;
      // Pair dollars with the same peak/trough event as maximum percentage
      // drawdown, rather than independently selecting the largest dollar drop.
      if (percent > worstPercentage ||
          (percent === worstPercentage && decline > worstDollars)) {
        worstPercentage = percent;
        worstDollars = decline;
      }
    }
  }
  return {
    observations: points.length,
    first_timestamp: points[0].timestamp,
    last_timestamp: points[points.length - 1].timestamp,
    observed_peak_equity: round(observedHigh),
    observed_low_equity: round(observedLow),
    // With only one observation, there is no period path to measure.
    max_observed_drawdown_pct: points.length < 2 ? null : round(worstPercentage, 2),
    max_observed_drawdown_usd: points.length < 2 ? null : round(worstDollars)
  };
}
