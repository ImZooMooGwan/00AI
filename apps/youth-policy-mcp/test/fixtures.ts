import type { Policy, PolicyBundle } from "../src/domain/types";

export function samplePolicy(overrides: Partial<Policy> = {}): Policy {
  return {
    id: "youth-center:R202600001",
    source: "youth_center",
    sourcePolicyId: "R202600001",
    title: "대전 청년 주거비 지원",
    description: "대전 거주 청년의 주거비를 지원합니다.",
    supportDetails: "월 최대 20만원 지원",
    largeCategory: "주거",
    mediumCategory: "주거비 지원",
    managingOrganization: "대전광역시",
    operatingOrganization: "대전청년내일재단",
    regionCodes: ["30"],
    regionNames: ["대전"],
    ageMin: 19,
    ageMax: 39,
    incomeCondition: "기준중위소득 150% 이하",
    employmentStatuses: ["미취업", "재직자"],
    educationCondition: null,
    majorCondition: null,
    maritalCondition: null,
    specialConditions: [],
    applicationStartDate: "2026-08-01",
    applicationEndDate: "2026-08-31",
    businessStartDate: "2026-09-01",
    businessEndDate: "2026-12-31",
    applicationMethod: "온라인 신청",
    applicationUrl: "https://www.youthcenter.go.kr/example/apply",
    requiredDocuments: ["주민등록초본"],
    referenceUrls: ["https://www.youthcenter.go.kr/example/policy"],
    currentStatus: "active",
    sourceUpdatedAt: "2026-08-20",
    collectedAt: "2026-08-24T03:30:00.000Z",
    firstSeenAt: "2026-08-24T03:30:00.000Z",
    lastSeenAt: "2026-08-24T03:30:00.000Z",
    missingCount: 0,
    sourceHash: "a".repeat(64),
    sourceUrl: "https://www.youthcenter.go.kr/example/policy",
    isMock: false,
    ...overrides,
  };
}

export function sampleBundle(overrides: Partial<Policy> = {}): PolicyBundle {
  const policy = samplePolicy(overrides);
  return {
    policy,
    conditions: [
      {
        id: `${policy.id}:age-min`,
        policyId: policy.id,
        conditionType: "age_min",
        operator: ">=",
        comparisonValue: "19",
        unit: "세",
        rawCondition: "만 19세 이상",
        structuredStatus: "structured",
        evidenceSource: "온통청년",
        evidenceUrl: policy.sourceUrl,
        manualReview: false,
      },
    ],
    evidence: [
      {
        id: `${policy.id}:evidence:title`,
        policyId: policy.id,
        fieldPath: "title",
        sourceName: "온통청년 청년정책 API",
        sourceId: policy.sourcePolicyId,
        sourceUrl: policy.sourceUrl,
        evidenceText: policy.title,
        effectiveDate: "2026-08-20",
        verifiedAt: policy.collectedAt,
        confidence: "high",
        sourceHash: policy.sourceHash,
        conflictNote: null,
      },
    ],
    legalBases: [],
  };
}
