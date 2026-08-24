import { CONNECTORS, credentialFor } from "./ingestion-config";
import type {
  CollectionResult,
  ConnectorId,
  IngestionStatus,
  NormalizedExternalRecord,
  RuntimeEnvironment,
} from "./ingestion-types";

type ConnectorRow = {
  id: ConnectorId;
  status: string;
  last_run_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  last_record_count: number;
};

type ExistingRecordRow = {
  id: string;
  title: string;
  content_hash: string;
};

export type PublicExternalRecord = {
  id: string;
  sourceId: ConnectorId;
  sourceRecordId: string;
  recordType: string;
  title: string;
  summary: string | null;
  category: string | null;
  region: string | null;
  organization: string | null;
  canonicalUrl: string | null;
  sourceUpdatedAt: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
};

let activeRuntime: RuntimeEnvironment | undefined;

export function setRuntimeEnvironment(runtime: RuntimeEnvironment) {
  activeRuntime = runtime;
}

export function getRuntimeEnvironment(): RuntimeEnvironment {
  return activeRuntime ?? {};
}

function getDatabase(runtime: RuntimeEnvironment): D1Database {
  if (!runtime.DB) {
    throw new Error("Y-HUB D1 binding DB is unavailable.");
  }
  return runtime.DB;
}

export async function ensureConnectorRows(runtime = getRuntimeEnvironment()) {
  const db = getDatabase(runtime);
  const now = new Date().toISOString();
  await db.batch(
    CONNECTORS.map((connector) =>
      db
        .prepare(
          `INSERT INTO source_connectors
            (id, name, endpoint, auth_env_key, status, last_record_count, updated_at)
           VALUES (?, ?, ?, ?, ?, 0, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             endpoint = excluded.endpoint,
             auth_env_key = excluded.auth_env_key,
             updated_at = excluded.updated_at`,
        )
        .bind(
          connector.id,
          connector.name,
          connector.endpoint,
          connector.authEnvKey,
          credentialFor(connector.id, runtime) ? "ready" : "key_required",
          now,
        ),
    ),
  );
}

export async function beginCollectionRun(
  sourceId: ConnectorId,
  runtime = getRuntimeEnvironment(),
) {
  const db = getDatabase(runtime);
  await ensureConnectorRows(runtime);
  const startedAt = new Date().toISOString();
  const runId = `${sourceId}:${startedAt}:${crypto.randomUUID()}`;
  await db.batch([
    db
      .prepare(
        `INSERT INTO collection_runs (id, source_id, status, started_at)
         VALUES (?, ?, 'running', ?)`,
      )
      .bind(runId, sourceId, startedAt),
    db
      .prepare(
        `UPDATE source_connectors
         SET status = 'running', last_run_at = ?, last_error = NULL, updated_at = ?
         WHERE id = ?`,
      )
      .bind(startedAt, startedAt, sourceId),
  ]);
  return { runId, startedAt };
}

