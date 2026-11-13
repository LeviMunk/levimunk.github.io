/**
 * LeviOS Trading: read-only Alpaca PAPER Worker.
 *
 * Security:
 * - Only Cloudflare Access authenticated requests (ctx.access) are accepted.
 * - A second email allowlist check is required via ALLOWED_EMAIL secret.
 * - Secrets are set in the Cloudflare dashboard; none live in GitHub or JS.
 * - No order routes or public account endpoints.
 * - Serves a protected copy of the SAME UI that GitHub Pages provides,
 *   so it works without cross-site third-party cookies.
 */
import { assets } from "../generated-assets.mjs";
import { equityScorecard } from "./performance.mjs";
import { positionRiskSummary } from "./risk.mjs";

const ALPACA_BASE = "https://paper-api.alpaca.markets";
const ALPACA_MARKET_DATA_BASE = "https://data.alpaca.markets";
const MAX_WATCHLIST_SYMBOLS = 12;
const SOURCE_ORIGIN = "https://levimunk.com";
const MAX_POSITIONS = 100;
const HISTORY_RANGE_PERIODS = Object.freeze({ "1W": "1W", "1M": "1M", "3M": "3M", "1Y": "1A" });
const MAX_HISTORY_POINTS = 400;
const FILLS_PAGE_SIZE = 50;
const MAX_FILL_CURSOR_LENGTH = 256;

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "X-Frame-Options": "DENY",
      ...extra
    }
  });

function commonHeaders(type) {
  return {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy":
      "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; " +
      "img-src 'self' data:; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"
  };
}

async function authorizationStatus(env, ctx) {
  // Cloudflare Access runs before our Worker when All traffic is protected.
  // Keep this fail-closed: NEVER accept an unauthenticated request.
  // Return only safe status codes, never any emails, tokens or keys.
  if (!ctx?.access || typeof ctx.access.getIdentity !== "function") {
    return { ok: false, reason: "access_not_authenticated" };
  }
  const allowed = String(env?.ALLOWED_EMAIL || "").trim().toLowerCase();
  if (!allowed) return { ok: false, reason: "allowed_email_not_configured" };
  try {
    const identity = await ctx.access.getIdentity();
    const email = String(identity?.email || "").trim().toLowerCase();
    if (!email) return { ok: false, reason: "access_identity_unavailable" };
    if (email !== allowed) return { ok: false, reason: "allowed_email_mismatch" };
    return { ok: true };
  } catch {
    return { ok: false, reason: "access_identity_unavailable" };
  }
}

// Only hardcoded diagnostic codes are returned to the signed-in user.
// Never return arbitrary fetch exceptions, Alpaca response bodies or headers:
// they can contain account identifiers or other private information.
function alpacaFailure(code, endpoint, httpStatus) {
  const error = new Error(code);
  error.safeCode = code;
  error.safeEndpoint = endpoint;
  if (httpStatus) error.safeHttpStatus = httpStatus;
  return error;
}

async function fetchPaperData(env, pathname) {
  const endpoint = pathname.startsWith("/v2/account/portfolio/history?")
    ? "history" : pathname.startsWith("/v2/account/activities/FILL?")
      ? "fills" : pathname === "/v2/account" ? "account" : "positions";
  const headers = {
    "APCA-API-KEY-ID": env.ALPACA_PAPER_KEY_ID,
    "APCA-API-SECRET-KEY": env.ALPACA_PAPER_SECRET_KEY,
    "Accept": "application/json"
  };
  let response;
  try {
    response = await fetch(ALPACA_BASE + pathname, {
      method: "GET",
      headers,
      // Cloudflare Workers does not implement fetch redirect: "error".
      // Use "manual" and refuse any 3xx response rather than following it
      // with private Alpaca authentication headers.
      redirect: "manual",
      signal: AbortSignal.timeout(8000)
    });
  } catch (error) {
    // Timeouts and network failures are distinct from invalid credentials.
    const code = error?.name === "TimeoutError" || error?.name === "AbortError"
      ? "alpaca_timeout" : "alpaca_network_error";
    throw alpacaFailure(code, endpoint);
  }
  if (!response.ok) {
    const status = response.status;
    const code = status === 401 || status === 403 ? "alpaca_credentials_rejected"
      : status === 429 ? "alpaca_rate_limited"
      : status >= 500 ? "alpaca_service_error"
      : "alpaca_http_error";
    throw alpacaFailure(code, endpoint, status);
  }
  try {
    return await response.json();
  } catch {
    throw alpacaFailure("alpaca_invalid_response", endpoint);
  }
}

