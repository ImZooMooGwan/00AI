import { describe, expect, it } from "vitest";

import type { RuntimeEnv } from "../src/env";
import { fetchYHubSnapshotPolicies } from "../src/ingestion/yhub-snapshot-client";

describe("Y-HUB verified snapshot bootstrap", () => {
  it("normalizes the public snapshot into persistent MCP records", async () => {
    const fetcher: typeof fetch = async (input) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      if (url.pathname.endsWith("/sources")) {
        return Response.json({
          data: [
            {
              id: "src-daejeon",
              name: "대전청년포털",
              url: "https://www.daejeonyouthportal.kr/",
            },
          ],
        });
      }
      return Response.json({
        meta: { datasetVersion: "2026.08.24-test" },
        data: [
          {
            id: "YH-POL-TEST",
            slug: "daejeon-housing-test",
            officialName: "대전 청년 주거지원",
            summary: "대전 청년의 주거비 부담 완화",
            category: "주거",
            region: "대전",
            regionCode: "30",
            leadOrganization: "대전광역시",
            age: "19세 이상 39세 이하",
            eligibility: ["대전 거주", "무주택 청년"],
            benefit: "월세 일부 지원",
            applicationPeriod: "상시",
            applicationChannel: "대전청년포털",
            requiredDocuments: ["신청서"],
            legalBasis: "공식 사업지침",
            sourceId: "src-daejeon",
            verificationStatus: "verified",
            lastReviewedAt: "2026-08-24",
          },
        ],
      });
    };

    const result = await fetchYHubSnapshotPolicies(
      { YHUB_SNAPSHOT_API_URL: "https://yhub.00ai.kr/api/v1" } as RuntimeEnv,
      "2026-08-25T00:00:00.000Z",
      fetcher,
    );

    expect(result.datasetVersion).toBe("2026.08.24-test");
    expect(result.policies).toHaveLength(1);
    expect(result.policies[0]?.policy).toEqual(
      expect.objectContaining({
        id: "yhub:YH-POL-TEST",
        source: "yhub_verified_snapshot",
        title: "대전 청년 주거지원",
        regionCodes: ["30"],
        isMock: false,
      }),
    );
    expect(result.policies[0]?.evidence[0]).toEqual(
      expect.objectContaining({
        sourceName: "대전청년포털",
        confidence: "high",
        conflictNote: null,
      }),
    );
  });
});
