import { calculateApplicationStatus, currentKoreanDate } from "./date";
import { evaluateEligibility } from "./eligibility";
import { normalizeRegionCodes } from "./regions";
import {
  DomainError,
  type ApplicationStatus,
  type ComparisonRequest,
  type EligibilityProfile,
  type Policy,
  type PolicyBundle,
  type PolicyRepository,
  type SearchCriteria,
} from "./types";

export interface SearchPoliciesInput {
  query?: string;
  regionCodes?: string[];
  largeCategories?: string[];
  mediumCategories?: string[];
  age?: number;
  employmentStatus?: string;
  applicationStatus?: ApplicationStatus;
  asOf?: string;
  page?: number;
  pageSize?: number;
}

const COMPARISON_FIELDS = [
  "supportDetails",
  "target",
  "applicationPeriod",
  "operatingOrganization",
  "regions",
] as const;

export class YouthPolicyService {
  constructor(private readonly repository: PolicyRepository) {}

  async search(input: SearchPoliciesInput) {
    const asOf = input.asOf ?? currentKoreanDate();
    const criteria: SearchCriteria = {
      asOf,
      page: input.page ?? 1,
      pageSize: Math.min(input.pageSize ?? 20, 50),
    };
    if (input.query) criteria.query = input.query;
    const normalizedRegions = normalizeRegionCodes(input.regionCodes);
    if (normalizedRegions) criteria.regionCodes = normalizedRegions;
    if (input.largeCategories) criteria.largeCategories = input.largeCategories;
    if (input.mediumCategories) criteria.mediumCategories = input.mediumCategories;
    if (input.age !== undefined) criteria.age = input.age;
    if (input.employmentStatus) criteria.employmentStatus = input.employmentStatus;
    if (input.applicationStatus) criteria.applicationStatus = input.applicationStatus;

    const page = await this.repository.search(criteria);
    return {
      items: page.items.map(({ policy, matchingReasons }) => ({
        policyId: policy.id,
        title: policy.title,
        summary: policy.description || policy.supportDetails,
        regions: policy.regionNames,
        targetAge: { minimum: policy.ageMin, maximum: policy.ageMax },
        applicationPeriod: {
          start: policy.applicationStartDate,
          end: policy.applicationEndDate,
        },
        applicationStatus: calculateApplicationStatus(policy, asOf),
        matchingReasons,
        source: sourceSummary(policy),
      })),
      pagination: {
        total: page.total,
        page: page.page,
        pageSize: page.pageSize,
        totalPages: page.totalPages,
      },
    };
  }

  async getPolicy(policyId: string, asOf?: string) {
    const date = asOf ?? currentKoreanDate();
    const bundle = await this.requiredBundle(policyId, asOf);
    const { policy } = bundle;
    return {
      policyId: policy.id,
      sourcePolicyId: policy.sourcePolicyId,
      title: policy.title,
      description: policy.description,
      supportDetails: policy.supportDetails,
      target: {
        age: { minimum: policy.ageMin, maximum: policy.ageMax },
        regions: policy.regionNames,
        income: policy.incomeCondition,
        employmentStatuses: policy.employmentStatuses,
        education: policy.educationCondition,
        major: policy.majorCondition,
        maritalStatus: policy.maritalCondition,
        specialConditions: policy.specialConditions,
      },
      applicationPeriod: {
        start: policy.applicationStartDate,
        end: policy.applicationEndDate,
        status: calculateApplicationStatus(policy, date),
      },
      businessPeriod: { start: policy.businessStartDate, end: policy.businessEndDate },
      applicationMethod: policy.applicationMethod,
      applicationUrl: policy.applicationUrl,
      requiredDocuments: policy.requiredDocuments,
      managingOrganization: policy.managingOrganization,
      operatingOrganization: policy.operatingOrganization,
      legalBases: bundle.legalBases,
      sources: bundle.evidence.map(toSourceReference),
      basisDate: date,
      warnings: buildWarnings(bundle),
      freshness: freshness(policy, date),
    };
  }

  async checkEligibility(policyId: string, profile: EligibilityProfile, asOf?: string) {
    const bundle = await this.requiredBundle(policyId, asOf);
    return evaluateEligibility(bundle, profile);
  }

