"use strict";
/* LeviOS Trading Lab / GitHub Pages edition.
 * All user data remains in browser storage. No broker credentials or order APIs.
 */
(() => {
  const STORAGE_KEY = "levios-trading-browser-v1";
  const INITIAL_CASH = 10000;
  const MAX_ROWS = 10000;
  const $ = id => document.getElementById(id);
  const money = value => Number(value).toLocaleString("en-US", {style:"currency", currency:"USD"});
  const pct = value => Number(value).toFixed(2) + "%";
  const escapeHTML = value => String(value).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const round = value => Math.round((value + Number.EPSILON) * 100) / 100;
  const emptyState = () => ({version:1, prices:{}, trades:[]});
  let state = emptyState();
  let toastTimer;
  let alpacaSnapshot = null; // In-memory only; not part of exported or browser-stored simulation.
  let accountView = "alpaca";
  const STRATEGY_LOG_STORAGE_KEY = "levios-strategy-log-v1";
  const VALIDATION_LOG_STORAGE_KEY = "levios-validation-history-v1";
  const MAX_VALIDATION_DECISIONS = 100;
  let validationDecisions = [];
  let activeValidationReview = null;
  const MAX_STRATEGY_VERSIONS = 25;
  let strategyVersions = [];
  let strategyNextVersion = 1;
  let activeStrategyRun = null;
  let iexStrategyRows = null;
  let iexStrategyTicker = "";
  let iexStrategyLoading = false;

  let tradingViewPnl = null;
  let tradingViewCandle = null;
  let candleSymbol = "SPY";
  let candleRange = "3M";
  let candleRequestToken = 0;
  let candleBars = null;
  let candleError = "";
  let candleRequesting = false;

  const WATCHLIST_STORAGE_KEY = "levios-iex-watchlist-v1";
  const WATCHLIST_DEFAULT = ["SPY", "QQQ", "AAPL", "MSFT", "NVDA"];
  const WATCHLIST_MAX = 12;
  let watchSymbols = WATCHLIST_DEFAULT.slice();
  let watchSnapshots = new Map();
  let watchRefreshTime = null;
  let watchFetching = false;
  let watchError = "";
  let watchGeneration = 0;
  let radarScanning = false;
  let radarSequence = 0;
  let latestRadarFindings = null;
  let latestRadarSymbols = "";
  let fillRows = [];
  let fillCursor = null;
  let fillsLoaded = false;
  let fillsLoading = false;
  let fillsError = "";
  let fillsRequestToken = 0;
  // Broker history is only held in memory, never mixed with the practice ledger.
  let pnlRange = "1M";
  let pnlHistory = null;
  let pnlMessage = "Sign in to view Alpaca PAPER performance.";
  let pnlRequestToken = 0;

  function validSymbol(value) {
    const valueText = String(value || "").trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9.-]{0,11}$/.test(valueText)) throw Error("Enter a valid ticker symbol (up to 12 characters).");
    return valueText;
  }
  function validDate(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const [year,month,day] = s.split("-").map(Number);
    const d = new Date(Date.UTC(year, month - 1, day));
    return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
  }
  function sanitizeState(data) {
    if (!data || data.version !== 1 || !data.prices || typeof data.prices !== "object" || Array.isArray(data.prices) || !Array.isArray(data.trades)) {
      throw Error("Unrecognized backup format.");
    }
    const prices = {};
    let symbols = 0;
    for (const [rawSymbol, rows] of Object.entries(data.prices)) {
      const symbol = validSymbol(rawSymbol);
      if (++symbols > 30 || !Array.isArray(rows) || rows.length > MAX_ROWS) throw Error("Too many imported symbols or price rows.");
      const seen = new Set();
      const parsed = [];
      for (const row of rows) {
        if (!row || !validDate(String(row.date)) || !Number.isFinite(row.close) || row.close <= 0 || row.close >= 100000000 || seen.has(row.date)) {
          throw Error("Backup contains invalid or duplicate price observations.");
        }
        seen.add(row.date);
        parsed.push({date:row.date, close:row.close});
      }
      parsed.sort((a,b) => a.date.localeCompare(b.date));
      prices[symbol] = parsed;
    }
    if (data.trades.length > 2000) throw Error("Backup contains too many transactions.");
    const trades = [];
    for (const row of data.trades) {
      if (!row || !Number.isFinite(row.qty) || row.qty <= 0 || !Number.isFinite(row.price) || row.price <= 0 || !Number.isFinite(row.notional) || row.notional <= 0 || !["BUY","SELL"].includes(row.side) || typeof row.at !== "string") {
        throw Error("Backup contains an invalid simulated trade.");
      }
      trades.push({id:String(row.id || ""), at:row.at.slice(0,32), symbol:validSymbol(row.symbol), side:row.side, qty:row.qty, price:row.price, notional:row.notional});
    }
    return {version:1, prices, trades};
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) state = sanitizeState(JSON.parse(raw));
    } catch (e) {
      console.warn("Could not load saved practice data:", e);
      state = emptyState();
      $("save-state").textContent = "Storage unavailable";
    }
  }
  function persist(candidate) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(candidate));
      state = candidate;
      $("save-state").textContent = "Saved in this browser";
      return true;
    } catch (e) {
      $("save-state").textContent = "Save failed";
      return false;
    }
  }
  function showToast(text) {
    const el = $("toast");
    el.textContent = text;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {el.hidden = true;}, 4000);
  }
  function feedback(id, text, error = false) {
    const el = $(id);
    el.textContent = text;
    el.classList.toggle("error", error);
  }
  function latest(symbol) {
    const rows = state.prices[symbol];
    return rows && rows.length ? rows[rows.length - 1] : null;
  }
  function portfolio() {
    let cash = INITIAL_CASH;
    const quantities = {};
    for (const t of state.trades) {
      cash += t.side === "BUY" ? -t.notional : t.notional;
      quantities[t.symbol] = (quantities[t.symbol] || 0) + (t.side === "BUY" ? t.qty : -t.qty);
    }
    const holdings = Object.entries(quantities).filter(([,qty]) => qty > 0.00000001).sort(([a],[b]) => a.localeCompare(b)).map(([symbol,qty]) => {
      const price = latest(symbol);
      return {symbol,qty,close:price?.close ?? null, date:price?.date ?? null,value:price ? price.close * qty : null};
    });
    const equity = cash + holdings.reduce((total,r) => total + (r.value ?? 0),0);
    return {cash, equity, pnl:equity-INITIAL_CASH,holdings};
  }
  function setOptions(id, symbols) {
    const select = $(id);
    const prev = select.value;
    select.replaceChildren();
    if (!symbols.length) {
      const option = new Option("Import a ticker first", "");
      option.disabled = true;
      select.add(option);
      select.disabled = true;
      return;
    }
    select.disabled = false;
    for (const symbol of symbols) select.add(new Option(symbol,symbol));
    if (symbols.includes(prev)) select.value = prev;
  }
  function renderRiskDashboard() {
    const values = ["risk-gross", "risk-largest", "risk-top3", "risk-unrealized"];
    for (const id of values) {
      $(id).textContent = "—";
      $(id).classList.remove("positive", "negative");
    }
    for (const id of ["risk-gross-pct", "risk-largest-share"]) {
      $(id).textContent = id === "risk-gross-pct"
        ? "Compared with account equity" : "Share of gross exposure";
    }
    $("risk-long").textContent = "—";
    $("risk-short").textContent = "—";
    $("risk-long-bar").style.width = "0";
    $("risk-short-bar").style.width = "0";
    $("risk-exposure-label").setAttribute("aria-label", "Long versus short share of gross exposure is unavailable");
    const privateWorker = window.location.hostname.endsWith(".workers.dev");
    if (accountView !== "alpaca") {
      $("risk-status").textContent = "Select Alpaca Paper to see actual brokerage position exposure. The browser simulator is separate.";
      return;
    }
    if (!privateWorker) {
      $("risk-status").textContent = "Open the protected Alpaca dashboard to see private position risk.";
      return;
    }
    if (!alpacaSnapshot?.connected) {
      $("risk-status").textContent = "Connect to Alpaca PAPER to load your current positions.";
      return;
    }
    const risk = alpacaSnapshot.risk;
    if (!risk || !Number.isInteger(risk.reported_positions)) {
      $("risk-status").textContent = "Risk figures are unavailable until the updated private Worker is deployed.";
      return;
    }
    const hasNumber = value => typeof value === "number" && Number.isFinite(value);
    if (hasNumber(risk.open_unrealized_pnl)) {
      const value = risk.open_unrealized_pnl;
      $("risk-unrealized").textContent =
        (value > 0 ? "+" : value < 0 ? "−" : "") + money(Math.abs(value));
      $("risk-unrealized").classList.add(value >= 0 ? "positive" : "negative");
    }
    if (!risk.complete || !hasNumber(risk.gross_exposure) ||
        !hasNumber(risk.long_exposure) || !hasNumber(risk.short_exposure)) {
      $("risk-status").textContent = "Some positions lack a market value; exposure and concentration were intentionally withheld rather than underestimated.";
      return;
    }
    const gross = risk.gross_exposure;
    $("risk-gross").textContent = money(gross);
    $("risk-gross-pct").textContent = hasNumber(risk.gross_exposure_pct_equity)
      ? risk.gross_exposure_pct_equity.toFixed(2) + "% of account equity"
      : "Cannot calculate percentage without positive account equity";
    $("risk-long").textContent = money(risk.long_exposure);
    $("risk-short").textContent = money(risk.short_exposure);
    if (gross > 0) {
      const longShare = Math.min(100, Math.max(0, risk.long_exposure / gross * 100));
      const shortShare = Math.min(100, Math.max(0, 100 - longShare));
      $("risk-long-bar").style.width = longShare.toFixed(2) + "%";
      $("risk-short-bar").style.width = shortShare.toFixed(2) + "%";
      $("risk-exposure-label").setAttribute("aria-label",
        "Long exposure " + longShare.toFixed(1) +
        " percent; short exposure " + shortShare.toFixed(1) + " percent");
      $("risk-largest").textContent =
        risk.largest_position_symbol ? String(risk.largest_position_symbol) : "—";
      $("risk-largest-share").textContent =
        hasNumber(risk.largest_position_pct_gross) &&
        hasNumber(risk.largest_position_market_value)
          ? risk.largest_position_pct_gross.toFixed(2) +
            "% of gross · " + money(risk.largest_position_market_value)
          : "Largest position data unavailable";
      $("risk-top3").textContent = hasNumber(risk.top_three_pct_gross)
        ? risk.top_three_pct_gross.toFixed(2) + "%" : "—";
    } else {
      $("risk-largest").textContent = "None";
      $("risk-largest-share").textContent = "No open exposure";
      $("risk-top3").textContent = "N/A";
    }
    $("risk-status").textContent = risk.reported_positions
      ? "Snapshot of " + risk.reported_positions + " Alpaca PAPER open position" +
        (risk.reported_positions === 1 ? "" : "s") +
        ". Market values can change between refreshes; this is not a real-time risk engine."
      : "No open Alpaca PAPER positions. Current position exposure is zero; other market and account risks are not measured here.";
  }

  function renderAccountSummary() {
    const sim = portfolio();
    const symbols = Object.keys(state.prices);
    const connected = Boolean(alpacaSnapshot && alpacaSnapshot.connected && alpacaSnapshot.account && Array.isArray(alpacaSnapshot.positions));
    const paper = accountView === "alpaca";
    $("mode-alpaca").disabled = false;
    for (const [id,active] of [["mode-alpaca",paper],["mode-simulator",!paper]]) {
      const button = $(id);
      button.classList.toggle("active",active);
      button.setAttribute("aria-pressed", String(active));
    }
    if (paper && connected) {
      const data = alpacaSnapshot;
      $("account-view-note").textContent = "Connected Alpaca PAPER account · read-only";
      $("metric-equity-label").textContent = "ALPACA PAPER EQUITY";
      $("metric-cash-label").textContent = "ALPACA PAPER CASH";
      $("metric-positions-label").textContent = "ALPACA POSITIONS";
      $("metric-trades-label").textContent = "ALPACA BUYING POWER";
      $("metric-equity").textContent = alpacaMoney(data.account.equity);
      $("metric-cash").textContent = alpacaMoney(data.account.cash);
      $("metric-positions").textContent = String(data.positions.length);
      $("metric-trades").textContent = alpacaMoney(data.account.buying_power);
      $("metric-pl").textContent = "Paper brokerage account · not live money";
      $("metric-pl").className = "";
      $("metric-cash-note").textContent = "Reported by Alpaca";
      $("metric-symbols").textContent = "From your Alpaca paper account";
      $("metric-trades-note").textContent = "Broker orders unavailable here";
      $("holdings-source").textContent = "ALPACA PAPER ACCOUNT";
      $("holdings-heading").textContent = "Brokerage paper positions";
      $("holdings-third-heading").textContent = "Unrealized P/L";
      $("holdings-fourth-heading").textContent = "Market value";
      $("portfolio-action").hidden = true;
      $("holdings-note").textContent = "Alpaca paper positions, not browser-simulated holdings. Quotes and values are provided by Alpaca.";
      $("holdings-rows").innerHTML = data.positions.length
        ? data.positions.map(h => `<tr><td><strong>${escapeHTML(h.symbol ?? "?")}</strong></td><td>${escapeHTML(h.qty ?? "—")}</td><td>${alpacaMoney(h.unrealized_pl)}</td><td>${alpacaMoney(h.market_value)}</td></tr>`).join("")
        : '<tr><td colspan="4" class="empty">No open positions in this Alpaca paper account.</td></tr>';
      $("view-description").textContent = "Your Alpaca paper-account balance and positions. Browser simulations are tracked separately.";
    } else if (paper) {
      $("account-view-note").textContent = "Alpaca paper account disconnected · sign in to view balances";
      $("metric-equity-label").textContent = "ALPACA PAPER EQUITY";
      $("metric-cash-label").textContent = "ALPACA PAPER CASH";
      $("metric-positions-label").textContent = "ALPACA POSITIONS";
      $("metric-trades-label").textContent = "ALPACA BUYING POWER";
      for (const id of ["metric-equity","metric-cash","metric-positions","metric-trades"]) $(id).textContent = "—";
      $("metric-pl").textContent = "Not connected — no live account data";
      $("metric-pl").className = "";
      $("metric-cash-note").textContent = "Connect to your private Alpaca bridge";
      $("metric-symbols").textContent = "Unavailable until authenticated";
      $("metric-trades-note").textContent = "Broker orders unavailable here";
      $("holdings-source").textContent = "ALPACA PAPER ACCOUNT";
      $("holdings-heading").textContent = "Brokerage paper positions";
      $("holdings-third-heading").textContent = "Unrealized P/L";
      $("holdings-fourth-heading").textContent = "Market value";
      $("portfolio-action").hidden = true;
      $("holdings-note").textContent = "No Alpaca account data is available until the private connection is authenticated.";
      $("holdings-rows").innerHTML = '<tr><td colspan="4" class="empty">Alpaca disconnected. Sign in to the private bridge and refresh.</td></tr>';
      $("view-description").textContent = "Your Alpaca paper-account summary will appear here after you connect securely.";
    } else {
      $("account-view-note").textContent = connected
        ? "Browser-only $10,000 practice portfolio · Alpaca account also connected"
        : "Showing browser-only practice funds until Alpaca connects.";
      $("metric-equity-label").textContent = "SIMULATED EQUITY";
      $("metric-cash-label").textContent = "SIMULATED CASH";
      $("metric-positions-label").textContent = "SIMULATED POSITIONS";
      $("metric-trades-label").textContent = "SIMULATED TRADES";
      $("metric-equity").textContent = money(sim.equity);
      $("metric-cash").textContent = money(sim.cash);
      $("metric-positions").textContent = String(sim.holdings.length);
      $("metric-trades").textContent = String(state.trades.length);
      $("metric-pl").textContent = (sim.pnl>=0?"+":"") + money(sim.pnl) + " total P/L";
      $("metric-pl").className = sim.pnl>=0 ? "gain" : "loss";
      $("metric-cash-note").textContent = "Initial balance: $10,000";
      $("metric-symbols").textContent = symbols.length + " symbols imported";
      $("metric-trades-note").textContent = "Recorded in this browser";
      $("holdings-source").textContent = "BROWSER SIMULATION";
      $("holdings-heading").textContent = "Current holdings";
      $("holdings-third-heading").textContent = "Last CSV close";
      $("holdings-fourth-heading").textContent = "Market value*";
      $("portfolio-action").hidden = false;
      $("holdings-note").textContent = "*Valued using the latest price you imported, which may be old.";
      $("holdings-rows").innerHTML = sim.holdings.length
        ? sim.holdings.map(h => `<tr><td><strong>${escapeHTML(h.symbol)}</strong></td><td>${h.qty.toFixed(6).replace(/0+$/,"").replace(/\.$/,"")}</td><td>${h.close===null?"—":money(h.close)}</td><td>${h.value===null?"Unpriced":money(h.value)}</td></tr>`).join("")
        : '<tr><td colspan="4" class="empty">No positions yet. Import CSV history and place a simulated order.</td></tr>';
      $("view-description").textContent = "Explore your separate browser-simulated $10,000 portfolio with historical prices.";
    }
    renderProfitLoss();
    renderRiskDashboard();
  }
  function render() {
    const symbols = Object.keys(state.prices).sort();
    renderAccountSummary();
    $("overview-symbols").innerHTML = symbols.length ? symbols.map(symbol => {
      const l = latest(symbol);
      return `<div class="symbol-card"><strong>${escapeHTML(symbol)}</strong><span>${money(l.close)}</span><small>CSV as of ${escapeHTML(l.date)}</small></div>`;
    }).join("") : '<p class="empty">No prices imported. Add a CSV under Market Data to get started.</p>';
    for (const id of ["market-symbol","strategy-symbol","trade-symbol"]) setOptions(id,symbols);
    const rows = [...state.trades].reverse().slice(0,200);
    $("trade-rows").innerHTML = rows.length ? rows.map(t=>`<tr><td>${escapeHTML(t.at.slice(0,10))}</td><td>${escapeHTML(t.symbol)}</td><td>${escapeHTML(t.side)}</td><td>${t.qty}</td><td>${money(t.price)}</td></tr>`).join("") : '<tr><td class="empty" colspan="5">No simulated orders yet.</td></tr>';
    plotHistory();
    renderFills();
  }
  function renderPerformanceScorecard() {
    $("scorecard-range").textContent = pnlRange + " PERIOD";
    for (const id of ["scorecard-drawdown", "scorecard-peak",
      "scorecard-low", "scorecard-count"]) {
      $(id).textContent = "—";
    }
    $("scorecard-drawdown").classList.remove("negative");
    $("scorecard-drawdown-usd").textContent =
      "Requires at least two daily equity observations";
    $("scorecard-coverage").textContent = "Waiting for Alpaca history";
    const privateWorker = window.location.hostname.endsWith(".workers.dev");
    const connected = Boolean(alpacaSnapshot?.connected);
    const stats = pnlHistory?.range === pnlRange ? pnlHistory?.scorecard : null;
    if (accountView !== "alpaca") {
      $("scorecard-status").textContent =
        "Performance statistics are for Alpaca PAPER, not the browser simulator.";
      return;
    }
    if (!privateWorker) {
      $("scorecard-status").textContent =
        "Open the protected Alpaca dashboard to view private performance statistics.";
      return;
    }
    if (!connected) {
      $("scorecard-status").textContent =
        "Connect to Alpaca PAPER to load this scorecard.";
      return;
    }
    if (!stats || !Number.isInteger(stats.observations) || stats.observations < 0) {
      $("scorecard-status").textContent =
        pnlMessage || "Waiting for authenticated Alpaca daily equity data.";
      return;
    }
    const count = stats.observations;
    $("scorecard-count").textContent = count.toLocaleString("en-US");
    $("scorecard-coverage").textContent = count === 1
      ? "One observed daily snapshot" : count + " observed daily snapshots";
    if (Number.isFinite(stats.observed_peak_equity)) {
      $("scorecard-peak").textContent = money(stats.observed_peak_equity);
    }
    if (Number.isFinite(stats.observed_low_equity)) {
      $("scorecard-low").textContent = money(stats.observed_low_equity);
    }
    if (count >= 2 && Number.isFinite(stats.max_observed_drawdown_pct) &&
        stats.max_observed_drawdown_pct >= 0 &&
        Number.isFinite(stats.max_observed_drawdown_usd) &&
        stats.max_observed_drawdown_usd >= 0) {
      $("scorecard-drawdown").textContent =
        "−" + stats.max_observed_drawdown_pct.toFixed(2) + "%";
      if (stats.max_observed_drawdown_pct > 0) {
        $("scorecard-drawdown").classList.add("negative");
      }
      $("scorecard-drawdown-usd").textContent =
        money(stats.max_observed_drawdown_usd) + " largest peak-to-trough drop";
    }
    $("scorecard-status").textContent = count >= 2
      ? "Based on " + count + " daily Alpaca PAPER equity observations; this is raw account-equity drawdown, not cash-flow-adjusted strategy performance."
      : "Not enough Alpaca PAPER observations to calculate a historical drawdown.";
  }

  // Uses the actual TradingView Lightweight Charts v5 standalone browser build,
  // self-hosted on the authenticated Cloudflare Worker (not a third-party CDN).
  function tradingViewAvailable() {
    const lib = window.LightweightCharts;
    return Boolean(lib && lib.createChart && lib.AreaSeries && lib.CandlestickSeries);
  }
  function chartTheme() {
    return {
      autoSize: true,
      layout: { background: { type: "solid", color: "#10242a" },
        textColor: "#a9c3c0", fontFamily: "Inter, system-ui, sans-serif" },
      grid: { vertLines: { color: "#223b40" },
        horzLines: { color: "#223b40" } },
      rightPriceScale: { borderColor: "#35545a" },
      timeScale: { borderColor: "#35545a", timeVisible: false,
        rightOffset: 3, fixLeftEdge: true },
      crosshair: { vertLine: { labelBackgroundColor: "#235145" },
        horzLine: { labelBackgroundColor: "#235145" } },
      handleScroll: true,
      handleScale: true
    };
  }
  function chartDailyData(points, toValue) {
    const unique = new Map();
    for (const point of points) {
      const time = point.time || (Number.isSafeInteger(point.timestamp)
        ? new Date(point.timestamp * 1000).toISOString().slice(0, 10) : null);
      if (!time || !/^\d{4}-\d{2}-\d{2}$/.test(time)) continue;
      const value = toValue(point);
      if (value && Object.values(value).every(Number.isFinite)) {
        unique.set(time, {time, ...value});
      }
    }
    return [...unique.values()].sort((a, b) => a.time.localeCompare(b.time));
  }
  function renderTradingViewPnl(points) {
    const el = $("pnl-lwc");
    if (!tradingViewAvailable() || !window.location.hostname.endsWith(".workers.dev")) return;
    const daily = chartDailyData(points, p => ({value: Number(p.profit_loss)}));
    if (daily.length < 2) return;
    try {
      el.hidden = false;
      if (!tradingViewPnl) {
        const chart = window.LightweightCharts.createChart(el, chartTheme());
        const series = chart.addSeries(window.LightweightCharts.AreaSeries, {
          lineColor: "#69ddb2",
          topColor: "rgba(105,221,178,.4)",
          bottomColor: "rgba(105,221,178,.02)",
          lineWidth: 2,
          priceLineVisible: false
        });
        series.createPriceLine({
          price: 0, color: "#64847f", lineWidth: 1,
          lineStyle: 2, axisLabelVisible: true, title: "Break-even"
        });
        tradingViewPnl = { chart, series };
      }
      const value = daily[daily.length - 1].value;
      tradingViewPnl.series.applyOptions({
        lineColor: value < 0 ? "#f3a3a3" : "#69ddb2",
        topColor: value < 0 ? "rgba(243,163,163,.32)" : "rgba(105,221,178,.4)",
        bottomColor: "rgba(105,221,178,.02)"
      });
      tradingViewPnl.series.setData(daily);
      tradingViewPnl.chart.timeScale().fitContent();
      $("pnl-chart").hidden = true;
    } catch (error) {
      console.warn("TradingView P/L chart could not render; retaining SVG fallback.", error);
      el.hidden = true;
      $("pnl-chart").hidden = false;
    }
  }

  function syncCandleSymbol() {
    if (!watchSymbols.includes(candleSymbol)) candleSymbol = watchSymbols[0] || "";
    const select = $("watch-chart-symbol");
    if (select.options.length !== watchSymbols.length ||
        watchSymbols.some((symbol, index) => select.options[index]?.value !== symbol)) {
      select.replaceChildren();
      for (const symbol of watchSymbols) select.add(new Option(symbol, symbol));
    }
    if (candleSymbol) select.value = candleSymbol;
    select.disabled = !candleSymbol;
  }
  function renderTradingCoach() {
    const status=$("coach-status"),lessons=$("coach-lessons");
    lessons.replaceChildren();
    if(candleRequesting){
      status.textContent="Checking completed historical candles for "+candleSymbol+"…";
      return;
    }
    if(candleError||!Array.isArray(candleBars)||!globalThis.LeviTradingCoach){
      status.textContent=candleError||"Load historical IEX candles on the protected dashboard to see educational observations.";
      return;
    }
    // Avoid treating the current, unfinished trading session as a completed day.
    const dateParts=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",
      year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
    const datePart=key=>dateParts.find(x=>x.type===key)?.value;
    const nyDate=datePart("year")+"-"+datePart("month")+"-"+datePart("day");
    const completed=candleBars.filter(b=>b && typeof b.time==="string" &&
      b.time<nyDate);
    const analysis=globalThis.LeviTradingCoach.analyze(completed);
    if(!analysis.ready){
      status.textContent=analysis.reason;
      return;
    }
    status.textContent=candleSymbol+" · IEX only · "+analysis.sessions+
      " completed daily observations · through "+analysis.asOf+
      " · last close "+money(analysis.lastClose)+
      ". No prediction or trading recommendation.";
    for(const item of analysis.observations){
      const card=document.createElement("div");
      const heading=document.createElement("span");
      heading.textContent=item.title.toUpperCase();
      const fact=document.createElement("strong");
      fact.textContent=item.fact;
      const explain=document.createElement("small");
      explain.textContent=item.explain+" Question to investigate: "+item.question;
      card.append(heading,fact,explain);
      lessons.appendChild(card);
    }
  }
  function renderCandleChart() {
    syncCandleSymbol();
    const privateWorker = window.location.hostname.endsWith(".workers.dev");
    for (const button of document.querySelectorAll("[data-ohlc-range]")) {
      const active = button.dataset.ohlcRange === candleRange;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
      button.disabled = !privateWorker || !candleSymbol;
    }
    const status = $("watch-candle-status");
    if (!privateWorker) {
      status.textContent = "Interactive IEX candles are available in the protected Alpaca dashboard.";
      return;
    }
    if (!tradingViewAvailable()) {
      status.textContent = "TradingView chart library is unavailable; review the Cloudflare build.";
      return;
    }
    if (!candleSymbol) {
      status.textContent = "Add a ticker to your watchlist to view daily candles.";
      return;
    }
    if (candleRequesting) {
      status.textContent = "Loading historical IEX candles for " + candleSymbol + "…";
      return;
    }
    if (candleError) {
      status.textContent = candleError;
      return;
    }
    if (!Array.isArray(candleBars)) {
      status.textContent = "Choose a ticker to load daily IEX candles.";
      return;
    }
    const rows = chartDailyData(candleBars, p => ({
      open: Number(p.open), high: Number(p.high),
      low: Number(p.low), close: Number(p.close)
    })).filter(p => p.low <= Math.min(p.open, p.close, p.high) &&
      p.high >= Math.max(p.open, p.close, p.low) && p.open > 0);
    if (!rows.length) {
      status.textContent = "No eligible IEX daily candles were returned for " + candleSymbol + ".";
      return;
    }
    try {
      const el = $("watch-candle-chart");
      if (!tradingViewCandle) {
        const chart = window.LightweightCharts.createChart(el, chartTheme());
        const series = chart.addSeries(window.LightweightCharts.CandlestickSeries, {
          upColor: "#69ddb2", downColor: "#f3a3a3",
          borderVisible: false,
          wickUpColor: "#69ddb2", wickDownColor: "#f3a3a3"
        });
        tradingViewCandle = { chart, series };
      }
      tradingViewCandle.series.setData(rows);
      tradingViewCandle.chart.timeScale().fitContent();
      status.textContent = candleSymbol + " · " + candleRange +
        " · " + rows.length + " IEX daily candles · " +
        rows[0].time + " to " + rows[rows.length - 1].time +
        ". Scroll to zoom; drag to pan; use crosshair to inspect prices.";
    } catch (error) {
      console.warn("TradingView IEX candlesticks failed to render.", error);
      status.textContent = "Candlestick chart could not render. Refresh and verify the TradingView build.";
    }
  }
  async function loadCandleBars() {
    const privateWorker = window.location.hostname.endsWith(".workers.dev");
    if (!privateWorker || !candleSymbol || !tradingViewAvailable()) {
      renderCandleChart();
      return;
    }
    const token = ++candleRequestToken;
    const symbol = candleSymbol, range = candleRange;
    candleError = "";
    candleBars = null;
    candleRequesting = true;
    renderCandleChart();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 11000);
    try {
      const response = await fetch("/api/market/bars?symbol=" +
        encodeURIComponent(symbol) + "&range=" + encodeURIComponent(range), {
          method:"GET", credentials:"same-origin", cache:"no-store",
          redirect:"error", signal:controller.signal
        });
      if (!response.ok) throw Error("Alpaca bars endpoint returned HTTP " + response.status);
      const result = await response.json();
      if (token !== candleRequestToken) return;
      if (!result || result.connected !== true || result.feed !== "iex" ||
          result.symbol !== symbol || result.range !== range || !Array.isArray(result.bars)) {
        throw Error(result?.reason || "IEX bars unavailable");
      }
      candleBars = result.bars;
      renderTradingCoach();
      if (result.truncated) candleError = "Historical IEX bar range was truncated; try a shorter period.";
    } catch (error) {
      if (token !== candleRequestToken) return;
      candleBars = null;
      candleError = error?.name === "AbortError" ? "IEX candlestick request timed out."
        : "Could not load historical IEX bars: " + String(error?.message || "connection error");
    } finally {
      clearTimeout(timeout);
      if (token === candleRequestToken) {
        candleRequesting = false;
        renderCandleChart();
        renderTradingCoach();
      }
    }
  }

  function renderProfitLoss() {
    const chart = $("pnl-chart");
    const empty = $("pnl-empty");
    chart.hidden = false;
    $("pnl-lwc").hidden = true;
    chart.replaceChildren();
    const privateWorker = window.location.hostname.endsWith(".workers.dev");
    const connected = Boolean(alpacaSnapshot?.connected);
    const paper = accountView === "alpaca";
    if (paper && connected) {
      $("metric-pl").textContent = "Paper brokerage account · not live money";
      $("metric-pl").className = "";
    }
    for (const button of document.querySelectorAll("[data-pnl-range]")) {
      const selected = button.dataset.pnlRange === pnlRange;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", String(selected));
      button.disabled = !privateWorker || !paper || !connected;
    }
    for (const id of ["pnl-value", "pnl-return", "pnl-base"]) {
      $(id).textContent = "—";
      $(id).classList.remove("positive", "negative");
    }
    $("pnl-start-date").textContent = "—";
    $("pnl-end-date").textContent = "—";
    empty.hidden = false;
    let message;
    if (!paper) {
      message = "This chart uses your actual Alpaca PAPER portfolio history. Select Alpaca Paper to view it.";
    } else if (!privateWorker) {
      message = "Paper-account P/L is private. Open your Cloudflare-protected Alpaca dashboard to view its chart.";
    } else if (!connected) {
      message = "Connect to Alpaca PAPER to load your portfolio history.";
    } else if (!pnlHistory || pnlHistory.range !== pnlRange) {
      message = pnlMessage || "Loading Alpaca portfolio history…";
    } else {
      const rows = Array.isArray(pnlHistory.points)
        ? pnlHistory.points.filter(p => Number.isFinite(p?.timestamp) &&
          Number.isFinite(p?.profit_loss) && Number.isFinite(p?.equity))
          .sort((a, b) => a.timestamp - b.timestamp)
        : [];
      if (!rows.length) {
        message = "No Alpaca portfolio-history observations are available for this period yet.";
      } else {
        const last = rows[rows.length - 1];
        const pnl = last.profit_loss;
        const pnlText = (pnl > 0 ? "+" : pnl < 0 ? "−" : "") + money(Math.abs(pnl));
        $("pnl-value").textContent = pnlText;
        $("pnl-value").classList.add(pnl >= 0 ? "positive" : "negative");
        // Mirror the period P/L in the equity card, clearly labeled as PAPER.
        $("metric-pl").textContent = pnlText + " " + pnlRange + " P/L · Alpaca PAPER";
        $("metric-pl").className = pnl >= 0 ? "gain" : "loss";
        if (last.profit_loss_pct !== null && last.profit_loss_pct !== undefined &&
            Number.isFinite(last.profit_loss_pct)) {
          const percent = last.profit_loss_pct * 100;
          $("pnl-return").textContent =
            (percent > 0 ? "+" : "") + percent.toFixed(2) + "%";
          $("pnl-return").classList.add(percent >= 0 ? "positive" : "negative");
        }
        if (Number.isFinite(pnlHistory.base_value)) {
          $("pnl-base").textContent = money(pnlHistory.base_value);
        }
        const dateLabel = timestamp =>
          new Intl.DateTimeFormat("en-US", {
            month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York"
          }).format(new Date(timestamp * 1000));
        $("pnl-start-date").textContent = dateLabel(rows[0].timestamp);
        $("pnl-end-date").textContent = dateLabel(last.timestamp);
        if (rows.length < 2) {
          message = "Only one daily P/L observation is available. The chart will draw a trend when Alpaca reports more history.";
        } else {
          empty.hidden = true;
          message = "Alpaca PAPER · " + rows.length + " daily observations · through " +
            dateLabel(last.timestamp) + ".";
          const ns = "http://www.w3.org/2000/svg";
          const add = (tag, attributes, label) => {
            const el = document.createElementNS(ns, tag);
            for (const [key, value] of Object.entries(attributes)) {
              el.setAttribute(key, String(value));
            }
            if (label !== undefined) el.textContent = label;
            chart.appendChild(el);
            return el;
          };
          const values = rows.map(p => p.profit_loss);
          const min = Math.min(0, ...values);
          const max = Math.max(0, ...values);
          const padding = Math.max(1, (max - min) * 0.12);
          const low = min - padding;
          const high = max + padding;
          const compact = window.matchMedia("(max-width: 600px)").matches;
          const chartWidth = compact ? 390 : 800;
          chart.setAttribute("viewBox", "0 0 " + chartWidth + " 250");
          const left = compact ? 63 : 83;
          const right = chartWidth - 21;
          const top = 19, bottom = 219;
          const x = i => left + (right - left) * i / (rows.length - 1);
          const y = value => bottom - (value - low) / (high - low) * (bottom - top);
          for (let i = 0; i <= 4; i++) {
            const tick = low + (high - low) * (i / 4);
            const py = y(tick);
            add("line", {x1: left, x2: right, y1: py, y2: py, class: "pnl-gridline"});
            add("text", {x: left - 12, y: py + 4, "text-anchor": "end",
              class: "pnl-axis-label"}, (tick < 0 ? "−" : "") +
              "$" + Math.abs(tick).toLocaleString("en-US", {maximumFractionDigits: 0}));
          }
          const zeroY = y(0);
          add("line", {x1: left, x2: right, y1: zeroY, y2: zeroY, class: "pnl-zero"});
          const points = rows.map((row, i) => [x(i), y(row.profit_loss)]);
          const path = points.map(([px, py], i) =>
            (i ? "L" : "M") + px.toFixed(2) + " " + py.toFixed(2)).join(" ");
          const color = pnl >= 0 ? "#69ddb2" : "#f09999";
          add("path", {d: path + " L" + x(rows.length - 1).toFixed(2) +
            " " + zeroY.toFixed(2) + " L" + x(0).toFixed(2) +
            " " + zeroY.toFixed(2) + " Z", fill: color, class: "pnl-area"});
          add("path", {d: path, stroke: color, class: "pnl-line"});
          const dot = add("circle", {
            cx: x(rows.length - 1), cy: y(pnl), r: 5.5, fill: color, class: "pnl-dot"
          });
          const title = document.createElementNS(ns, "title");
          title.textContent = dateLabel(last.timestamp) + ": " + pnlText +
            " period P/L in Alpaca PAPER";
          dot.appendChild(title);
          chart.setAttribute("aria-label", pnlRange + " Alpaca paper P/L: " +
            pnlText + " as of " + dateLabel(last.timestamp) +
            ", based on " + rows.length + " daily observations.");
          renderTradingViewPnl(rows);
        }
      }
    }
    empty.textContent = message;
    $("pnl-status").textContent = message;
    renderPerformanceScorecard();
  }

  async function loadProfitLoss() {
    if (!window.location.hostname.endsWith(".workers.dev") || !alpacaSnapshot?.connected) {
      return;
    }
    const currentRequest = ++pnlRequestToken;
    const selectedRange = pnlRange;
    pnlHistory = null;
    pnlMessage = "Loading Alpaca PAPER " + selectedRange + " history…";
    renderProfitLoss();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 11000);
    try {
      const response = await fetch("/api/alpaca/history?range=" +
        encodeURIComponent(selectedRange), {
          method: "GET", credentials: "same-origin", cache: "no-store",
          redirect: "error", signal: controller.signal
        });
      if (!response.ok) throw Error("Portfolio history request returned HTTP " + response.status);
      const result = await response.json();
      if (currentRequest !== pnlRequestToken || selectedRange !== pnlRange) return;
      if (!result || result.connected !== true || result.mode !== "paper" ||
          result.range !== selectedRange || !Array.isArray(result.points)) {
        pnlMessage = result?.message || "Alpaca paper history is unavailable.";
        pnlHistory = null;
      } else {
        pnlHistory = result;
        pnlMessage = "";
      }
    } catch (error) {
      if (currentRequest !== pnlRequestToken || selectedRange !== pnlRange) return;
      pnlHistory = null;
      pnlMessage = error?.name === "AbortError"
        ? "Alpaca history request timed out; refresh to retry."
        : "Could not load Alpaca portfolio history. Check the private connection and try again.";
    } finally {
      clearTimeout(timeout);
      if (currentRequest === pnlRequestToken) renderProfitLoss();
    }
  }

  function renderFills() {
    const privateWorker = window.location.hostname.endsWith(".workers.dev");
    const connected = privateWorker && Boolean(alpacaSnapshot?.connected);
    $("fills-private-link").hidden = privateWorker;
    $("fills-refresh").disabled = !connected || fillsLoading;
    $("fills-more").hidden = !connected || fillsLoading || !fillCursor;
    $("fills-more").disabled = !connected || fillsLoading;
    $("fills-summary").textContent = connected
      ? "Verified Alpaca PAPER execution fills · read-only brokerage history"
      : privateWorker
        ? "Connect your Alpaca PAPER account to view verified executions."
        : "Account history is private. Open the protected Alpaca dashboard to see it.";

    const tbody = $("fills-rows");
    if (!connected || !fillRows.length) {
      const message = !connected
        ? "No private brokerage history is displayed on this page."
        : fillsLoading
          ? "Loading Alpaca executions…"
          : fillsError || (fillsLoaded
            ? "No fills found in this Alpaca PAPER account."
            : "Trade history has not loaded yet.");
      tbody.innerHTML = '<tr><td class="empty" colspan="7">' +
        escapeHTML(message) + '</td></tr>';
    } else {
      tbody.innerHTML = fillRows.map(fill => {
        const when = new Date(fill.time);
        const date = Number.isFinite(when.valueOf())
          ? new Intl.DateTimeFormat("en-US", {
            month: "short", day: "numeric", year: "numeric",
            hour: "numeric", minute: "2-digit", timeZone: "America/New_York"
          }).format(when) : "—";
        const side = fill.side === "sell" ? "sell" : "buy";
        const qty = Number(fill.qty);
        const price = Number(fill.price);
        const amount = Number(fill.notional);
        const quantityText = Number.isFinite(qty)
          ? qty.toLocaleString("en-US", {maximumFractionDigits:8}) : "—";
        return '<tr><td>' + escapeHTML(date) + '</td><td class="fills-symbol">' +
          escapeHTML(fill.symbol) + '</td><td><span class="fills-side ' + side +
          '">' + side.toUpperCase() + '</span></td><td>' +
          escapeHTML(quantityText) + '</td><td>' +
          (Number.isFinite(price) ? money(price) : "—") + '</td><td>' +
          (Number.isFinite(amount) ? money(amount) : "—") + '</td><td class="fills-type">' +
          (fill.type === "partial_fill" ? "Partial" : "Fill") + '</td></tr>';
      }).join("");
    }
    $("fills-status").textContent = fillsLoading
      ? "Loading Alpaca PAPER executions…"
      : fillsError || (!connected
        ? "Only authenticated Alpaca PAPER account data is shown here."
        : fillsLoaded
          ? (fillRows.length ? "Showing " + fillRows.length +
              " execution" + (fillRows.length === 1 ? "" : "s") +
              (fillCursor ? " · older fills available." : " · end of available history.")
            : "No executed orders reported yet. New paper fills will appear here.")
          : "Open this tab to load verified Alpaca fills.");
  }

  async function loadFills(older = false) {
    const privateWorker = window.location.hostname.endsWith(".workers.dev");
    if (!privateWorker || !alpacaSnapshot?.connected || fillsLoading) return;
    const cursor = older ? fillCursor : null;
    if (older && !cursor) return;
    fillsLoading = true;
    fillsError = "";
    const requestId = ++fillsRequestToken;
    if (!older) {
      fillRows = [];
      fillCursor = null;
      fillsLoaded = false;
    }
    renderFills();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 11000);
    try {
      const response = await fetch("/api/alpaca/fills" +
        (cursor ? "?page_token=" + encodeURIComponent(cursor) : ""), {
          method: "GET", credentials: "same-origin", cache: "no-store",
          redirect: "error", signal: controller.signal
        });
      if (!response.ok) throw Error("Trade history endpoint returned HTTP " + response.status);
      const data = await response.json();
      if (requestId !== fillsRequestToken) return;
      if (!data || data.connected !== true || data.mode !== "paper" ||
          !Array.isArray(data.fills)) {
        throw Error(data?.message || "Trade history unavailable.");
      }
      fillRows = older ? fillRows.concat(data.fills) : data.fills.slice();
      // Bound the in-memory history: avoid unlimited loads on mobile.
      fillCursor = fillRows.length < 500 &&
        typeof data.next_page_token === "string" &&
        data.next_page_token.length <= 256 &&
        /^[a-zA-Z0-9:._-]+$/.test(data.next_page_token) &&
        data.next_page_token !== cursor ? data.next_page_token : null;
      fillsLoaded = true;
    } catch (error) {
      if (requestId !== fillsRequestToken) return;
      fillsError = error?.name === "AbortError"
        ? "The Alpaca request timed out. Refresh to retry."
        : "Unable to load trade history. " + String(error?.message || "");
      if (!older) fillsLoaded = false;
    } finally {
      clearTimeout(timeout);
      if (requestId === fillsRequestToken) {
        fillsLoading = false;
        renderFills();
      }
    }
  }


  function validWatchSymbol(input) {
    const symbol = String(input || "").trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol)) {
      throw Error("Use a valid stock or ETF ticker (letters, numbers, periods or hyphens).");
    }
    return symbol;
  }
  function loadWatchSymbols() {
    try {
      const saved = JSON.parse(localStorage.getItem(WATCHLIST_STORAGE_KEY));
      if (Array.isArray(saved) && saved.length <= WATCHLIST_MAX &&
          saved.every(item => typeof item === "string")) {
        const sanitized = saved.map(validWatchSymbol);
        if (new Set(sanitized).size === sanitized.length) watchSymbols = sanitized;
      }
    } catch {
      // A missing or corrupted saved list falls back to the starter list.
    }
  }
  function saveWatchSymbols() {
    try {
      localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchSymbols));
    } catch {
      feedback("watch-feedback", "This browser cannot save your watchlist permanently.", true);
    }
  }
  function formatIexPrice(value) {
    const n = Number(value);
    if (value === null || value === undefined || !Number.isFinite(n) || n <= 0) return "—";
    return n.toLocaleString("en-US", {style: "currency", currency:"USD",
      minimumFractionDigits:2, maximumFractionDigits:n < 1 ? 4 : 2});
  }
  function formatIexTime(iso) {
    const time = Date.parse(String(iso || ""));
    if (!Number.isFinite(time)) return {text:"—", stale:false};
    const label = new Intl.DateTimeFormat("en-US", {timeZone:"America/New_York",
      month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(time));
    return {text:label, stale:Date.now() - time > 5 * 60 * 1000};
  }
  function renderWatchlist() {
    syncCandleSymbol();
    const worker = window.location.hostname.endsWith(".workers.dev");
    $("watch-private-link").hidden = worker;
    $("watch-refresh").disabled = !worker || watchFetching || watchSymbols.length === 0;
    const count = watchSymbols.length;
    $("watch-poll-state").textContent = worker
      ? "Refreshes every 60 seconds while this view is visible · IEX only"
      : "Sign in to the protected Worker for live IEX snapshots";
    $("watch-refresh-state").textContent = watchFetching
      ? "Refreshing IEX snapshots…"
      : watchRefreshTime
        ? "Last request: " + new Intl.DateTimeFormat("en-US", {timeZone:"America/New_York",
          hour:"numeric",minute:"2-digit",second:"2-digit"}).format(watchRefreshTime) + " ET"
        : "Snapshots not loaded yet";
    if (watchError) {
      feedback("watch-feedback", watchError, true);
    } else {
      feedback("watch-feedback",
        count + " / " + WATCHLIST_MAX + " symbols. Saved locally in this browser. " +
        "Data is IEX-only, not consolidated market coverage.");
    }
    if (!count) {
      $("watch-rows").innerHTML = '<tr><td colspan="8" class="empty">Your watchlist is empty. Add a ticker to begin.</td></tr>';
      return;
    }
    $("watch-rows").innerHTML = watchSymbols.map(symbol => {
      const snap = worker ? watchSnapshots.get(symbol) : null;
      const lastPrice = snap?.available ? formatIexPrice(snap.last_trade) : "—";
      const changeValue = snap?.change;
      const delta = changeValue === null || changeValue === undefined ||
        !Number.isFinite(changeValue) ? "—" :
        (changeValue > 0 ? "+" : changeValue < 0 ? "−" : "") +
        (changeValue === 0 ? "$0.00" : formatIexPrice(Math.abs(changeValue)));
      const pct = Number.isFinite(snap?.change_percent) ?
        " (" + (snap.change_percent > 0 ? "+" : "") +
        snap.change_percent.toFixed(2) + "%)" : "";
      const direction = Number.isFinite(changeValue)
        ? changeValue >= 0 ? "positive" : "negative" : "";
      const time = formatIexTime(snap?.trade_time);
      const quoteTime = formatIexTime(snap?.quote_time);
      const noTrade = worker && watchRefreshTime && snap?.last_trade == null;
      const note = noTrade ? '<span class="watch-stale">No IEX trade available</span>' :
        time.stale ? '<span class="watch-stale">Earlier trade · check timestamp</span>' : "";
      const quoteNote = quoteTime.stale
        ? '<span class="watch-stale">Earlier quote</span>' : "";
      return '<tr><td class="watch-symbol">' + escapeHTML(symbol) + '</td>' +
        '<td>' + lastPrice + (snap?.last_trade == null ? note : "") + '</td>' +
        '<td class="watch-delta ' + direction + '">' + delta + pct + '</td>' +
        '<td>' + formatIexPrice(snap?.bid) + '</td>' +
        '<td>' + formatIexPrice(snap?.ask) + '</td>' +
        '<td class="watch-quote-time">' + escapeHTML(time.text) +
        (snap?.last_trade != null ? note : "") + '</td>' +
        '<td class="watch-quote-time">' + escapeHTML(quoteTime.text) + quoteNote + '</td>' +
        '<td><button class="watch-remove" type="button" data-watch-remove="' +
        escapeHTML(symbol) + '" aria-label="Remove ' +
        escapeHTML(symbol) + ' from watchlist">Remove</button></td></tr>';
    }).join("");
  }

  async function loadWatchlist(force = false) {
    const worker = window.location.hostname.endsWith(".workers.dev");
    if (!worker || watchFetching || !watchSymbols.length) return;
    // A one-call batch request is much cheaper than one call per ticker.
    if (!force && watchRefreshTime && Date.now() - watchRefreshTime.getTime() < 15000) return;
    const generation = ++watchGeneration;
    const symbolsAtRequest = watchSymbols.slice();
    watchFetching = true;
    watchError = "";
    renderWatchlist();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch("/api/market/watchlist?symbols=" +
        encodeURIComponent(symbolsAtRequest.join(",")), {
        method: "GET", credentials: "same-origin", cache:"no-store",
        redirect: "error", signal: controller.signal
      });
      if (!response.ok) throw Error("HTTP " + response.status);
      const result = await response.json();
      if (generation !== watchGeneration) return;
      if (result?.connected !== true || result?.feed !== "iex" ||
          !Array.isArray(result.symbols)) {
        throw Error(result?.reason || "Alpaca IEX market data unavailable");
      }
      watchSnapshots = new Map(result.symbols
        .filter(item => item && symbolsAtRequest.includes(item.symbol))
        .map(item => [item.symbol,item]));
      watchRefreshTime = new Date();
    } catch (error) {
      if (generation !== watchGeneration) return;
      watchError = "Could not refresh IEX data (" +
        (error?.name === "AbortError" ? "timeout" : String(error?.message || "connection error")) +
        "). Existing prices are cleared to avoid presenting them as fresh.";
      watchSnapshots = new Map();
      watchRefreshTime = null;
    } finally {
      clearTimeout(timeout);
      if (generation === watchGeneration) {
        watchFetching = false;
        renderWatchlist();
      }
    }
  }

  function currentNYTradingDate() {
    const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",
      year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
    const get=type=>parts.find(x=>x.type===type)?.value;
    return get("year")+"-"+get("month")+"-"+get("day");
  }
  function renderRadarContext() {
    const target=$("radar-results");
    if(!latestRadarFindings)return;
    target.replaceChildren();
    if(latestRadarSymbols!==watchSymbols.join(",")){
      const warning=document.createElement("p");warning.className="muted";
      warning.textContent="Watchlist changed since the scan. Run Market Radar again for current selections.";
      target.append(warning);
      return;
    }
    const engine=globalThis.LeviCatalystContext;
    const eventEngine=globalThis.LeviMarketEvents;
    const earningsEngine=globalThis.LeviEarningsEducation;
    const today=currentNYTradingDate();
    // Only a successfully retrieved agency replaces its snapshot;
    // an unavailable source retains the dated, explicitly labeled fallback.
    const allMacro=eventEngine?eventEngine.events.map(e=>({...e,source:"snapshot"})):[];
    if(officialEvents?.sources){
      for(const source of officialEvents.sources){
        if(source.status!=="fresh")continue;
        for(let i=allMacro.length-1;i>=0;i--){
          if(allMacro[i].agency===source.agency)allMacro.splice(i,1);
        }
        for(const event of source.events)allMacro.push(event);
      }
    }
    const earnings=earningsEngine?earningsEngine.confirmed.slice():[];
    const match=earningsRequestedSymbols===watchSymbols.join(",") &&
      earningsResult?.status==="fetched" ? earningsResult.events:[];
    for(const event of match){
      // Forecast dates are not issuer confirmations. Attach a source reference
      // or a relevant issuer research page, never an untrusted upstream URL.
      earnings.push({...event,
        url:earningsEngine?.investorRelations[event.symbol]||
          "https://www.alphavantage.co/documentation/"});
    }
    for(const result of latestRadarFindings){
      const box=document.createElement("div");
      const title=document.createElement("span");
      title.textContent=result.symbol+" · "+(result.ready?result.asOf:"DATA UNAVAILABLE");
      const strong=document.createElement("strong");
      strong.textContent=result.ready?
        result.flags+" observation(s) · "+result.attention:result.reason;
      box.append(title,strong);
      if(result.ready){
        const context=document.createElement("small");
        context.textContent="Completed IEX close "+formatIexPrice(result.lastClose)+
          " · "+(result.movePct>=0?"+":"")+result.movePct.toFixed(2)+
          "% session move. "+(result.quiet||"");
        box.append(context);
        for(const observation of result.findings){
          const note=document.createElement("small");
          note.textContent=observation.title+". "+observation.evidence+" "+
            observation.explain+" Investigate: "+observation.question;
          box.append(note);
        }
        const heading=document.createElement("span");
        heading.textContent="CATALYST CONTEXT · TEMPORAL ASSOCIATIONS ONLY";
        box.append(heading);
        const analysis=engine?.context(result,allMacro,earnings,today);
        if(analysis?.ready && analysis.items.length){
          for(const event of analysis.items){
            const line=document.createElement("small");
            const source=event.sourceLevel==="issuer_confirmed"?"COMPANY CONFIRMED":
              event.sourceLevel==="provider_estimate"?"THIRD-PARTY ESTIMATE":
              event.sourceLevel==="official_feed"?"OFFICIAL FEED":"DATED SNAPSHOT";
            const when=event.relation==="upcoming_seven_calendar_days"?"UPCOMING":
              event.relation==="same_calendar_date_time_unverified"?"SAME DATE":
              "EARLIER DATE";
            line.textContent=when+" · "+event.date+" · "+
              (event.scope==="marketwide"?"MARKETWIDE":"SAME TICKER")+
              " · "+source+" · "+event.name+". "+event.interpretation+
              " Investigate: "+event.question;
            const a=document.createElement("a");
            a.href=event.url;a.target="_blank";a.rel="noopener noreferrer";
            a.textContent="Verify source ↗";
            box.append(line,a);
          }
          if(analysis.limited){
            const trunc=document.createElement("small");
            trunc.textContent="Additional possible events omitted; see Market Events and original sources.";
            box.append(trunc);
          }
        }else{
          const empty=document.createElement("small");
          empty.textContent="No matching calendar events found in available sources. "+
            "This is not evidence that no catalyst exists; this tool does not search news, "+
            "corporate filings or unscheduled announcements.";
          box.append(empty);
        }
      }
      target.append(box);
    }
  }
  async function scanMarketRadar() {
    if(radarScanning)return;
    const status=$("radar-status"),results=$("radar-results");
    if(!window.location.hostname.endsWith(".workers.dev")){
      status.textContent="Market Radar requires the authenticated Cloudflare dashboard.";
      return;
    }
    if(!globalThis.LeviMarketRadar){
      status.textContent="Market Radar engine not loaded. Refresh the dashboard.";
      return;
    }
    const symbols=watchSymbols.slice();
    if(!symbols.length){
      status.textContent="Add tickers to the watchlist before scanning.";
      return;
    }
    const sequence=++radarSequence;
    radarScanning=true;
    $("radar-scan").disabled=true;
    results.replaceChildren();
    status.textContent="Scanning "+symbols.length+" tickers using completed IEX daily candles…";
    const today=currentNYTradingDate();
    const findings=[];
    let completed=0;
    let unavailable=0;
    // Bounded request concurrency reduces rate-limit pressure. Never persist
    // private market data or forward it to another server.
    async function scanOne(symbol){
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),11000);
      try {
        const response=await fetch("/api/market/bars?symbol="+encodeURIComponent(symbol)+"&range=3M",{
          method:"GET",credentials:"same-origin",cache:"no-store",
          redirect:"error",signal:controller.signal
        });
        if(!response.ok)throw Error("HTTP "+response.status);
        const payload=await response.json();
        if(payload?.connected!==true||payload.feed!=="iex"||
          payload.symbol!==symbol||payload.truncated===true||
          !Array.isArray(payload.bars))throw Error("Incomplete IEX history");
        const completedBars=payload.bars.filter(b=>
          b&&typeof b.time==="string"&&b.time<today);
        return globalThis.LeviMarketRadar.analyze(symbol,completedBars);
      }catch(error){
        return {symbol,ready:false,reason:error?.name==="AbortError"?
          "Request timed out":String(error?.message||"IEX data unavailable")};
      }finally{clearTimeout(timeout);}
    }
    // Two workers maximum, each consuming the next symbol in order.
    let cursor=0;
    const worker=async()=>{
      while(cursor<symbols.length){
        const index=cursor++;
        const result=await scanOne(symbols[index]);
        if(sequence!==radarSequence)return;
        completed++;
        if(!result.ready)unavailable++;
        findings.push(result);
        status.textContent="Scanned "+completed+" / "+symbols.length+" symbols…";
      }
    };
    try{
      await Promise.all([worker(),worker()]);
      if(sequence!==radarSequence)return;
      findings.sort((a,b)=>(b.flags||0)-(a.flags||0)||
        symbols.indexOf(a.symbol)-symbols.indexOf(b.symbol));
      latestRadarFindings=findings;
      latestRadarSymbols=symbols.join(",");
      renderRadarContext();
      // These loaders reuse six-hour session caches, label source failures,
      // and never authorize order placement. The radar results display
      // immediately and update as verified context arrives.
      void refreshMarketEvents(false);
      void refreshWatchlistEarnings(false);
      status.textContent="Scan complete · "+(symbols.length-unavailable)+
        " tickers analyzed · "+unavailable+" unavailable · "+
        findings.reduce((s,x)=>s+(x.flags||0),0)+
        " descriptive observations · last completed daily candles only. "+
        "This snapshot does not update automatically.";
    }finally{
      radarScanning=false;
      $("radar-scan").disabled=false;
    }
  }
  function marketDateET(){
    const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
    const get=x=>parts.find(p=>p.type===x)?.value;
    return get("year")+"-"+get("month")+"-"+get("day");
  }
  const EVENTS_CACHE_KEY="levios-official-events-cache-v1";
  const EVENTS_REFRESH_MS=6*60*60*1000;
  let officialEvents=null,officialEventsLoading=false,officialEventsError="";
  let officialEventsToken=0;
  function validatedOfficialCache(value){
    if(!value||value.version!=="levios-agency-events-v1"||
      !Array.isArray(value.sources)||value.sources.length!==2)return null;
    const names=["BLS","BEA"];
    for(let i=0;i<2;i++){
      const s=value.sources[i];
      if(!s||s.agency!==names[i]||!["fresh","unavailable"].includes(s.status)||
        !Array.isArray(s.events)||s.events.length>80)return null;
      for(const e of s.events){
        if(typeof e?.id!=="string"||typeof e?.name!=="string"||
          typeof e?.agency!=="string"||e.agency!==s.agency||
          typeof e?.date!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(e.date)||
          !["growth","inflation","labor"].includes(e.type)||
          !["BLS","BEA"].includes(e.agency)||
          typeof e.explain!=="string"||typeof e.question!=="string"||
          typeof e.url!=="string"||!["https://www.bls.gov/","https://www.bea.gov/"].some(base=>e.url.startsWith(base)))return null;
      }
    }
    return value;
  }
  function readOfficialCache(){
    try{
      const cache=JSON.parse(sessionStorage.getItem(EVENTS_CACHE_KEY)||"null");
      if(!cache||!Number.isFinite(cache.savedAt)||cache.savedAt>Date.now()+60000 ||
        Date.now()-cache.savedAt>EVENTS_REFRESH_MS)return null;
      const data=validatedOfficialCache(cache.data);
      return data?{data,savedAt:cache.savedAt}:null;
    }catch{return null;}
  }
  async function refreshMarketEvents(force=false){
    if(officialEventsLoading)return;
    const privateWorker=window.location.hostname.endsWith(".workers.dev");
    if(!privateWorker){renderMarketEvents();return;}
    const cache=force?null:readOfficialCache();
    if(cache){officialEvents=cache.data;renderMarketEvents();renderRadarContext();return;}
    const token=++officialEventsToken;
    officialEventsLoading=true;officialEventsError="";
    renderMarketEvents();
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),14000);
    try{
      const response=await fetch("/api/market/events",{
        method:"GET",credentials:"same-origin",cache:"no-store",
        redirect:"error",signal:controller.signal
      });
      if(!response.ok)throw Error("Official calendar endpoint HTTP "+response.status);
      const result=validatedOfficialCache(await response.json());
      if(!result)throw Error("Calendar response did not pass validation.");
      if(token!==officialEventsToken)return;
      officialEvents=result;
      try{sessionStorage.setItem(EVENTS_CACHE_KEY,JSON.stringify({savedAt:Date.now(),data:result}));}catch{}
    }catch(error){
      if(token!==officialEventsToken)return;
      officialEventsError=error?.name==="AbortError"?"Calendar request timed out.":
        String(error?.message||"Calendar request failed.");
      // Never present stale source data as successful current retrieval.
      officialEvents=null;
    }finally{
      clearTimeout(timeout);
      if(token===officialEventsToken){officialEventsLoading=false;renderMarketEvents();renderRadarContext();}
    }
  }
  function renderMarketEvents(){
    const engine=globalThis.LeviMarketEvents;
    const list=$("events-list"),status=$("events-summary");
    list.replaceChildren();
    $("events-sources").replaceChildren();
    if(!engine){status.textContent="Market events schedule module unavailable. Refresh the page.";return;}
    const today=marketDateET();
    const age=engine.snapshotAge(today);
    $("events-freshness").textContent="Federal Reserve schedule: dated snapshot verified "+engine.verifiedOn+
      (age.expired?" (over 60 days old; recheck urgently).":
       age.possiblyStale?" (over 14 days old; verify before relying on it).":
       " (still verify last-minute changes).")+
      " BLS and BEA are retrieved independently through official feeds.";
    const sourceState=$("events-source-status");
    if(!window.location.hostname.endsWith(".workers.dev")){
      sourceState.textContent="Public static copy: stored schedule only. Open your protected Worker for automatic BLS/BEA checks.";
    }else if(officialEventsLoading){
      sourceState.textContent="Contacting BLS and BEA official schedules…";
    }else if(officialEvents){
      const summary=officialEvents.sources.map(s=>s.agency+": "+
        (s.status==="fresh"?"official feed fetched":"feed unavailable; using snapshot"));
      sourceState.textContent=summary.join(" · ")+" · Retrieved "+officialEvents.retrieved_at+
        " · Browser refresh interval 6 hours. Fed remains dated snapshot.";
    }else{
      sourceState.textContent="Live agency feeds have not been verified"+
        (officialEventsError?": "+officialEventsError:" yet.")+
        " Showing stored snapshot dates. No feeds are running in the background.";
    }
    const type=$("events-category").value;
    const fallback=engine.upcoming(today,"all",120);
    const liveSources=new Map(officialEvents?.sources?.map(s=>[s.agency,s])||[]);
    let all=fallback.filter(e=>!["BLS","BEA"].includes(e.agency)||
      liveSources.get(e.agency)?.status!=="fresh");
    for(const s of liveSources.values()){
      if(s.status==="fresh")all=all.concat(s.events);
    }
    const seen=new Set();
    const upcoming=all.filter(e=>{
      if(seen.has(e.id)||e.date<today||
        Date.parse(e.date+"T00:00:00Z")-Date.parse(today+"T00:00:00Z")>120*86400000)return false;
      seen.add(e.id);return type==="all"||e.type===type;
    }).sort((a,b)=>a.date.localeCompare(b.date)||
      String(a.time||"99:99").localeCompare(String(b.time||"99:99")));
    status.textContent=upcoming.length+" scheduled events in the next 120 days · "+
      (type==="all"?"all categories":type)+" · agency-specific provenance and fallback are shown.";
    if(!upcoming.length){
      const empty=document.createElement("p");empty.className="muted";
      empty.textContent="No events available for this filter in the dated snapshot. That does not mean no market events are scheduled; consult the official calendars.";
      list.append(empty);
    }
    for(const event of upcoming){
      const card=document.createElement("div");
      const eyebrow=document.createElement("span");
      const readable=new Intl.DateTimeFormat("en-US",{timeZone:"UTC",month:"short",day:"numeric",year:"numeric"}).format(new Date(event.date+"T12:00:00Z"));
      eyebrow.textContent=event.agency+" · "+(event.source==="live"?"OFFICIAL FEED":"DATED SNAPSHOT")+
        " · "+event.type.toUpperCase()+" · "+readable+
        (event.time?" · "+event.time+" ET":" · exact time not listed");
      const title=document.createElement("strong");title.textContent=event.name;
      const explain=document.createElement("small");explain.textContent=event.explain;
      const question=document.createElement("small");question.textContent="Investigate: "+event.question;
      const a=document.createElement("a");a.href=event.url;a.target="_blank";a.rel="noopener noreferrer";
      a.textContent="Verify on "+event.agency+" official calendar ↗";
      card.append(eyebrow,title,explain,question,a);list.append(card);
    }
    for(const source of engine.sourceLinks){
      const a=document.createElement("a");a.href=source.url;a.target="_blank";
      a.rel="noopener noreferrer";a.className="text-link";a.textContent=source.name+" ↗";
      $("events-sources").append(a);
    }
  }
  // Read-only company earnings education: issuer confirmations are separate
  // from Alpha Vantage forecast dates and are never overwritten by a forecast.
  let earningsResult=null,earningsLoading=false,earningsError="",earningsRequestedSymbols="";
  let earningsRequestToken=0;
  const EARNINGS_CACHE_MS=6*60*60*1000;
  function validEarningsResponse(data){
    if(!data||data.provider!=="Alpha Vantage"||
      !["not_configured","unavailable","fetched"].includes(data.status)||
      !Array.isArray(data.events)||data.events.length>100)return null;
    for(const e of data.events){
      if(typeof e.symbol!=="string"||!/^[A-Z][A-Z0-9.-]{0,9}$/.test(e.symbol)||
        typeof e.date!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(e.date)||
        e.status!=="provider_estimate"||e.provider!=="Alpha Vantage"||
        (e.timing&&!["before_market","after_market","unknown"].includes(e.timing)))return null;
    }
    return data;
  }
  async function refreshWatchlistEarnings(force=false){
    const symbols=watchSymbols.slice();
    const query=symbols.join(",");
    if(!symbols.length){earningsResult=null;renderEarnings();return;}
    if(!window.location.hostname.endsWith(".workers.dev")){renderEarnings();return;}
    if(earningsLoading)return;
    const cacheKey="levios-earnings-v1:"+query;
    if(!force){
      try{
        const cached=JSON.parse(sessionStorage.getItem(cacheKey)||"null");
        if(cached&&Number.isFinite(cached.savedAt)&&
           cached.savedAt<=Date.now()&&Date.now()-cached.savedAt<EARNINGS_CACHE_MS){
          const checked=validEarningsResponse(cached.data);
          if(checked){earningsResult=checked;earningsRequestedSymbols=query;renderEarnings();renderRadarContext();return;}
        }
      }catch{}
    }
    earningsLoading=true;earningsError="";
    earningsRequestedSymbols=query;
    const token=++earningsRequestToken;
    renderEarnings();
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),12500);
    try{
      const response=await fetch("/api/market/earnings?symbols="+encodeURIComponent(query),{
        method:"GET",credentials:"same-origin",cache:"no-store",
        redirect:"error",signal:controller.signal
      });
      if(!response.ok)throw Error("Earnings data returned HTTP "+response.status);
      const checked=validEarningsResponse(await response.json());
      if(!checked)throw Error("Earnings response failed validation");
      if(token!==earningsRequestToken)return;
      earningsResult=checked;
      try{sessionStorage.setItem(cacheKey,JSON.stringify({savedAt:Date.now(),data:checked}));}catch{}
    }catch(error){
      if(token!==earningsRequestToken)return;
      earningsResult=null;
      earningsError=error?.name==="AbortError"?"Earnings request timed out.":
        String(error?.message||"Earnings provider unavailable.");
    }finally{
      clearTimeout(timeout);
      if(token===earningsRequestToken){earningsLoading=false;renderEarnings();renderRadarContext();}
    }
  }
  function renderEarnings(){
    const engine=globalThis.LeviEarningsEducation;
    const list=$("earnings-list"),status=$("earnings-status");
    list.replaceChildren();
    if(!engine){status.textContent="Earnings educational module unavailable.";return;}
    const today=marketDateET();
    const symbols=watchSymbols.filter(s=>s!=="SPY"&&s!=="QQQ");
    const confirmed=engine.forSymbols(symbols,today);
    const forecasts=earningsRequestedSymbols===watchSymbols.join(",")&&
      earningsResult?.status==="fetched"?earningsResult.events.filter(
        e=>symbols.includes(e.symbol)&&e.date>=today):[];
    const confirmedSymbols=new Set(confirmed.map(e=>e.symbol));
    // An issuer announcement takes precedence for the same ticker;
    // do not show a conflicting third-party estimate as confirmed.
    const projected=forecasts.filter(e=>!confirmedSymbols.has(e.symbol));
    const all=confirmed.map(e=>({...e,kind:"confirmed"})).concat(
      projected.map(e=>({...e,kind:"estimate"})))
      .sort((a,b)=>a.date.localeCompare(b.date)||a.symbol.localeCompare(b.symbol));
    if(earningsLoading)status.textContent="Checking optional earnings provider for "+
      symbols.length+" watchlist companies…";
    else if(earningsError)status.textContent=earningsError+
      " Showing company-confirmed announcements and investor research links only.";
    else if(earningsResult?.status==="not_configured")status.textContent=
      "No private ALPHAVANTAGE_API_KEY configured. Showing only individually verified company announcements and investor relations links.";
    else if(earningsResult?.status==="unavailable")status.textContent=
      "Alpha Vantage calendar unavailable or rate-limited. No projected dates will be invented.";
    else if(earningsResult?.status==="fetched")status.textContent=
      "Alpha Vantage calendar checked at "+(earningsResult.fetched_at||"unspecified time")+
      ". Entries are third-party estimates, not company-confirmed dates.";
    else status.textContent="Company announcements verified "+engine.verifiedOn+
      "; optional Alpha Vantage lookup is available only in the private dashboard.";
    for(const event of all){
      const card=document.createElement("div");
      const label=document.createElement("span");
      label.textContent=event.symbol+" · "+event.date+" · "+
        (event.kind==="confirmed"?"COMPANY CONFIRMED":"THIRD-PARTY ESTIMATE");
      const title=document.createElement("strong");
      title.textContent=event.kind==="confirmed"?event.name:
        (event.name||event.symbol)+" · projected earnings date";
      const detail=document.createElement("small");
      detail.textContent=event.kind==="confirmed"?
        "Issuer announcement dated "+event.published+
          ". Conference call "+(event.callTimeET||"time unspecified")+
          " ET; report release time may differ.":
        "Forecast date may change. Fiscal period "+
          (event.fiscalPeriod||"unknown")+
          "; "+(event.timing==="before_market"?"before market":
            event.timing==="after_market"?"after market":"release time unknown")+
          ". Verify on the issuer's investor-relations site.";
      card.append(label,title,detail);
      if(event.kind==="confirmed"){
        const link=document.createElement("a");link.href=event.url;
        link.target="_blank";link.rel="noopener noreferrer";
        link.textContent="View original issuer announcement ↗";
        card.append(link);
      }
      list.append(card);
    }
    if(!all.length){
      const box=document.createElement("div"),title=document.createElement("strong");
      title.textContent="No verified upcoming company events available";
      const note=document.createElement("small");
      note.textContent="No date is not proof that earnings are far away. Check investor relations before acting.";
      box.append(title,note);list.append(box);
    }
    for(const symbol of symbols){
      if(confirmedSymbols.has(symbol))continue;
      const url=engine.investorRelations[symbol];
      if(!url)continue;
      const card=document.createElement("div");
      const label=document.createElement("span");label.textContent=symbol+" · ISSUER RESEARCH";
      const title=document.createElement("strong");title.textContent="Verify next earnings announcement";
      const link=document.createElement("a");link.href=url;link.target="_blank";
      link.rel="noopener noreferrer";link.textContent="Open official investor relations ↗";
      card.append(label,title,link);list.append(card);
    }
    const guide=document.createElement("div");
    const head=document.createElement("span");head.textContent="WHAT TO INVESTIGATE";
    guide.append(head);
    for(const q of engine.questions){
      const prompt=document.createElement("small");
      prompt.textContent="• "+q;guide.append(prompt);
    }
    list.append(guide);
  }
  const HYPOTHESIS_STORAGE_KEY="levios-hypothesis-journal-v1";
  let hypothesisData={version:1,plans:[],reviews:[]};
  function loadHypotheses(){
    try{
      const raw=localStorage.getItem(HYPOTHESIS_STORAGE_KEY);
      hypothesisData=globalThis.LeviHypothesisJournal.sanitize(raw?JSON.parse(raw):null);
    }catch{
      hypothesisData={version:1,plans:[],reviews:[]};
    }
  }
  function saveHypotheses(next){
    try{
      localStorage.setItem(HYPOTHESIS_STORAGE_KEY,JSON.stringify(next));
      hypothesisData=next;
      return true;
    }catch{return false;}
  }
  function renderHypothesisJournal(){
    const list=$("journal-entries"),sel=$("journal-review-id");
    list.replaceChildren();sel.replaceChildren();
    const reviews=new Map(hypothesisData.reviews.map(r=>[r.planId,r]));
    const remaining=hypothesisData.plans.filter(p=>!reviews.has(p.id));
    for(const plan of remaining){
      const opt=document.createElement("option");opt.value=plan.id;
      opt.textContent=plan.symbol+" · "+plan.createdAt.slice(0,10)+" · "+plan.direction;
      sel.append(opt);
    }
    $("journal-review-form").querySelector("button[type=submit]").disabled=!remaining.length;
    $("journal-summary").textContent=hypothesisData.plans.length+
      " hypotheses · "+hypothesisData.reviews.length+" separate reviews · "+
      remaining.length+" awaiting retrospective analysis. Browser-only; not an audit record.";
    if(!hypothesisData.plans.length){
      const empty=document.createElement("p");empty.className="muted";
      empty.textContent="Write the thesis before seeing its outcome, then return to review it later.";
      list.append(empty);
    }
    for(const plan of hypothesisData.plans){
      const card=document.createElement("div"),title=document.createElement("span");
      title.textContent=plan.symbol+" · "+plan.direction.toUpperCase()+" · "+
        plan.createdAt.slice(0,16).replace("T"," ")+" UTC · ORIGINAL PLAN";
      const thesis=document.createElement("strong");thesis.textContent=plan.thesis;
      const details=document.createElement("small");
      details.textContent="Evidence: "+plan.evidence+" | Counterpoint: "+plan.counterpoint+
        " | Invalidation: "+plan.invalidation+" | Review horizon: "+plan.timeHorizon;
      const sizing=document.createElement("small");
      sizing.textContent="Manual reference "+money(plan.referencePrice)+
        " | invalidation "+money(plan.invalidationPrice)+
        " | hypothetical max loss budget "+money(plan.riskBudget)+
        " | difference/share "+money(plan.riskPerShare)+
        " | simplified shares "+(plan.theoreticalShares===null?"not applicable":plan.theoreticalShares)+
        ". No gap, fee, spread or slippage coverage.";
      card.append(title,thesis,details,sizing);
      const outcome=reviews.get(plan.id);
      if(outcome){
        const r=document.createElement("small");
        r.textContent="SEPARATE REVIEW ("+outcome.reviewedAt.slice(0,10)+") · "+
          outcome.grade+" · manual observed price "+money(outcome.reviewPrice)+
          " · hypothetical change "+(outcome.hypotheticalChangePct>=0?"+":"")+
          outcome.hypotheticalChangePct.toFixed(2)+"% · Outcome: "+
          outcome.observation+" · Lesson: "+outcome.lesson;
        card.append(r);
      }else{
        const pending=document.createElement("small");
        pending.textContent="Awaiting review. Original thesis is read-only in the UI.";
        card.append(pending);
      }
      list.append(card);
    }
  }
  function submitHypothesis(event){
    event.preventDefault();
    try{
      const engine=globalThis.LeviHypothesisJournal;
      const id="hyp-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,12);
      const plan=engine.create({
        symbol:$("journal-symbol").value,direction:$("journal-direction").value,
        thesis:$("journal-thesis").value,evidence:$("journal-evidence").value,
        counterpoint:$("journal-counterpoint").value,
        invalidation:$("journal-invalidation").value,timeHorizon:$("journal-horizon").value,
        referencePrice:$("journal-reference").value,invalidationPrice:$("journal-stop").value,
        riskBudget:$("journal-budget").value
      },{id,now:new Date().toISOString()});
      const next=engine.addPlan(hypothesisData,plan);
      if(!saveHypotheses(next))throw Error("Browser storage failed; hypothesis was not recorded.");
      $("journal-form").reset();
      feedback("journal-feedback","Original hypothesis saved. It cannot be edited from this dashboard.");
      renderHypothesisJournal();
    }catch(error){feedback("journal-feedback",String(error?.message||error),true);}
  }
  function submitHypothesisReview(event){
    event.preventDefault();
    try{
      const id=$("journal-review-id").value;
      const plan=hypothesisData.plans.find(p=>p.id===id);
      if(!plan)throw Error("Choose a saved, unreviewed hypothesis.");
      const engine=globalThis.LeviHypothesisJournal;
      const review=engine.review(plan,{
        grade:$("journal-grade").value,reviewPrice:$("journal-review-price").value,
        observation:$("journal-observation").value,lesson:$("journal-lesson").value
      },new Date().toISOString());
      if(!saveHypotheses(engine.addReview(hypothesisData,review)))
        throw Error("Browser storage failed; review was not recorded.");
      $("journal-review-form").reset();
      feedback("journal-review-feedback","Independent review saved; the original plan is unchanged.");
      renderHypothesisJournal();
    }catch(error){feedback("journal-review-feedback",String(error?.message||error),true);}
  }
  function exportHypothesisJournal(){
    const data=JSON.stringify({
      exportedAt:new Date().toISOString(),journal:globalThis.LeviHypothesisJournal.sanitize(hypothesisData)
    },null,2);
    const blob=new Blob([data],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;
    a.download="levios-hypothesis-journal-"+new Date().toISOString().slice(0,10)+".json";
    document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  const PAPER_PLANS_KEY="levios-paper-predictions-v1";
  const PAPER_OUTCOMES_KEY="levios-paper-outcomes-v1";
  let paperPredictions=[],paperOutcomes={},checkingPredictions=false;
  function loadPaperPredictions(){
    try{
      const x=JSON.parse(localStorage.getItem(PAPER_PLANS_KEY)||"[]");
      paperPredictions=Array.isArray(x)?x.filter(p=>p&&p.mode==="PAPER_SIM_ONLY"&&
        typeof p.id==="string"&&/^[A-Z][A-Z0-9.-]{0,9}$/.test(p.symbol)&&
        typeof p.createdAt==="string"&&Number.isFinite(Date.parse(p.createdAt))&&
        Number.isFinite(p.entry)&&Number.isFinite(p.stop)&&Number.isFinite(p.target)&&
        p.stop<p.entry&&p.entry<p.target&&Number.isInteger(p.expiryDays)&&
        p.expiryDays>=1&&p.expiryDays<=60).slice(0,100):[];
    }catch{paperPredictions=[];}
    try{
      const outcomes=JSON.parse(localStorage.getItem(PAPER_OUTCOMES_KEY)||"{}");
      if(outcomes&&typeof outcomes==="object"&&!Array.isArray(outcomes)){
        paperOutcomes={};
        for(const p of paperPredictions){
          const x=outcomes[p.id];
          if(x&&["win","loss","open","waiting","expired","ambiguous","awaiting_data","unverifiable"].includes(x.status)&&
            x.symbol===p.symbol)paperOutcomes[p.id]=x;
        }
      }
    }catch{paperOutcomes={};}
  }
  function savePaperPrediction(event){
    event.preventDefault();
    const status=$("paper-prediction-status");
    try{
      if(paperPredictions.length>=100)throw Error("100-plan limit reached. Export your history before adding more.");
      const plan=globalThis.LeviPaperPredictions.plan({
        symbol:$("paper-plan-symbol").value,
        entry:$("paper-plan-entry").value,
        stop:$("paper-plan-stop").value,
        target:$("paper-plan-target").value,
        expiryDays:$("paper-plan-expiry").value,
        riskBudget:$("paper-plan-risk").value
      },{id:"paper-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,10),
        now:new Date().toISOString()});
      const next=[plan,...paperPredictions];
      localStorage.setItem(PAPER_PLANS_KEY,JSON.stringify(next));
      paperPredictions=next;
      status.textContent="Saved "+plan.symbol+" PAPER prediction. Only future completed daily candles can score it.";
      $("paper-prediction-form").reset();
      renderPaperPredictions();
    }catch(error){status.textContent="Prediction not saved: "+String(error?.message||error);}
  }
  function renderPaperPredictions(){
    const score=$("paper-prediction-score"),rows=$("paper-prediction-records");
    score.replaceChildren();rows.replaceChildren();
    const available=paperPredictions.map(p=>paperOutcomes[p.id]||
      {symbol:p.symbol,status:"unscored",reason:"Not yet checked against completed price data."});
    const x=globalThis.LeviPaperPredictions.stats(available);
    const summary=[["Saved predictions",x.plans],["Resolved wins",x.wins],
      ["Resolved losses",x.losses],["Win rate",x.winRatePct===null?"No resolved trades":x.winRatePct.toFixed(1)+"%"],
      ["Average hypothetical R",x.averageR===null?"—":x.averageR.toFixed(2)+"R"]];
    for(const [label,value] of summary){
      const box=document.createElement("div");
      const name=document.createElement("span");name.textContent=label.toUpperCase();
      const n=document.createElement("strong");n.textContent=String(value);
      box.append(name,n);score.append(box);
    }
    if(!paperPredictions.length){rows.textContent="No predictions yet. Save a PAPER plan to start tracking.";return;}
    for(const p of paperPredictions){
      const result=paperOutcomes[p.id]||{status:"unscored",reason:"Not yet checked."};
      const card=document.createElement("div");
      const label=document.createElement("span");
      label.textContent=p.symbol+" · "+p.createdAt.slice(0,10)+" · PAPER ONLY";
      const headline=document.createElement("strong");headline.textContent=
        String(result.status).replaceAll("_"," ").toUpperCase();
      const details=document.createElement("small");
      details.textContent="Entry $"+p.entry+" · Stop $"+p.stop+" · Target $"+p.target+
        " · Entry window "+p.expiryDays+"d · Planned risk $"+p.riskBudget+
        " · "+p.plannedShares+" theoretical shares.";
      const note=document.createElement("small");note.textContent=result.reason||
        "Simulation only.";
      card.append(label,headline,details,note);
      if(result.status==="win"||result.status==="loss"){
        const calc=document.createElement("small");
        calc.textContent="Approximate result: "+result.rMultiple.toFixed(2)+"R · "+
          result.returnPct.toFixed(2)+"% per share, before costs · "+
          result.entryDate+" to "+result.exitDate;
        card.append(calc);
      }
      rows.append(card);
    }
  }
  async function checkPaperPredictions(){
    const status=$("paper-prediction-status");
    if(checkingPredictions)return;
    if(!window.location.hostname.endsWith(".workers.dev")){
      status.textContent="Open the protected Worker dashboard to check PAPER predictions.";return;
    }
    if(!paperPredictions.length){status.textContent="Save at least one PAPER prediction first.";return;}
    checkingPredictions=true;$("paper-prediction-check").disabled=true;
    let checked=0;
    const today=currentNYTradingDate(),cache=new Map(),next={...paperOutcomes};
    try{
      for(const p of paperPredictions){
        status.textContent="Checking "+(++checked)+" / "+paperPredictions.length+" PAPER predictions…";
        try{
          if(!cache.has(p.symbol)){
            const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),16000);
            try{
              const res=await fetch("/api/market/bars?symbol="+encodeURIComponent(p.symbol)+"&range=3M",{
                method:"GET",credentials:"same-origin",cache:"no-store",redirect:"error",signal:controller.signal
              });
              if(!res.ok)throw Error("History request failed: HTTP "+res.status);
              const payload=await res.json();
              if(payload?.connected!==true||payload.feed!=="iex"||payload.symbol!==p.symbol||
                payload.truncated===true||!Array.isArray(payload.bars))
                throw Error("Completed IEX data unavailable.");
              cache.set(p.symbol,payload.bars);
            }finally{clearTimeout(timer);}
          }
          // Three-month history cannot settle older plans whose early trades are missing.
          const age=(Date.parse(today+"T00:00:00Z")-Date.parse(p.createdAt.slice(0,10)+"T00:00:00Z"))/86400000;
          if(age>75&&!["win","loss","ambiguous"].includes(next[p.id]?.status))
            throw Error("Prediction older than available 3-month research window; insufficient full history.");
          // Never overwrite a resolved result with truncated history or a new incomplete feed.
          const result=globalThis.LeviPaperPredictions.replay(p,cache.get(p.symbol),today);
          if(!["win","loss","ambiguous"].includes(next[p.id]?.status)||
              ["win","loss","ambiguous"].includes(result.status))next[p.id]=result;
        }catch(error){
          if(!next[p.id])next[p.id]={symbol:p.symbol,status:"unverifiable",
            reason:String(error?.message||error)};
        }
      }
      paperOutcomes=next;
      try{localStorage.setItem(PAPER_OUTCOMES_KEY,JSON.stringify(next));}
      catch{status.textContent="Result storage failed. Export your predictions now.";return;}
      renderPaperPredictions();
      status.textContent="Checked "+checked+" plan(s). W/L excludes open, expired, untriggered and ambiguous cases. These are simulated, not Alpaca fills.";
    }finally{checkingPredictions=false;$("paper-prediction-check").disabled=false;}
  }
  function exportPaperPredictions(){
    const data=JSON.stringify({version:1,mode:"PAPER_SIM_ONLY",exportedAt:new Date().toISOString(),
      plans:paperPredictions,outcomes:paperOutcomes},null,2);
    const blob=new Blob([data],{type:"application/json"});
    const url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download="levios-paper-predictions-"+new Date().toISOString().slice(0,10)+".json";
    document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  let decisionBriefRunning=false;
  async function requestDecisionBrief(event){
    event.preventDefault();
    if(decisionBriefRunning)return;
    const output=$("decision-brief-output"),status=$("decision-brief-status");
    output.replaceChildren();
    const symbol=$("decision-brief-symbol").value.trim().toUpperCase();
    if(!/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol)){
      status.textContent="Enter a valid stock ticker.";return;
    }
    if(!window.location.hostname.endsWith(".workers.dev")){
      status.textContent="Open the protected LeviOS dashboard to run this brief.";
      return;
    }
    if(!globalThis.LeviDecisionGuide||!globalThis.LeviDecisionBrief){
      status.textContent="Decision research module unavailable. Refresh the dashboard.";return;
    }
    decisionBriefRunning=true;
    $("decision-brief-form").querySelector("button").disabled=true;
    const today=currentNYTradingDate();
    status.textContent="Checking "+symbol+" against PAPER holdings, IEX history and SEC filings…";
    async function getJSON(url,timeoutMs=18000){
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),timeoutMs);
      try{
        const response=await fetch(url,{method:"GET",cache:"no-store",
          credentials:"same-origin",redirect:"error",signal:controller.signal});
        if(!response.ok)throw Error("Data source returned "+response.status);
        return await response.json();
      }finally{clearTimeout(timer);}
    }
    try{
      const positions=alpacaSnapshot?.connected&&Array.isArray(alpacaSnapshot.positions)?
        alpacaSnapshot.positions:[];
      const equity=Number(alpacaSnapshot?.account?.equity);
      const observed=await Promise.allSettled([
        getJSON("/api/market/bars?symbol="+encodeURIComponent(symbol)+"&range=3M"),
        getJSON("/api/research/sec-financials?symbol="+encodeURIComponent(symbol),24500)
      ]);
      let decision=null;
      if(observed[0].status==="fulfilled"){
        const response=observed[0].value;
        if(response?.connected===true&&response.feed==="iex"&&
           response.symbol===symbol&&response.truncated!==true&&
           Array.isArray(response.bars)){
          const completed=response.bars.filter(b=>typeof b?.time==="string"&&b.time<today);
          decision=globalThis.LeviDecisionGuide.examine({
            symbol,bars:completed,
            holding:positions.find(p=>p.symbol===symbol)||null,
            equity:Number.isFinite(equity)&&equity>0?equity:null,
            holdingsVerified:Boolean(alpacaSnapshot?.connected&&
              Array.isArray(alpacaSnapshot.positions)&&alpacaSnapshot.account),
            asOfLimit:today
          });
        }
      }
      if(!decision)decision={symbol,ready:false};
      let sec=null;
      if(observed[1].status==="fulfilled"){
        const result=observed[1].value;
        if(result?.status==="available"&&result.ticker===symbol&&
          Array.isArray(result.measures)&&result.measures.length<=15&&
          typeof result.sourceUrl==="string"&&
          /^https:\/\/www\.sec\.gov\/Archives\//.test(result.sourceUrl))
          sec=result;
      }
      const latestThesis=hypothesisData.plans.find(p=>p.symbol===symbol)||null;
      const result=globalThis.LeviDecisionBrief.generate({
        symbol,decision,sec,today,thesis:latestThesis
      });
      const flag=document.createElement("span");
      flag.className="decision-action "+(result.tone||"wait");
      flag.textContent=result.action;
      const headline=document.createElement("h3");
      headline.className="decision-headline";headline.textContent=result.headline;
      const next=document.createElement("p");next.className="brief-next";
      next.textContent=result.next;
      const proof=document.createElement("p");proof.className="brief-proof";
      proof.textContent=(result.sourceDate?"IEX close "+result.sourceDate:"Price not verified")+
        (result.secDate?" · SEC annual filing "+result.secDate:" · Recent annual SEC facts unavailable")+
        " · "+(result.held?"Position shown in PAPER account":
          decision.holdingsVerified?"No open PAPER position":"PAPER holdings not verified");
      output.append(flag,headline,next,proof);
      const groups=[
        ["Evidence for",result.bull],
        ["Reasons for caution",result.bear],
        ["Still unknown",result.unknown]
      ];
      const columns=document.createElement("div");columns.className="decision-columns";
      for(const [name,items] of groups){
        const card=document.createElement("div");card.className="decision-column";
        const head=document.createElement("h3");head.textContent=name;card.append(head);
        const selected=items.length?items:["No verified evidence yet."];
        for(const item of selected.slice(0,5)){
          const p=document.createElement("p");p.textContent=item;card.append(p);
        }
        columns.append(card);
      }
      output.append(columns);
      if(result.thesis){
        const original=document.createElement("p");original.className="brief-proof";
        original.textContent="Your saved thesis: "+result.thesis;output.append(original);
      }
      const actions=document.createElement("div");actions.className="button-row";
      const research=document.createElement("button");
      research.type="button";research.className="button secondary";research.textContent="Research financials";
      research.addEventListener("click",()=>{
        $("fund-symbol").value=symbol;showView("research");
      });
      const journal=document.createElement("button");
      journal.type="button";journal.className="button secondary";journal.textContent="Write a trade plan";
      journal.addEventListener("click",()=>{
        $("journal-symbol").value=symbol;showView("journal");
      });
      actions.append(research,journal);output.append(actions);
      if(result.sourceUrl){
        const link=document.createElement("a");link.className="brief-source";
        link.href=result.sourceUrl;link.target="_blank";link.rel="noopener noreferrer";
        link.textContent="Verify SEC financial source ↗";output.append(link);
      }
      status.textContent=result.confidence==="partial"?
        "Brief ready · conditional assessment. Verify quotes and the investment case before acting.":
        "Brief limited · one or more essential data sources were unavailable.";
    }catch(error){
      status.textContent="Decision brief unavailable: "+String(error?.message||error);
      output.replaceChildren();
    }finally{
      decisionBriefRunning=false;
      $("decision-brief-form").querySelector("button").disabled=false;
    }
  }
  function toggleOverviewDetails(){
    const view=$("view-overview"),button=$("overview-more");
    const next=!view.classList.contains("show-advanced");
    view.classList.toggle("show-advanced",next);
    button.setAttribute("aria-pressed",String(next));
    button.textContent=next?"Hide advanced analytics":"Show advanced analytics";
    if(next){renderAccountSummary();}
  }
  let briefingRunning=false,briefingRecords=null,briefingSymbols="";
  function renderDailyBrief(){
    const cards=$("daily-brief-cards");cards.replaceChildren();
    if(!briefingRecords){
      const card=document.createElement("div");
      const title=document.createElement("strong");title.textContent="Start with your current risk.";
      const note=document.createElement("small");note.textContent="Run Review my portfolio for a short action list.";
      card.append(title,note);cards.append(card);return;
    }
    if(briefingSymbols!==watchSymbols.join(",")){
      const message=document.createElement("p");message.className="muted";
      message.textContent="Watchlist changed. Run your portfolio review again.";
      cards.append(message);return;
    }
    const ranked=globalThis.LeviDecisionGuide.summarize(briefingRecords).ready;
    const missing=briefingRecords.filter(r=>!r.ready);
    function makeCard(item){
      const card=document.createElement("div");card.className="brief-priority";
      const label=document.createElement("span");
      label.textContent=item.symbol+" · "+item.asOf;
      const title=document.createElement("strong");title.textContent=item.title;
      const next=document.createElement("small");next.textContent=item.next;
      const more=document.createElement("details");more.className="research-disclosure";
      const summary=document.createElement("summary");summary.textContent="Why this matters";
      const reason=document.createElement("p");reason.textContent=item.why;
      const metrics=document.createElement("p");
      metrics.textContent="IEX close "+formatIexPrice(item.lastClose)+
        " · 20-day average "+formatIexPrice(item.ma20)+
        " · 50-day average "+formatIexPrice(item.ma50)+
        (item.weightPct!==null?" · PAPER exposure "+item.weightPct.toFixed(1)+"%":"");
      const change=document.createElement("p");change.textContent="Reassess when: "+item.changes;
      more.append(summary,reason,metrics,change);
      card.append(label,title,next,more);return card;
    }
    for(const item of ranked.slice(0,3))cards.append(makeCard(item));
    const rest=ranked.slice(3);
    if(rest.length||missing.length){
      const disclosure=document.createElement("details");
      disclosure.className="brief-more-details";
      const summary=document.createElement("summary");
      summary.textContent="Show "+(rest.length+missing.length)+" more ticker"+
        (rest.length+missing.length===1?"":"s");
      disclosure.append(summary);
      for(const item of rest)disclosure.append(makeCard(item));
      for(const item of missing){
        const card=document.createElement("div");
        const label=document.createElement("strong");
        label.textContent=item.symbol+" · Data unavailable";
        const note=document.createElement("small");note.textContent=item.reason;
        card.append(label,note);disclosure.append(card);
      }
      cards.append(disclosure);
    }
    if(!ranked.length&&!missing.length)cards.textContent="No stocks selected.";
  }
  async function runDailyBrief(){
    if(briefingRunning)return;
    const status=$("daily-brief-status");
    if(!window.location.hostname.endsWith(".workers.dev")){
      status.textContent="For private IEX market analysis, open the authenticated Cloudflare dashboard.";
      return;
    }
    if(!globalThis.LeviDecisionGuide){status.textContent="Decision engine unavailable; refresh page.";return;}
    const holdings=alpacaSnapshot?.connected && Array.isArray(alpacaSnapshot.positions)?
      alpacaSnapshot.positions:[];
    const heldSymbols=holdings.map(h=>String(h.symbol||"").toUpperCase())
      .filter(s=>/^[A-Z][A-Z0-9.-]{0,9}$/.test(s));
    const symbols=[...new Set([...heldSymbols,...watchSymbols])].slice(0,12);
    if(!symbols.length){status.textContent="Add a watchlist ticker before analysis.";return;}
    const today=currentNYTradingDate();
    const equity=alpacaSnapshot?.connected?Number(alpacaSnapshot.account?.equity):null;
    const results=new Array(symbols.length);let cursor=0,completed=0;
    briefingRunning=true;$("daily-brief-run").disabled=true;
    status.textContent="Checking "+symbols.length+
      " symbols against completed IEX daily bars. No orders will be submitted.";
    async function one(index){
      const symbol=symbols[index],controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),12000);
      try{
        const response=await fetch("/api/market/bars?symbol="+encodeURIComponent(symbol)+"&range=3M",{
          method:"GET",credentials:"same-origin",cache:"no-store",
          redirect:"error",signal:controller.signal
        });
        if(!response.ok)throw Error("HTTP "+response.status);
        const payload=await response.json();
        if(payload?.connected!==true||payload.feed!=="iex"||
          payload.symbol!==symbol||payload.truncated===true||!Array.isArray(payload.bars))
          throw Error("Missing or incomplete IEX data");
        const complete=payload.bars.filter(x=>typeof x?.time==="string"&&x.time<today);
        return globalThis.LeviDecisionGuide.examine({
          symbol,bars:complete,
          holding:holdings.find(h=>h.symbol===symbol)||null,
          equity:Number.isFinite(equity)&&equity>0?equity:null,
          holdingsVerified:Boolean(alpacaSnapshot?.connected),
          asOfLimit:today
        });
      }catch(error){
        return {symbol,ready:false,reason:error?.name==="AbortError"?
          "Historical prices timed out.":String(error?.message||"History unavailable.")};
      }finally{clearTimeout(timeout);}
    }
    const worker=async()=>{
      while(cursor<symbols.length){
        const index=cursor++;
        results[index]=await one(index);completed++;
        status.textContent="Analyzed "+completed+" / "+symbols.length+" symbols…";
      }
    };
    try{
      await Promise.all([worker(),worker()]);
      briefingRecords=results;
      briefingSymbols=watchSymbols.join(",");
      renderDailyBrief();
      const missing=results.filter(x=>!x.ready).length;
      status.textContent="Research completed for "+(results.length-missing)+
        " / "+results.length+" tickers (PAPER holdings first) · "+missing+" unavailable · "+
        (alpacaSnapshot?.connected?
          "PAPER holdings used for risk review.":
          "PAPER holdings unavailable: hold and concentration guidance cannot be personalized.")+
        " IEX-only historical observations, not real-time buy/sell orders.";
    }finally{briefingRunning=false;$("daily-brief-run").disabled=false;}
  }
  let secLookupRunning=false;
  async function loadSecAnnualFacts(){
    const status=$("sec-status"),panel=$("sec-facts");
    panel.replaceChildren();
    if(secLookupRunning)return;
    if(!window.location.hostname.endsWith(".workers.dev")){
      status.textContent="Open your authenticated LeviOS Worker to fetch SEC filings.";
      return;
    }
    const symbol=$("fund-symbol").value.trim().toUpperCase();
    if(!/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol)){
      status.textContent="Enter a valid ticker first.";
      return;
    }
    secLookupRunning=true;$("sec-fetch").disabled=true;
    status.textContent="Checking the SEC ticker register and annual XBRL filing…";
    const key="levios-sec-annual-v1-"+symbol;
    try{
      let report=null;
      try{
        const cache=JSON.parse(sessionStorage.getItem(key)||"null");
        if(cache&&Number.isFinite(cache.at)&&cache.at<=Date.now()&&
           Date.now()-cache.at<6*60*60*1000&&cache.report?.status==="available"&&
           cache.report.ticker===symbol)report=cache.report;
      }catch{}
      if(!report){
        const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),24000);
        try{
          const response=await fetch("/api/research/sec-financials?symbol="+encodeURIComponent(symbol),{
            method:"GET",credentials:"same-origin",cache:"no-store",redirect:"error",signal:controller.signal
          });
          if(!response.ok)throw Error("SEC Worker request returned "+response.status);
          report=await response.json();
        }finally{clearTimeout(timeout);}
        if(report?.status==="available"){
          try{sessionStorage.setItem(key,JSON.stringify({at:Date.now(),report}));}catch{}
        }
      }
      if(report?.status!=="available"){
        const reason=report?.status==="not_configured"?
          "Cloudflare Worker SEC_USER_AGENT is not configured. Set a private, identifiable contact User-Agent in the Worker secrets.":
          report?.status==="not_found"?"Ticker was not found in the SEC company register.":
          "SEC data unavailable or annual concepts could not be validated. No financial values were invented.";
        status.textContent=reason;
        return;
      }
      if(report.ticker!==symbol||!/^https:\/\/www\.sec\.gov\/Archives\//.test(report.sourceUrl)||
         !/^\d{4}-\d{2}-\d{2}$/.test(report.reportEnd)||
         !report.computed||!Array.isArray(report.measures)||report.measures.length>12)
         throw Error("SEC response did not pass client validation.");
      const header=document.createElement("div");
      const tag=document.createElement("span");
      tag.textContent="SEC 10-K · "+report.ticker+" · "+report.cik+
        " · PERIOD ENDED "+report.reportEnd;
      const title=document.createElement("strong");title.textContent=report.name;
      const note=document.createElement("small");
      note.textContent="SEC accession "+report.accession+" · filed "+
        report.filingDate+" · original XBRL tags, not analyst estimates.";
      header.append(tag,title,note);panel.append(header);
      const values=[
        ["Year-over-year revenue growth","revenueGrowthPct","fund-growth","%"],
        ["Annual operating margin","operatingMarginPct","fund-margin","%"],
        ["Long-term debt/equity proxy","longTermDebtToEquity","fund-debt",""],
        ["Annual FCF","freeCashFlowMillions","fund-fcf"," million USD"]
      ];
      // Clear previous company's inputs; never silently mix data across firms.
      for(const id of ["fund-growth","fund-margin","fund-debt","fund-fcf","fund-pe"])
        $(id).value="";
      for(const [name,field,id,unit] of values){
        const raw=report.computed[field];
        const value=typeof raw==="number"&&Number.isFinite(raw)?raw:null;
        const box=document.createElement("div"),label=document.createElement("span"),
          detail=document.createElement("small");
        label.textContent=name.toUpperCase();
        detail.textContent=value===null?"Unavailable from consistent annual SEC facts.":
          value.toLocaleString("en-US",{maximumFractionDigits:2})+unit+
          " · prefilled from SEC. Verify before using.";
        if(value!==null)$(id).value=String(Number(value.toFixed(8)));
        box.append(label,detail);panel.append(box);
      }
      const link=document.createElement("a");link.href=report.sourceUrl;
      link.target="_blank";link.rel="noopener noreferrer";
      link.textContent="Open SEC source filing archive ↗";panel.append(link);
      const caveats=document.createElement("small");
      caveats.textContent=String(report.caveats||"Annual financials need independent review.");
      panel.append(caveats);
      $("fund-period").value=report.reportEnd;
      $("fund-source").value=report.sourceUrl;
      status.textContent="Loaded historical SEC annual data for "+symbol+
        ". Complete any missing metrics and independently verify a dated P/E before evaluating.";
    }catch(error){
      status.textContent="SEC lookup failed: "+String(error?.message||"unavailable")+
        ". Existing inputs have not been submitted as a recommendation.";
    }finally{secLookupRunning=false;$("sec-fetch").disabled=false;}
  }
  function suggestResearchPeers(){
    const list=$("valuation-peer-options");list.replaceChildren();
    const engine=globalThis.LeviPeerThesis;
    const ticker=$("valuation-first").value.trim().toUpperCase();
    if(!engine||!/^[A-Z][A-Z0-9.-]{0,9}$/.test(ticker)){
      list.textContent="Enter a valid first ticker to inspect candidate peers.";return;
    }
    const options=engine.candidates(ticker);
    if(!options.length){
      list.textContent="No reviewed peer suggestions for "+ticker+
        ". Select a second ticker manually; peer equivalence is not verified.";return;
    }
    const intro=document.createElement("div");
    const title=document.createElement("span");title.textContent="EDITORIAL PEER CANDIDATES · NOT VERIFIED MATCHES";
    const desc=document.createElement("small");
    desc.textContent="Choose a research candidate; then fetch the actual SEC and IEX financial comparison.";
    intro.append(title,desc);list.append(intro);
    for(const item of options){
      const card=document.createElement("div");
      const label=document.createElement("strong");label.textContent=item.ticker;
      const detail=document.createElement("small");
      detail.textContent="Overlap: "+item.overlap+". Important difference: "+item.difference+".";
      const action=document.createElement("button");
      action.type="button";action.className="button secondary";
      action.textContent="Compare with "+item.ticker;
      action.addEventListener("click",()=>{
        $("valuation-second").value=item.ticker;
        $("valuation-status").textContent="Peer "+item.ticker+
          " selected for research. Run Compare financials & valuation to check actual evidence.";
      });
      card.append(label,detail,action);list.append(card);
    }
  }
  function renderComparisonThesis(first,second,comparison){
    const panel=$("valuation-thesis");panel.replaceChildren();
    const engine=globalThis.LeviPeerThesis;
    if(!engine)return;
    const model=engine.thesis(first,second,comparison);
    const sections=[
      ["BULL CASE · HISTORICAL SUPPORTING EVIDENCE",model.bull],
      ["BEAR CASE · OPPOSING EVIDENCE",model.bear],
      ["UNKNOWNS / DATA GAPS",model.unknown],
      ["WHAT TO RESEARCH NEXT",model.researchActions]
    ];
    const heading=document.createElement("div");
    const label=document.createElement("span");
    label.textContent="CONDITIONAL RESEARCH THESIS · "+first.ticker+" VS "+second.ticker;
    const title=document.createElement("strong");
    title.textContent="Build the bull case and challenge it with the bear case";
    heading.append(label,title);panel.append(heading);
    for(const [headingText,items] of sections){
      const container=document.createElement("div");
      const title=document.createElement("span");title.textContent=headingText;
      container.append(title);
      for(const item of items){
        const line=document.createElement("small");
        line.textContent="• "+item;container.append(line);
      }
      panel.append(container);
    }
    const ending=document.createElement("small");ending.textContent=model.conclusion;
    panel.append(ending);
  }
  let valuationBusy=false;
  async function runValuationComparison(event){
    event.preventDefault();
    if(valuationBusy)return;
    const status=$("valuation-status"),results=$("valuation-results");
    results.replaceChildren();$("valuation-thesis").replaceChildren();
    if(!window.location.hostname.endsWith(".workers.dev")){
      status.textContent="Open the authenticated Cloudflare Worker for SEC/IEX valuation research.";
      return;
    }
    const symbols=[$("valuation-first").value,$("valuation-second").value]
      .map(x=>x.trim().toUpperCase());
    if(symbols.some(x=>!/^[A-Z][A-Z0-9.-]{0,9}$/.test(x))||
       symbols[0]===symbols[1]){
      status.textContent="Enter two different valid U.S. equity tickers.";return;
    }
    if(!globalThis.LeviRelativeValuation){
      status.textContent="Valuation engine did not load. Refresh the dashboard.";return;
    }
    valuationBusy=true;
    $("valuation-form").querySelector("button").disabled=true;
    const today=currentNYTradingDate(),rows=[];
    async function getResponse(endpoint){
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),25000);
      try{
        const response=await fetch(endpoint,{
          method:"GET",cache:"no-store",redirect:"error",
          credentials:"same-origin",signal:controller.signal
        });
        if(!response.ok)throw Error("Source request returned HTTP "+response.status);
        return await response.json();
      }finally{clearTimeout(timer);}
    }
    try{
      for(const symbol of symbols){
        status.textContent="Checking SEC annual report and completed IEX prices for "+symbol+"…";
        const sec=await getResponse("/api/research/sec-financials?symbol="+encodeURIComponent(symbol));
        if(sec?.status!=="available"||sec.ticker!==symbol||
           !Array.isArray(sec.measures)||sec.measures.length>15||
           !/^https:\/\/www\.sec\.gov\/Archives\//.test(String(sec.sourceUrl||"")))
          throw Error("SEC financial evidence unavailable or invalid for "+symbol+
            (sec?.status==="not_configured"?". Configure private SEC_USER_AGENT.":"."));
        const price=await getResponse("/api/market/bars?symbol="+encodeURIComponent(symbol)+"&range=1M");
        if(price?.connected!==true||price.feed!=="iex"||price.symbol!==symbol||
           price.truncated===true||!Array.isArray(price.bars))
          throw Error("Completed IEX daily prices unavailable for "+symbol+".");
        const prior=price.bars.filter(b=>typeof b?.time==="string"&&
          b.time<today&&typeof b.close==="number"&&Number.isFinite(b.close)&&b.close>0)
          .sort((a,b)=>a.time.localeCompare(b.time));
        const last=prior.at(-1);
        if(!last)throw Error("No completed positive IEX close for "+symbol+".");
        rows.push(globalThis.LeviRelativeValuation.build({
          sec,priceObservation:{symbol,date:last.time,close:last.close},today
        }));
      }
      const evaluation=globalThis.LeviRelativeValuation.compare(rows[0],rows[1]);
      for(const company of rows){
        const card=document.createElement("div");
        const label=document.createElement("span");
        label.textContent=company.ticker+" · SEC "+company.reportEnd+
          " · IEX "+company.asOf;
        const heading=document.createElement("strong");heading.textContent=company.name;
        const summary=document.createElement("small");
        summary.textContent="IEX reference close "+formatIexPrice(company.price)+
          " · "+(company.ready?
            "Annual share-count valuation proxies available.":
            "Ratio inputs stale or incomplete; valuation multiples withheld.");
        const source=document.createElement("a");source.href=company.sourceUrl;
        source.target="_blank";source.rel="noopener noreferrer";
        source.textContent="Review SEC source ↗";
        card.append(label,heading,summary,source);results.append(card);
      }
      for(const metric of evaluation.items){
        const block=document.createElement("div");
        const label=document.createElement("span");label.textContent=metric.name.toUpperCase();
        const value=document.createElement("strong");
        const display=n=>n===null?"Unavailable":
          n.toLocaleString("en-US",{maximumFractionDigits:2})+
          (metric.name==="Operating margin"||metric.name==="Revenue growth"?"%":"×");
        value.textContent=rows[0].ticker+": "+display(metric.first)+" · "+
          rows[1].ticker+": "+display(metric.second);
        const caveat=document.createElement("small");caveat.textContent=metric.evidence;
        block.append(label,value,caveat);results.append(block);
      }
      renderComparisonThesis(rows[0],rows[1],evaluation);
      const footer=document.createElement("div");
      const warning=document.createElement("small");
      warning.textContent=evaluation.judgment+" "+rows[0].limitations;
      footer.append(warning);results.append(footer);
      status.textContent="Compared "+rows[0].ticker+" and "+rows[1].ticker+
        " · "+(evaluation.aligned?"fiscal periods within 120 days.":
          "fiscal periods differ; comparison withheld.")+
        " All calculations are approximate educational research, not Buy/Hold/Sell advice.";
    }catch(error){
      status.textContent="Comparison unavailable: "+String(error?.message||"source failure")+
        " No valuation estimate was invented.";
      results.replaceChildren();
    }finally{
      valuationBusy=false;$("valuation-form").querySelector("button").disabled=false;
    }
  }
  function submitFundamentalsResearch(event){
    event.preventDefault();
    const summary=$("fund-summary"),results=$("fund-results");
    results.replaceChildren();
    try{
      const e=globalThis.LeviFundamentals;
      if(!e)throw Error("Stock research engine unavailable.");
      const data=e.assess({
        symbol:$("fund-symbol").value.trim().toUpperCase(),
        periodEnd:$("fund-period").value,sourceUrl:$("fund-source").value,
        revenueGrowth:$("fund-growth").value,operatingMargin:$("fund-margin").value,
        debtToEquity:$("fund-debt").value,priceToEarnings:$("fund-pe").value,
        freeCashFlow:$("fund-fcf").value
      },currentNYTradingDate());
      summary.textContent=data.symbol+" · "+data.headline+" · Reporting period "+
        data.periodEnd+" · "+data.favorable+" favorable / "+data.cautions+
        " caution flags across 5 illustrative factors. This is not a stock rating.";
      const intro=document.createElement("div");
      const label=document.createElement("span");label.textContent="NEXT RESEARCH ACTION";
      const what=document.createElement("strong");what.textContent=data.next;
      intro.append(label,what);results.append(intro);
      for(const check of data.checks){
        const box=document.createElement("div"),name=document.createElement("span");
        name.textContent=check.label.toUpperCase()+" · "+
          (check.caution?"CAUTION":check.good?"FAVORABLE":"MIXED");
        const expl=document.createElement("small");expl.textContent=check.explain;
        box.append(name,expl);results.append(box);
      }
      const source=document.createElement("a");source.href=data.sourceUrl;
      source.rel="noopener noreferrer";source.target="_blank";
      source.textContent="Recheck supplied financial document ↗";results.append(source);
      const limitations=document.createElement("small");
      limitations.textContent=data.limitations;results.append(limitations);
      feedback("fund-feedback","Analyzed manually supplied figures. No brokerage orders sent.");
    }catch(error){
      summary.textContent="Research incomplete. No rating or action was generated.";
      feedback("fund-feedback",String(error?.message||error),true);
    }
  }
  function showView(name) {
    const headings = {overview:["Your trading dashboard","Your priorities, portfolio and next research steps."],market:["Market data","Import closing prices and explore historical trends."],research:["Stock Research","Verify financial evidence and investigate valuation, business quality and risks."],strategy:["Strategy testing workbench","Test reproducible strategies with fees, slippage, chronological evaluation and research versions."],trades:["Paper trade journal","Record hypothetical orders, never real Alpaca trades."],journal:["Hypothesis Journal","Record research before the outcome, then attach separate reflective reviews."],fills:["Trade history","Verified executed orders from your Alpaca PAPER brokerage account."],watchlist:["IEX market watchlist","Time-stamped IEX snapshots for your tracked stocks and ETFs."],events:["Market Events Intelligence","Verified agency schedule snapshots and guided macroeconomic research."],settings:["Data & settings","Your simulation data stays in this browser unless you export it."]};
    if (!headings[name]) return;
    document.querySelectorAll(".view").forEach(el => {
      const active = el.id === "view-" + name;
      el.hidden = !active;
      el.classList.toggle("active",active);
    });
    document.querySelectorAll("[data-view]").forEach(el => {
      const active = el.dataset.view === name;
      el.classList.toggle("active",active);
      if (active) el.setAttribute("aria-current","page"); else el.removeAttribute("aria-current");
    });
    $("view-heading").textContent = headings[name][0];
    $("view-description").textContent = headings[name][1];
    document.title = headings[name][0] + " | LeviOS Trading";
    if (name==="journal") renderHypothesisJournal();
    if (name==="overview"){renderAccountSummary();renderDailyBrief();}
    if (name==="market") plotHistory();
    if (name==="events"){renderMarketEvents();renderEarnings();void refreshMarketEvents(false);void refreshWatchlistEarnings(false);}
    if (name === "watchlist") {
      renderWatchlist();
      renderCandleChart();
      renderTradingCoach();
      if (document.visibilityState === "visible") {
        void loadWatchlist(false);
        if (!Array.isArray(candleBars)) void loadCandleBars();
      }
    }
    if (name==="fills") {
      renderFills();
      if (window.location.hostname.endsWith(".workers.dev") &&
          alpacaSnapshot?.connected && !fillsLoaded && !fillsLoading) {
        void loadFills(false);
      }
    }
    window.scrollTo({top:0,behavior:"smooth"});
  }
  function chart(id, rows, key) {
    const svg = $(id);
    svg.replaceChildren();
    if (rows.length < 2) return;
    const values = rows.map(d=>Number(d[key])).filter(Number.isFinite);
    if (values.length<2) return;
    let low=Infinity, high=-Infinity;
    for (const value of values) {low=Math.min(low,value);high=Math.max(high,value);}
    if (high===low) high=low+1;
    const pts = values.map((value,i) => [24+i*752/(values.length-1), 205-(value-low)/(high-low)*170]);
    const ns="http://www.w3.org/2000/svg";
    for(let i=0;i<4;i++) {
      const grid = document.createElementNS(ns,"line");
      grid.setAttribute("x1","24");grid.setAttribute("x2","776");
      grid.setAttribute("y1",String(35+i*57));grid.setAttribute("y2",String(35+i*57));
      grid.setAttribute("class","gridline");
      svg.appendChild(grid);
    }
    const d=pts.map(([x,y],i)=>(i?"L":"M")+x.toFixed(1)+","+y.toFixed(1)).join(" ");
    const area=document.createElementNS(ns,"path");
    area.setAttribute("class","area");
    area.setAttribute("d",d+" L 776,205 L 24,205 Z");
    svg.appendChild(area);
    const line=document.createElementNS(ns,"path");
    line.setAttribute("class","price-line");
    line.setAttribute("d",d);
    svg.appendChild(line);
  }
  function plotHistory() {
    const symbol = $("market-symbol").value;
    const rows = state.prices[symbol] || [];
    $("market-summary").textContent = rows.length ? `${symbol}: ${rows.length.toLocaleString()} daily closes · ${rows[0].date} → ${rows[rows.length-1].date} · Latest ${money(rows[rows.length-1].close)}` : "Import a symbol to display its historical close chart.";
    chart("market-chart",rows,"close");
  }
  function importCsv(file,symbol) {
    if (file.size > 1500000) throw Error("CSV must be smaller than 1.5 MB.");
    return file.text().then(text=>{
      const lines=text.replace(/^\uFEFF/,"").split(/\r?\n/).filter(s=>s.trim());
      if (lines.length < 2) throw Error("CSV is empty.");
      const head=lines[0].split(",").map(x=>x.trim().replace(/^"|"$/g,"").toLowerCase());
      const dateIndex=head.indexOf("date");
      const closeIndex=head.indexOf("close");
      if (dateIndex<0 || closeIndex<0) throw Error("CSV needs date and close headers.");
      if (lines.length-1>MAX_ROWS) throw Error("Limit is 10,000 observations per symbol.");
      const byDate=new Map();
      for (let i=1;i<lines.length;i++) {
        const cells=lines[i].split(",");
        const date=(cells[dateIndex]||"").trim().replace(/^"|"$/g,"");
        const rawClose=(cells[closeIndex]||"").trim().replace(/^"|"$/g,"");
        const close=Number(rawClose);
        if (!validDate(date) || !rawClose || !Number.isFinite(close) || close<=0 || close>=100000000) throw Error("Invalid date or close on CSV row " + (i+1));
        byDate.set(date,{date,close});
      }
      const rows=[...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date));
      const candidate={...state,prices:{...state.prices,[symbol]:rows}};
      if (Object.keys(candidate.prices).length>30) throw Error("Maximum 30 imported tickers per browser.");
      if (!persist(candidate)) throw Error("Unable to save data. Browser storage may be full.");
      render();
      $("market-symbol").value=symbol;
      plotHistory();
      return rows.length;
    });
  }
  function executeTrade(symbol,side,qty) {
    const last = latest(symbol);
    if (!last) throw Error("Import historical prices for this symbol first.");
    if (!Number.isFinite(qty) || qty<=0 || qty>100000) throw Error("Shares must be a positive number up to 100,000.");
    const p=portfolio();
    const notional=round(qty*last.close);
    if (notional<=0) throw Error("Notional is too small.");
    if (side==="BUY" && notional>p.cash+0.00001) throw Error("Insufficient simulated cash.");
    const held=p.holdings.find(h=>h.symbol===symbol)?.qty ?? 0;
    if (side==="SELL" && qty>held+1e-8) throw Error("You cannot sell more shares than your simulated holdings.");
    const trade={id:String(Date.now())+"-"+state.trades.length,at:new Date().toISOString(),symbol,side,qty,price:last.close,notional};
    const candidate={...state,trades:[...state.trades,trade]};
    if (!persist(candidate)) throw Error("Could not save trade to this browser.");
    render();
    return trade;
  }
  function strategyLabelPercent(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) return "—";
    return (value > 0 ? "+" : "") + value.toFixed(2) + "%";
  }
  function strategySettings() {
    return {
      fast: Number($("fast").value),
      slow: Number($("slow").value),
      feeBps: Number($("strategy-fee").value),
      slippageBps: Number($("strategy-slippage").value),
      splitPct: Number($("strategy-split").value)
    };
  }
  function strategySourceInfo() {
    const source = $("strategy-source").value;
    if (source === "iex") {
      const symbol = validWatchSymbol($("strategy-iex-symbol").value);
      if (!iexStrategyRows || iexStrategyTicker !== symbol) {
        throw Error("Load historical Alpaca IEX bars for " + symbol + " first.");
      }
      return {source: "IEX-only Alpaca daily close", symbol, rows: iexStrategyRows};
    }
    const symbol = $("strategy-symbol").value;
    const rows = state.prices[symbol];
    if (!symbol || !Array.isArray(rows)) {
      throw Error("Import a dated CSV in Market Data or choose the fictional DEMO series first.");
    }
    return {
      source: symbol === "DEMO" ? "FICTIONAL DEMO daily close" : "Browser-imported CSV daily close",
      symbol, rows
    };
  }
  function updateStrategySource() {
    const iex = $("strategy-source").value === "iex";
    $("strategy-csv-options").hidden = iex;
    $("strategy-iex-options").hidden = !iex;
    $("strategy-load-iex").disabled = !iex || iexStrategyLoading ||
      !window.location.hostname.endsWith(".workers.dev");
    $("strategy-split-label").textContent = $("strategy-split").value + "%";
    $("strategy-holdout-label").textContent = (100 - Number($("strategy-split").value)) + "%";
    if (iex && !window.location.hostname.endsWith(".workers.dev")) {
      $("strategy-iex-status").textContent = "Historical Alpaca IEX bars require the protected Cloudflare dashboard. The public GitHub Pages edition supports CSV backtests.";
    }
  }
  async function loadStrategyIexHistory() {
    const worker = window.location.hostname.endsWith(".workers.dev");
    if (!worker || iexStrategyLoading) return;
    let symbol;
    try { symbol = validWatchSymbol($("strategy-iex-symbol").value); }
    catch (error) { feedback("backtest-feedback", error.message, true); return; }
    iexStrategyLoading = true;
    updateStrategySource();
    $("strategy-iex-status").textContent = "Loading IEX daily closes for " + symbol + "…";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 11000);
    try {
      const response = await fetch("/api/market/bars?symbol=" +
        encodeURIComponent(symbol) + "&range=1Y", {
          method: "GET", credentials: "same-origin", cache: "no-store",
          redirect: "error", signal: controller.signal
        });
      if (!response.ok) throw Error("IEX history endpoint returned HTTP " + response.status);
      const data = await response.json();
      if (data?.connected !== true || data?.feed !== "iex" ||
          data?.symbol !== symbol || !Array.isArray(data?.bars)) {
        throw Error(data?.reason || "Alpaca historical data unavailable.");
      }
      if (data.truncated) throw Error("The requested period is incomplete because Alpaca paginated the result. Do not use a partial research dataset.");
      // Exclude today's (possibly unfinished) daily candle using market-local time.
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit"
      }).formatToParts(new Date());
      const part = type => parts.find(item => item.type === type)?.value;
      const todayNY = part("year") + "-" + part("month") + "-" + part("day");
      const rows = data.bars
        .filter(bar => bar && validDate(String(bar.time)) &&
          String(bar.time) < todayNY && typeof bar.close === "number" &&
          Number.isFinite(bar.close) && bar.close > 0)
        .map(bar => ({date: bar.time, close: bar.close}))
        .sort((a, b) => a.date.localeCompare(b.date));
      if (rows.length < 30) throw Error("Too few completed IEX daily bars returned for a meaningful split.");
      // Detect duplicates. The strategy engine also checks for them.
      if (new Set(rows.map(row => row.date)).size !== rows.length) {
        throw Error("Alpaca IEX history contained duplicate dates.");
      }
      iexStrategyRows = rows;
      iexStrategyTicker = symbol;
      $("strategy-iex-status").textContent = "Loaded " + rows.length +
        " complete IEX-only closes (" + rows[0].date + " to " +
        rows[rows.length - 1].date + "). No consolidated SIP or dividend adjustment.";
      feedback("backtest-feedback", "IEX research dataset loaded. Adjust parameters, then run a reproducible backtest.");
    } catch (error) {
      iexStrategyRows = null;
      iexStrategyTicker = "";
      const message = error?.name === "AbortError" ? "IEX history request timed out." :
        String(error?.message || "Could not load Alpaca daily history.");
      $("strategy-iex-status").textContent = message;
      feedback("backtest-feedback", message, true);
    } finally {
      clearTimeout(timer);
      iexStrategyLoading = false;
      updateStrategySource();
    }
  }
  function renderStrategyVersions() {
    const tbody = $("strategy-versions");
    if (!strategyVersions.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty">No saved strategy versions yet.</td></tr>';
    } else {
      tbody.innerHTML = [...strategyVersions].reverse().map(run => {
        const settings = run.settings;
        const config = settings.fast + "/" + settings.slow + " MA · " +
          settings.splitPct + "% train · fee " + settings.feeBps +
          "bp / slip " + settings.slippageBps + "bp";
        return '<tr><td><strong>v' + run.version + '</strong></td><td>' +
          escapeHTML(run.savedAt.slice(0,10)) + '</td><td>' +
          escapeHTML(run.symbol + " · " + run.source) + '</td><td>' +
          escapeHTML(config) + '</td><td>' +
          strategyLabelPercent(run.trainReturnPct) + '</td><td>' +
          strategyLabelPercent(run.testReturnPct) + '</td><td>' +
          strategyLabelPercent(run.testHoldPct) + '</td><td><code>' +
          escapeHTML(run.dataHash) + '</code></td></tr>';
      }).join("");
    }
    $("strategy-version-status").textContent = strategyVersions.length +
      " saved version(s) in this browser · next v" + strategyNextVersion +
      " · no connection to broker orders.";
  }
  function loadStrategyVersions() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STRATEGY_LOG_STORAGE_KEY) || "[]");
      if (!Array.isArray(parsed)) return;
      strategyVersions = parsed.slice(-MAX_STRATEGY_VERSIONS).filter(row =>
        row && Number.isInteger(row.version) && row.version > 0 &&
        typeof row.savedAt === "string" && typeof row.symbol === "string" &&
        typeof row.source === "string" && /^[a-f0-9]{8}$/.test(String(row.dataHash)) &&
        row.settings && Number.isFinite(row.trainReturnPct) &&
        Number.isFinite(row.testReturnPct) && Number.isFinite(row.testHoldPct));
      strategyNextVersion = Math.max(0, ...strategyVersions.map(v => v.version)) + 1;
    } catch { strategyVersions = []; strategyNextVersion = 1; }
    renderStrategyVersions();
  }
  // Research approvals are browser-local workflow decisions only.
  // They never change Cloudflare Worker settings or send an Alpaca order.
  function renderValidationOptions(preferred = null) {
    const selector = $("validation-candidate");
    const original = preferred === null ? selector.value : String(preferred);
    selector.replaceChildren(new Option(
      "Select a saved research experiment", ""));
    for (const run of [...strategyVersions].reverse()) {
      selector.add(new Option("v" + run.version + " · " +
        run.symbol + " · " + run.source + " · " +
        run.settings.fast + "/" + run.settings.slow + " MA",
        String(run.version)));
    }
    const valid = [...selector.options].some(option => option.value === original);
    selector.value = valid ? original : "";
    $("validation-review").disabled = !selector.value;
    $("validation-approve").disabled = true;
    renderValidationChampion();
  }
  function validationCandidate() {
    const version = Number($("validation-candidate").value);
    return Number.isSafeInteger(version)
      ? strategyVersions.find(v => v.version === version) ?? null : null;
  }
  function validationContextChampion(candidate) {
    return candidate && globalThis.LeviStrategyValidation
      ? globalThis.LeviStrategyValidation.comparableChampion(
          validationDecisions,candidate) : null;
  }
  function renderValidationChampion() {
    const candidate = validationCandidate();
    const champion = validationContextChampion(candidate);
    $("validation-champion").textContent = !candidate
      ? "Select an experiment to view its matching research champion."
      : champion
        ? "Current research champion for this exact dataset and test protocol: v" +
          champion.version + " · evaluation " +
          strategyLabelPercent(champion.testReturnPct) +
          ". A new candidate must exceed this result without materially worsening drawdown."
        : "No research champion for this exact dataset and test protocol. This candidate will be judged against buy-and-hold plus the other fixed gates.";
  }
  function renderValidationReview() {
    const review = activeValidationReview;
    const badge = $("validation-status-badge");
    const list = $("validation-checks");
    list.replaceChildren();
    badge.classList.remove("eligible", "rejected");
    $("validation-approve").disabled = !review?.eligible;
    if (!review) {
      badge.textContent = "NOT EVALUATED";
      $("validation-summary").textContent =
        "Select a saved experiment and run the fixed validation gates. Manual approval only.";
      const item = document.createElement("li");
      item.textContent = "Validation results and rejection reasons will appear here.";
      list.appendChild(item);
      renderValidationChampion();
      return;
    }
    badge.textContent = review.eligible ? "GATES PASSED" : "REJECTED";
    badge.classList.add(review.eligible ? "eligible" : "rejected");
    const fails = review.checks.filter(check => !check.pass);
    $("validation-summary").textContent = review.eligible
      ? "v" + review.candidateVersion +
        " meets the current research gates. Approval is a separate explicit action, not a deployment or prediction."
      : "v" + review.candidateVersion + " failed " + fails.length +
        " gate" + (fails.length === 1 ? "" : "s") +
        ". Address the specific reasons before considering this strategy.";
    for (const check of review.checks) {
      const item = document.createElement("li");
      item.className = check.pass ? "validation-pass" : "validation-fail";
      item.textContent = (check.pass ? "PASS · " : "FAIL · ") +
        check.explanation;
      list.appendChild(item);
    }
    renderValidationChampion();
  }
  function renderValidationDecisions() {
    const tbody = $("validation-decisions");
    if (!validationDecisions.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty">No saved validation decisions yet.</td></tr>';
    } else {
      tbody.innerHTML = [...validationDecisions].reverse().slice(0,30).map(event => {
        const when = typeof event.at === "string" ? event.at.slice(0,16).replace("T"," ") : "—";
        const decision = event.kind === "approved_research"
          ? "APPROVED RESEARCH" : event.passed ? "GATES PASSED" : "REJECTED";
        const reasons = event.kind === "approved_research"
          ? "Manually approved · " + event.contextKey?.split("|")[3]
          : (event.failedCodes?.length
            ? "Failed: " + event.failedCodes.join(", ") : "All fixed checks passed");
        return '<tr><td>' + escapeHTML(when) + '</td><td>v' +
          escapeHTML(String(event.candidateVersion)) + ' · ' +
          escapeHTML(String(event.symbol || "")) + '</td><td>' +
          escapeHTML(decision) + '</td><td>' +
          escapeHTML(event.baselineVersion ? "v" + event.baselineVersion : "Buy & hold") +
          '</td><td>' + escapeHTML(reasons) + '</td></tr>';
      }).join("");
    }
    $("validation-audit-status").textContent = validationDecisions.length +
      " locally stored research decision(s), newest 30 displayed. Export the research log for a full copy.";
  }
  function saveValidationEvent(event) {
    const next = [...validationDecisions, event].slice(-MAX_VALIDATION_DECISIONS);
    // Persist before updating UI. A failed write must not claim approval.
    localStorage.setItem(VALIDATION_LOG_STORAGE_KEY, JSON.stringify(next));
    validationDecisions = next;
    renderValidationDecisions();
  }
  function loadValidationDecisions() {
    try {
      const stored = JSON.parse(localStorage.getItem(VALIDATION_LOG_STORAGE_KEY) || "[]");
      validationDecisions = Array.isArray(stored)
        ? stored.slice(-MAX_VALIDATION_DECISIONS).filter(row =>
          row && ["review", "approved_research"].includes(row.kind) &&
          typeof row.at === "string" && Number.isSafeInteger(row.candidateVersion) &&
          row.candidateVersion > 0 && typeof row.contextKey === "string" &&
          row.contextKey.length < 512 &&
          (!row.snapshot || (row.snapshot.version === row.candidateVersion &&
            row.snapshot.settings && typeof row.snapshot.dataHash === "string")))
        : [];
    } catch { validationDecisions = []; }
    renderValidationDecisions();
    renderValidationOptions();
    renderValidationReview();
  }
  function runValidationReview() {
    activeValidationReview = null;
    renderValidationReview();
    const candidate = validationCandidate();
    const validator = globalThis.LeviStrategyValidation;
    if (!candidate || !validator) {
      $("validation-summary").textContent =
        "Save a valid research experiment before running approval gates.";
      return;
    }
    const champion = validationContextChampion(candidate);
    const result = validator.evaluate(candidate, champion);
    const record = {
      kind: "review", at: new Date().toISOString(),
      candidateVersion: candidate.version, symbol:candidate.symbol,
      contextKey: result.contextKey || "",
      baselineVersion: result.baselineVersion,
      passed: result.eligible,
      failedCodes: result.checks.filter(check => !check.pass).map(check => check.code),
      policyVersion: validator.version
    };
    try {
      saveValidationEvent(record);
    } catch {
      $("validation-summary").textContent =
        "Could not store the validation review in this browser. No approval was enabled.";
      return;
    }
    activeValidationReview = {
      ...result, candidateVersion:candidate.version,
      candidateSavedAt:candidate.savedAt
    };
    renderValidationReview();
  }
  function approveValidationReview() {
    const candidate = validationCandidate();
    const review = activeValidationReview;
    const validator = globalThis.LeviStrategyValidation;
    if (!candidate || !review?.eligible || !validator ||
        candidate.version !== review.candidateVersion ||
        candidate.savedAt !== review.candidateSavedAt) {
      $("validation-summary").textContent =
        "This review is stale. Re-run the validation gates before approving.";
      $("validation-approve").disabled = true;
      return;
    }
    // Re-check gates against the latest approved champion before persisting.
    const champion = validationContextChampion(candidate);
    const current = validator.evaluate(candidate, champion);
    if (!current.eligible || current.contextKey !== review.contextKey ||
        current.baselineVersion !== review.baselineVersion) {
      activeValidationReview = null;
      renderValidationReview();
      $("validation-summary").textContent =
        "The baseline or validation evidence changed. Re-run the gates before approval.";
      return;
    }
    if (!window.confirm("Approve v" + candidate.version +
        " as a BROWSER-LOCAL RESEARCH champion only? This does NOT place broker orders, deploy strategies, or establish future profitability.")) {
      return;
    }
    const event = {
      kind:"approved_research", at:new Date().toISOString(),
      candidateVersion:candidate.version, symbol:candidate.symbol,
      contextKey:current.contextKey, baselineVersion:current.baselineVersion,
      passed:true, failedCodes:[],
      policyVersion:validator.version,
      snapshot:{...candidate, settings:{...candidate.settings}}
    };
    try {
      saveValidationEvent(event);
    } catch {
      $("validation-summary").textContent =
        "Browser storage failed: no research champion was approved.";
      return;
    }
    activeValidationReview = null;
    renderValidationReview();
    $("validation-summary").textContent =
      "Research champion v" + candidate.version +
      " approved locally. No trading permissions or strategies were deployed.";
    renderValidationChampion();
    showToast("Approved research champion v" + candidate.version + " (browser only)");
  }

  function renderRobustness(result) {
    const tbody = $("robustness-rows");
    try {
      const windows = globalThis.LeviStrategyEngine.evaluationWindows(result);
      tbody.innerHTML = windows.map(w =>
        "<tr><td>Window " + w.window + "</td><td>" +
        escapeHTML(w.startDate + " to " + w.endDate) + "</td><td>" +
        w.observations + "</td><td>" +
        strategyLabelPercent(w.returnPct) + "</td><td>" +
        strategyLabelPercent(w.holdPct) + "</td><td>" +
        strategyLabelPercent(w.excessPctPoints) + "</td><td>" +
        strategyLabelPercent(w.maxDrawdownPct) + "</td><td>" +
        w.executions + "</td></tr>"
      ).join("");
      const winners = windows.filter(w => w.excessPctPoints > 0).length;
      $("robustness-summary").textContent = winners +
        " of 3 windows outperformed buy-and-hold. " +
        "These are contiguous slices of the SAME test, not three independent backtests. " +
        "No refitting, forward evaluation, or trading signals were performed.";
    } catch (error) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty">Insufficient evaluation history for the three-window breakdown.</td></tr>';
      $("robustness-summary").textContent = String(error?.message || "Window breakdown unavailable.") +
        " No values have been estimated or fabricated.";
    }
  }
  function runWalkForwardWorkbench() {
    const status=$("walkforward-status");
    const tbody=$("walkforward-rows");
    try {
      if (!globalThis.LeviStrategyEngine?.walkForward) {
        throw Error("Walk-forward engine unavailable. Refresh the dashboard.");
      }
      const {source,symbol,rows}=strategySourceInfo();
      const analysis=globalThis.LeviStrategyEngine.walkForward(rows,strategySettings());
      tbody.innerHTML=analysis.folds.map(f =>
        "<tr><td>Fold "+f.fold+"</td><td>"+escapeHTML(f.trainEnd)+
        "</td><td>"+escapeHTML(f.evalStart+" to "+f.evalEnd)+
        "</td><td>"+f.fast+"/"+f.slow+
        "</td><td>"+strategyLabelPercent(f.trainingExcessPctPoints)+
        "</td><td>"+strategyLabelPercent(f.returnPct)+
        "</td><td>"+strategyLabelPercent(f.holdPct)+
        "</td><td>"+strategyLabelPercent(f.excessPctPoints)+
        "</td><td>"+strategyLabelPercent(f.maxDrawdownPct)+
        "</td><td>"+f.executions+"</td></tr>"
      ).join("");
      status.textContent=symbol+" · "+source+" · "+analysis.folds.length+
        " chronological folds · "+analysis.positiveFolds+
        " / 3 beat their same-window benchmark · fingerprint "+
        analysis.dataHash+". These results are historical and do not authorize an order.";
    } catch (error) {
      tbody.innerHTML='<tr><td colspan="10" class="empty">No valid walk-forward results. Check the source and history length.</td></tr>';
      status.textContent=String(error?.message||"Walk-forward testing failed.");
    }
  }
  function runStrategyWorkbench() {
    if (!globalThis.LeviStrategyEngine) throw Error("Strategy engine is unavailable. Refresh the page.");
    const {source, symbol, rows} = strategySourceInfo();
    const config = strategySettings();
    const result = globalThis.LeviStrategyEngine.run(rows, config);
    // Re-run the identical dataset under increased modeled execution costs.
    // Minimum 5 bps per cost category ensures a meaningful stress when the
    // ordinary research setting uses 0 bps. Settings above 100 bps cannot be
    // doubled within the engine's validated range; these runs fail closed.
    const stressSettings = {
      ...config,
      feeBps: Math.max(5, config.feeBps * 2),
      slippageBps: Math.max(5, config.slippageBps * 2)
    };
    const stress = stressSettings.feeBps <= 200 &&
      stressSettings.slippageBps <= 200
      ? globalThis.LeviStrategyEngine.run(rows, stressSettings) : null;
    activeStrategyRun = { ...result, source, symbol, stress, stressSettings };
    $("strategy-run-badge").textContent = result.version.toUpperCase();
    $("strategy-train-return").textContent = strategyLabelPercent(result.train.returnPct);
    $("strategy-test-return").textContent = strategyLabelPercent(result.test.returnPct);
    $("strategy-test-benchmark").textContent = strategyLabelPercent(result.test.holdPct);
    $("strategy-test-drawdown").textContent = strategyLabelPercent(result.test.maxDrawdownPct);
    $("strategy-train-window").textContent = result.train.startDate +
      " to " + result.train.endDate;
    $("strategy-test-window").textContent = result.test.startDate +
      " to " + result.test.endDate;
    $("result-return").textContent = strategyLabelPercent(result.full.returnPct);
    $("result-hold").textContent = strategyLabelPercent(result.full.holdPct);
    $("result-dd").textContent = strategyLabelPercent(result.full.maxDrawdownPct);
    $("result-trades").textContent = String(result.executions.length);
    chart("equity-chart", result.curve, "equity");
    renderRobustness(result);
    $("strategy-data-proof").textContent = result.version + " · " +
      symbol + " · " + source + " · " + result.curve.length +
      " observations · training ends " + result.train.endDate +
      " · evaluation begins " + result.splitDate +
      " · data fingerprint " + result.dataHash + ".";
    $("strategy-save").disabled = false;
    feedback("backtest-feedback", "Research run complete. Evaluation is later in time than training; do not tune repeatedly against it and call it unseen.");
    return result;
  }
  function saveStrategyVersion() {
    if (!activeStrategyRun) {
      feedback("backtest-feedback", "Run a backtest before saving a research version.", true);
      return;
    }
    const r = activeStrategyRun;
    const entry = {
      version: strategyNextVersion,
      savedAt: new Date().toISOString(),
      engine: r.version, symbol: r.symbol, source: r.source,
      dataHash: r.dataHash, dataStart: r.dataStart, dataEnd: r.dataEnd,
      splitDate: r.splitDate, settings: {...r.settings},
      trainReturnPct: r.train.returnPct, testReturnPct: r.test.returnPct,
      testHoldPct: r.test.holdPct, testDrawdownPct: r.test.maxDrawdownPct,
      testObservations: r.test.observations, testExecutions: r.test.executions,
      stressTestReturnPct: r.stress?.test?.returnPct ?? null,
      stressTestHoldPct: r.stress?.test?.holdPct ?? null,
      stressFeeBps: r.stress?.settings?.feeBps ?? null,
      stressSlippageBps: r.stress?.settings?.slippageBps ?? null,
      executions: r.executions.length
    };
    const next = [...strategyVersions, entry].slice(-MAX_STRATEGY_VERSIONS);
    try {
      localStorage.setItem(STRATEGY_LOG_STORAGE_KEY, JSON.stringify(next));
      strategyVersions = next;
      strategyNextVersion++;
      renderStrategyVersions();
      renderValidationOptions(entry.version);
      activeValidationReview = null;
      renderValidationReview();
      showToast("Saved reproducible research version v" + entry.version);
    } catch {
      feedback("backtest-feedback", "Browser storage unavailable; export results instead.", true);
    }
  }
  function exportStrategyVersions() {
    const data = JSON.stringify({
      format: "levios-strategy-research-v2",
      generated_at: new Date().toISOString(),
      caveat: "Browser-local self-reported research decisions only. No trading execution, proof of profitability, or audited forward testing.",
      strategy_versions: strategyVersions,
      validation_decisions: validationDecisions,
      validation_policy: globalThis.LeviStrategyValidation?.policy ?? null
    }, null, 2);
    const url = URL.createObjectURL(new Blob([data], {type:"application/json"}));
    const a = document.createElement("a");
    a.href = url;
    a.download = "levios-strategy-experiments.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function addDemoData() {
    if (state.prices.DEMO && !window.confirm("Replace the current fictional DEMO price history?")) return;
    const rows = [];
    let price = 100, day = new Date(Date.UTC(2026,0,2));
    while (rows.length < 180) {
      const weekday = day.getUTCDay();
      if (weekday !== 0 && weekday !== 6) {
        const i = rows.length;
        price = Math.max(10, price + 0.14 + Math.sin(i/8)*0.75 + Math.cos(i/19)*0.32);
        rows.push({date:day.toISOString().slice(0,10),close:round(price)});
      }
      day.setUTCDate(day.getUTCDate()+1);
    }
    const candidate = {...state,prices:{...state.prices,DEMO:rows}};
    if (!persist(candidate)) {feedback("import-feedback","Unable to store sample data in this browser.",true);return;}
    render();
    $("market-symbol").value="DEMO";
    plotHistory();
    feedback("import-feedback","Loaded 180 fictional DEMO observations. These are generated, NOT market prices.");
    showToast("Fictional practice data loaded.");
  }
  // Read-only Alpaca status bridge: the API keys NEVER enter this website.
  // Only a loopback URL or a private Tailscale Serve HTTPS endpoint is allowed.
  const BRIDGE_STORAGE_KEY = "levios-trading-bridge-url";
  function safeBridgeUrl(input) {
    let url;
    try { url = new URL(String(input || "").trim()); }
    catch { throw Error("Enter a valid private bridge address."); }
    const local = url.protocol === "http:" &&
      (url.hostname === "127.0.0.1" || url.hostname === "localhost") && url.port === "8767";
    const worker = url.protocol === "https:" && url.hostname === "levimunk-alpaca.levivanstap.workers.dev" && !url.port;
    const cloudflare = url.protocol === "https:" && url.hostname === "trading-api.levimunk.com" && !url.port;
    const tailnet = url.protocol === "https:" &&
      /^[a-z0-9-]+(?:\.[a-z0-9-]+)+\.ts\.net$/i.test(url.hostname) && url.port === "8443";
    if ((!local && !tailnet && !cloudflare && !worker) || url.username || url.password || (url.pathname !== "/" && url.pathname !== "") || url.search || url.hash) {
      throw Error("Use your protected https://levimunk-alpaca.levivanstap.workers.dev dashboard (or a previously configured private bridge).");
    }
    return url.origin;
  }
  function alpacaMoney(value) {
    if (value === null || value === undefined || value === "" || !Number.isFinite(Number(value))) return "—";
    return money(Number(value));
  }
  function clearAlpacaStatus(message = "Not connected") {
    $("alpaca-connection-badge").textContent = "NOT CONNECTED";
    $("alpaca-connection-badge").classList.remove("connected");
    for (const id of ["alpaca-equity","alpaca-cash","alpaca-buying-power","alpaca-position-count"]) $(id).textContent = "—";
    $("alpaca-position-list").replaceChildren();
    alpacaSnapshot = null;
    fillsRequestToken++;
    fillRows = [];
    fillCursor = null;
    fillsLoaded = false;
    fillsLoading = false;
    fillsError = "";
    renderFills();
    pnlRequestToken++;
    pnlHistory = null;
    pnlMessage = "Alpaca PAPER account disconnected.";
    renderAccountSummary();
    feedback("alpaca-feedback", message);
  }
  function showAlpacaSnapshot(data) {
    if (!data || data.mode !== "paper") throw Error("The endpoint did not return an Alpaca paper account response.");
    if (!data.connected) {
      clearAlpacaStatus(data.message || "The private bridge is reachable, but Alpaca is not connected.");
      return;
    }
    if (!data.account || !Array.isArray(data.positions)) throw Error("Incomplete account response from the private bridge.");
    if (!alpacaSnapshot) accountView = "alpaca";
    alpacaSnapshot = data;
    renderAccountSummary();
    $("alpaca-connection-badge").textContent = "PAPER CONNECTED";
    $("alpaca-connection-badge").classList.add("connected");
    $("alpaca-equity").textContent = alpacaMoney(data.account.equity);
    $("alpaca-cash").textContent = alpacaMoney(data.account.cash);
    $("alpaca-buying-power").textContent = alpacaMoney(data.account.buying_power);
    $("alpaca-position-count").textContent = String(data.positions.length);
    const list = $("alpaca-position-list");
    list.replaceChildren();
    if (!data.positions.length) {
      const p = document.createElement("p");
      p.className = "muted footnote";
      p.textContent = "No open positions in your Alpaca paper account.";
      list.appendChild(p);
    } else {
      const title = document.createElement("p");
      title.className = "eyebrow";
      title.textContent = "OPEN ALPACA PAPER POSITIONS";
      list.appendChild(title);
      for (const position of data.positions.slice(0,30)) {
        const row = document.createElement("div");
        row.className = "broker-position-row";
        const label = document.createElement("span");
        label.textContent = String(position.symbol || "?") + " · " + String(position.qty || "0") + " shares";
        const value = document.createElement("strong");
        value.textContent = alpacaMoney(position.market_value);
        row.append(label,value);
        list.appendChild(row);
      }
      if (data.positions.length > 30) {
        const p = document.createElement("p");
        p.className = "muted footnote";
        p.textContent = "Showing first 30 positions.";
        list.appendChild(p);
      }
    }
    feedback("alpaca-feedback", "Connected to Alpaca PAPER account through your private bridge. Read-only.");
    if ($("view-fills").classList.contains("active") && !fillsLoading) {
      void loadFills(false);
    }
    // Broker history is requested only from the protected same-origin Worker.
    if (window.location.hostname.endsWith(".workers.dev")) void loadProfitLoss();
  }
  async function connectAlpaca() {
    let base;
    try { base = safeBridgeUrl($("alpaca-endpoint").value); }
    catch (err) { clearAlpacaStatus(err.message); return; }
    if (base.endsWith(".workers.dev") && base !== window.location.origin) {
      try {localStorage.setItem(BRIDGE_STORAGE_KEY, base);} catch {}
      // A protected Worker hosts its own same-origin dashboard. The public
      // GitHub Pages site should NOT fetch it using third-party cookies.
      window.open(base + "/", "_blank", "noopener,noreferrer");
      feedback("alpaca-feedback", "Open the protected dashboard tab and sign in. The public page does not load private account data.");
      return;
    }
    feedback("alpaca-feedback", "Checking your private Alpaca paper account…");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 11000);
    try {
      const useCloudflareAccess = base === "https://trading-api.levimunk.com" || base.endsWith(".workers.dev");
      const sameOrigin = base === window.location.origin;
      const response = await fetch(base + "/api/alpaca/status", {method:"GET",cache:"no-store",signal:controller.signal,credentials:sameOrigin?"same-origin":useCloudflareAccess?"include":"omit",redirect:"error"});
      if (!response.ok) throw Error("Private bridge returned HTTP " + response.status + ".");
      const data = await response.json();
      showAlpacaSnapshot(data);
      try {localStorage.setItem(BRIDGE_STORAGE_KEY, base);} catch {}
    } catch (err) {
      clearAlpacaStatus(useCloudflareEndpoint(base)
        ? "Secure Alpaca dashboard unavailable from this page. Open the private dashboard using the link, sign in with Cloudflare Access, and try there."
        : "Could not reach the private bridge. Check Docker or Tailscale access. " + (err.name === "AbortError" ? "(Connection timed out.)" : ""));
    } finally { clearTimeout(timer); }
  }
  function exportData() {
    const payload=JSON.stringify({...state,exportedAt:new Date().toISOString(),source:"LeviOS Trading Lab browser edition"},null,2);
    const url=URL.createObjectURL(new Blob([payload],{type:"application/json"}));
    const a=document.createElement("a");
    a.href=url;a.download="levios-trading-backup-"+new Date().toISOString().slice(0,10)+".json";
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    showToast("Practice-data backup downloaded.");
  }
  document.querySelectorAll("[data-view]").forEach(el=>el.addEventListener("click",()=>showView(el.dataset.view)));
  document.querySelectorAll("[data-go]").forEach(el=>el.addEventListener("click",()=>showView(el.dataset.go)));
  $("market-symbol").addEventListener("change",plotHistory);
  $("btn-demo").addEventListener("click",addDemoData);
  $("import-form").addEventListener("submit",async e=>{
    e.preventDefault();
    try{
      const file=$("csv-file").files[0];
      if(!file)throw Error("Select a CSV file.");
      const symbol=validSymbol($("csv-symbol").value);
      const n=await importCsv(file,symbol);
      feedback("import-feedback","Imported "+n.toLocaleString()+" historical rows for "+symbol+".");
      showToast("Price history imported.");
    }catch(err){feedback("import-feedback",err.message,true);}
  });
  $("trade-form").addEventListener("submit",e=>{
    e.preventDefault();
    try{
      const symbol=$("trade-symbol").value,side=$("trade-side").value,qty=Number($("trade-qty").value);
      const t=executeTrade(symbol,side,qty);
      feedback("trade-feedback",t.side+" "+t.qty+" "+t.symbol+" at "+money(t.price)+" (simulated at imported close).");
      showToast("Simulated trade saved locally.");
    }catch(err){feedback("trade-feedback",err.message,true);}
  });
  $("backtest-form").addEventListener("submit", e => {
    e.preventDefault();
    try { runStrategyWorkbench(); }
    catch (error) {
      activeStrategyRun = null;
      $("strategy-save").disabled = true;
      feedback("backtest-feedback", String(error?.message || "Research run failed."), true);
    }
  });
  $("strategy-source").addEventListener("change", updateStrategySource);
  $("strategy-split").addEventListener("input", updateStrategySource);
  $("strategy-load-iex").addEventListener("click", () => void loadStrategyIexHistory());
  $("walkforward-run").addEventListener("click", runWalkForwardWorkbench);
  $("strategy-save").addEventListener("click", saveStrategyVersion);
  $("strategy-export").addEventListener("click", exportStrategyVersions);
  $("validation-candidate").addEventListener("change", () => {
    activeValidationReview = null;
    renderValidationReview();
  });
  $("validation-review").addEventListener("click", runValidationReview);
  $("validation-approve").addEventListener("click", approveValidationReview);
  $("mode-alpaca").addEventListener("click", () => {
    if (!alpacaSnapshot || !alpacaSnapshot.connected) return;
    accountView = "alpaca";
    renderAccountSummary();
  });
  $("mode-simulator").addEventListener("click", () => {
    accountView = "sim";
    renderAccountSummary();
  });
  function useCloudflareEndpoint(base) {
    return base === "https://trading-api.levimunk.com" || base.endsWith(".workers.dev");
  }
  function updateCloudflareLogin() {
    const button = $("alpaca-auth");
    let base = "";
    try { base = safeBridgeUrl($("alpaca-endpoint").value); } catch {}
    const isPrivateWorker = window.location.hostname.endsWith(".workers.dev");
    button.hidden = !base || (base === window.location.origin && isPrivateWorker);
    if (!button.hidden) button.href = base + "/";
    const connectButton = $("alpaca-connect");
    connectButton.textContent = (base.endsWith(".workers.dev") && base !== window.location.origin)
      ? "Open secure dashboard" : "Connect / Refresh";
  }
  for (const button of document.querySelectorAll("[data-pnl-range]")) {
    button.addEventListener("click", () => {
      if (!["1W", "1M", "3M", "1Y"].includes(button.dataset.pnlRange)) return;
      if (pnlRange === button.dataset.pnlRange) return;
      pnlRange = button.dataset.pnlRange;
      pnlHistory = null;
      pnlMessage = "Loading Alpaca PAPER " + pnlRange + " history…";
      renderProfitLoss();
      void loadProfitLoss();
    });
  }
  window.addEventListener("resize", () => {
    if (pnlHistory?.points?.length > 1 && accountView === "alpaca") renderProfitLoss();
  });
  $("watch-add-form").addEventListener("submit", event => {
    event.preventDefault();
    try {
      const symbol = validWatchSymbol($("watch-symbol-input").value);
      if (watchSymbols.includes(symbol)) throw Error(symbol + " is already being tracked.");
      if (watchSymbols.length >= WATCHLIST_MAX) {
        throw Error("Watchlist limit reached: remove a ticker before adding another.");
      }
      watchSymbols.push(symbol);
      watchGeneration++;
      watchFetching = false;
      saveWatchSymbols();
      $("watch-symbol-input").value = "";
      watchRefreshTime = null;
      renderWatchlist();
      void loadWatchlist(true);
      if ($("view-watchlist").classList.contains("active")) void loadCandleBars();
    } catch (error) {
      feedback("watch-feedback", String(error.message || "Invalid ticker."), true);
    }
  });
  $("watch-rows").addEventListener("click", event => {
    const button = event.target.closest("[data-watch-remove]");
    if (!button) return;
    const symbol = button.dataset.watchRemove;
    if (!watchSymbols.includes(symbol)) return;
    watchSymbols = watchSymbols.filter(item => item !== symbol);
    watchSnapshots.delete(symbol);
    watchGeneration++;
    watchFetching = false;
    watchRefreshTime = null;
    watchError = "";
    saveWatchSymbols();
    renderWatchlist();
    if (watchSymbols.length) void loadWatchlist(true);
    if ($("view-watchlist").classList.contains("active")) void loadCandleBars();
    else candleBars = null;
  });
  $("journal-form").addEventListener("submit",submitHypothesis);
  $("journal-review-form").addEventListener("submit",submitHypothesisReview);
  $("journal-export").addEventListener("click",exportHypothesisJournal);
  $("sec-fetch").addEventListener("click",()=>void loadSecAnnualFacts());
  $("fundamentals-form").addEventListener("submit",submitFundamentalsResearch);
  $("valuation-peer-suggest").addEventListener("click",suggestResearchPeers);
  $("valuation-form").addEventListener("submit",runValuationComparison);
  $("decision-brief-form").addEventListener("submit",e=>void requestDecisionBrief(e));
  $("paper-prediction-form").addEventListener("submit",savePaperPrediction);
  $("paper-prediction-check").addEventListener("click",()=>void checkPaperPredictions());
  $("paper-prediction-export").addEventListener("click",exportPaperPredictions);
  $("overview-more").addEventListener("click",toggleOverviewDetails);
  $("daily-brief-run").addEventListener("click",()=>void runDailyBrief());
  $("events-category").addEventListener("change", renderMarketEvents);
  $("events-refresh").addEventListener("click",()=>void refreshMarketEvents(true));
  $("earnings-refresh").addEventListener("click",()=>void refreshWatchlistEarnings(true));
  $("radar-scan").addEventListener("click", () => void scanMarketRadar());
  $("watch-refresh").addEventListener("click", () => void loadWatchlist(true));
  $("watch-chart-symbol").addEventListener("change", () => {
    candleSymbol = $("watch-chart-symbol").value;
    void loadCandleBars();
  });
  for (const button of document.querySelectorAll("[data-ohlc-range]")) {
    button.addEventListener("click", () => {
      const range = button.dataset.ohlcRange;
      if (!["1M","3M","1Y"].includes(range) || candleRange === range) return;
      candleRange = range;
      void loadCandleBars();
    });
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" &&
        $("view-watchlist").classList.contains("active")) void loadWatchlist(false);
  });
  setInterval(() => {
    if (document.visibilityState === "visible" &&
        $("view-watchlist").classList.contains("active")) void loadWatchlist(false);
  }, 60000);
  $("fills-refresh").addEventListener("click", () => void loadFills(false));
  $("fills-more").addEventListener("click", () => void loadFills(true));
  $("alpaca-endpoint").addEventListener("input", updateCloudflareLogin);
  $("alpaca-connect-form").addEventListener("submit", e => {e.preventDefault();connectAlpaca();});
  $("alpaca-disconnect").addEventListener("click", () => {
    try {localStorage.removeItem(BRIDGE_STORAGE_KEY);} catch {}
    clearAlpacaStatus("Private Alpaca bridge disconnected in this browser.");
    $("alpaca-endpoint").value = window.location.hostname.endsWith(".workers.dev") ? window.location.origin : "";
    updateCloudflareLogin();
  });
  for(const id of ["btn-export","btn-export-top"]) $(id).addEventListener("click",exportData);
  $("backup-file").addEventListener("change",async e=>{
    try{
      const file=e.target.files[0];
      if(!file)return;
      if(file.size>3000000) throw Error("Backup file is too large.");
      const candidate=sanitizeState(JSON.parse(await file.text()));
      if(!window.confirm("Replace this browser's practice portfolio with the imported backup?")) return;
      if(!persist(candidate)) throw Error("Could not save restored data.");
      render();feedback("backup-feedback","Practice-data backup restored.");
      showToast("Backup restored.");
    }catch(err){feedback("backup-feedback",err.message,true);}finally{e.target.value="";}
  });
  $("btn-reset").addEventListener("click",()=>{
    if (!window.confirm("Delete all local simulated trades and imported prices from this browser?")) return;
    if(!persist(emptyState())) {showToast("Could not reset local data.");return;}
    render();showToast("Practice portfolio reset.");
  });
  loadWatchSymbols();
  load();
  loadStrategyVersions();
  loadValidationDecisions();
  loadHypotheses();
  loadPaperPredictions();
  renderPaperPredictions();
  updateStrategySource();
  render();showView("overview");
  renderWatchlist();
  const privateWorker = window.location.hostname.endsWith(".workers.dev");
  $("private-trading-link").hidden = privateWorker;
  if (privateWorker) {
    $("alpaca-endpoint").value = window.location.origin;
  } else {
    try {
      const savedBridgeUrl = localStorage.getItem(BRIDGE_STORAGE_KEY);
      if (savedBridgeUrl) {
        const migratedBridgeUrl = savedBridgeUrl === "https://levimunk-github-io.levivanstap.workers.dev"
          ? "https://levimunk-alpaca.levivanstap.workers.dev" : savedBridgeUrl;
        $("alpaca-endpoint").value = safeBridgeUrl(migratedBridgeUrl);
        if (migratedBridgeUrl !== savedBridgeUrl) localStorage.setItem(BRIDGE_STORAGE_KEY, migratedBridgeUrl);
      }
    } catch {
      // The public page does not need localStorage to function.
    }
  }
  updateCloudflareLogin();
  if (privateWorker) {
    connectAlpaca();
  } else if ($("alpaca-endpoint").value && !$("alpaca-endpoint").value.endsWith(".workers.dev")) {
    connectAlpaca(); // Optional legacy localhost or Tailscale bridge only.
  }
})();
