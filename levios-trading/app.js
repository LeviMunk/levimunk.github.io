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
  const WATCHLIST_STORAGE_KEY = "levios-iex-watchlist-v1";
  const WATCHLIST_DEFAULT = ["SPY", "QQQ", "AAPL", "MSFT", "NVDA"];
  const WATCHLIST_MAX = 12;
  let watchSymbols = WATCHLIST_DEFAULT.slice();
  let watchSnapshots = new Map();
  let watchRefreshTime = null;
  let watchFetching = false;
  let watchError = "";
  let watchGeneration = 0;
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
  function renderProfitLoss() {
    const chart = $("pnl-chart");
    const empty = $("pnl-empty");
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
        }
      }
    }
    empty.textContent = message;
    $("pnl-status").textContent = message;
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
      $("watch-rows").innerHTML = '<tr><td colspan="7" class="empty">Your watchlist is empty. Add a ticker to begin.</td></tr>';
      return;
    }
    $("watch-rows").innerHTML = watchSymbols.map(symbol => {
      const snap = worker ? watchSnapshots.get(symbol) : null;
      const lastPrice = snap?.available ? formatIexPrice(snap.last_trade) : "—";
      const changeValue = snap?.change;
      const delta = changeValue === null || changeValue === undefined ||
        !Number.isFinite(changeValue) ? "—" :
        (changeValue > 0 ? "+" : changeValue < 0 ? "−" : "") +
        formatIexPrice(Math.abs(changeValue));
      const pct = Number.isFinite(snap?.change_percent) ?
        " (" + (snap.change_percent > 0 ? "+" : "") +
        snap.change_percent.toFixed(2) + "%)" : "";
      const direction = Number.isFinite(changeValue)
        ? changeValue >= 0 ? "positive" : "negative" : "";
      const time = formatIexTime(snap?.trade_time);
      const noData = worker && watchRefreshTime && !snap?.available;
      const note = noData ? '<span class="watch-stale">No IEX trade available</span>' :
        time.stale ? '<span class="watch-stale">Earlier trade · check timestamp</span>' : "";
      return '<tr><td class="watch-symbol">' + escapeHTML(symbol) + '</td>' +
        '<td>' + lastPrice + (snap?.last_trade == null ? note : "") + '</td>' +
        '<td class="watch-delta ' + direction + '">' + delta + pct + '</td>' +
        '<td>' + formatIexPrice(snap?.bid) + '</td>' +
        '<td>' + formatIexPrice(snap?.ask) + '</td>' +
        '<td class="watch-quote-time">' + escapeHTML(time.text) +
        (snap?.last_trade != null ? note : "") + '</td>' +
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

  function showView(name) {
    const headings = {overview:["Trading overview","Explore a simulated portfolio and test ideas against your own historical data."],market:["Market data","Import closing prices and explore historical trends."],strategy:["Strategy lab","Experiment with a simple long-only moving-average model."],trades:["Paper trade journal","Record hypothetical orders, never real Alpaca trades."],fills:["Trade history","Verified executed orders from your Alpaca PAPER brokerage account."],watchlist:["IEX market watchlist","Time-stamped IEX snapshots for your tracked stocks and ETFs."],settings:["Data & settings","Your simulation data stays in this browser unless you export it."]};
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
    if (name==="overview") renderAccountSummary();
    if (name==="market") plotHistory();
    if (name === "watchlist") {
      renderWatchlist();
      if (document.visibilityState === "visible") void loadWatchlist(false);
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
  function runBacktest(symbol,fast,slow) {
    if (!Number.isInteger(fast) || !Number.isInteger(slow) || fast<2 || fast>=slow || slow>250) throw Error("Use whole numbers where 2 ≤ fast < slow ≤ 250.");
    const rows=state.prices[symbol] || [];
    if (rows.length<slow+2) throw Error("Import at least " + (slow+2) + " daily closes for this test.");
    const closes=rows.map(r=>r.close);
    let cash=INITIAL_CASH, shares=0, pending="", trades=0;
    const curve=[];
    const sumFast=closes.slice(0,fast).reduce((a,b)=>a+b,0); // input sanity via initial window
    if (!Number.isFinite(sumFast)) throw Error("Invalid historical data.");
    for(let i=0;i<rows.length;i++) {
      const price=closes[i];
      if(pending==="BUY" && cash>0) {shares=cash/(price*1.001);cash=0;trades++;}
      else if(pending==="SELL" && shares>0) {cash=shares*price*(1-0.001);shares=0;trades++;}
      pending="";
      if(i>=slow-1) {
        let f=0,s=0;
        for(let j=i-fast+1;j<=i;j++) f+=closes[j];
        for(let j=i-slow+1;j<=i;j++) s+=closes[j];
        if(f/fast>s/slow && shares===0) pending="BUY";
        else if(f/fast<=s/slow && shares>0) pending="SELL";
      }
      curve.push({date:rows[i].date,equity:cash+shares*price});
    }
    let peak=curve[0].equity, maxDD=0;
    for(const row of curve){peak=Math.max(peak,row.equity);maxDD=Math.min(maxDD,(row.equity/peak-1)*100);}
    return {returnPct:(curve[curve.length-1].equity/INITIAL_CASH-1)*100,holdPct:(closes[closes.length-1]/closes[0]-1)*100,maxDD,trades,curve};
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
  $("backtest-form").addEventListener("submit",e=>{
    e.preventDefault();
    try{
      const symbol=$("strategy-symbol").value;
      const r=runBacktest(symbol,Number($("fast").value),Number($("slow").value));
      $("result-return").textContent=pct(r.returnPct);
      $("result-hold").textContent=pct(r.holdPct);
      $("result-dd").textContent=pct(r.maxDD);
      $("result-trades").textContent=String(r.trades);
      chart("equity-chart",r.curve,"equity");
      feedback("backtest-feedback","Backtest complete on "+r.curve.length+" observations.");
    }catch(err){feedback("backtest-feedback",err.message,true);}
  });
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
      saveWatchSymbols();
      $("watch-symbol-input").value = "";
      watchRefreshTime = null;
      renderWatchlist();
      void loadWatchlist(true);
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
  });
  $("watch-refresh").addEventListener("click", () => void loadWatchlist(true));
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
  load();render();showView("overview");
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
