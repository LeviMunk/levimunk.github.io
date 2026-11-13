/**
 * Read-only positions exposure analytics for Alpaca PAPER.
 * This is not brokerage margin usage, VaR, financial advice, or realized P/L.
 * Uses the ISC-licensed precise summation algorithm from simple-statistics.
 * See ./vendor/simple-statistics/LICENSE.
 */
import sum from "./vendor/simple-statistics/sum.mjs";

const amount = value =>
  value === null || value === undefined || value === "" ||
  !Number.isFinite(Number(value)) ? null : Number(value);
const round = (n, decimals = 2) =>
  Number.isFinite(n) ? Number(n.toFixed(decimals)) : null;

export function positionRiskSummary(account, positions) {
  const rows = Array.isArray(positions) ? positions : [];
  const exposureRows = [];
  let unavailable = 0;
  let missingPnl = 0;
  const openPL = [];

  for (const position of rows) {
    const value = amount(position?.market_value);
    if (value === null) {
      unavailable++;
    } else {
      const side = String(position?.side || "").toLowerCase();
      // Alpaca can report a signed market value or an explicit short side.
      // Respect the explicit side when present; otherwise use the value sign.
      const signed = side === "short" ? -Math.abs(value)
        : side === "long" ? Math.abs(value) : value;
      exposureRows.push({
        symbol: String(position?.symbol || "").slice(0, 24),
        signed,
        absolute: Math.abs(signed)
      });
    }
    const pnl = amount(position?.unrealized_pl);
    if (pnl === null) missingPnl++;
    else openPL.push(pnl);
  }

  // Don't show an underestimated "complete" exposure or P/L when
  // any reported position lacks a market value or unrealized-P/L figure.
  const complete = unavailable === 0;
  const gross = complete ? sum(exposureRows.map(x => x.absolute)) : null;
  const long = complete ? sum(exposureRows.filter(x => x.signed > 0).map(x => x.absolute)) : null;
  const short = complete ? sum(exposureRows.filter(x => x.signed < 0).map(x => x.absolute)) : null;
  const net = complete ? sum(exposureRows.map(x => x.signed)) : null;
  const equity = amount(account?.equity);
  const leader = complete && exposureRows.length
    ? exposureRows.reduce((max, x) => x.absolute > max.absolute ? x : max)
    : null;
  const top3 = complete && gross > 0
    ? sum(exposureRows.map(x => x.absolute).sort((a, b) => b - a).slice(0, 3))
    : null;
  return {
    reported_positions: rows.length,
    priced_positions: exposureRows.length,
    complete,
    gross_exposure: round(gross),
    net_exposure: round(net),
    long_exposure: round(long),
    short_exposure: round(short),
    gross_exposure_pct_equity: equity > 0 && gross !== null ? round(gross / equity * 100) : null,
    largest_position_symbol: leader && leader.absolute > 0 ? leader.symbol : null,
    largest_position_market_value: leader && leader.absolute > 0 ? round(leader.absolute) : null,
    largest_position_pct_gross: leader && gross > 0 ? round(leader.absolute / gross * 100) : null,
    top_three_pct_gross: top3 !== null ? round(top3 / gross * 100) : null,
    open_unrealized_pnl: missingPnl ? null : round(sum(openPL)),
    missing_market_values: unavailable,
    missing_open_pnl: missingPnl
  };
}
