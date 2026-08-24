import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("a11y", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);
const env = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
const ctx = { waitUntil() {}, passThroughOnException() {} };

async function html(path) {
  const response = await worker.fetch(new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }), env, ctx);
  assert.equal(response.status, 200);
  return response.text();
}

test("root exposes Korean language, skip navigation, landmark and accessible policy galaxy", async () => {
  const body = await html("/");
  assert.match(body, /<html[^>]+lang="ko"/);
  assert.match(body, /href="#main"[^>]*>본문 바로가기/);
  assert.match(body, /<main[^>]+id="main"/);
  assert.match(body, /aria-labelledby="atlas-graph-title atlas-graph-desc"/);
  assert.match(body, /대한민국 청년정책 은하 관계지도/);
  assert.match(body, /드래그로 회전하고 휠이나 손가락으로 확대/);
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /prefers-reduced-motion/);
});

test("policy detail provides labelled workflow and text status alternatives", async () => {
  const body = await html("/policy/daejeon-housing-deposit-interest");
  assert.match(body, /aria-label="정책 신청 절차"/);
  assert.match(body, /검증 완료/);
  assert.match(body, /신청 가능/);
});
