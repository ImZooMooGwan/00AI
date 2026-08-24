import { DurableObject } from "cloudflare:workers";

import { MemoryPolicyRepository } from "./memory-repository";
import { diffPolicies } from "../domain/changes";
import type {
  Policy,
  PolicyBundle,
  PolicyRepository,
  PolicyVersion,
  RepositoryHealth,
  SearchCriteria,
  SearchPage,
  SyncSummary,
  UpsertPolicyInput,
  UpsertPolicyResult,
} from "../domain/types";

interface PolicyRow extends Record<string, SqlStorageValue> {
  id: string;
  policy_json: string;
  bundle_json: string;
}

interface VersionRow extends Record<string, SqlStorageValue> {
  version_json: string;
}

interface SyncRow extends Record<string, SqlStorageValue> {
  summary_json: string;
}

/** Strongly consistent policy store provisioned with the Worker itself. */
export class YouthPolicyStore extends DurableObject<Env> implements PolicyRepository {
  private readonly sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    ctx.blockConcurrencyWhile(async () => this.migrate());
  }

  async health(): Promise<RepositoryHealth> {
    try {
      const { count } = this.sql
        .exec<{ count: number }>("SELECT COUNT(*) AS count FROM policies WHERE is_mock = 0")
        .one();
      const lastSync = this.sql
        .exec<SyncRow>("SELECT summary_json FROM sync_runs ORDER BY started_at DESC LIMIT 1")
        .toArray()[0];
      return {
        connected: true,
        policyCount: count,
        lastSync: lastSync ? parseJson<SyncSummary>(lastSync.summary_json) : null,
      };
    } catch {
      return { connected: false, policyCount: 0, lastSync: null };
    }
  }

  async search(criteria: SearchCriteria): Promise<SearchPage> {
    const rows = this.sql
      .exec<Pick<PolicyRow, "bundle_json">>(
        "SELECT bundle_json FROM policies WHERE is_mock = 0 AND current_status = 'active'",
      )
      .toArray();
    return new MemoryPolicyRepository(
      rows.map(({ bundle_json }) => parseJson<PolicyBundle>(bundle_json)),
    ).search(criteria);
  }

  async getBundle(policyId: string, asOf?: string): Promise<PolicyBundle | null> {
    const row = this.sql
      .exec<Pick<PolicyRow, "bundle_json">>(
        "SELECT bundle_json FROM policies WHERE id = ? AND is_mock = 0",
        policyId,
      )
      .toArray()[0];
    if (!row) return null;
    const bundle = parseJson<PolicyBundle>(row.bundle_json);
    if (!asOf) return bundle;

    const version = this.sql
      .exec<VersionRow>(
        `SELECT version_json FROM policy_versions
         WHERE policy_id = ? AND substr(valid_from, 1, 10) <= ?
           AND (valid_to IS NULL OR substr(valid_to, 1, 10) > ?)
         ORDER BY version DESC LIMIT 1`,
        policyId,
        asOf,
        asOf,
      )
      .toArray()[0];
    if (!version) return null;
    return {
      ...bundle,
      policy: parseJson<PolicyVersion>(version.version_json).normalizedData,
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
    return this.readVersions(policyId, from, to);
  }

  async upsertPolicy(input: UpsertPolicyInput, observedAt: string): Promise<UpsertPolicyResult> {
    const existingRow = this.sql
      .exec<PolicyRow>(
        "SELECT id, policy_json, bundle_json FROM policies WHERE source = ? AND source_policy_id = ?",
        input.policy.source,
        input.policy.sourcePolicyId,
      )
      .toArray()[0];
    const existingBundle = existingRow ? parseJson<PolicyBundle>(existingRow.bundle_json) : null;
    const existing = existingBundle?.policy ?? null;

    if (existing?.sourceHash === input.policy.sourceHash) {
      const policy: Policy = {
        ...existing,
        collectedAt: observedAt,
        lastSeenAt: observedAt,
        missingCount: 0,
        currentStatus: "active",
      };
      this.writeCurrentPolicy({
        policy,
        conditions: existingBundle?.conditions ?? [],
        evidence: existingBundle?.evidence ?? [],
        legalBases: existingBundle?.legalBases ?? [],
      });
      return { state: "unchanged", changes: [] };
    }

    const policy: Policy = existing
      ? {
          ...input.policy,
          id: existing.id,
          firstSeenAt: existing.firstSeenAt,
        }
      : input.policy;
    const changes = existing ? diffPolicies(existing, policy) : [];
    const bundle: PolicyBundle = {
      policy,
      conditions: input.conditions.map((condition) => ({ ...condition, policyId: policy.id })),
      evidence: input.evidence.map((item) => ({ ...item, policyId: policy.id })),
      legalBases: input.legalBases.map((basis) => ({ ...basis, policyId: policy.id })),
    };
    const versions = this.readVersions(policy.id);
    const nextVersion = (versions.at(-1)?.version ?? 0) + 1;
    const version: PolicyVersion = {
      id: `${policy.id}:v${nextVersion}`,
      policyId: policy.id,
      version: nextVersion,
      validFrom: observedAt,
      validTo: null,
      normalizedData: policy,
      rawResponse: input.rawResponse,
      diff: changes,
      sourceHash: policy.sourceHash,
      createdAt: observedAt,
    };

    this.writeCurrentPolicy(bundle);
    if (existingRow) {
      this.sql.exec(
        `UPDATE policy_versions
         SET valid_to = ?, version_json = json_set(version_json, '$.validTo', ?)
         WHERE policy_id = ? AND valid_to IS NULL`,
        observedAt,
        observedAt,
        policy.id,
      );
    }
    this.sql.exec(
      `INSERT INTO policy_versions
       (id, policy_id, version, valid_from, valid_to, version_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
      version.id,
      version.policyId,
      version.version,
      version.validFrom,
      version.validTo,
      JSON.stringify(version),
    );
    return { state: existing ? "updated" : "new", changes };
  }

  private readVersions(policyId: string, from?: string, to?: string): PolicyVersion[] {
    const clauses = ["policy_id = ?"];
    const values: string[] = [policyId];
    if (from) {
      clauses.push("substr(valid_from, 1, 10) >= ?");
      values.push(from);
    }
    if (to) {
      clauses.push("substr(valid_from, 1, 10) <= ?");
      values.push(to);
    }
    return this.sql
      .exec<VersionRow>(
        `SELECT version_json FROM policy_versions WHERE ${clauses.join(" AND ")} ORDER BY version`,
        ...values,
      )
      .toArray()
      .map(({ version_json }) => parseJson<PolicyVersion>(version_json));
  }

  private writeCurrentPolicy(bundle: PolicyBundle): void {
    const policy = bundle.policy;
    this.sql.exec(
      `INSERT INTO policies
       (id, source, source_policy_id, policy_json, bundle_json, current_status,
        is_mock, last_seen_at, missing_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         policy_json = excluded.policy_json,
         bundle_json = excluded.bundle_json,
         current_status = excluded.current_status,
         is_mock = excluded.is_mock,
         last_seen_at = excluded.last_seen_at,
         missing_count = excluded.missing_count`,
      policy.id,
      policy.source,
      policy.sourcePolicyId,
      JSON.stringify(policy),
      JSON.stringify(bundle),
      policy.currentStatus,
      policy.isMock ? 1 : 0,
      policy.lastSeenAt,
      policy.missingCount,
    );
  }

  async markMissing(source: string, observedBefore: string, threshold: number): Promise<number> {
    this.sql.exec(
      `UPDATE policies SET
         missing_count = missing_count + 1,
         policy_json = json_set(policy_json, '$.missingCount', missing_count + 1),
         bundle_json = json_set(bundle_json, '$.policy.missingCount', missing_count + 1)
       WHERE source = ? AND last_seen_at < ? AND current_status = 'active'`,
      source,
      observedBefore,
    );
    return this.sql
      .exec<{ id: string }>(
        `UPDATE policies SET
           current_status = 'source_missing',
           policy_json = json_set(policy_json, '$.currentStatus', 'source_missing'),
           bundle_json = json_set(bundle_json, '$.policy.currentStatus', 'source_missing')
         WHERE source = ? AND missing_count >= ? AND current_status = 'active'
         RETURNING id`,
        source,
        threshold,
      )
      .toArray().length;
  }

  async startSync(source: string, startedAt: string): Promise<string> {
    const id = crypto.randomUUID();
    const summary: SyncSummary = {
      id,
      source,
      startedAt,
      finishedAt: null,
      success: null,
      status: "running",
      fetchedCount: 0,
      newCount: 0,
      updatedCount: 0,
      unchangedCount: 0,
      inactiveCount: 0,
      errorCount: 0,
      errorSummary: null,
    };
    this.sql.exec(
      "INSERT INTO sync_runs (id, source, started_at, summary_json) VALUES (?, ?, ?, ?)",
      id,
      source,
      startedAt,
      JSON.stringify(summary),
    );
    return id;
  }

  async finishSync(
    id: string,
    summary: Omit<SyncSummary, "id" | "source" | "startedAt">,
  ): Promise<void> {
    const row = this.sql
      .exec<SyncRow>("SELECT summary_json FROM sync_runs WHERE id = ?", id)
      .toArray()[0];
    if (!row) return;
    const finished = { ...parseJson<SyncSummary>(row.summary_json), ...summary };
    this.sql.exec(
      "UPDATE sync_runs SET finished_at = ?, status = ?, summary_json = ? WHERE id = ?",
      finished.finishedAt,
      finished.status,
      JSON.stringify(finished),
      id,
    );
  }

  private migrate(): void {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS _sql_schema_migrations (
        id INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    const { version } = this.sql
      .exec<{ version: number }>(
        "SELECT COALESCE(MAX(id), 0) AS version FROM _sql_schema_migrations",
      )
      .one();
    if (version >= 1) return;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS policies (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        source_policy_id TEXT NOT NULL,
        policy_json TEXT NOT NULL,
        bundle_json TEXT NOT NULL,
        current_status TEXT NOT NULL,
        is_mock INTEGER NOT NULL DEFAULT 0,
        last_seen_at TEXT NOT NULL,
        missing_count INTEGER NOT NULL DEFAULT 0,
        UNIQUE(source, source_policy_id)
      );
      CREATE INDEX IF NOT EXISTS idx_do_policies_status
        ON policies(current_status, is_mock);
      CREATE TABLE IF NOT EXISTS policy_versions (
        id TEXT PRIMARY KEY,
        policy_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        valid_from TEXT NOT NULL,
        valid_to TEXT,
        version_json TEXT NOT NULL,
        UNIQUE(policy_id, version)
      );
      CREATE INDEX IF NOT EXISTS idx_do_versions_policy
        ON policy_versions(policy_id, version);
      CREATE TABLE IF NOT EXISTS sync_runs (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        status TEXT NOT NULL DEFAULT 'running',
        summary_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_do_sync_started ON sync_runs(started_at DESC);
      INSERT INTO _sql_schema_migrations (id) VALUES (1);
    `);
  }
}

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}
