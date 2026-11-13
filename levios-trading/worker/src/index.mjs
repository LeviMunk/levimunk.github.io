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
  const endpoint = pathname === "/v2/account" ? "account" : "positions";
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
      }))
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
