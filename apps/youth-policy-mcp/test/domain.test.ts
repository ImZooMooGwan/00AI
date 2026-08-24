import { describe, expect, it } from "vitest";

import { diffPolicies } from "../src/domain/changes";
import { calculateApplicationStatus, currentKoreanDate, normalizeDate } from "../src/domain/date";
import { evaluateEligibility } from "../src/domain/eligibility";
import { normalizeRegionCode, parseRegionValues, regionMatches } from "../src/domain/regions";
import { sampleBundle, samplePolicy } from "./fixtures";

describe("date and application status", () => {
  it("uses the Asia/Seoul calendar date", () => {
    expect(currentKoreanDate(new Date("2026-08-23T16:00:00Z"))).toBe("2026-08-24");
  });

  it.each([
    ["2026-07-31", "upcoming"],
    ["2026-08-10", "open"],
    ["2026-08-25", "closing_soon"],
    ["2026-09-01", "closed"],
  ] as const)("calculates %s as %s", (asOf, expected) => {
    expect(calculateApplicationStatus(samplePolicy(), asOf)).toBe(expected);
  });

  it("treats policies without application dates as always open", () => {
    expect(
      calculateApplicationStatus(
        samplePolicy({ applicationStartDate: null, applicationEndDate: null }),
        "2026-08-24",
      ),
    ).toBe("always_open");
  });

  it("normalizes Korean date separators and rejects free text", () => {
    expect(normalizeDate("2026. 8. 24.")).toBe("2026-08-24");
    expect(normalizeDate("상시 모집")).toBeNull();
  });
});

describe("region handling", () => {
  it("recognizes region names and legal codes", () => {
    expect(normalizeRegionCode("대전광역시")).toBe("30");
    expect(normalizeRegionCode("30110")).toBe("30");
  });

  it("does not silently replace an unknown region", () => {
    expect(() => normalizeRegionCode("없는지역")).toThrow(/지원하지 않는 지역/);
  });

  it("allows nationwide policies to match a local request", () => {
    expect(regionMatches(["00"], ["30"])).toBe(true);
    expect(regionMatches(["36"], ["30"])).toBe(false);
  });

  it("does not infer nationwide coverage when the source region is missing", () => {
    expect(parseRegionValues(null)).toEqual({ codes: [], names: [] });
  });
});

describe("eligibility", () => {
  it("returns manual review when a free-text income condition remains", () => {
    const result = evaluateEligibility(sampleBundle(), {
      age: 29,
      region: "대전",
      employmentStatus: "미취업",
      incomeBand: "중위소득 100%",
    });
    expect(result.status).toBe("manual_review");
    expect(result.checks.some((check) => check.condition === "소득" && check.state === "manual")).toBe(true);
  });

  it("returns needs_more_info when required profile data is missing", () => {
    const result = evaluateEligibility(sampleBundle({ incomeCondition: null }), {});
    expect(result.status).toBe("needs_more_info");
    expect(result.missingInformation).toContain("연령");
    expect(result.missingInformation).toContain("거주지역");
  });

  it("returns ineligible on a deterministic age failure", () => {
    const result = evaluateEligibility(sampleBundle({ incomeCondition: null }), {
      age: 45,
      region: "대전",
      employmentStatus: "미취업",
    });
    expect(result.status).toBe("ineligible");
  });
});

describe("change detection", () => {
  it("classifies support and application changes as major", () => {
    const changes = diffPolicies(
      samplePolicy(),
      samplePolicy({ supportDetails: "월 최대 30만원 지원", applicationEndDate: "2026-09-10" }),
    );
    expect(changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "supportDetails", impact: "major" }),
        expect.objectContaining({ field: "applicationEndDate", impact: "major" }),
      ]),
    );
  });

  it("ignores collection timestamps", () => {
    const changes = diffPolicies(samplePolicy(), samplePolicy({ collectedAt: "2026-08-25T00:00:00Z" }));
    expect(changes).toHaveLength(0);
  });
});
