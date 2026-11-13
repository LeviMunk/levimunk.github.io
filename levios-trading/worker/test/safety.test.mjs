import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import handler from "../src/index.mjs";
import { equityScorecard } from "../src/performance.mjs";
import { positionRiskSummary } from "../src/risk.mjs";
import preciseSum from "../src/vendor/simple-statistics/sum.mjs";

const url = "https://levimunk-alpaca.levivanstap.workers.dev";
const authenticated = { access: { getIdentity: async () => ({ email: "owner@example.test" }) } };
const authorizedEnv = { ALLOWED_EMAIL: "owner@example.test" };

test("denies requests without Cloudflare Access context", async () => {
  const response = await handler.fetch(new Request(url), authorizedEnv, {});
  assert.equal(response.status, 403);
  assert.equal((await response.json()).reason, "access_not_authenticated");
});

test("denies a different identity even with Access context", async () => {
  const response = await handler.fetch(new Request(url), authorizedEnv, {
    access: { getIdentity: async () => ({ email: "someoneelse@example.test" }) }
  });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).reason, "allowed_email_mismatch");
});

test("requires explicit configured owner email", async () => {
  const response = await handler.fetch(new Request(url), {}, authenticated);
  assert.equal(response.status, 403);
  assert.equal((await response.json()).reason, "allowed_email_not_configured");
});

test("protected dashboard and assets are served after login", async () => {
  const response = await handler.fetch(new Request(url), authorizedEnv, authenticated);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /LeviOS Trading Lab/);
  assert.match(html, /id="pnl-chart"/);
  assert.match(html, /src="\.\/strategy-engine\.js"/);
  assert.match(html, /src="\.\/validation-engine\.js"/);
  assert.match(html, /id="radar-scan"/);
  assert.ok(html.includes('src="./events-engine.js"'));
  assert.ok(html.includes('id="events-category"'));
  assert.ok(html.includes('id="earnings-refresh"'));
  assert.ok(html.includes('src="./earnings-engine.js"'));
  assert.ok(html.includes('src="./catalyst-engine.js"'));
  assert.ok(html.includes('src="./journal-engine.js"'));
  assert.ok(html.includes('src="./decision-guide.js"'));
  assert.ok(html.includes('id="daily-brief-run"'));
  assert.ok(html.includes('id="fundamentals-form"'));
  assert.ok(html.includes('src="./fundamentals-engine.js"'));
  assert.ok(html.includes('src="./valuation-engine.js"'));
  assert.ok(html.includes('id="valuation-form"'));
  assert.ok(html.includes('src="./peer-thesis-engine.js"'));
  assert.ok(html.includes('src="./decision-brief-engine.js"'));
  assert.ok(html.includes('id="decision-brief-form"'));
  assert.ok(html.includes('id="valuation-peer-suggest"'));
  assert.ok(html.includes('id="journal-form"'));
  assert.ok(html.includes('src="./radar-engine.js"'));
  assert.match(html, /id="validation-review"/);
  assert.match(html, /id="validation-approve"/);
  assert.match(html, /id="validation-checks"/);
  assert.match(html, /id="validation-decisions"/);
  assert.match(html, /id="strategy-train-return"/);
  assert.match(html, /id="strategy-test-return"/);
  assert.match(html, /id="strategy-versions"/);
  assert.match(html, /id="strategy-load-iex"/);
  assert.match(html, /data-pnl-range="1W"/);
  assert.match(html, /data-pnl-range="1Y"/);
  assert.match(html, /data-view="fills"/);
  assert.match(html, /id="view-fills"/);
  assert.match(html, /id="fills-rows"/);
  assert.match(html, /id="fills-more"/);
  assert.match(html, /data-view="watchlist"/);
  assert.match(html, /id="watch-rows"/);
  assert.match(html, /id="watch-refresh"/);
  assert.match(html, /id="broker-connection-internals" hidden aria-hidden="true"/);
  assert.match(html, /class="grid-2 holdings-section"/);
  assert.match(html, /id="private-trading-link"/);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
});

test("read-only broker endpoint requires paper keys and never accepts POST", async () => {
  const res = await handler.fetch(new Request(url + "/api/alpaca/status"), authorizedEnv, authenticated);
  const result = await res.json();
  assert.equal(result.connected, false);
  assert.equal(result.mode, "paper");
  const post = await handler.fetch(new Request(url + "/api/alpaca/status", {method:"POST"}), authorizedEnv, authenticated);
  assert.equal(post.status, 405);
});

test("market calendar requires authentication, rejects POST and query params", async()=>{
  const endpoint=url+"/api/market/events";
  const denied=await handler.fetch(new Request(endpoint),authorizedEnv,{});
  assert.equal(denied.status,403);
  const post=await handler.fetch(new Request(endpoint,{method:"POST"}),authorizedEnv,authenticated);
  assert.equal(post.status,405);
  const bad=await handler.fetch(new Request(endpoint+"?url=https://evil.example/"),authorizedEnv,authenticated);
  assert.equal(bad.status,400);
  const head=await handler.fetch(new Request(endpoint,{method:"HEAD"}),authorizedEnv,authenticated);
  assert.equal(head.status,200);
});

