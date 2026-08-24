import assert from "node:assert/strict";
import test from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);

const env = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
const ctx = { waitUntil() {}, passThroughOnException() {} };

test("renders the immersive Y-HUB policy galaxy with production metadata", async () => {
  const response = await worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), env, ctx);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assert.match(html, /청년정책데이터허브 Y-HUB/);
  assert.match(html, /청년정책 은하/);
  assert.match(html, /Y-HUB 온톨로지/);
  assert.match(html, /분야는 행성/);
  assert.match(html, /aria-label="정책 은하 움직임 제어"/);
  assert.match(html, /자동 공전 일시 정지/);
  assert.match(html, /aria-label="정책 변화 연대기"/);
  assert.doesNotMatch(html, /codex-preview/);
});

test("serves at least thirty policy records through Open API v1", async () => {
  const response = await worker.fetch(new Request("http://localhost/api/v1/policies"), env, ctx);
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.meta.apiVersion, "v1");
  assert.ok(payload.meta.recordCount >= 30);
  assert.equal(payload.data.length, payload.meta.recordCount);
});

test("serves a standards-compatible RSS change feed", async () => {
  const response = await worker.fetch(new Request("http://localhost/feed/changes"), env, ctx);
  const body = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /application\/rss\+xml/);
  assert.match(body, /<rss version="2.0">/);
  assert.match(body, /Y-HUB 정책 변경 피드/);
});

test("reports connector readiness without exposing credentials", async () => {
  const response = await worker.fetch(new Request("http://localhost/api/v1/collection-status"), env, ctx);
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.storage, "unavailable");
  assert.equal(payload.connectors.length, 3);
  assert.ok(payload.connectors.every((connector) => connector.keyConfigured === false));
  assert.doesNotMatch(JSON.stringify(payload), /SYNC_SECRET/);
});

test("rejects unauthenticated manual synchronization", async () => {
  const response = await worker.fetch(new Request("http://localhost/api/system/sync", { method: "POST" }), env, ctx);
  assert.equal(response.status, 401);
});