  async compare(request: ComparisonRequest) {
    let bundles: PolicyBundle[];
    if (request.policyIds?.length) {
      const ids = [...new Set(request.policyIds)];
      if (ids.length > 10) throw new DomainError("TOO_MANY_POLICIES", "정책은 한 번에 최대 10개까지 비교할 수 있습니다.");
      bundles = await this.repository.getBundles(ids, request.asOf);
      const found = new Set(bundles.map(({ policy }) => policy.id));
      const missing = ids.filter((id) => !found.has(id));
      if (missing.length) {
        throw new DomainError("POLICY_NOT_FOUND", `정책을 찾을 수 없습니다: ${missing.join(", ")}`);
      }
    } else {
      if (!request.regions?.length || !request.category) {
        throw new DomainError(
          "COMPARE_INPUT_REQUIRED",
          "policy_ids 또는 regions와 category를 함께 입력해 주세요.",
        );
      }
      const regionCodes = normalizeRegionCodes(request.regions);
      const page = await this.repository.search({
        ...(regionCodes ? { regionCodes } : {}),
        largeCategories: [request.category],
        asOf: request.asOf,
        page: 1,
        pageSize: 10,
      });
      bundles = await this.repository.getBundles(
        page.items.map(({ policy }) => policy.id),
        request.asOf,
      );
    }

    const fields = request.fields?.length ? request.fields : [...COMPARISON_FIELDS];
    const rows = bundles.map((bundle) => comparisonRow(bundle.policy, request.asOf, fields));
    const common: string[] = [];
    const differences: string[] = [];
    for (const field of fields) {
      const values = rows.map((row) => JSON.stringify(row.facts[field]));
      if (values.length > 1 && values.every((value) => value === values[0])) common.push(field);
      else differences.push(field);
    }
    const active = bundles.filter(
      ({ policy }) => calculateApplicationStatus(policy, request.asOf) === "open" ||
        calculateApplicationStatus(policy, request.asOf) === "closing_soon" ||
        calculateApplicationStatus(policy, request.asOf) === "always_open",
    );
    return {
      comparison: rows,
      facts: { commonFields: common, differentFields: differences },
      interpretation: {
        type: "rule_based_signal",
        overlapPossibility:
          active.length > 1
            ? "신청기간과 대상지역이 겹치는 정책이 있어 중복 신청 가능 여부를 각 공고에서 확인해야 합니다."
            : "현재 구조화 데이터만으로 명확한 중복 신호가 확인되지 않았습니다.",
        gapPossibility:
          bundles.length === 0
            ? "요청 조건에 맞는 정책이 없어 정책 공백 가능성이 있습니다. 전국값으로 대체하지 않았습니다."
            : "정책 존재 여부만 확인한 신호이며 수요 대비 정책 공백을 뜻하지는 않습니다.",
      },
      sources: bundles.flatMap(({ evidence }) => evidence.map(toSourceReference)),
    };
  }

  async getChanges(policyId: string, from?: string, to?: string) {
    await this.requiredBundle(policyId);
    const versions = await this.repository.getVersions(policyId, from, to);
    return {
      policyId,
      from: from ?? null,
      to: to ?? null,
      changes: versions.flatMap((version) =>
        version.diff.map((change) => ({
          field: change.field,
          previousValue: change.previousValue,
          currentValue: change.currentValue,
          detectedAt: version.createdAt,
          source: version.normalizedData.source,
          impact: change.impact,
          originalUrl: version.normalizedData.sourceUrl,
        })),
      ),
      versions: versions.map((version) => ({
        version: version.version,
        validFrom: version.validFrom,
        validTo: version.validTo,
        sourceHash: version.sourceHash,
      })),
    };
  }

