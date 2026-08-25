import { calculateApplicationStatus } from "../domain/date";
import { diffPolicies } from "../domain/changes";
import { regionMatches } from "../domain/regions";
import type {
  Policy,
  PolicyBundle,
  PolicyCondition,
  PolicyEvidence,
  PolicyLegalBasis,
  PolicyRepository,
  PolicyVersion,
  RepositoryHealth,
  SearchCriteria,
  SearchPage,
  SyncSummary,
  UpsertPolicyInput,
  UpsertPolicyResult,
} from "../domain/types";
import {
  conditionFromRow,
  evidenceFromRow,
  legalBasisFromRow,
  normalizeSearchText,
  policyFromRow,
  policySearchText,
  syncFromRow,
  versionFromRow,
  type DatabaseRow,
} from "./serialization";

type BindValue = string | number | null;

export class D1PolicyRepository implements PolicyRepository {
  constructor(private readonly database: D1Database) {}

  async health(): Promise<RepositoryHealth> {
    try {
      const countRow = await this.database
        .prepare("SELECT COUNT(*) AS count FROM policies WHERE is_mock = 0")
        .first<{ count: number }>();
      const syncRow = await this.database
        .prepare("SELECT * FROM sync_runs ORDER BY started_at DESC LIMIT 1")
        .first<DatabaseRow>();
      return {
        connected: true,
        policyCount: countRow?.count ?? 0,
        lastSync: syncRow ? syncFromRow(syncRow) : null,
      };
    } catch {
      return { connected: false, policyCount: 0, lastSync: null };
    }
  }

  async search(criteria: SearchCriteria): Promise<SearchPage> {
    const clauses = ["is_mock = 0", "current_status = 'active'"];
    const values: BindValue[] = [];

    if (criteria.query) {
      const tokens = criteria.query
        .split(/\s+/)
        .map(normalizeSearchText)
        .filter(Boolean)
        .slice(0, 8);
      for (const token of tokens) {
        clauses.push("search_text LIKE ?");
        values.push(`%${token}%`);
      }
    }
    if (criteria.regionCodes?.length) {
      const regionClauses = ["region_codes_json LIKE '%\"00\"%'"];
      for (const code of criteria.regionCodes) {
        regionClauses.push("region_codes_json LIKE ?");
        values.push(`%\"${code}\"%`);
      }
      clauses.push(`(${regionClauses.join(" OR ")})`);
    }
    if (criteria.largeCategories?.length) {
      clauses.push(`large_category IN (${criteria.largeCategories.map(() => "?").join(",")})`);
      values.push(...criteria.largeCategories);
    }
    if (criteria.mediumCategories?.length) {
      clauses.push(`medium_category IN (${criteria.mediumCategories.map(() => "?").join(",")})`);
      values.push(...criteria.mediumCategories);
    }
    if (criteria.age !== undefined) {
      clauses.push("(age_min IS NULL OR age_min <= ?)", "(age_max IS NULL OR age_max >= ?)");
      values.push(criteria.age, criteria.age);
    }
    if (criteria.employmentStatus) {
      clauses.push("(employment_statuses_json = '[]' OR employment_statuses_json LIKE ?)");
      values.push(`%${criteria.employmentStatus}%`);
    }

    const statement = this.database.prepare(
      `SELECT * FROM policies WHERE ${clauses.join(" AND ")} ORDER BY title COLLATE NOCASE LIMIT 5000`,
    );
    const result = await (values.length > 0 ? statement.bind(...values) : statement).all<DatabaseRow>();
    const policies = result.results
      .map(policyFromRow)
      .filter(
        (policy) =>
          !criteria.regionCodes || regionMatches(policy.regionCodes, criteria.regionCodes),
      )
      .filter(
        (policy) =>
          !criteria.applicationStatus ||
          calculateApplicationStatus(policy, criteria.asOf) === criteria.applicationStatus,
      );

    const offset = (criteria.page - 1) * criteria.pageSize;
    const items = policies.slice(offset, offset + criteria.pageSize).map((policy) => ({
      policy,
      matchingReasons: matchingReasons(policy, criteria),
    }));
    return {
      items,
      total: policies.length,
      page: criteria.page,
      pageSize: criteria.pageSize,
      totalPages: Math.ceil(policies.length / criteria.pageSize),
    };
  }

