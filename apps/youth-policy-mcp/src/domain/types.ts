export const TOOL_NAMES = [
  "search_youth_policies",
  "get_youth_policy",
  "check_policy_eligibility",
  "compare_youth_policies",
  "get_policy_changes",
  "get_policy_evidence",
  "analyze_youth_policy_question",
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

export type ApplicationStatus =
  | "open"
  | "closing_soon"
  | "upcoming"
  | "closed"
  | "always_open"
  | "unknown";

export type PolicyLifecycleStatus = "active" | "inactive" | "source_missing";

export interface Policy {
  id: string;
  source: string;
  sourcePolicyId: string;
  title: string;
  description: string;
  supportDetails: string;
  largeCategory: string | null;
  mediumCategory: string | null;
  managingOrganization: string | null;
  operatingOrganization: string | null;
  regionCodes: string[];
  regionNames: string[];
  ageMin: number | null;
  ageMax: number | null;
  incomeCondition: string | null;
  employmentStatuses: string[];
  educationCondition: string | null;
  majorCondition: string | null;
  maritalCondition: string | null;
  specialConditions: string[];
  applicationStartDate: string | null;
  applicationEndDate: string | null;
  businessStartDate: string | null;
  businessEndDate: string | null;
  applicationMethod: string | null;
  applicationUrl: string | null;
  requiredDocuments: string[];
  referenceUrls: string[];
  currentStatus: PolicyLifecycleStatus;
  sourceUpdatedAt: string | null;
  collectedAt: string;
  firstSeenAt: string;
  lastSeenAt: string;
  missingCount: number;
  sourceHash: string;
  sourceUrl: string;
  isMock: boolean;
}

export type ConditionType =
  | "age_min"
  | "age_max"
  | "region"
  | "income"
  | "employment"
  | "education"
  | "major"
  | "marital"
  | "special";

export interface PolicyCondition {
  id: string;
  policyId: string;
  conditionType: ConditionType;
  operator: string;
  comparisonValue: string | null;
  unit: string | null;
  rawCondition: string;
  structuredStatus: "structured" | "partial" | "unstructured";
  evidenceSource: string | null;
  evidenceUrl: string | null;
  manualReview: boolean;
}

export interface PolicyEvidence {
  id: string;
  policyId: string;
  fieldPath: string;
  sourceName: string;
  sourceId: string;
  sourceUrl: string;
  evidenceText: string | null;
  effectiveDate: string | null;
  verifiedAt: string;
  confidence: "high" | "medium" | "low";
  sourceHash: string;
  conflictNote: string | null;
}

export interface PolicyLegalBasis {
  id: string;
  policyId: string;
  legalId: string | null;
  legalName: string;
  article: string | null;
  effectiveDate: string | null;
  promulgationDate: string | null;
  responsibleAgency: string | null;
  sourceUrl: string;
  linkMethod: "source" | "automatic" | "manual";
  confidence: "high" | "medium" | "low";
  verifiedAt: string;
  manualReview: boolean;
}

export interface FieldChange {
  field: string;
  previousValue: unknown;
  currentValue: unknown;
  impact: "major" | "minor";
}

export interface PolicyVersion {
  id: string;
  policyId: string;
  version: number;
  validFrom: string;
  validTo: string | null;
  normalizedData: Policy;
  rawResponse: Record<string, unknown>;
  diff: FieldChange[];
  sourceHash: string;
  createdAt: string;
}

export interface PolicyBundle {
  policy: Policy;
  conditions: PolicyCondition[];
  evidence: PolicyEvidence[];
  legalBases: PolicyLegalBasis[];
}

export interface SearchCriteria {
  query?: string;
  regionCodes?: string[];
  largeCategories?: string[];
  mediumCategories?: string[];
  age?: number;
  employmentStatus?: string;
  applicationStatus?: ApplicationStatus;
  asOf: string;
  page: number;
  pageSize: number;
}

export interface SearchRecord {
  policy: Policy;
  matchingReasons: string[];
}

export interface SearchPage {
  items: SearchRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface EligibilityProfile {
  age?: number;
  region?: string;
  income?: number;
  incomeBand?: string;
  employmentStatus?: string;
  enrollmentStatus?: string;
  education?: string;
  major?: string;
  maritalStatus?: string;
  specialConditions?: string[];
}

export type EligibilityCheckState = "pass" | "fail" | "unknown" | "manual";

export interface EligibilityCheck {
  condition: string;
  policyRequirement: string;
  userValue: string | number | null;
  state: EligibilityCheckState;
  reason: string;
  evidence: string | null;
}

export type EligibilityStatus =
  | "eligible"
  | "ineligible"
  | "needs_more_info"
  | "manual_review";

export interface EligibilityResult {
  policyId: string;
  status: EligibilityStatus;
  checks: EligibilityCheck[];
  missingInformation: string[];
  followUpQuestions: string[];
  agencyConfirmations: string[];
  disclaimer: string;
}

export interface ComparisonRequest {
  policyIds?: string[];
  regions?: string[];
  category?: string;
  fields?: string[];
  asOf: string;
}

export interface SourceReference {
  sourceName: string;
  sourceId: string;
  sourceUrl: string;
  verifiedAt: string;
}

export interface SyncSummary {
  id: string;
  source: string;
  startedAt: string;
  finishedAt: string | null;
  success: boolean | null;
  status: "running" | "succeeded" | "partial" | "failed" | "skipped";
  fetchedCount: number;
  newCount: number;
  updatedCount: number;
  unchangedCount: number;
  inactiveCount: number;
  errorCount: number;
  errorSummary: string | null;
}

export interface RepositoryHealth {
  connected: boolean;
  policyCount: number;
  lastSync: SyncSummary | null;
}

export interface UpsertPolicyInput {
  policy: Policy;
  conditions: PolicyCondition[];
  evidence: PolicyEvidence[];
  legalBases: PolicyLegalBasis[];
  rawResponse: Record<string, unknown>;
}

export interface UpsertPolicyResult {
  state: "new" | "updated" | "unchanged";
  changes: FieldChange[];
}

export interface PolicyRepository {
  health(): Promise<RepositoryHealth>;
  search(criteria: SearchCriteria): Promise<SearchPage>;
  getBundle(policyId: string, asOf?: string): Promise<PolicyBundle | null>;
  getBundles(policyIds: string[], asOf?: string): Promise<PolicyBundle[]>;
  getVersions(policyId: string, from?: string, to?: string): Promise<PolicyVersion[]>;
  upsertPolicy(input: UpsertPolicyInput, observedAt: string): Promise<UpsertPolicyResult>;
  markMissing(source: string, observedBefore: string, threshold: number): Promise<number>;
  startSync(source: string, startedAt: string): Promise<string>;
  finishSync(id: string, summary: Omit<SyncSummary, "id" | "source" | "startedAt">): Promise<void>;
}

export interface NormalizedPolicyRecord {
  policy: Policy;
  conditions: PolicyCondition[];
  evidence: PolicyEvidence[];
  legalBases: PolicyLegalBasis[];
  rawResponse: Record<string, unknown>;
}

export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