  async getEvidence(policyId: string, fields?: string[]) {
    const bundle = await this.requiredBundle(policyId);
    const selected = fields?.length
      ? bundle.evidence.filter((item) => fields.some((field) => item.fieldPath === field || item.fieldPath.startsWith(`${field}.`)))
      : bundle.evidence;
    return {
      policyId,
      evidence: selected.map((item) => ({
        field: item.fieldPath,
        sourceName: item.sourceName,
        sourceId: item.sourceId,
        originalUrl: item.sourceUrl,
        effectiveDate: item.effectiveDate,
        collectedAt: item.verifiedAt,
        sourceHash: item.sourceHash,
        evidenceText: item.evidenceText,
        confidence: item.confidence,
        conflictOrUncertainty: item.conflictNote,
        citation: `${item.sourceName}, '${bundle.policy.title}', 기준일 ${item.effectiveDate ?? item.verifiedAt.slice(0, 10)}, ${item.sourceUrl}`,
      })),
      legalBases: bundle.legalBases,
      conflicts: selected
        .filter((item) => item.conflictNote)
        .map((item) => ({ field: item.fieldPath, note: item.conflictNote })),
    };
  }

  private async requiredBundle(policyId: string, asOf?: string): Promise<PolicyBundle> {
    const bundle = await this.repository.getBundle(policyId, asOf);
    if (!bundle) {
      throw new DomainError(
        "POLICY_NOT_FOUND",
        asOf
          ? `정책 '${policyId}'의 ${asOf} 시점 데이터를 찾을 수 없습니다.`
          : `정책 '${policyId}'을(를) 찾을 수 없습니다.`,
      );
    }
    return bundle;
  }
}

function sourceSummary(policy: Policy) {
  return {
    sourceName: "온통청년 청년정책 API",
    sourcePolicyId: policy.sourcePolicyId,
    originalUrl: policy.sourceUrl,
    collectedAt: policy.collectedAt,
  };
}

function toSourceReference(evidence: PolicyBundle["evidence"][number]) {
  return {
    sourceName: evidence.sourceName,
    sourceId: evidence.sourceId,
    sourceUrl: evidence.sourceUrl,
    verifiedAt: evidence.verifiedAt,
  };
}

function buildWarnings(bundle: PolicyBundle): string[] {
  const warnings: string[] = [];
  if (bundle.legalBases.some((basis) => basis.manualReview)) warnings.push("일부 법적 근거는 원문 수동 확인이 필요합니다.");
  if (bundle.evidence.some((evidence) => evidence.conflictNote)) warnings.push("출처 간 충돌 또는 불확실성이 기록되어 있습니다.");
  if (
    bundle.conditions.some((condition) => condition.manualReview) ||
    bundle.policy.incomeCondition ||
    bundle.policy.educationCondition ||
    bundle.policy.majorCondition ||
    bundle.policy.maritalCondition ||
    bundle.policy.specialConditions.length > 0
  ) {
    warnings.push("자유서술형 지원조건은 자동 판정하지 않습니다.");
  }
  return warnings;
}

function freshness(policy: Policy, asOf: string) {
  const collectedDate = policy.collectedAt.slice(0, 10);
  const daysOld = Math.max(
    0,
    Math.floor((Date.parse(`${asOf}T00:00:00Z`) - Date.parse(`${collectedDate}T00:00:00Z`)) / 86_400_000),
  );
  return {
    isLatest: policy.currentStatus === "active" && daysOld <= 2,
    collectedAt: policy.collectedAt,
    sourceUpdatedAt: policy.sourceUpdatedAt,
    daysOld,
  };
}

function comparisonRow(policy: Policy, asOf: string, fields: string[]) {
  const allFacts: Record<string, unknown> = {
    supportDetails: policy.supportDetails,
    target: {
      age: { minimum: policy.ageMin, maximum: policy.ageMax },
      income: policy.incomeCondition,
      employmentStatuses: policy.employmentStatuses,
    },
    applicationPeriod: {
      start: policy.applicationStartDate,
      end: policy.applicationEndDate,
      status: calculateApplicationStatus(policy, asOf),
    },
    managingOrganization: policy.managingOrganization,
    operatingOrganization: policy.operatingOrganization,
    regions: policy.regionNames,
    applicationMethod: policy.applicationMethod,
    requiredDocuments: policy.requiredDocuments,
  };
  return {
    policyId: policy.id,
    title: policy.title,
    facts: Object.fromEntries(fields.map((field) => [field, allFacts[field] ?? null])),
  };
}
