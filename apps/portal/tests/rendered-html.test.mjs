import assert from "node:assert/strict";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("renders homepage with project discovery and case sources", async (t) => {
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
  assert.match(html, developmentPreviewMeta);
  assert.match(html, /GitHub 자동 등록/);
  assert.match(html, /프로젝트 갤러리/);
  assert.match(html, /청년 AI 보편복지 모델/);
  assert.match(html, /https:\/\/www\.hani\.co\.kr\/arti\/area\/chungcheong\/1272905\.html/);
  assert.match(html, /https:\/\/policy\.00ai\.kr/);
  assert.match(html, /https:\/\/yhub\.00ai\.kr/);
});