  async getBundle(policyId: string, asOf?: string): Promise<PolicyBundle | null> {
    const row = await this.database
      .prepare("SELECT * FROM policies WHERE id = ? AND is_mock = 0")
      .bind(policyId)
      .first<DatabaseRow>();
    if (!row) return null;

    let policy = policyFromRow(row);
    if (asOf) {
      const versionRow = await this.database
        .prepare(
          `SELECT * FROM policy_versions
           WHERE policy_id = ? AND substr(valid_from, 1, 10) <= ?
             AND (valid_to IS NULL OR substr(valid_to, 1, 10) > ?)
           ORDER BY version DESC LIMIT 1`,
        )
        .bind(policyId, asOf, asOf)
        .first<DatabaseRow>();
      if (!versionRow) return null;
      policy = versionFromRow(versionRow).normalizedData;
    }

    const [conditions, evidence, legalBases] = await Promise.all([
      this.database
        .prepare("SELECT * FROM policy_conditions WHERE policy_id = ? ORDER BY condition_type, id")
        .bind(policyId)
        .all<DatabaseRow>(),
      this.database
        .prepare("SELECT * FROM policy_evidence WHERE policy_id = ? ORDER BY field_path, id")
        .bind(policyId)
        .all<DatabaseRow>(),
      this.database
        .prepare("SELECT * FROM policy_legal_bases WHERE policy_id = ? ORDER BY legal_name, article")
        .bind(policyId)
        .all<DatabaseRow>(),
    ]);
    return {
      policy,
      conditions: conditions.results.map(conditionFromRow),
      evidence: evidence.results.map(evidenceFromRow),
      legalBases: legalBases.results.map(legalBasisFromRow),
    };
  }

  async getBundles(policyIds: string[], asOf?: string): Promise<PolicyBundle[]> {
    const bundles: PolicyBundle[] = [];
    for (const policyId of policyIds) {
      const bundle = await this.getBundle(policyId, asOf);
      if (bundle) bundles.push(bundle);
    }
    return bundles;
  }

  async getVersions(policyId: string, from?: string, to?: string): Promise<PolicyVersion[]> {
    const clauses = ["policy_id = ?"];
    const values: BindValue[] = [policyId];
    if (from) {
      clauses.push("substr(valid_from, 1, 10) >= ?");
      values.push(from);
    }
    if (to) {
      clauses.push("substr(valid_from, 1, 10) <= ?");
      values.push(to);
    }
    const result = await this.database
      .prepare(`SELECT * FROM policy_versions WHERE ${clauses.join(" AND ")} ORDER BY version`)
      .bind(...values)
      .all<DatabaseRow>();
    return result.results.map(versionFromRow);
  }

  async upsertPolicy(input: UpsertPolicyInput, observedAt: string): Promise<UpsertPolicyResult> {
    const existingRow = await this.database
      .prepare("SELECT * FROM policies WHERE source = ? AND source_policy_id = ?")
      .bind(input.policy.source, input.policy.sourcePolicyId)
      .first<DatabaseRow>();
    const existing = existingRow ? policyFromRow(existingRow) : null;

    if (existing?.sourceHash === input.policy.sourceHash) {
      await this.database
        .prepare(
          "UPDATE policies SET collected_at = ?, last_seen_at = ?, missing_count = 0, current_status = 'active' WHERE id = ?",
        )
        .bind(observedAt, observedAt, existing.id)
        .run();
      return { state: "unchanged", changes: [] };
    }

    const policy = existing
      ? { ...input.policy, id: existing.id, firstSeenAt: existing.firstSeenAt }
      : input.policy;
    const changes = existing ? diffPolicies(existing, policy) : [];
    const versionRow = await this.database
      .prepare("SELECT COALESCE(MAX(version), 0) AS version FROM policy_versions WHERE policy_id = ?")
      .bind(policy.id)
      .first<{ version: number }>();
    const nextVersion = (versionRow?.version ?? 0) + 1;
    const statements: D1PreparedStatement[] = [];

    statements.push(policyUpsertStatement(this.database, policy));
    if (existing) {
      statements.push(
        this.database
          .prepare("UPDATE policy_versions SET valid_to = ? WHERE policy_id = ? AND valid_to IS NULL")
          .bind(observedAt, policy.id),
      );
    }
    statements.push(
      this.database
        .prepare(
          `INSERT INTO policy_versions
           (id, policy_id, version, valid_from, valid_to, normalized_data_json,
            raw_response_json, diff_json, source_hash, created_at)
           VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)`,
        )
        .bind(
          `${policy.id}:v${nextVersion}`,
          policy.id,
          nextVersion,
          observedAt,
          JSON.stringify(policy),
          JSON.stringify(input.rawResponse),
          JSON.stringify(changes),
          policy.sourceHash,
          observedAt,
        ),
      this.database.prepare("DELETE FROM policy_conditions WHERE policy_id = ?").bind(policy.id),
      this.database.prepare("DELETE FROM policy_evidence WHERE policy_id = ?").bind(policy.id),
      this.database.prepare("DELETE FROM policy_legal_bases WHERE policy_id = ?").bind(policy.id),
    );
    for (const condition of input.conditions) statements.push(conditionInsert(this.database, condition, policy.id));
    for (const evidence of input.evidence) statements.push(evidenceInsert(this.database, evidence, policy.id));
    for (const basis of input.legalBases) statements.push(legalInsert(this.database, basis, policy.id));
    await this.database.batch(statements);
    return { state: existing ? "updated" : "new", changes };
  }

