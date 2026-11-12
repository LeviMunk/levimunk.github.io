import test from "node:test";
import assert from "node:assert/strict";
import handler from "../src/index.mjs";

const url = "https://levios-alpaca.example.workers.dev";
const authenticated = { access: { getIdentity: async () => ({ email: "owner@example.test" }) } };
const authorizedEnv = { ALLOWED_EMAIL: "owner@example.test" };

test("denies requests without Cloudflare Access context", async () => {
  const response = await handler.fetch(new Request(url), authorizedEnv, {});
  assert.equal(response.status, 403);
});

test("denies a different identity even with Access context", async () => {
  const response = await handler.fetch(new Request(url), authorizedEnv, {
    access: { getIdentity: async () => ({ email: "someoneelse@example.test" }) }
  });
  assert.equal(response.status, 403);
});

test("requires explicit configured owner email", async () => {
  const response = await handler.fetch(new Request(url), {}, authenticated);
  assert.equal(response.status, 403);
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