test("earnings API requires Access, valid tickers and never places orders",async()=>{
  const api=url+"/api/market/earnings?symbols=AAPL,MSFT";
  assert.equal((await handler.fetch(new Request(api),authorizedEnv,{})).status,403);
  assert.equal((await handler.fetch(new Request(api,{method:"POST"}),authorizedEnv,authenticated)).status,405);
  assert.equal((await handler.fetch(new Request(url+"/api/market/earnings?symbols=AAPL,AAPL"),authorizedEnv,authenticated)).status,400);
  assert.equal((await handler.fetch(new Request(api,{method:"HEAD"}),authorizedEnv,authenticated)).status,200);
  const result=await (await handler.fetch(new Request(api),authorizedEnv,authenticated)).json();
  assert.equal(result.status,"not_configured");
  assert.deepEqual(result.events,[]);
});
test("SEC financial lookup requires Access and private agent and rejects unsafe queries",async()=>{
  const endpoint=url+"/api/research/sec-financials?symbol=AAPL";
  const denied=await handler.fetch(new Request(endpoint),authorizedEnv,{});
  assert.equal(denied.status,403);
  const bad=await handler.fetch(new Request(endpoint+"&redirect=https://bad.example"),authorizedEnv,authenticated);
  assert.equal(bad.status,400);
  const post=await handler.fetch(new Request(endpoint,{method:"POST"}),authorizedEnv,authenticated);
  assert.equal(post.status,405);
  const head=await handler.fetch(new Request(endpoint,{method:"HEAD"}),authorizedEnv,authenticated);
  assert.equal(head.status,200);
  const noAgent=await (await handler.fetch(new Request(endpoint),authorizedEnv,authenticated)).json();
  assert.equal(noAgent.status,"not_configured");
});
test("unknown paths fail with 404", async () => {
  const res = await handler.fetch(new Request(url + "/api/orders"), authorizedEnv, authenticated);
  assert.equal(res.status, 404);
});

test("authenticated account snapshot only reads Alpaca PAPER endpoints and strips secrets", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (destination, options) => {
    calls.push({destination:String(destination), method:options.method, headers:options.headers});
    if (String(destination).endsWith("/v2/account")) {
      return Response.json({ equity:"100000.00", cash:"98000.00", buying_power:"196000.00", status:"ACTIVE", currency:"USD", account_number:"PRIVATE" });
    }
    if (String(destination).endsWith("/v2/positions")) {
      return Response.json([{ symbol:"SPY", qty:"2", market_value:"1200.00", unrealized_pl:"33.00", asset_id:"PRIVATE" }]);
    }
    throw Error("Unexpected broker URL");
  };
  try {
    const response = await handler.fetch(
      new Request(url + "/api/alpaca/status"),
      {...authorizedEnv, ALPACA_PAPER_KEY_ID:"TEST_PAPER_KEY",ALPACA_PAPER_SECRET_KEY:"TEST_PAPER_SECRET"},
      authenticated
    );
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.connected, true);
    assert.equal(result.account.equity, "100000.00");
    assert.equal(result.positions[0].symbol, "SPY");
    assert.ok(!JSON.stringify(result).includes("PRIVATE"));
    assert.ok(!JSON.stringify(result).includes("TEST_PAPER"));
    assert.deepEqual(calls.map(c=>c.method), ["GET","GET"]);
    assert.ok(calls.every(c=>c.destination.startsWith("https://paper-api.alpaca.markets/v2/")));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fails closed if Cloudflare identity lookup throws", async () => {
  const response = await handler.fetch(new Request(url), authorizedEnv, {
    access: { getIdentity: async () => { throw Error("identity service not available"); } }
  });
  assert.equal(response.status, 403);
  const payload = await response.json();
  assert.equal(payload.reason, "access_identity_unavailable");
  assert.ok(!JSON.stringify(payload).includes("owner@example.test"));
});