  async upsertPolicies(
    inputs: UpsertPolicyInput[],
    observedAt: string,
  ): Promise<UpsertPolicyResult[]> {
    const results: UpsertPolicyResult[] = [];
    for (const input of inputs) results.push(await this.upsertPolicy(input, observedAt));
    return results;
  }

  async markMissing(source: string, observedBefore: string, threshold: number): Promise<number> {
    await this.database
      .prepare(
        `UPDATE policies
         SET missing_count = missing_count + 1
         WHERE source = ? AND last_seen_at < ? AND current_status = 'active'`,
      )
      .bind(source, observedBefore)
      .run();
    const result = await this.database
      .prepare(
        `UPDATE policies
         SET current_status = 'source_missing'
         WHERE source = ? AND missing_count >= ? AND current_status = 'active'`,
      )
      .bind(source, threshold)
      .run();
    return result.meta.changes;
  }

  async startSync(source: string, startedAt: string): Promise<string> {
    const id = crypto.randomUUID();
    await this.database
      .prepare("INSERT INTO sync_runs (id, source, started_at, status) VALUES (?, ?, ?, 'running')")
      .bind(id, source, startedAt)
      .run();
    return id;
  }

  async finishSync(
    id: string,
    summary: Omit<SyncSummary, "id" | "source" | "startedAt">,
  ): Promise<void> {
    await this.database
      .prepare(
        `UPDATE sync_runs SET
           finished_at = ?, success = ?, status = ?, fetched_count = ?, new_count = ?,
           updated_count = ?, unchanged_count = ?, inactive_count = ?, error_count = ?,
           error_summary = ?
         WHERE id = ?`,
      )
      .bind(
        summary.finishedAt,
        summary.success === null ? null : summary.success ? 1 : 0,
        summary.status,
        summary.fetchedCount,
        summary.newCount,
        summary.updatedCount,
        summary.unchangedCount,
        summary.inactiveCount,
        summary.errorCount,
        summary.errorSummary,
        id,
      )
      .run();
  }
}