async function accountSnapshot(env) {
  if (!env.ALPACA_PAPER_KEY_ID || !env.ALPACA_PAPER_SECRET_KEY) {
    return {
      connected: false,
      mode: "paper",
      reason: "alpaca_paper_secrets_missing",
      message: "Alpaca PAPER keys are not yet configured in Cloudflare Worker Secrets."
    };
  }
  try {
    const [account, positions] = await Promise.all([
      fetchPaperData(env, "/v2/account"),
      fetchPaperData(env, "/v2/positions")
    ]);
    if (!account || typeof account !== "object" ||
        account.equity == null || account.cash == null || account.buying_power == null ||
        !Array.isArray(positions)) {
      throw alpacaFailure("alpaca_invalid_response", "account_or_positions");
    }
    return {
      connected: true,
      mode: "paper",
      account: {
        equity: account.equity,
        cash: account.cash,
        buying_power: account.buying_power,
        status: account.status,
        currency: account.currency
      },
      positions: positions.slice(0, MAX_POSITIONS).map(p => ({
        symbol: p.symbol,
        qty: p.qty,
        market_value: p.market_value,
        unrealized_pl: p.unrealized_pl
      })),
      risk: positionRiskSummary(account, positions),
      positions_display_limited: positions.length > MAX_POSITIONS
    };
  } catch (error) {
    // Do not echo exception messages or Alpaca response bodies to the browser.
    const allowedCodes = new Set([
      "alpaca_credentials_rejected", "alpaca_rate_limited", "alpaca_service_error",
      "alpaca_http_error", "alpaca_timeout", "alpaca_network_error", "alpaca_invalid_response"
    ]);
    const reason = allowedCodes.has(error?.safeCode) ? error.safeCode : "alpaca_unexpected_error";
    const message = reason === "alpaca_credentials_rejected"
      ? "Alpaca rejected the paper API credentials."
      : "Alpaca paper account is temporarily unavailable.";
    const result = { connected: false, mode: "paper", reason, message };
    if (error?.safeEndpoint) result.endpoint = error.safeEndpoint;
    if (Number.isInteger(error?.safeHttpStatus)) result.http_status = error.safeHttpStatus;
    return result;
  }
}

