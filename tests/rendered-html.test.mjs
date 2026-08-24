import assert from "node:assert/strict";
import test from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);

const env = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
const ctx = { waitUntil() {}, passThroughOnException() {} };

test("renders the complete Y-HUB data hub with the policy galaxy in the first view", async () => {
  const response = await worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), env, ctx);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assert.match(html, /청년정책데이터허브 Y-HUB/);
  assert.match(html, /청년정책 은하/);
  assert.match(html, /Y-HUB 온톨로지/);
  assert.match(html, /분야는 행성/);
  assert.match(html, /AI로 시각화한/);
  assert.match(html, /POLICY DATA PULSE/);
  assert.match(html, /정책을 찾는 데서 끝나지 않습니다/);
  assert.match(html, /오늘의 정책 변화/);
  assert.match(html, /대한민국 정책지도/);
  assert.match(html, /청년지표 관측소/);
  assert.match(html, /같은 데이터, 다른 질문/);
  assert.match(html, /청년정책 MCP 연결/);
  assert.match(html, /GitHub 소스/);
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
  assert.equal(payload.youthPolicyMcp.state, "not_configured");
  assert.ok(payload.connectors.every((connector) => connector.keyConfigured === false));
  assert.doesNotMatch(JSON.stringify(payload), /SYNC_SECRET/);
});

test("falls back to the verified snapshot when MCP and D1 are unavailable", async () => {
  const response = await worker.fetch(new Request("http://localhost/api/v1/live-policies"), env, ctx);
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.meta.provider, "verified-snapshot");
  assert.equal(payload.meta.fallbackUsed, true);
  assert.ok(payload.data.length >= 30);
});

test("uses the GitHub youth-policy MCP contract when the remote server is healthy", async () => {
  const originalFetch = globalThis.fetch;
  const toolNames = [
    "search_youth_policies",
    "get_youth_policy",
    "check_policy_eligibility",
    "compare_youth_policies",
    "get_policy_changes",
    "get_policy_evidence",
  ];
  globalThis.fetch = async (input, init = {}) => {
    const remoteUrl = typeof input === "string" ? input : input.url;
    if (remoteUrl === "https://mcp.example.test/youth/health") {
      return Response.json({
        ok: true,
        service: "00AI Youth Policy MCP",
        version: "0.1.0",
        tools: 6,
        database: { connected: true, policy_count: 17 },
        last_sync_at: "2026-08-24T11:00:00.000Z",
        last_sync_status: "succeeded",
      });
    }
    if (remoteUrl === "https://mcp.example.test/youth") {
      const rpc = JSON.parse(String(init.body));
      if (rpc.method === "tools/list") {
        return Response.json({
          jsonrpc: "2.0",
          id: rpc.id,
          result: { tools: toolNames.map((name) => ({ name })) },
        });
      }
      if (rpc.method === "tools/call") {
        const envelope = {
          ok: true,
          data: {
            items: [
              {
                policyId: "youth-center:R202600001",
                title: "대전 청년 주거비 지원",
                summary: "공식 MCP 검색 결과",
                regions: ["대전"],
                targetAge: { minimum: 19, maximum: 39 },
                applicationStatus: "open",
                matchingReasons: ["query"],
                source: {
                  sourcePolicyId: "R202600001",
                  originalUrl: "https://www.youthcenter.go.kr/",
                  collectedAt: "2026-08-24T11:00:00.000Z",
                },
              },
            ],
            pagination: { total: 1, page: 1, pageSize: 20, totalPages: 1 },
          },
          meta: {
            as_of: "2026-08-24",
            retrieved_at: "2026-08-24T11:01:00.000Z",
            sources: [{ source_name: "온통청년" }],
            warnings: [],
            is_cached: false,
          },
        };
        return Response.json({
          jsonrpc: "2.0",
          id: rpc.id,
          result: {
            structuredContent: envelope,
            content: [{ type: "text", text: JSON.stringify(envelope) }],
          },
        });
      }
    }
    return originalFetch(input, init);
  };

  const mcpEnv = {
    ...env,
    YOUTH_POLICY_MCP_URL: "https://mcp.example.test/youth",
    YOUTH_POLICY_MCP_TIMEOUT_MS: "1000",
    SYNC_SECRET: "must-not-leak",
  };
  try {
    const statusResponse = await worker.fetch(
      new Request("http://localhost/api/v1/mcp/status"),
      mcpEnv,
      ctx,
    );
    const status = await statusResponse.json();
    assert.equal(status.state, "connected");
    assert.equal(status.toolCount, 6);
    assert.equal(status.database.policyCount, 17);
    assert.doesNotMatch(JSON.stringify(status), /must-not-leak/);

    const searchResponse = await worker.fetch(
      new Request("http://localhost/api/v1/live-policies?q=주거&region=대전"),
      mcpEnv,
      ctx,
    );
    const search = await searchResponse.json();
    assert.equal(search.meta.provider, "youth-policy-mcp");
    assert.equal(search.meta.fallbackUsed, false);
    assert.equal(search.data[0].id, "youth-center:R202600001");
    assert.equal(search.data[0].sourceId, "youth-policy-mcp");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects unauthenticated manual synchronization", async () => {
  const response = await worker.fetch(new Request("http://localhost/api/system/sync", { method: "POST" }), env, ctx);
  assert.equal(response.status, 401);
});
