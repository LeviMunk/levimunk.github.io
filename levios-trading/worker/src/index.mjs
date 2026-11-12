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

const ALPACA_BASE = "https://paper-api.alpaca.markets";
const SOURCE_ORIGIN = "https://levimunk.com";
const MAX_POSITIONS = 100;

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

async function authorized(env, ctx) {
  // Access is enforced by Cloudflare *before* Worker execution when enabled.
  // Requiring ctx.access ensures this code fails CLOSED if Access is disabled.
  if (!ctx?.access || typeof ctx.access.getIdentity !== "function") return false;
  const allowed = String(env?.ALLOWED_EMAIL || "").trim().toLowerCase();
  if (!allowed) return false;
  try {
    const identity = await ctx.access.getIdentity();
    return String(identity?.email || "").trim().toLowerCase() === allowed;
  } catch {
    return false;
  }
}

async function fetchPaperData(env, pathname) {
  const headers = {
    "APCA-API-KEY-ID": env.ALPACA_PAPER_KEY_ID,
    "APCA-API-SECRET-KEY": env.ALPACA_PAPER_SECRET_KEY,
    "Accept": "application/json"
  };
  const response = await fetch(ALPACA_BASE + pathname, {
    method: "GET",
    headers,
    redirect: "error",
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) {
    throw new Error(response.status === 401 || response.status === 403
      ? "Alpaca rejected the paper credentials."
      : "Alpaca returned HTTP " + response.status + ".");
  }
  return response.json();
}

async function accountSnapshot(env) {
  if (!env.ALPACA_PAPER_KEY_ID || !env.ALPACA_PAPER_SECRET_KEY) {
    return { connected: false, mode: "paper", message: "Alpaca PAPER keys are not yet configured in Cloudflare Worker Secrets." };
  }
  try {
    const [account, positions] = await Promise.all([
      fetchPaperData(env, "/v2/account"),
      fetchPaperData(env, "/v2/positions")
    ]);
    if (!account || !Array.isArray(positions)) throw new Error("Unexpected Alpaca response.");
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
      }))
    };
  } catch (error) {
    // Do not echo network details, headers, or secret values in responses.
    const message = error.message === "Alpaca rejected the paper credentials."
      ? error.message
      : "Alpaca paper account is temporarily unavailable.";
    return { connected: false, mode: "paper", message };
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!(await authorized(env, ctx))) {
      return json({ error: "Authenticated Cloudflare Access session required." }, 403);
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
    if (url.pathname === "/api/health") {
      return json({ ok: true, mode: "paper", access: "authenticated" });
    }

    const staticContent = {
      "/": [assets.html, "text/html; charset=utf-8"],
      "/index.html": [assets.html, "text/html; charset=utf-8"],
      "/app.js": [assets.app, "text/javascript; charset=utf-8"],
      "/styles.css": [assets.css, "text/css; charset=utf-8"]
    }[url.pathname];
    if (!staticContent) return json({ error: "Not found" }, 404);
    return new Response(request.method === "HEAD" ? null : staticContent[0], {
      status: 200,
      headers: commonHeaders(staticContent[1])
    });
  }
};
