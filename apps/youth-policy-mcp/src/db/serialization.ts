import type {
  Policy,
  PolicyCondition,
  PolicyEvidence,
  PolicyLegalBasis,
  PolicyVersion,
  SyncSummary,
} from "../domain/types";

export type DatabaseRow = Record<string, unknown>;

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function parseStringArray(value: unknown): string[] {
  if (typeof value !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function parseObject<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function policyFromRow(row: DatabaseRow): Policy {
  return {
    id: stringValue(row.id),
    source: stringValue(row.source),
    sourcePolicyId: stringValue(row.source_policy_id),
    title: stringValue(row.title),
    description: stringValue(row.description),
    supportDetails: stringValue(row.support_details),
    largeCategory: nullableString(row.large_category),
    mediumCategory: nullableString(row.medium_category),
    managingOrganization: nullableString(row.managing_organization),
    operatingOrganization: nullableString(row.operating_organization),
    regionCodes: parseStringArray(row.region_codes_json),
    regionNames: parseStringArray(row.region_names_json),
    ageMin: nullableNumber(row.age_min),
    ageMax: nullableNumber(row.age_max),
    incomeCondition: nullableString(row.income_condition),
    employmentStatuses: parseStringArray(row.employment_statuses_json),
    educationCondition: nullableString(row.education_condition),
    majorCondition: nullableString(row.major_condition),
    maritalCondition: nullableString(row.marital_condition),
    specialConditions: parseStringArray(row.special_conditions_json),
    applicationStartDate: nullableString(row.application_start_date),
    applicationEndDate: nullableString(row.application_end_date),
    businessStartDate: nullableString(row.business_start_date),
    businessEndDate: nullableString(row.business_end_date),
    applicationMethod: nullableString(row.application_method),
    applicationUrl: nullableString(row.application_url),
    requiredDocuments: parseStringArray(row.required_documents_json),
    referenceUrls: parseStringArray(row.reference_urls_json),
    currentStatus:
      row.current_status === "inactive" || row.current_status === "source_missing"
        ? row.current_status
        : "active",
    sourceUpdatedAt: nullableString(row.source_updated_at),
    collectedAt: stringValue(row.collected_at),
    firstSeenAt: stringValue(row.first_seen_at),
    lastSeenAt: stringValue(row.last_seen_at),
    missingCount: typeof row.missing_count === "number" ? row.missing_count : 0,
    sourceHash: stringValue(row.source_hash),
    sourceUrl: stringValue(row.source_url),
    isMock: row.is_mock === 1 || row.is_mock === true,
  };
}

export function conditionFromRow(row: DatabaseRow): PolicyCondition {
  const type = stringValue(row.condition_type) as PolicyCondition["conditionType"];
  const structuredStatus = stringValue(row.structured_status);
  return {
    id: stringValue(row.id),
    policyId: stringValue(row.policy_id),
    conditionType: type,
    operator: stringValue(row.operator),
    comparisonValue: nullableString(row.comparison_value),
    unit: nullableString(row.unit),
    rawCondition: stringValue(row.raw_condition),
    structuredStatus:
      structuredStatus === "structured" || structuredStatus === "partial"
        ? structuredStatus
        : "unstructured",
    evidenceSource: nullableString(row.evidence_source),
    evidenceUrl: nullableString(row.evidence_url),
    manualReview: row.manual_review === 1 || row.manual_review === true,
  };
}

export function evidenceFromRow(row: DatabaseRow): PolicyEvidence {
  const confidence = stringValue(row.confidence);
  return {
    id: stringValue(row.id),
    policyId: stringValue(row.policy_id),
    fieldPath: stringValue(row.field_path),
    sourceName: stringValue(row.source_name),
    sourceId: stringValue(row.source_id),
    sourceUrl: stringValue(row.source_url),
    evidenceText: nullableString(row.evidence_text),
    effectiveDate: nullableString(row.effective_date),
    verifiedAt: stringValue(row.verified_at),
    confidence: confidence === "medium" || confidence === "low" ? confidence : "high",
    sourceHash: stringValue(row.source_hash),
    conflictNote: nullableString(row.conflict_note),
  };
}

export function legalBasisFromRow(row: DatabaseRow): PolicyLegalBasis {
  const method = stringValue(row.link_method);
  const confidence = stringValue(row.confidence);
  return {
    id: stringValue(row.id),
    policyId: stringValue(row.policy_id),
    legalId: nullableString(row.legal_id),
    legalName: stringValue(row.legal_name),
    article: nullableString(row.article),
    effectiveDate: nullableString(row.effective_date),
    promulgationDate: nullableString(row.promulgation_date),
    responsibleAgency: nullableString(row.responsible_agency),
    sourceUrl: stringValue(row.source_url),
    linkMethod: method === "automatic" || method === "manual" ? method : "source",
    confidence: confidence === "medium" || confidence === "low" ? confidence : "high",
    verifiedAt: stringValue(row.verified_at),
    manualReview: row.manual_review === 1 || row.manual_review === true,
  };
}

export function versionFromRow(row: DatabaseRow): PolicyVersion {
  return {
    id: stringValue(row.id),
    policyId: stringValue(row.policy_id),
    version: typeof row.version === "number" ? row.version : 0,
    validFrom: stringValue(row.valid_from),
    validTo: nullableString(row.valid_to),
    normalizedData: parseObject<Policy>(row.normalized_data_json, {} as Policy),
    rawResponse: parseObject<Record<string, unknown>>(row.raw_response_json, {}),
    diff: parseObject<PolicyVersion["diff"]>(row.diff_json, []),
    sourceHash: stringValue(row.source_hash),
    createdAt: stringValue(row.created_at),
  };
}

export function syncFromRow(row: DatabaseRow): SyncSummary {
  const status = stringValue(row.status);
  return {
    id: stringValue(row.id),
    source: stringValue(row.source),
    startedAt: stringValue(row.started_at),
    finishedAt: nullableString(row.finished_at),
    success: row.success === null || row.success === undefined ? null : row.success === 1,
    status:
      status === "succeeded" ||
      status === "partial" ||
      status === "failed" ||
      status === "skipped"
        ? status
        : "running",
    fetchedCount: typeof row.fetched_count === "number" ? row.fetched_count : 0,
    newCount: typeof row.new_count === "number" ? row.new_count : 0,
    updatedCount: typeof row.updated_count === "number" ? row.updated_count : 0,
    unchangedCount: typeof row.unchanged_count === "number" ? row.unchanged_count : 0,
    inactiveCount: typeof row.inactive_count === "number" ? row.inactive_count : 0,
    errorCount: typeof row.error_count === "number" ? row.error_count : 0,
    errorSummary: nullableString(row.error_summary),
  };
}

export function normalizeSearchText(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/[^0-9a-z가-힣]/g, "");
}

export function policySearchText(policy: Policy): string {
  return normalizeSearchText(
    [
      policy.title,
      policy.description,
      policy.supportDetails,
      policy.largeCategory,
      policy.mediumCategory,
      policy.managingOrganization,
      policy.operatingOrganization,
      ...policy.regionNames,
    ]
      .filter(Boolean)
      .join(" "),
  );
}
