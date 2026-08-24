import { describe, expect, it } from "vitest";

import { MemoryPolicyRepository } from "../src/db/memory-repository";
import { YouthPolicyService } from "../src/domain/service";
import { sampleBundle } from "./fixtures";

describe("YouthPolicyService", () => {
  it("returns policy summaries with status, basis date, and source", async () => {
    const service = new YouthPolicyService(new MemoryPolicyRepository([sampleBundle()]));
    const result = await service.search({
      query: "주거비",
      regionCodes: ["대전"],
      applicationStatus: "closing_soon",
      asOf: "2026-08-25",
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        policyId: "youth-center:R202600001",
        applicationStatus: "closing_soon",
        source: expect.objectContaining({ sourcePolicyId: "R202600001" }),
      }),
    );
  });

  it("does not replace an invalid region with nationwide results", async () => {
    const service = new YouthPolicyService(new MemoryPolicyRepository([sampleBundle()]));
    await expect(service.search({ regionCodes: ["없는지역"] })).rejects.toMatchObject({
      code: "INVALID_REGION",
    });
  });

  it("returns detailed provenance and manual-review warnings", async () => {
    const service = new YouthPolicyService(new MemoryPolicyRepository([sampleBundle()]));
    const detail = await service.getPolicy("youth-center:R202600001", "2026-08-24");
    expect(detail.sources).toHaveLength(1);
    expect(detail.warnings).toContain("자유서술형 지원조건은 자동 판정하지 않습니다.");
  });

  it("compares facts separately from interpretation", async () => {
    const first = sampleBundle();
    const second = sampleBundle({
      id: "youth-center:R202600002",
      sourcePolicyId: "R202600002",
      title: "세종 청년 주거비 지원",
      regionCodes: ["36"],
      regionNames: ["세종"],
    });
    const service = new YouthPolicyService(new MemoryPolicyRepository([first, second]));
    const result = await service.compare({
      policyIds: [first.policy.id, second.policy.id],
      asOf: "2026-08-24",
    });
    expect(result.comparison).toHaveLength(2);
    expect(result.facts.differentFields).toContain("regions");
    expect(result.interpretation.type).toBe("rule_based_signal");
  });

  it("returns citation-ready evidence", async () => {
    const service = new YouthPolicyService(new MemoryPolicyRepository([sampleBundle()]));
    const result = await service.getEvidence("youth-center:R202600001", ["title"]);
    expect(result.evidence[0]?.citation).toContain("온통청년 청년정책 API");
    expect(result.evidence[0]?.sourceHash).toHaveLength(64);
  });

  it("preserves versions and returns field-level change history", async () => {
    const repository = new MemoryPolicyRepository();
    const first = sampleBundle();
    await repository.upsertPolicy({ ...first, rawResponse: { amount: 20 } }, first.policy.collectedAt);
    const second = sampleBundle({
      supportDetails: "월 최대 30만원 지원",
      sourceHash: "b".repeat(64),
      collectedAt: "2026-08-25T00:00:00Z",
      lastSeenAt: "2026-08-25T00:00:00Z",
    });
    await repository.upsertPolicy({ ...second, rawResponse: { amount: 30 } }, second.policy.collectedAt);
    const result = await new YouthPolicyService(repository).getChanges(first.policy.id);
    expect(result.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "supportDetails", impact: "major" }),
      ]),
    );
  });
});
