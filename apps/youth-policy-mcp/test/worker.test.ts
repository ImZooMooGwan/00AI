import { env, exports } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";

import { D1PolicyRepository } from "../src/db/d1-repository";
import { sampleBundle } from "./fixtures";

async function rpcBody(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (response.headers.get("content-type")?.includes("text/event-stream")) {
    const data = text
      .split("\n")
      .find((line) => line.startsWith("data:"))
      ?.slice(5)
      .trim();
    return JSON.parse(data ?? "{}") as Record<string, unknown>;
  }
  return JSON.parse(text) as Record<string, unknown>;
}

function mcpRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/youth", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": "2025-06-18",
    },
    body: JSON.stringify(body),
  });
}

async function callTool(
  id: number,
  name: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const response = await exports.default.fetch(
    mcpRequest({
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: { name, arguments: args },
    }),
  );
  expect(response.status).toBe(200);
  return rpcBody(response);
}

describe("Worker HTTP surface", () => {
  beforeAll(async () => {
    const repository = new D1PolicyRepository(env.DB);
    const first = sampleBundle();
    const second = sampleBundle({
      id: "youth-center:R202600002",
      sourcePolicyId: "R202600002",
      title: "세종 청년 창업 지원",
      largeCategory: "창업",
      mediumCategory: "사업화",
      regionCodes: ["36"],
      regionNames: ["세종"],
      incomeCondition: null,
      sourceHash: "b".repeat(64),
    });
    await repository.upsertPolicy(
      { ...first, rawResponse: { plcyNo: first.policy.sourcePolicyId } },
      first.policy.collectedAt,
    );
    await repository.upsertPolicy(
      { ...second, rawResponse: { plcyNo: second.policy.sourcePolicyId } },
      second.policy.collectedAt,
    );
  });

  it("reports health without exposing configuration secrets", async () => {
    const response = await exports.default.fetch("http://localhost/youth/health");
    expect(response.status).toBe(200);
    const body = await response.json<Record<string, unknown>>();
    expect(body).toEqual(
      expect.objectContaining({
        ok: true,
        service: "00AI Youth Policy MCP",
        tools: 7,
        hasa: expect.objectContaining({ state: "key_required" }),
      }),
    );
    expect(JSON.stringify(body)).not.toContain("test-sync-secret");
  });

  it("serves an MCP initialize exchange over Streamable HTTP", async () => {
    const response = await exports.default.fetch(
      mcpRequest({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
      }),
    );
    expect(response.status).toBe(200);
    const rpc = await rpcBody(response);
    expect(rpc).toEqual(
      expect.objectContaining({
        jsonrpc: "2.0",
        id: 1,
        result: expect.objectContaining({
          serverInfo: expect.objectContaining({ name: "00ai-youth-policy-mcp" }),
        }),
      }),
    );
  });

  it("lists the six deterministic tools and the HASA read-only analysis tool", async () => {
    const response = await exports.default.fetch(
      mcpRequest({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
    );
    expect(response.status).toBe(200);
    const rpc = await rpcBody(response);
    const result = rpc.result as { tools?: Array<{ name: string; annotations?: Record<string, boolean> }> };
    expect(result.tools?.map((tool) => tool.name)).toEqual([
      "search_youth_policies",
      "get_youth_policy",
      "check_policy_eligibility",
      "compare_youth_policies",
      "get_policy_changes",
      "get_policy_evidence",
      "analyze_youth_policy_question",
    ]);
    expect(result.tools?.every((tool) => tool.annotations?.readOnlyHint === true)).toBe(true);
  });

  it("executes all six deterministic tools through the MCP protocol", async () => {
    const calls: Array<[string, Record<string, unknown>]> = [
      [
        "search_youth_policies",
        { query: "주거", region_codes: ["대전"], as_of: "2026-08-24" },
      ],
      ["get_youth_policy", { policy_id: "youth-center:R202600001", as_of: "2026-08-24" }],
      [
        "check_policy_eligibility",
        {
          policy_id: "youth-center:R202600001",
          profile: { age: 29, region: "대전", employment_status: "미취업" },
        },
      ],
      [
        "compare_youth_policies",
        {
          policy_ids: ["youth-center:R202600001", "youth-center:R202600002"],
          as_of: "2026-08-24",
        },
      ],
      ["get_policy_changes", { policy_id: "youth-center:R202600001" }],
      ["get_policy_evidence", { policy_id: "youth-center:R202600001", fields: ["title"] }],
    ];

    for (const [index, [name, args]] of calls.entries()) {
      const rpc = await callTool(100 + index, name, args);
      expect(rpc.error).toBeUndefined();
      const result = rpc.result as { isError?: boolean; structuredContent?: { ok?: boolean } };
      expect(result.isError).not.toBe(true);
      expect(result.structuredContent?.ok).toBe(true);
    }
  });

  it("supports CORS preflight only for allowed origins", async () => {
    const response = await exports.default.fetch(
      new Request("http://localhost/youth", {
        method: "OPTIONS",
        headers: { Origin: "http://localhost:5173" },
      }),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
  });

  it("protects manual synchronization with a bearer secret", async () => {
    const response = await exports.default.fetch(
      new Request("http://localhost/admin/sync", {
        method: "POST",
        headers: { Authorization: "Bearer wrong-secret" },
      }),
    );
    expect(response.status).toBe(401);
    expect(await response.text()).not.toContain("test-sync-secret");
  });

  it("does not disclose internal paths for unknown routes", async () => {
    const response = await exports.default.fetch("http://localhost/private");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });
});
