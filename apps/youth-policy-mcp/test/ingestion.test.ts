import { describe, expect, it } from "vitest";

import { normalizeYouthPolicy } from "../src/ingestion/normalize";
import { assertAllowedSourceUrl } from "../src/ingestion/http";
import { parseYouthPolicyPayload } from "../src/ingestion/youth-payload";
import jsonFixture from "./fixtures/youth-policies.json?raw";
import xmlFixture from "./fixtures/youth-policies.xml?raw";

describe("온통청년 payload parsing", () => {
  it("parses the current JSON response shape", () => {
    const parsed = parseYouthPolicyPayload(jsonFixture, "application/json");
    expect(parsed.format).toBe("json");
    expect(parsed.totalCount).toBe(1);
    expect(parsed.items[0]?.plcyNo).toBe("R202600001");
  });

  it("parses XML without a DOM runtime", () => {
    const parsed = parseYouthPolicyPayload(xmlFixture, "application/xml");
    expect(parsed.format).toBe("xml");
    expect(parsed.items[0]?.plcyNm).toBe("세종 청년 창업 지원");
  });

  it("rejects an unknown response shape instead of storing it", () => {
    expect(() => parseYouthPolicyPayload('{"unexpected":true}')).toThrow(/응답 구조/);
  });

  it("does not expose an upstream error payload", () => {
    expect(() =>
      parseYouthPolicyPayload('{"response":{"header":{"resultCode":"AUTH_KEY_123"}}}'),
    ).toThrow(/오류 코드 AUTH_KEY_123/);
  });
});

describe("normalization", () => {
  it("normalizes a policy and creates provenance", async () => {
    const item = parseYouthPolicyPayload(jsonFixture).items[0];
    expect(item).toBeDefined();
    const normalized = await normalizeYouthPolicy(item!, "2026-08-24T00:00:00.000Z");
    expect(normalized.policy.regionCodes).toEqual(["30"]);
    expect(normalized.policy.ageMin).toBe(19);
    expect(normalized.policy.sourceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(normalized.evidence.length).toBeGreaterThan(0);
    expect(normalized.policy.isMock).toBe(false);
  });

  it("requires both an official identifier and title", async () => {
    await expect(normalizeYouthPolicy({ plcyNm: "제목만" }, new Date().toISOString())).rejects.toThrow(
      /ID 누락/,
    );
  });

  it("allows only official source hosts", () => {
    expect(assertAllowedSourceUrl("https://www.youthcenter.go.kr").hostname).toBe(
      "www.youthcenter.go.kr",
    );
    expect(() => assertAllowedSourceUrl("https://example.com/secret")).toThrow(/허용목록/);
  });
});