export async function finishCollectionRun(
  runId: string,
  result: CollectionResult,
  runtime = getRuntimeEnvironment(),
) {
  const db = getDatabase(runtime);
  const connectorState =
    result.status === "succeeded"
      ? "succeeded"
      : result.status === "partial"
        ? "partial"
        : result.status === "skipped"
          ? "key_required"
          : "failed";
  const successAt =
    result.status === "succeeded" || result.status === "partial"
      ? result.finishedAt
      : null;

  await db.batch([
    db
      .prepare(
        `UPDATE collection_runs
         SET status = ?, finished_at = ?, fetched_count = ?, inserted_count = ?,
             updated_count = ?, unchanged_count = ?, duration_ms = ?, error_message = ?
         WHERE id = ?`,
      )
      .bind(
        result.status,
        result.finishedAt,
        result.fetchedCount,
        result.insertedCount,
        result.updatedCount,
        result.unchangedCount,
        result.durationMs,
        result.message ?? null,
        runId,
      ),
    db
      .prepare(
        `UPDATE source_connectors
         SET status = ?, last_success_at = COALESCE(?, last_success_at),
             last_error = ?, last_record_count = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(
        connectorState,
        successAt,
        result.status === "failed" ? (result.message ?? "수집 실패") : null,
        result.fetchedCount,
        result.finishedAt,
        result.sourceId,
      ),
  ]);
}

export async function upsertExternalRecord(
  record: NormalizedExternalRecord,
  runtime = getRuntimeEnvironment(),
): Promise<"inserted" | "updated" | "unchanged"> {
  const db = getDatabase(runtime);
  const payloadJson = stableStringify(record.payload);
  const contentHash = await sha256(payloadJson);
  const now = new Date().toISOString();
  const existing = await db
    .prepare(
      `SELECT id, title, content_hash
       FROM external_records
       WHERE source_id = ? AND source_record_id = ?`,
    )
    .bind(record.sourceId, record.sourceRecordId)
    .first<ExistingRecordRow>();

  if (!existing) {
    const id = `${record.sourceId}:${record.sourceRecordId}`;
    await db
      .prepare(
        `INSERT INTO external_records
          (id, source_id, source_record_id, record_type, title, summary, category,
           region, organization, canonical_url, source_updated_at, payload_json,
           content_hash, first_seen_at, last_seen_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        record.sourceId,
        record.sourceRecordId,
        record.recordType,
        record.title,
        record.summary ?? null,
        record.category ?? null,
        record.region ?? null,
        record.organization ?? null,
        record.canonicalUrl ?? null,
        record.sourceUpdatedAt ?? null,
        payloadJson,
        contentHash,
        now,
        now,
      )
      .run();
    return "inserted";
  }

  if (existing.content_hash === contentHash) {
    await db
      .prepare(
        `UPDATE external_records SET last_seen_at = ? WHERE id = ?`,
      )
      .bind(now, existing.id)
      .run();
    return "unchanged";
  }

  await db.batch([
    db
      .prepare(
        `UPDATE external_records
         SET record_type = ?, title = ?, summary = ?, category = ?, region = ?,
             organization = ?, canonical_url = ?, source_updated_at = ?,
             payload_json = ?, content_hash = ?, last_seen_at = ?
         WHERE id = ?`,
      )
      .bind(
        record.recordType,
        record.title,
        record.summary ?? null,
        record.category ?? null,
        record.region ?? null,
        record.organization ?? null,
        record.canonicalUrl ?? null,
        record.sourceUpdatedAt ?? null,
        payloadJson,
        contentHash,
        now,
        existing.id,
      ),
    db
      .prepare(
        `INSERT INTO change_candidates
          (id, external_record_id, source_id, field, previous_value, current_value,
           previous_hash, current_hash, detected_at, review_status)
         VALUES (?, ?, ?, 'record', ?, ?, ?, ?, ?, 'pending')`,
      )
      .bind(
        crypto.randomUUID(),
        existing.id,
        record.sourceId,
        existing.title,
        record.title,
        existing.content_hash,
        contentHash,
        now,
      ),
  ]);
  return "updated";
}

export async function getIngestionStatus(
  runtime = getRuntimeEnvironment(),
): Promise<IngestionStatus> {
  const checkedAt = new Date().toISOString();
  if (!runtime.DB) {
    return {
      storage: "unavailable",
      checkedAt,
      recordCount: 0,
      runCount: 0,
      pendingChangeCount: 0,
      observationCount: 0,
      connectors: CONNECTORS.map((connector) => ({
        ...connector,
        state: credentialFor(connector.id, runtime) ? "ready" : "key_required",
        keyConfigured: Boolean(credentialFor(connector.id, runtime)),
        lastRunAt: null,
        lastSuccessAt: null,
        lastError: null,
        lastRecordCount: 0,
      })),
    };
  }

  const db = getDatabase(runtime);
  await ensureConnectorRows(runtime);
  const [connectorResult, recordCount, runCount, changeCount, observationCount] =
    await Promise.all([
      db.prepare(`SELECT * FROM source_connectors ORDER BY id`).all<ConnectorRow>(),
      countRow(db, "external_records"),
      countRow(db, "collection_runs"),
      countRow(db, "change_candidates", "WHERE review_status = 'pending'"),
      countRow(db, "indicator_observations"),
    ]);
  const rows = connectorResult.results ?? [];

  return {
    storage: "d1",
    checkedAt,
    recordCount,
    runCount,
    pendingChangeCount: changeCount,
    observationCount,
    connectors: CONNECTORS.map((connector) => {
      const row = rows.find((candidate) => candidate.id === connector.id);
      const keyConfigured = Boolean(credentialFor(connector.id, runtime));
      return {
        ...connector,
        state: keyConfigured
          ? ((row?.status ?? "ready") as IngestionStatus["connectors"][number]["state"])
          : "key_required",
        keyConfigured,
        lastRunAt: row?.last_run_at ?? null,
        lastSuccessAt: row?.last_success_at ?? null,
        lastError: row?.last_error ?? null,
        lastRecordCount: row?.last_record_count ?? 0,
      };
    }),
  };
}

export async function getExternalRecords(
  recordType?: string,
  limit = 100,
  runtime = getRuntimeEnvironment(),
): Promise<PublicExternalRecord[]> {
  const db = getDatabase(runtime);
  const cappedLimit = Math.min(500, Math.max(1, limit));
  const where = recordType ? "WHERE record_type = ?" : "";
  const statement = db.prepare(
    `SELECT id, source_id, source_record_id, record_type, title, summary, category,
            region, organization, canonical_url, source_updated_at, first_seen_at, last_seen_at
     FROM external_records ${where}
     ORDER BY last_seen_at DESC LIMIT ?`,
  );
  const result = recordType
    ? await statement.bind(recordType, cappedLimit).all<Record<string, unknown>>()
    : await statement.bind(cappedLimit).all<Record<string, unknown>>();
  return (result.results ?? []).map((row) => ({
    id: String(row.id),
    sourceId: String(row.source_id) as ConnectorId,
    sourceRecordId: String(row.source_record_id),
    recordType: String(row.record_type),
    title: String(row.title),
    summary: nullableString(row.summary),
    category: nullableString(row.category),
    region: nullableString(row.region),
    organization: nullableString(row.organization),
    canonicalUrl: nullableString(row.canonical_url),
    sourceUpdatedAt: nullableString(row.source_updated_at),
    firstSeenAt: String(row.first_seen_at),
    lastSeenAt: String(row.last_seen_at),
  }));
}

export async function getRecentRuns(
  limit = 20,
  runtime = getRuntimeEnvironment(),
) {
  const db = getDatabase(runtime);
  const result = await db
    .prepare(
      `SELECT id, source_id, status, started_at, finished_at, fetched_count,
              inserted_count, updated_count, unchanged_count, duration_ms, error_message
       FROM collection_runs ORDER BY started_at DESC LIMIT ?`,
    )
    .bind(Math.min(100, Math.max(1, limit)))
    .all<Record<string, unknown>>();
  return result.results ?? [];
}

async function countRow(db: D1Database, table: string, where = "") {
  const allowedTables = new Set([
    "external_records",
    "collection_runs",
    "change_candidates",
    "indicator_observations",
  ]);
  if (!allowedTables.has(table)) throw new Error("Unsupported count table.");
  const row = await db
    .prepare(`SELECT COUNT(*) AS count FROM ${table} ${where}`)
    .first<{ count: number }>();
  return Number(row?.count ?? 0);
}

function nullableString(value: unknown) {
  return value === null || value === undefined ? null : String(value);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