function policyUpsertStatement(database: D1Database, policy: Policy): D1PreparedStatement {
  const values: Record<string, BindValue> = {
    id: policy.id,
    source: policy.source,
    source_policy_id: policy.sourcePolicyId,
    title: policy.title,
    description: policy.description,
    support_details: policy.supportDetails,
    large_category: policy.largeCategory,
    medium_category: policy.mediumCategory,
    managing_organization: policy.managingOrganization,
    operating_organization: policy.operatingOrganization,
    region_codes_json: JSON.stringify(policy.regionCodes),
    region_names_json: JSON.stringify(policy.regionNames),
    age_min: policy.ageMin,
    age_max: policy.ageMax,
    income_condition: policy.incomeCondition,
    employment_statuses_json: JSON.stringify(policy.employmentStatuses),
    education_condition: policy.educationCondition,
    major_condition: policy.majorCondition,
    marital_condition: policy.maritalCondition,
    special_conditions_json: JSON.stringify(policy.specialConditions),
    application_start_date: policy.applicationStartDate,
    application_end_date: policy.applicationEndDate,
    business_start_date: policy.businessStartDate,
    business_end_date: policy.businessEndDate,
    application_method: policy.applicationMethod,
    application_url: policy.applicationUrl,
    required_documents_json: JSON.stringify(policy.requiredDocuments),
    reference_urls_json: JSON.stringify(policy.referenceUrls),
    current_status: policy.currentStatus,
    source_updated_at: policy.sourceUpdatedAt,
    collected_at: policy.collectedAt,
    first_seen_at: policy.firstSeenAt,
    last_seen_at: policy.lastSeenAt,
    missing_count: policy.missingCount,
    source_hash: policy.sourceHash,
    source_url: policy.sourceUrl,
    search_text: policySearchText(policy),
    is_mock: policy.isMock ? 1 : 0,
  };
  const columns = Object.keys(values);
  const updates = columns
    .filter((column) => !["id", "source", "source_policy_id", "first_seen_at"].includes(column))
    .map((column) => `${column} = excluded.${column}`)
    .join(", ");
  return database
    .prepare(
      `INSERT INTO policies (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})
       ON CONFLICT(id) DO UPDATE SET ${updates}`,
    )
    .bind(...Object.values(values));
}

function conditionInsert(
  database: D1Database,
  condition: PolicyCondition,
  policyId: string,
): D1PreparedStatement {
  return database
    .prepare(
      `INSERT INTO policy_conditions
       (id, policy_id, condition_type, operator, comparison_value, unit, raw_condition,
        structured_status, evidence_source, evidence_url, manual_review)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      condition.id,
      policyId,
      condition.conditionType,
      condition.operator,
      condition.comparisonValue,
      condition.unit,
      condition.rawCondition,
      condition.structuredStatus,
      condition.evidenceSource,
      condition.evidenceUrl,
      condition.manualReview ? 1 : 0,
    );
}

function evidenceInsert(
  database: D1Database,
  evidence: PolicyEvidence,
  policyId: string,
): D1PreparedStatement {
  return database
    .prepare(
      `INSERT INTO policy_evidence
       (id, policy_id, field_path, source_name, source_id, source_url, evidence_text,
        effective_date, verified_at, confidence, source_hash, conflict_note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      evidence.id,
      policyId,
      evidence.fieldPath,
      evidence.sourceName,
      evidence.sourceId,
      evidence.sourceUrl,
      evidence.evidenceText,
      evidence.effectiveDate,
      evidence.verifiedAt,
      evidence.confidence,
      evidence.sourceHash,
      evidence.conflictNote,
    );
}

function legalInsert(
  database: D1Database,
  basis: PolicyLegalBasis,
  policyId: string,
): D1PreparedStatement {
  return database
    .prepare(
      `INSERT INTO policy_legal_bases
       (id, policy_id, legal_id, legal_name, article, effective_date, promulgation_date,
        responsible_agency, source_url, link_method, confidence, verified_at, manual_review)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      basis.id,
      policyId,
      basis.legalId,
      basis.legalName,
      basis.article,
      basis.effectiveDate,
      basis.promulgationDate,
      basis.responsibleAgency,
      basis.sourceUrl,
      basis.linkMethod,
      basis.confidence,
      basis.verifiedAt,
      basis.manualReview ? 1 : 0,
    );
}

function matchingReasons(policy: Policy, criteria: SearchCriteria): string[] {
  const reasons: string[] = [];
  if (criteria.query && policySearchText(policy).includes(normalizeSearchText(criteria.query))) {
    reasons.push(`검색어 '${criteria.query}'와 정책 텍스트가 일치`);
  }
  if (criteria.regionCodes) reasons.push("요청한 지역과 적용지역이 일치");
  if (criteria.age !== undefined) reasons.push("입력 연령이 정책 연령 범위에 포함");
  if (criteria.largeCategories?.length || criteria.mediumCategories?.length) reasons.push("정책 분류가 일치");
  if (criteria.applicationStatus) reasons.push(`신청상태가 ${calculateApplicationStatus(policy, criteria.asOf)}`);
  return reasons.length > 0 ? reasons : ["활성 청년정책"];
}