// Alpaca computes this history relative to a period baseline. It is neither
// an execution log nor a claim about realized P/L or lifetime performance.
async function portfolioHistory(env, range) {
  if (!env.ALPACA_PAPER_KEY_ID || !env.ALPACA_PAPER_SECRET_KEY) {
    return {
      connected: false, mode: "paper", range, reason: "alpaca_paper_secrets_missing",
      message: "Alpaca PAPER credentials are not configured."
    };
  }
  try {
    const period = HISTORY_RANGE_PERIODS[range];
    const history = await fetchPaperData(env,
      "/v2/account/portfolio/history?period=" + period + "&timeframe=1D");
    if (!history || !Array.isArray(history.timestamp) ||
        !Array.isArray(history.equity) || !Array.isArray(history.profit_loss) ||
        !Array.isArray(history.profit_loss_pct)) {
      throw alpacaFailure("alpaca_invalid_response", "history");
    }
    const length = Math.min(
      history.timestamp.length, history.equity.length,
      history.profit_loss.length, history.profit_loss_pct.length
    );
    // Missing values must not be silently reinterpreted as zero P/L.
    const points = [];
    for (let i = Math.max(0, length - MAX_HISTORY_POINTS); i < length; i++) {
      const ts = Number(history.timestamp[i]);
      const rawEquity = history.equity[i];
      const rawPL = history.profit_loss[i];
      if (rawEquity == null || rawPL == null) continue;
      const equity = Number(rawEquity), pl = Number(rawPL);
      const pct = history.profit_loss_pct[i] == null
        ? null : Number(history.profit_loss_pct[i]);
      if (!Number.isSafeInteger(ts) || ts < 946684800 || ts > 4102444800 ||
          !Number.isFinite(equity) || !Number.isFinite(pl) ||
          (pct !== null && !Number.isFinite(pct))) continue;
      points.push({ timestamp: ts, equity, profit_loss: pl, profit_loss_pct: pct });
    }
    const base = history.base_value == null ? null : Number(history.base_value);
    return {
      connected: true,
      mode: "paper",
      range,
      timeframe: "1D",
      base_value: Number.isFinite(base) ? base : null,
      points,
      scorecard: equityScorecard(points)
    };
  } catch (error) {
    const allowed = new Set([
      "alpaca_credentials_rejected", "alpaca_rate_limited", "alpaca_service_error",
      "alpaca_http_error", "alpaca_timeout", "alpaca_network_error", "alpaca_invalid_response"
    ]);
    const reason = allowed.has(error?.safeCode) ? error.safeCode : "alpaca_unexpected_error";
    const result = {
      connected: false, mode: "paper", range, reason,
      message: reason === "alpaca_credentials_rejected"
        ? "Alpaca rejected the paper credentials for portfolio history."
        : "Alpaca portfolio history is temporarily unavailable."
    };
    if (Number.isInteger(error?.safeHttpStatus)) result.http_status = error.safeHttpStatus;
    return result;
  }
}

// Alpaca FILL activities are individual executions, including partial fills.
// This is a trade ledger, NOT a realized profit/loss calculation.
async function recentTradeFills(env, pageToken = null) {
  if (!env.ALPACA_PAPER_KEY_ID || !env.ALPACA_PAPER_SECRET_KEY) {
    return { connected: false, mode: "paper", reason: "alpaca_paper_secrets_missing",
      message: "Alpaca PAPER credentials are not configured." };
  }
  const params = new URLSearchParams({
    direction: "desc", page_size: String(FILLS_PAGE_SIZE)
  });
  if (pageToken) params.set("page_token", pageToken);
  try {
    const raw = await fetchPaperData(env, "/v2/account/activities/FILL?" + params.toString());
    if (!Array.isArray(raw)) throw alpacaFailure("alpaca_invalid_response", "fills");
    const items = [];
    for (const fill of raw.slice(0, FILLS_PAGE_SIZE)) {
      if (!fill || fill.activity_type !== "FILL") continue;
      const symbol = String(fill.symbol || "").trim().toUpperCase();
      const side = String(fill.side || "").toLowerCase();
      const quantity = Number(fill.qty), price = Number(fill.price);
      const time = typeof fill.transaction_time === "string" ? fill.transaction_time : "";
      if (!/^[A-Z0-9./_-]{1,40}$/.test(symbol) ||
          !["buy", "sell"].includes(side) ||
          !Number.isFinite(quantity) || quantity <= 0 ||
          !Number.isFinite(price) || price <= 0 ||
          !Number.isFinite(Date.parse(time))) continue;
      items.push({
        time, symbol, side, qty: String(fill.qty), price: String(fill.price),
        notional: Math.round(quantity * price * 100) / 100,
        type: fill.type === "partial_fill" ? "partial_fill" : "fill"
      });
    }
    const lastId = raw.length === FILLS_PAGE_SIZE
      ? String(raw[raw.length - 1]?.id || "") : "";
    const nextPageToken = lastId.length <= MAX_FILL_CURSOR_LENGTH &&
      /^[a-zA-Z0-9:._-]+$/.test(lastId) ? lastId : null;
    return {
      connected: true, mode: "paper",
      fills: items,
      next_page_token: nextPageToken,
      page_size: FILLS_PAGE_SIZE
    };
  } catch (error) {
    const permitted = new Set([
      "alpaca_credentials_rejected", "alpaca_rate_limited", "alpaca_service_error",
      "alpaca_http_error", "alpaca_timeout", "alpaca_network_error", "alpaca_invalid_response"
    ]);
    const reason = permitted.has(error?.safeCode) ? error.safeCode : "alpaca_unexpected_error";
    const result = { connected: false, mode: "paper", reason,
      message: reason === "alpaca_credentials_rejected"
        ? "Alpaca rejected the PAPER credentials for trade history."
        : "Alpaca trade history is temporarily unavailable." };
    if (Number.isInteger(error?.safeHttpStatus)) result.http_status = error.safeHttpStatus;
    return result;
  }
}