test("distinguishes Alpaca paper HTTP error statuses without exposing keys", async () => {
  const originalFetch = globalThis.fetch;
  try {
    const examples = [
      [401, "alpaca_credentials_rejected"],
      [403, "alpaca_credentials_rejected"],
      [429, "alpaca_rate_limited"],
      [503, "alpaca_service_error"],
      [404, "alpaca_http_error"]
    ];
    for (const [httpStatus, reason] of examples) {
      globalThis.fetch = async () => new Response(
        '{"message":"SECRET_ERROR_TEXT_DO_NOT_EXPOSE"}',
        {status:httpStatus, headers:{"Content-Type":"application/json"}}
      );
      const response = await handler.fetch(
        new Request(url + "/api/alpaca/status"),
        {...authorizedEnv, ALPACA_PAPER_KEY_ID:"EXAMPLE_TEST_KEY", ALPACA_PAPER_SECRET_KEY:"EXAMPLE_TEST_SECRET"},
        authenticated
      );
      const body = await response.json();
      assert.equal(response.status, 200);
      assert.equal(body.connected, false);
      assert.equal(body.reason, reason);
      assert.equal(body.endpoint, "account");
      assert.equal(body.http_status, httpStatus);
      assert.ok(!JSON.stringify(body).includes("SECRET_ERROR_TEXT_DO_NOT_EXPOSE"));
      assert.ok(!JSON.stringify(body).includes("EXAMPLE_TEST"));
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("reports network errors without leaking exception text", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {throw Error("PRIVATE_RUNTIME_ERROR");};
  try {
    const response = await handler.fetch(
      new Request(url + "/api/alpaca/status"),
      {...authorizedEnv, ALPACA_PAPER_KEY_ID:"EXAMPLE_TEST_KEY", ALPACA_PAPER_SECRET_KEY:"EXAMPLE_TEST_SECRET"},
      authenticated
    );
    const body = await response.json();
    assert.equal(body.connected, false);
    assert.equal(body.reason, "alpaca_network_error");
    assert.equal(body.endpoint, "account");
    assert.ok(!JSON.stringify(body).includes("PRIVATE_RUNTIME_ERROR"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("reports malformed Alpaca account data without exposing it", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (destination) =>
    String(destination).endsWith("/v2/positions") ? Response.json([]) : Response.json({account_number:"PRIVATE"});
  try {
    const response = await handler.fetch(
      new Request(url + "/api/alpaca/status"),
      {...authorizedEnv, ALPACA_PAPER_KEY_ID:"EXAMPLE_TEST_KEY", ALPACA_PAPER_SECRET_KEY:"EXAMPLE_TEST_SECRET"},
      authenticated
    );
    const body = await response.json();
    assert.equal(body.reason, "alpaca_invalid_response");
    assert.ok(!JSON.stringify(body).includes("PRIVATE"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("outbound paper requests use Cloudflare-supported manual redirects", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (destination, options) => {
    requests.push({ url: String(destination), redirect: options.redirect, method: options.method });
    return String(destination).endsWith("/v2/account")
      ? Response.json({ equity: "100000", cash: "99000", buying_power: "198000" })
      : Response.json([]);
  };
  try {
    const response = await handler.fetch(
      new Request(url + "/api/alpaca/status"),
      {...authorizedEnv, ALPACA_PAPER_KEY_ID: "TEST_PAPER_ID", ALPACA_PAPER_SECRET_KEY: "TEST_PAPER_SECRET"},
      authenticated
    );
    assert.equal((await response.json()).connected, true);
    assert.equal(requests.length, 2);
    assert.ok(requests.every(x => x.method === "GET" && x.redirect === "manual"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("does not follow Alpaca redirects or send keys to a redirect destination", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response(null, {
      status: 302,
      headers: { location: "https://attacker.invalid/collect" }
    });
  };
  try {
    const response = await handler.fetch(
      new Request(url + "/api/alpaca/status"),
      {...authorizedEnv, ALPACA_PAPER_KEY_ID: "TEST_PAPER_ID", ALPACA_PAPER_SECRET_KEY: "TEST_PAPER_SECRET"},
      authenticated
    );
    const result = await response.json();
    assert.equal(result.connected, false);
    assert.equal(result.reason, "alpaca_http_error");
    assert.equal(result.http_status, 302);
    assert.equal(calls, 2);
    assert.ok(!JSON.stringify(result).includes("attacker.invalid"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("private portfolio history is read-only and returns only Alpaca-approved P/L fields", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (destination, options) => {
    requests.push({url:String(destination), method:options.method, redirect:options.redirect});
    return Response.json({
      timestamp:[1762900000,1762986400,1763072800],
      equity:[100000,100020,100065.79],
      profit_loss:[0,20,65.79],
      profit_loss_pct:[0,0.0002,0.0006579],
      base_value:100000,
      account_number:"PRIVATE_ACCOUNT_NUMBER",
      secret_field:"PRIVATE_DATA"
    });
  };
  try {
    const urlHistory = url + "/api/alpaca/history?range=1M";
    const env = {...authorizedEnv, ALPACA_PAPER_KEY_ID:"TEST_KEY", ALPACA_PAPER_SECRET_KEY:"TEST_SECRET"};
    const response = await handler.fetch(new Request(urlHistory), env, authenticated);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.connected, true);
    assert.equal(body.mode, "paper");
    assert.equal(body.range, "1M");
    assert.equal(body.timeframe, "1D");
    assert.equal(body.base_value, 100000);
    assert.equal(body.points.length, 3);
    assert.equal(body.points[2].profit_loss, 65.79);
    assert.equal(body.points[2].equity, 100065.79);
    assert.equal(body.points[2].profit_loss_pct, 0.0006579);
    assert.equal(body.scorecard.observations, 3);
    assert.equal(body.scorecard.observed_peak_equity, 100065.79);
    assert.equal(body.scorecard.observed_low_equity, 100000);
    assert.equal(body.scorecard.max_observed_drawdown_pct, 0);
    assert.deepEqual(Object.keys(body.points[0]).sort(), ["equity","profit_loss","profit_loss_pct","timestamp"]);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "https://paper-api.alpaca.markets/v2/account/portfolio/history?period=1M&timeframe=1D");
    assert.equal(requests[0].method, "GET");
    assert.equal(requests[0].redirect, "manual");
    assert.ok(!JSON.stringify(body).includes("PRIVATE"));
    assert.ok(!JSON.stringify(body).includes("TEST_SECRET"));
    const rejected = await handler.fetch(new Request(urlHistory,{method:"POST"}), env, authenticated);
    assert.equal(rejected.status, 405);
    assert.equal(requests.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("portfolio history maps year to Alpaca annual period and rejects untrusted parameters", async () => {
  const originalFetch = globalThis.fetch;
  const observed = [];
  globalThis.fetch = async destination => {
    observed.push(String(destination));
    return Response.json({
      timestamp:[], equity:[], profit_loss:[], profit_loss_pct:[], base_value:null
    });
  };
  const env = {...authorizedEnv, ALPACA_PAPER_KEY_ID:"TEST_KEY", ALPACA_PAPER_SECRET_KEY:"TEST_SECRET"};
  try {
    for(const [range,period] of [["1W","1W"],["3M","3M"],["1Y","1A"]]) {
      const response = await handler.fetch(new Request(url + "/api/alpaca/history?range=" + range), env, authenticated);
      const body = await response.json();
      assert.equal(response.status, 200);
      assert.equal(body.connected, true);
      assert.equal(body.range, range);
      assert.deepEqual(body.points, []);
      assert.equal(observed.at(-1), "https://paper-api.alpaca.markets/v2/account/portfolio/history?period=" + period + "&timeframe=1D");
    }
    for(const query of ["range=1Y%26evil=true", "range=100Y", "range=1M&url=https://elsewhere.invalid", "range=1M&range=1Y"]) {
      const response = await handler.fetch(new Request(url + "/api/alpaca/history?" + query), env, authenticated);
      assert.equal(response.status, 400);
    }
    assert.equal(observed.length, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("portfolio history is unavailable without Access authentication", async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {called = true; return Response.json({});};
  try {
    const response = await handler.fetch(
      new Request(url + "/api/alpaca/history?range=1M"),
      {...authorizedEnv, ALPACA_PAPER_KEY_ID:"TEST_KEY", ALPACA_PAPER_SECRET_KEY:"TEST_SECRET"},
      {}
    );
    assert.equal(response.status, 403);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("portfolio history rejects malicious or malformed points instead of fabricating values", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({
    timestamp:[1762900000,1762986400,1763072800,1763159200],
    equity:[100000,null,100065,100055],
    profit_loss:[0,10,null,-12],
    profit_loss_pct:[0,0.0001,null,null],
    base_value:100000
  });
  try {
    const response = await handler.fetch(new Request(url + "/api/alpaca/history?range=1M"), {
      ...authorizedEnv,ALPACA_PAPER_KEY_ID:"TEST_KEY", ALPACA_PAPER_SECRET_KEY:"TEST_SECRET"
    },authenticated);
    const body=await response.json();
    assert.equal(body.connected,true);
    assert.deepEqual(body.points.map(p=>p.profit_loss),[0,-12]);
    assert.equal(body.points[1].profit_loss_pct,null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("private execution fills are read-only, sanitized and never expose order IDs", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (destination, options) => {
    requests.push({url:String(destination), method:options.method, redirect:options.redirect});
    return Response.json([
      {
        activity_type:"FILL", id:"20261112000000001::PRIVATE-ORDER-ID",
        order_id:"PRIVATE-ORDER-ID", symbol:"SPY", qty:"0.5",
        price:"600.25", side:"buy", type:"partial_fill",
        transaction_time:"2026-11-12T15:01:03.000Z",
        account_number:"SECRET_ACCOUNT_ID"
      },
      {
        activity_type:"FILL", id:"20261112000000000::PRIVATE-ID-2",
        symbol:"AAPL", qty:"2", price:"200", side:"sell",
        type:"fill", transaction_time:"2026-11-12T15:00:00.000Z"
      }
    ]);
  };
  const env={...authorizedEnv,ALPACA_PAPER_KEY_ID:"TEST_KEY",ALPACA_PAPER_SECRET_KEY:"TEST_SECRET"};
  try {
    const response=await handler.fetch(new Request(url+"/api/alpaca/fills"),env,authenticated);
    assert.equal(response.status,200);
    const body=await response.json();
    assert.equal(body.connected,true);
    assert.equal(body.mode,"paper");
    assert.equal(body.fills.length,2);
    assert.equal(body.page_size,50);
    assert.equal(body.next_page_token,null);
    assert.deepEqual(body.fills[0],{
      time:"2026-11-12T15:01:03.000Z",symbol:"SPY",
      side:"buy",qty:"0.5",price:"600.25",
      notional:300.13,type:"partial_fill"
    });
    assert.equal(body.fills[1].side,"sell");
    assert.equal(requests.length,1);
    assert.equal(requests[0].url,"https://paper-api.alpaca.markets/v2/account/activities/FILL?direction=desc&page_size=50");
    assert.equal(requests[0].method,"GET");
    assert.equal(requests[0].redirect,"manual");
    assert.ok(!JSON.stringify(body).includes("PRIVATE"));
    assert.ok(!JSON.stringify(body).includes("SECRET_ACCOUNT_ID"));
    assert.ok(!JSON.stringify(body).includes("TEST_SECRET"));
    const rejected=await handler.fetch(new Request(url+"/api/alpaca/fills",{method:"POST"}),env,authenticated);
    assert.equal(rejected.status,405);
    assert.equal(requests.length,1);
  } finally {globalThis.fetch=originalFetch;}
});

test("trade-history pagination uses only a validated Alpaca cursor", async () => {
  const originalFetch=globalThis.fetch;
  const requests=[];
  globalThis.fetch=async (destination) => {
    requests.push(String(destination));
    return Response.json(Array.from({length:50},(_,i)=>({
      activity_type:"FILL",id:"20261112::"+String(i).padStart(4,"0"),
      symbol:"SPY",qty:"1",price:"600",side:"buy",
      type:"fill",transaction_time:"2026-11-12T15:00:00Z"
    })));
  };
  const env={...authorizedEnv,ALPACA_PAPER_KEY_ID:"TEST_KEY",ALPACA_PAPER_SECRET_KEY:"TEST_SECRET"};
  try {
    const response=await handler.fetch(new Request(url+"/api/alpaca/fills?page_token=20261112%3A%3A0000"),env,authenticated);
    const data=await response.json();
    assert.equal(data.fills.length,50);
    assert.equal(data.next_page_token,"20261112::0049");
    assert.equal(requests[0],"https://paper-api.alpaca.markets/v2/account/activities/FILL?direction=desc&page_size=50&page_token=20261112%3A%3A0000");
    for(const query of [
      "page_token=x%26direction%3Dasc",
      "page_token=%3Cscript%3E",
      "page_token=abc&page_token=def",
      "page_size=1000",
      "page_token="
    ]){
      const invalid=await handler.fetch(new Request(url+"/api/alpaca/fills?"+query),env,authenticated);
      assert.equal(invalid.status,400);
    }
    assert.equal(requests.length,1);
  } finally {globalThis.fetch=originalFetch;}
});

test("trade history fails closed without Cloudflare Access and never calls Alpaca", async () => {
  const originalFetch=globalThis.fetch;
  let requests=0;
  globalThis.fetch=async()=>{requests++;return Response.json([])};
  try{
    const response=await handler.fetch(new Request(url+"/api/alpaca/fills"),
      {...authorizedEnv,ALPACA_PAPER_KEY_ID:"KEY",ALPACA_PAPER_SECRET_KEY:"SECRET"}, {});
    assert.equal(response.status,403);
    assert.equal(requests,0);
  } finally {globalThis.fetch=originalFetch;}
});

test("trade history handles empty fills and missing keys without fake trades", async () => {
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async()=>Response.json([]);
  try {
    const missing=await handler.fetch(new Request(url+"/api/alpaca/fills"),authorizedEnv,authenticated);
    const missingData=await missing.json();
    assert.equal(missingData.connected,false);
    assert.equal(missingData.reason,"alpaca_paper_secrets_missing");
    const result=await handler.fetch(new Request(url+"/api/alpaca/fills"),
      {...authorizedEnv,ALPACA_PAPER_KEY_ID:"KEY",ALPACA_PAPER_SECRET_KEY:"SECRET"},authenticated);
    const body=await result.json();
    assert.equal(body.connected,true);
    assert.deepEqual(body.fills,[]);
    assert.equal(body.next_page_token,null);
  } finally {globalThis.fetch=originalFetch;}
});

test("IEX watchlist returns sanitized multi-symbol snapshots without secrets", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (destination, options) => {
    calls.push({url:String(destination),method:options.method,redirect:options.redirect,headers:options.headers});
    return Response.json({snapshots:{
      SPY: {
        latestTrade:{p:601.23,t:"2026-11-12T18:30:00.123456789Z",secret:"PRIVATE"},
        latestQuote:{bp:601.22,ap:601.25,t:"2026-11-12T18:29:59Z"},
        prevDailyBar:{c:600},dailyBar:{c:601.24},
        order_id:"PRIVATE_ORDER"
      },
      MSFT:{
        latestTrade:{p:450,t:"2026-11-12T18:29:58Z"},
        latestQuote:{bp:449.99,ap:450.01,t:"2026-11-12T18:29:58Z"},
        prevDailyBar:{c:455},dailyBar:{c:450}
      }
    }, account_number:"PRIVATE_ACCOUNT"});
  };
  const env={...authorizedEnv,ALPACA_PAPER_KEY_ID:"TESTKEY",ALPACA_PAPER_SECRET_KEY:"TESTSECRET"};
  try{
    const response=await handler.fetch(new Request(url+"/api/market/watchlist?symbols=SPY,MSFT"),env,authenticated);
    assert.equal(response.status,200);
    const result=await response.json();
    assert.equal(result.connected,true);
    assert.equal(result.feed,"iex");
    assert.equal(result.feed_scope,"single_exchange");
    assert.equal(result.symbols.length,2);
    assert.equal(result.symbols[0].symbol,"SPY");
    assert.equal(result.symbols[0].last_trade,601.23);
    assert.equal(result.symbols[0].bid,601.22);
    assert.equal(result.symbols[0].ask,601.25);
    assert.equal(result.symbols[0].previous_close,600);
    assert.equal(result.symbols[0].change,1.23);
    assert.equal(result.symbols[0].change_percent,0.205);
    assert.equal(result.symbols[1].change,-5);
    assert.equal(calls.length,1);
    assert.equal(calls[0].url,"https://data.alpaca.markets/v2/stocks/snapshots?symbols=SPY%2CMSFT&feed=iex");
    assert.equal(calls[0].method,"GET");
    assert.equal(calls[0].redirect,"manual");
    assert.equal(calls[0].headers["APCA-API-KEY-ID"],"TESTKEY");
    assert.equal(calls[0].headers["APCA-API-SECRET-KEY"],"TESTSECRET");
    assert.ok(!JSON.stringify(result).includes("PRIVATE"));
    assert.ok(!JSON.stringify(result).includes("TESTSECRET"));
  }finally{globalThis.fetch=originalFetch;}
});

test("IEX watchlist preserves unavailable symbols without inventing quotes", async () => {
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async()=>Response.json({snapshots:{
    SPY:{latestTrade:null,latestQuote:null,dailyBar:null,prevDailyBar:{c:599}}
  }});
  try{
    const result=await handler.fetch(new Request(url+"/api/market/watchlist?symbols=SPY,XYZ"),
      {...authorizedEnv,ALPACA_PAPER_KEY_ID:"KEY",ALPACA_PAPER_SECRET_KEY:"SECRET"},authenticated);
    const body=await result.json();
    assert.equal(body.connected,true);
    assert.equal(body.symbols.length,2);
    assert.equal(body.symbols[0].available,false);
    assert.equal(body.symbols[0].last_trade,null);
    assert.equal(body.symbols[0].change,null);
    assert.deepEqual(body.symbols[1],{symbol:"XYZ",available:false});
  }finally{globalThis.fetch=originalFetch;}
});

test("IEX symbol list rejects duplicates, injection, excessive tickers and other query keys", async () => {
  const originalFetch=globalThis.fetch;
  let requests=0;
  globalThis.fetch=async()=>{requests++;return Response.json({snapshots:{}})};
  const env={...authorizedEnv,ALPACA_PAPER_KEY_ID:"KEY",ALPACA_PAPER_SECRET_KEY:"SECRET"};
  try{
    const invalid=[
      "", "symbols=","symbols=SPY,SPY","symbols=SPY,spy",
      "symbols=SPY%26feed%3Dsip","symbols=SPY&feed=sip",
      "symbols=SPY&symbols=QQQ","symbols=SPY,QQQ,",
      "symbols="+Array.from({length:13},(_,i)=>"S"+i).join(","),
      "symbols=SPY%2FUS","symbols=SPY%20OR%201%3D1"
    ];
    for(const params of invalid){
      const response=await handler.fetch(new Request(url+"/api/market/watchlist"+(params?"?"+params:"")),env,authenticated);
      assert.equal(response.status,400,params);
    }
    assert.equal(requests,0);
    const noAuth=await handler.fetch(new Request(url+"/api/market/watchlist?symbols=SPY"),env,{});
    assert.equal(noAuth.status,403);
    assert.equal(requests,0);
    const post=await handler.fetch(new Request(url+"/api/market/watchlist?symbols=SPY",{method:"POST"}),env,authenticated);
    assert.equal(post.status,405);
    assert.equal(requests,0);
  }finally{globalThis.fetch=originalFetch;}
});

test("IEX errors, missing credentials and rate limits are safe and explicit", async () => {
  const originalFetch=globalThis.fetch;
  const env={...authorizedEnv,ALPACA_PAPER_KEY_ID:"KEY",ALPACA_PAPER_SECRET_KEY:"SECRET"};
  try{
    const noKeys=await handler.fetch(new Request(url+"/api/market/watchlist?symbols=AAPL"),authorizedEnv,authenticated);
    assert.equal((await noKeys.json()).reason,"alpaca_paper_secrets_missing");
    for(const [status,reason] of [[401,"alpaca_credentials_rejected"],[429,"alpaca_rate_limited"],[502,"alpaca_service_error"]]){
      globalThis.fetch=async()=>new Response('PRIVATE RESPONSE',{status});
      const response=await handler.fetch(new Request(url+"/api/market/watchlist?symbols=AAPL"),env,authenticated);
      const body=await response.json();
      assert.equal(body.connected,false);
      assert.equal(body.reason,reason);
      assert.equal(body.http_status,status);
      assert.ok(!JSON.stringify(body).includes("PRIVATE"));
    }
    globalThis.fetch=async()=>Response.json({wrong:"shape"});
    const bad=await handler.fetch(new Request(url+"/api/market/watchlist?symbols=AAPL"),env,authenticated);
    assert.equal((await bad.json()).reason,"alpaca_invalid_response");
  }finally{globalThis.fetch=originalFetch;}
});

test("equity scorecard uses period high watermark for percentage drawdown", () => {
  const data = [
    {timestamp: 100, equity: 100},
    {timestamp: 200, equity: 120},
    {timestamp: 300, equity: 90},
    {timestamp: 400, equity: 130}
  ];
  const stats = equityScorecard(data);
  assert.deepEqual(stats, {
    observations: 4,
    first_timestamp: 100,
    last_timestamp: 400,
    observed_peak_equity: 130,
    observed_low_equity: 90,
    max_observed_drawdown_pct: 25,
    max_observed_drawdown_usd: 30
  });
});

test("equity scorecard returns 0% for a rising or flat history, not fake losses", () => {
  assert.equal(equityScorecard([
    {timestamp: 1, equity: 10000},
    {timestamp: 2, equity: 10000},
    {timestamp: 3, equity: 10100}
  ]).max_observed_drawdown_pct, 0);
  assert.equal(equityScorecard([
    {timestamp: 1, equity: 10000},
    {timestamp: 2, equity: 10000}
  ]).max_observed_drawdown_usd, 0);
});

test("equity scorecard refuses to invent drawdown from sparse or missing data", () => {
  const empty = equityScorecard([]);
  assert.equal(empty.observations, 0);
  assert.equal(empty.max_observed_drawdown_pct, null);
  assert.equal(empty.observed_peak_equity, null);
  const single = equityScorecard([{timestamp: 10, equity: 12345}]);
  assert.equal(single.observations, 1);
  assert.equal(single.max_observed_drawdown_pct, null);
  assert.equal(single.max_observed_drawdown_usd, null);
  assert.equal(single.observed_peak_equity, 12345);
});

test("equity scorecard rejects bad data, orders by timestamp, and deduplicates", () => {
  const stats = equityScorecard([
    {timestamp: 3, equity: 90},
    {timestamp: 1, equity: 100},
    {timestamp: 2, equity: 120},
    {timestamp: 2, equity: 999999},
    {timestamp: 4, equity: -1},
    {timestamp: 5, equity: Infinity},
    {timestamp: "6", equity: 100}
  ]);
  assert.equal(stats.observations, 3);
  assert.equal(stats.max_observed_drawdown_pct, 25);
  assert.equal(stats.max_observed_drawdown_usd, 30);
  assert.equal(stats.observed_peak_equity, 120);
  assert.equal(stats.observed_low_equity, 90);
  assert.equal(stats.first_timestamp, 1);
  assert.equal(stats.last_timestamp, 3);
});

test("maximum-dollar drawdown belongs to same event as percentage drawdown", () => {
  const stats = equityScorecard([
    {timestamp:1,equity:100},
    {timestamp:2,equity:80}, // 20% = $20
    {timestamp:3,equity:200},
    {timestamp:4,equity:170} // 15% = $30; not the max percentage
  ]);
  assert.equal(stats.max_observed_drawdown_pct, 20);
  assert.equal(stats.max_observed_drawdown_usd, 20);
});

test("vendored simple-statistics precision sum is active for risk calculations", () => {
  assert.equal(preciseSum([0.1, 0.2, 0.3]), 0.6);
  assert.equal(preciseSum([]), 0);
});

test("Alpaca risk report calculates gross, long, short and concentration correctly", () => {
  const result = positionRiskSummary({equity:"10000.00"}, [
    {symbol:"SPY",side:"long",market_value:"6000.00",unrealized_pl:"500"},
    {symbol:"QQQ",side:"long",market_value:"3000.00",unrealized_pl:"-100"},
    {symbol:"TSLA",side:"short",market_value:"2000.00",unrealized_pl:"-200"},
    {symbol:"AAPL",side:"long",market_value:"1000.00",unrealized_pl:"50"}
  ]);
  assert.equal(result.reported_positions, 4);
  assert.equal(result.priced_positions, 4);
  assert.equal(result.complete, true);
  assert.equal(result.gross_exposure, 12000);
  assert.equal(result.net_exposure, 8000);
  assert.equal(result.long_exposure, 10000);
  assert.equal(result.short_exposure, 2000);
  assert.equal(result.gross_exposure_pct_equity, 120);
  assert.equal(result.largest_position_symbol, "SPY");
  assert.equal(result.largest_position_market_value, 6000);
  assert.equal(result.largest_position_pct_gross, 50);
  assert.equal(result.top_three_pct_gross, 91.67);
  assert.equal(result.open_unrealized_pnl, 250);
});

test("Alpaca account with no positions has exactly zero risk exposure", () => {
  const result = positionRiskSummary({equity:"100000"},[]);
  assert.equal(result.gross_exposure,0);
  assert.equal(result.gross_exposure_pct_equity,0);
  assert.equal(result.long_exposure,0);
  assert.equal(result.short_exposure,0);
  assert.equal(result.open_unrealized_pnl,0);
  assert.equal(result.largest_position_symbol,null);
  assert.equal(result.top_three_pct_gross,null);
});

test("Alpaca missing position values never silently underestimate exposure or unrealized P/L", () => {
  const result = positionRiskSummary({equity:"10000"},[
    {symbol:"AAPL",market_value:"1500",unrealized_pl:"30"},
    {symbol:"MSFT",market_value:null,unrealized_pl:null}
  ]);
  assert.equal(result.complete,false);
  assert.equal(result.missing_market_values,1);
  assert.equal(result.missing_open_pnl,1);
  assert.equal(result.gross_exposure,null);
  assert.equal(result.net_exposure,null);
  assert.equal(result.gross_exposure_pct_equity,null);
  assert.equal(result.largest_position_symbol,null);
  assert.equal(result.open_unrealized_pnl,null);
});

test("risk percentages require positive equity and short positions respect explicit side", () => {
  const result = positionRiskSummary({equity:"0"},[
    {symbol:"NVDA",market_value:"4000",side:"short",unrealized_pl:"-10"}
  ]);
  assert.equal(result.short_exposure,4000);
  assert.equal(result.long_exposure,0);
  assert.equal(result.net_exposure,-4000);
  assert.equal(result.gross_exposure_pct_equity,null);
});

test("authenticated Alpaca account response exposes only sanitized risk summary", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async destination => {
    if(String(destination).endsWith("/v2/account")) {
      return Response.json({equity:"10000",cash:"1000",buying_power:"20000",account_number:"PRIVATE"});
    }
    return Response.json([{symbol:"SPY",side:"long",qty:"2",market_value:"1300",
      unrealized_pl:"50",asset_id:"SECRET_ASSET"}]);
  };
  try {
    const response=await handler.fetch(new Request(url+"/api/alpaca/status"),
      {...authorizedEnv,ALPACA_PAPER_KEY_ID:"TEST_ID",ALPACA_PAPER_SECRET_KEY:"TEST_SECRET"},
      authenticated);
    const data=await response.json();
    assert.equal(data.connected,true);
    assert.equal(data.risk.gross_exposure,1300);
    assert.equal(data.risk.open_unrealized_pnl,50);
    assert.equal(data.risk.largest_position_symbol,"SPY");
    assert.equal(data.positions_display_limited,false);
    assert.ok(!JSON.stringify(data).includes("PRIVATE"));
    assert.ok(!JSON.stringify(data).includes("SECRET_ASSET"));
    assert.ok(!JSON.stringify(data).includes("TEST_SECRET"));
  }finally{globalThis.fetch=originalFetch;}
});

test("self-hosted TradingView bundle is protected, real, and served same-origin", async () => {
  const res = await handler.fetch(new Request(url + "/lightweight-charts.js"), authorizedEnv, authenticated);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /text\/javascript/);
  const script = await res.text();
  assert.ok(script.length > 50000, "Chart package must be a real browser bundle");
  assert.match(script, /TradingView|LightweightCharts/);
  assert.equal(res.headers.get("access-control-allow-origin"), null);
  assert.equal(res.headers.get("cache-control"), "no-store");
  const denied = await handler.fetch(new Request(url + "/lightweight-charts.js"), authorizedEnv, {});
  assert.equal(denied.status, 403);
});

test("IEX daily candlesticks sanitize OHLC bars and never expose Alpaca response metadata", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (destination, opts) => {
    calls.push({url:String(destination),method:opts.method,redirect:opts.redirect,headers:opts.headers});
    return Response.json({
      symbol:"SPY", account_number:"PRIVATE",
      bars: [
        {t:"2026-11-10T05:00:00Z",o:600,h:604,l:598,c:602,v:123456,secret:"PRIVATE"},
        {t:"2026-11-11T05:00:00Z",o:602,h:608,l:601,c:606,v:98765},
        {t:"2026-11-12T05:00:00Z",o:606,h:605,l:601,c:603,v:123}, // invalid high
        {t:"BAD_DATE",o:607,h:610,l:600,c:607,v:100}
      ], next_page_token:null
    });
  };
  try {
    const env={...authorizedEnv,ALPACA_PAPER_KEY_ID:"TEST_ID",ALPACA_PAPER_SECRET_KEY:"TEST_SECRET"};
    const res=await handler.fetch(new Request(url+"/api/market/bars?symbol=SPY&range=3M"),env,authenticated);
    assert.equal(res.status,200);
    const data=await res.json();
    assert.equal(data.connected,true);
    assert.equal(data.feed,"iex");
    assert.equal(data.symbol,"SPY");
    assert.equal(data.range,"3M");
    assert.equal(data.timeframe,"1Day");
    assert.equal(data.bars.length,2);
    assert.deepEqual(data.bars[0],{
      time:"2026-11-10",open:600,high:604,low:598,close:602,volume:123456
    });
    assert.equal(data.truncated,false);
    assert.equal(calls.length,1);
    assert.ok(calls[0].url.startsWith("https://data.alpaca.markets/v2/stocks/SPY/bars?"));
    assert.ok(calls[0].url.includes("feed=iex"));
    assert.ok(calls[0].url.includes("timeframe=1Day"));
    assert.ok(calls[0].url.includes("limit=400"));
    assert.equal(calls[0].method,"GET");
    assert.equal(calls[0].redirect,"manual");
    assert.ok(!JSON.stringify(data).includes("PRIVATE"));
    assert.ok(!JSON.stringify(data).includes("TEST_SECRET"));
  } finally { globalThis.fetch = originalFetch; }
});

test("IEX bars reject untrusted query parameters, bad ranges and anonymous clients", async () => {
  const originalFetch = globalThis.fetch;
  let called = 0;
  globalThis.fetch = async () => {called++; return Response.json({bars:[]});};
  try {
    const env={...authorizedEnv,ALPACA_PAPER_KEY_ID:"TEST_ID",ALPACA_PAPER_SECRET_KEY:"TEST_SECRET"};
    for (const query of [
      "", "symbol=SPY", "symbol=SPY&range=1D",
      "symbol=spy&range=1M", "symbol=SPY&range=1M&feed=sip",
      "symbol=SPY&symbol=QQQ&range=1M",
      "symbol=SPY&range=1M&range=1Y",
      "symbol=SPY%2Ffoo&range=3M",
      "symbol=SPY%26feed%3Dsip&range=3M"
    ]) {
      const res=await handler.fetch(new Request(url+"/api/market/bars?"+query),env,authenticated);
      assert.equal(res.status,400,query);
    }
    assert.equal(called,0);
    const anonymous = await handler.fetch(new Request(url+"/api/market/bars?symbol=SPY&range=1M"),env,{});
    assert.equal(anonymous.status,403);
    const post=await handler.fetch(new Request(url+"/api/market/bars?symbol=SPY&range=1M",{method:"POST"}),env,authenticated);
    assert.equal(post.status,405);
    assert.equal(called,0);
  } finally { globalThis.fetch=originalFetch; }
});

test("IEX bars have honest empty and rate-limit states", async () => {
  const originalFetch=globalThis.fetch;
  const env={...authorizedEnv,ALPACA_PAPER_KEY_ID:"TEST_ID",ALPACA_PAPER_SECRET_KEY:"TEST_SECRET"};
  try {
    globalThis.fetch = async () => Response.json({bars:[],next_page_token:null});
    let res=await handler.fetch(new Request(url+"/api/market/bars?symbol=QQQ&range=1M"),env,authenticated);
    let data=await res.json();
    assert.equal(data.connected,true);
    assert.deepEqual(data.bars,[]);
    globalThis.fetch=async()=>new Response("PRIVATE",{status:429});
    res=await handler.fetch(new Request(url+"/api/market/bars?symbol=QQQ&range=1M"),env,authenticated);
    data=await res.json();
    assert.equal(data.connected,false);
    assert.equal(data.reason,"alpaca_rate_limited");
    assert.equal(data.http_status,429);
    assert.ok(!JSON.stringify(data).includes("PRIVATE"));
  }finally{globalThis.fetch=originalFetch;}
});

test("actual TradingView chart adapter accepts ISO daily candles and P/L timestamps", () => {
  // Run the real pure frontend adapter (not a reimplementation), to prevent
  // accidentally double-escaped date regexes from blanking the charts.
  const app = readFileSync(new URL("../../app.js", import.meta.url), "utf8");
  const begin = app.indexOf("  function chartDailyData(");
  const end = app.indexOf("\n  function renderTradingViewPnl(", begin);
  assert.ok(begin >= 0 && end > begin);
  const chartDailyData = new Function(app.slice(begin,end) + "\nreturn chartDailyData;")();
  const candles = chartDailyData([
    {time:"2026-11-11",open:10,high:14,low:9,close:13},
    {time:"BAD",open:12,high:15,low:11,close:14},
    {time:"2026-11-10",open:9,high:12,low:8,close:11},
    {time:"2026-11-11",open:10,high:15,low:9,close:14}
  ], p => ({open:p.open,high:p.high,low:p.low,close:p.close}));
  assert.deepEqual(candles, [
    {time:"2026-11-10",open:9,high:12,low:8,close:11},
    {time:"2026-11-11",open:10,high:15,low:9,close:14}
  ]);
  const pnl = chartDailyData([
    {timestamp:1762732800,profit_loss:0},
    {timestamp:1762819200,profit_loss:65.79}
  ], p => ({value:p.profit_loss}));
  assert.deepEqual(pnl,[
    {time:"2025-11-10",value:0},
    {time:"2025-11-11",value:65.79}
  ]);
});

test("strategy-engine script is served only behind Cloudflare Access", async () => {
  const request = new Request(url+"/strategy-engine.js");
  const allowed = await handler.fetch(request,authorizedEnv,authenticated);
  assert.equal(allowed.status,200);
  const script=await allowed.text();
  assert.match(script,/LeviStrategyEngine/);
  assert.match(script,/levios-ma-v1/);
  assert.equal(allowed.headers.get("access-control-allow-origin"),null);
  const denied=await handler.fetch(request,authorizedEnv,{});
  assert.equal(denied.status,403);
});

test("validation engine JavaScript is guarded by Cloudflare Access and cannot expose account data", async () => {
  const resource = new Request(url+"/validation-engine.js");
  const allowed=await handler.fetch(resource,authorizedEnv,authenticated);
  assert.equal(allowed.status,200);
  assert.match(allowed.headers.get("content-type"),/text\/javascript/);
  const script=await allowed.text();
  assert.match(script,/LeviStrategyValidation/);
  assert.match(script,/levios-validation-v1/);
  assert.ok(!script.includes("APCA-API-SECRET-KEY"));
  assert.equal(allowed.headers.get("access-control-allow-origin"),null);
  const denied=await handler.fetch(resource,authorizedEnv,{});
  assert.equal(denied.status,403);
  const noPost=await handler.fetch(new Request(url+"/validation-engine.js",{method:"POST"}),authorizedEnv,authenticated);
  assert.equal(noPost.status,405);
});
