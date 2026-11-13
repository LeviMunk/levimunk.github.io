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
  assert.match(await response.text(), /LeviOS Trading Lab/);
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