// Free Alpaca market data is IEX-only; never label this as consolidated SIP.
const watchlistSymbolPattern = /^[A-Z][A-Z0-9.-]{0,9}$/;

async function iexSnapshots(env, symbols) {
  if (!env.ALPACA_PAPER_KEY_ID || !env.ALPACA_PAPER_SECRET_KEY) {
    return { connected: false, feed: "iex", reason: "alpaca_paper_secrets_missing",
      message: "Alpaca PAPER credentials are not configured." };
  }
  const params = new URLSearchParams({ symbols: symbols.join(","), feed: "iex" });
  let response;
  try {
    response = await fetch(ALPACA_MARKET_DATA_BASE + "/v2/stocks/snapshots?" + params.toString(), {
      method: "GET",
      headers: {
        "APCA-API-KEY-ID": env.ALPACA_PAPER_KEY_ID,
        "APCA-API-SECRET-KEY": env.ALPACA_PAPER_SECRET_KEY,
        "Accept": "application/json"
      },
      redirect: "manual",
      signal: AbortSignal.timeout(8000)
    });
  } catch (error) {
    const reason = error?.name === "TimeoutError" || error?.name === "AbortError"
      ? "alpaca_timeout" : "alpaca_network_error";
    return { connected: false, feed: "iex", reason,
      message: "Could not reach Alpaca IEX market data." };
  }
  if (!response.ok) {
    const status = response.status;
    const reason = status === 401 || status === 403 ? "alpaca_credentials_rejected"
      : status === 429 ? "alpaca_rate_limited"
      : status >= 500 ? "alpaca_service_error" : "alpaca_http_error";
    return { connected: false, feed: "iex", reason, http_status: status,
      message: "Alpaca IEX market data is unavailable." };
  }
  let payload;
  try { payload = await response.json(); } catch {
    return { connected: false, feed: "iex", reason: "alpaca_invalid_response",
      message: "Alpaca returned an unexpected market-data response." };
  }
  if (!payload || typeof payload !== "object" || !payload.snapshots ||
      typeof payload.snapshots !== "object" || Array.isArray(payload.snapshots)) {
    return { connected: false, feed: "iex", reason: "alpaca_invalid_response",
      message: "Alpaca returned an unexpected market-data response." };
  }
  const number = value => value === null || value === undefined || value === "" ||
    !Number.isFinite(Number(value)) || Number(value) <= 0 ? null : Number(value);
  // Validate timestamp and return only it, never raw market-data records.
  const instant = value => typeof value === "string" &&
    value.length <= 40 && Number.isFinite(Date.parse(value)) ? value : null;
  const result = symbols.map(symbol => {
    const snap = payload.snapshots[symbol];
    if (!snap || typeof snap !== "object") {
      return { symbol, available: false };
    }
    const trade = number(snap.latestTrade?.p);
    const bid = number(snap.latestQuote?.bp);
    const ask = number(snap.latestQuote?.ap);
    const prevClose = number(snap.prevDailyBar?.c);
    const dailyClose = number(snap.dailyBar?.c);
    // Price changes are based on the IEX last trade relative to Alpaca's
    // prior daily close. Do not fabricate prices from a missing quote.
    const change = trade !== null && prevClose !== null
      ? Math.round((trade - prevClose) * 10000) / 10000 : null;
    const changePercent = change !== null && prevClose !== null
      ? Math.round(change / prevClose * 1000000) / 10000 : null;
    return {
      symbol,
      available: [trade, bid, ask, dailyClose].some(value => value !== null),
      last_trade: trade,
      trade_time: instant(snap.latestTrade?.t),
      bid, ask,
      quote_time: instant(snap.latestQuote?.t),
      previous_close: prevClose,
      daily_close: dailyClose,
      change, change_percent: changePercent
    };
  });
  return {
    connected: true, feed: "iex", feed_scope: "single_exchange",
    refreshed_at: new Date().toISOString(),
    symbols: result
  };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const authorization = await authorizationStatus(env, ctx);
    if (!authorization.ok) {
      return json({
        error: "Authenticated Cloudflare Access session required.",
        reason: authorization.reason
      }, 403);
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return json({ error: "Read-only application. Orders and changes are not supported." }, 405);
    }
    // Do not enable CORS. The private UI calls the API on this SAME origin.
    // That avoids cross-site cookie restrictions on workplace browsers.
    if (url.pathname === "/api/alpaca/status") {
      if (request.method === "HEAD") return new Response(null, { status: 200, headers: commonHeaders("application/json") });
      return json(await accountSnapshot(env));
    }
    if (url.pathname === "/api/alpaca/fills") {
      const keys = [...url.searchParams.keys()];
      const tokens = url.searchParams.getAll("page_token");
      const cursor = tokens[0] || null;
      if (tokens.length > 1 || keys.some(key => key !== "page_token") ||
          (tokens.length && (!cursor || cursor.length > MAX_FILL_CURSOR_LENGTH ||
            !/^[a-zA-Z0-9:._-]+$/.test(cursor)))) {
        return json({ error: "Invalid trade-history page token." }, 400);
      }
      if (request.method === "HEAD") {
        return new Response(null, { status: 200, headers: commonHeaders("application/json") });
      }
      return json(await recentTradeFills(env, cursor));
    }
    if (url.pathname === "/api/market/watchlist") {
      const symbolValues = url.searchParams.getAll("symbols");
      const keys = [...url.searchParams.keys()];
      const symbols = symbolValues.length === 1
        ? symbolValues[0].split(",").map(value => value.toUpperCase()) : [];
      if (symbolValues.length !== 1 ||
          keys.some(key => key !== "symbols") ||
          symbols.length < 1 || symbols.length > MAX_WATCHLIST_SYMBOLS ||
          symbols.some(symbol => !watchlistSymbolPattern.test(symbol)) ||
          new Set(symbols).size !== symbols.length) {
        return json({ error: "Provide 1–12 unique supported ticker symbols." }, 400);
      }
      if (request.method === "HEAD") {
        return new Response(null, { status: 200, headers: commonHeaders("application/json") });
      }
      return json(await iexSnapshots(env, symbols));
    }
    if (url.pathname === "/api/alpaca/history") {
      const range = url.searchParams.get("range") || "1M";
      if (!Object.hasOwn(HISTORY_RANGE_PERIODS, range) ||
          url.searchParams.getAll("range").length > 1 ||
          [...url.searchParams.keys()].some(key => key !== "range")) {
        return json({ error: "Choose a supported history range: 1W, 1M, 3M, or 1Y." }, 400);
      }
      if (request.method === "HEAD") {
        return new Response(null, { status: 200, headers: commonHeaders("application/json") });
      }
      return json(await portfolioHistory(env, range));
    }
    if (url.pathname === "/api/health") {
      return json({ ok: true, mode: "paper", access: "authenticated" });
    }

    const staticContent = {
      "/": [assets.html, "text/html; charset=utf-8"],
      "/index.html": [assets.html, "text/html; charset=utf-8"],
      "/app.js": [assets.app, "text/javascript; charset=utf-8"],
      "/lightweight-charts.js": [assets.chartLib, "text/javascript; charset=utf-8"],
      "/styles.css": [assets.css, "text/css; charset=utf-8"]
    }[url.pathname];
    if (!staticContent) return json({ error: "Not found" }, 404);
    return new Response(request.method === "HEAD" ? null : staticContent[0], {
      status: 200,
      headers: commonHeaders(staticContent[1])
    });
  }
};
