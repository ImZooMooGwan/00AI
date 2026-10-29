import assert from "node:assert/strict";
import test from "node:test";

test("renders the administrative service hub", async (t) => {
  const priorCaches = globalThis.caches;
  globalThis.caches = { default: { async match() { return undefined; }, async put() {} } };
  t.after(() => { if (priorCaches === undefined) delete globalThis.caches; else globalThis.caches = priorCaches; });
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  const html = await response.text();
  assert.match(html, /행정에 필요한 도구/);
  assert.match(html, /00AI DOCS/);
  assert.match(html, /00AI Harness/);
  assert.match(html, /AI 정책상황실/);
  assert.match(html, /청년정책 데이터허브/);
  assert.match(html, /초과근무 알람/);
  assert.doesNotMatch(html, /프로젝트 갤러리/);
  assert.match(html, /https:\/\/policy\.00ai\.kr/);
  assert.match(html, /https:\/\/yhub\.00ai\.kr/);
});
