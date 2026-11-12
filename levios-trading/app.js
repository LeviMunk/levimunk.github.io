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
  }
  function showView(name) {
    const headings = {overview:["Trading overview","Explore a simulated portfolio and test ideas against your own historical data."],market:["Market data","Import closing prices and explore historical trends."],strategy:["Strategy lab","Experiment with a simple long-only moving-average model."],trades:["Paper trade journal","Record hypothetical orders, never real Alpaca trades."],settings:["Data & settings","Your simulation data stays in this browser unless you export it."]};
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
    const worker = url.protocol === "https:" && /^levios-alpaca\.[a-z0-9-]+\.workers\.dev$/i.test(url.hostname) && !url.port;
    const cloudflare = url.protocol === "https:" && url.hostname === "trading-api.levimunk.com" && !url.port;
    const tailnet = url.protocol === "https:" &&
      /^[a-z0-9-]+(?:\.[a-z0-9-]+)+\.ts\.net$/i.test(url.hostname) && url.port === "8443";
    if ((!local && !tailnet && !cloudflare && !worker) || url.username || url.password || (url.pathname !== "/" && url.pathname !== "") || url.search || url.hash) {
      throw Error("Enter your protected levios-alpaca.<account>.workers.dev address (or a previously configured private bridge).");
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
  }
  async function connectAlpaca() {
    let base;
    try { base = safeBridgeUrl($("alpaca-endpoint").value); }
    catch (err) { clearAlpacaStatus(err.message); return; }
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
  }
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
  load();render();showView("overview");
  if (window.location.hostname.endsWith(".workers.dev")) {
    $("alpaca-endpoint").value = window.location.origin;
  }
  updateCloudflareLogin();
  try {
    const savedBridgeUrl = localStorage.getItem(BRIDGE_STORAGE_KEY);
    if (savedBridgeUrl) {
      $("alpaca-endpoint").value = window.location.hostname.endsWith(".workers.dev") ? window.location.origin : safeBridgeUrl(savedBridgeUrl);
      updateCloudflareLogin();
      connectAlpaca();
    }
  } catch {
    // If storage is blocked, manual Connect still works.
  }
  if (window.location.hostname.endsWith(".workers.dev") && !$("alpaca-connection-badge").classList.contains("connected")) {
    $("alpaca-endpoint").value = window.location.origin;
    updateCloudflareLogin();
    connectAlpaca();
  }
})();
