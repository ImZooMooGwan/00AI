import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const sourceConnectors = sqliteTable(
  "source_connectors",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    endpoint: text("endpoint").notNull(),
    authEnvKey: text("auth_env_key").notNull(),
    status: text("status").notNull().default("key_required"),
    lastRunAt: text("last_run_at"),
    lastSuccessAt: text("last_success_at"),
    lastError: text("last_error"),
    lastRecordCount: integer("last_record_count").notNull().default(0),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("source_connectors_status_idx").on(table.status)],
);

export const collectionRuns = sqliteTable(
  "collection_runs",
  {
    id: text("id").primaryKey(),
    sourceId: text("source_id").notNull(),
    status: text("status").notNull(),
    startedAt: text("started_at").notNull(),
    finishedAt: text("finished_at"),
    fetchedCount: integer("fetched_count").notNull().default(0),
    insertedCount: integer("inserted_count").notNull().default(0),
    updatedCount: integer("updated_count").notNull().default(0),
    unchangedCount: integer("unchanged_count").notNull().default(0),
    durationMs: integer("duration_ms"),
    errorMessage: text("error_message"),
  },
  (table) => [
    index("collection_runs_source_idx").on(table.sourceId),
    index("collection_runs_started_idx").on(table.startedAt),
  ],
);

export const externalRecords = sqliteTable(
  "external_records",
  {
    id: text("id").primaryKey(),
    sourceId: text("source_id").notNull(),
    sourceRecordId: text("source_record_id").notNull(),
    recordType: text("record_type").notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    category: text("category"),
    region: text("region"),
    organization: text("organization"),
    canonicalUrl: text("canonical_url"),
    sourceUpdatedAt: text("source_updated_at"),
    payloadJson: text("payload_json").notNull(),
    contentHash: text("content_hash").notNull(),
    firstSeenAt: text("first_seen_at").notNull(),
    lastSeenAt: text("last_seen_at").notNull(),
  },
  (table) => [
    uniqueIndex("external_records_source_record_uq").on(table.sourceId, table.sourceRecordId),
    index("external_records_type_idx").on(table.recordType),
    index("external_records_last_seen_idx").on(table.lastSeenAt),
  ],
);

export const changeCandidates = sqliteTable(
  "change_candidates",
  {
    id: text("id").primaryKey(),
    externalRecordId: text("external_record_id").notNull(),
    sourceId: text("source_id").notNull(),
    field: text("field").notNull(),
    previousValue: text("previous_value"),
    currentValue: text("current_value"),
    previousHash: text("previous_hash").notNull(),
    currentHash: text("current_hash").notNull(),
    detectedAt: text("detected_at").notNull(),
    reviewStatus: text("review_status").notNull().default("pending"),
  },
  (table) => [
    index("change_candidates_source_idx").on(table.sourceId),
    index("change_candidates_review_idx").on(table.reviewStatus),
  ],
);

export const indicatorObservations = sqliteTable(
  "indicator_observations",
  {
    id: text("id").primaryKey(),
    indicatorId: text("indicator_id").notNull(),
    sourceId: text("source_id").notNull(),
    tableId: text("table_id"),
    period: text("period"),
    regionCode: text("region_code"),
    value: text("value"),
    unit: text("unit"),
    payloadJson: text("payload_json").notNull(),
    observedAt: text("observed_at").notNull(),
  },
  (table) => [
    uniqueIndex("indicator_observations_natural_uq").on(
      table.indicatorId,
      table.sourceId,
      table.period,
      table.regionCode,
    ),
    index("indicator_observations_period_idx").on(table.period),
  ],
);
