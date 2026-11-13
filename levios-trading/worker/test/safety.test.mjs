import test from "node:test";
import assert from "node:assert/strict";
import handler from "../src/index.mjs";

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
