export type ConnectorId = "youth-center" | "kosis" | "law";

export type ConnectorState =
  | "ready"
  | "running"
  | "succeeded"
  | "partial"
  | "key_required"
  | "failed";

export interface RuntimeEnvironment {
  DB?: D1Database;
  YOUTH_CENTER_API_KEY?: string;
  YOUTH_CENTER_API_URL?: string;
  YOUTH_CENTER_MAX_PAGES?: string;
  KOSIS_API_KEY?: string;
  LAW_OPEN_API_KEY?: string;
  LAW_OC?: string;
  SYNC_SECRET?: string;
  COLLECTION_INTERVAL_MINUTES?: string;
  [key: string]: unknown;
}

export interface ConnectorDefinition {
  id: ConnectorId;
  name: string;
  organization: string;
  endpoint: string;
  docsUrl: string;
  authEnvKey: string;
  cadence: string;
}

export interface NormalizedExternalRecord {
  sourceId: ConnectorId;
  sourceRecordId: string;
  recordType: "policy" | "statistics_catalog" | "law";
  title: string;
  summary?: string;
  category?: string;
  region?: string;
  organization?: string;
  canonicalUrl?: string;
  sourceUpdatedAt?: string;
  payload: Record<string, unknown>;
}

export interface CollectionResult {
  sourceId: ConnectorId;
  status: "succeeded" | "partial" | "skipped" | "failed";
  fetchedCount: number;
  insertedCount: number;
  updatedCount: number;
  unchangedCount: number;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  message?: string;
}

export interface ConnectorStatusView extends ConnectorDefinition {
  state: ConnectorState;
  keyConfigured: boolean;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastRecordCount: number;
}

export interface IngestionStatus {
  storage: "d1" | "unavailable";
  checkedAt: string;
  recordCount: number;
  runCount: number;
  pendingChangeCount: number;
  observationCount: number;
  connectors: ConnectorStatusView[];
}

