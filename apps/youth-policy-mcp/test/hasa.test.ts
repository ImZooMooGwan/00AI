import { describe, expect, it } from "vitest";

import { analyzeWithHasa, getHasaConfiguration } from "../src/ai/hasa-client";
import type { RuntimeEnv } from "../src/env";

const context = {
  question: "대전의 주거 지원을 알려줘",
  asOf: "2026-08-25",
  policies: [
    {
      policyId: "yhub:YH-POL-0001",
      title: "대전 청년월세지원사업",
      summary: "무주택 청년의 월세를 지원",
      regions: ["대전"],
      applicationStatus: "always_open",
      source: {
        sourceName: "대전청년포털",
        sourcePolicyId: "YH-POL-0001",
        originalUrl: "https://www.daejeonyouthportal.kr/",
        collectedAt: "2026-08-25T00:00:00.000Z",
      },
    },
  ],
};

describe("HASA client", () => {
  it("calls the official OpenAI-compatible endpoint without exposing the key", async () => {
    let authorization = "";
    let requestedModel = "";
    const fetcher: typeof fetch = async (_input, init) => {
      authorization = new Headers(init?.headers).get("Authorization") ?? "";
      requestedModel = (JSON.parse(String(init?.body)) as { model: string }).model;
      return Response.json({
        choices: [{ message: { content: "대전 청년월세지원사업을 확인하세요. [yhub:YH-POL-0001]" } }],
      });
    };
    const env = {
      HASA_API_KEY: "test-hasa-secret",
      HASA_API_BASE_URL: "https://open.hasa.re.kr/v1",
      HASA_MODEL: "exaone-4.0-32b",
    } as RuntimeEnv;

    const result = await analyzeWithHasa(env, context, fetcher);

    expect(authorization).toBe("Bearer test-hasa-secret");
    expect(requestedModel).toBe("exaone-4.0-32b");
    expect(result).toEqual({
      provider: "HASA",
      model: "exaone-4.0-32b",
      analysis: "대전 청년월세지원사업을 확인하세요. [yhub:YH-POL-0001]",
    });
    expect(JSON.stringify(result)).not.toContain("test-hasa-secret");
  });

  it("requires a secret key and rejects non-official hosts", async () => {
    await expect(analyzeWithHasa({} as RuntimeEnv, context)).rejects.toMatchObject({
      code: "HASA_API_KEY_REQUIRED",
    });
    expect(() =>
      getHasaConfiguration({ HASA_API_BASE_URL: "https://example.com/v1" } as RuntimeEnv),
    ).toThrow(/공식 HTTPS 호스트/);
  });
});
