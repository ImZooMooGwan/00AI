import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import {
  DatabaseSync,
  type SQLInputValue,
  type StatementSync,
} from "node:sqlite";
import {
  ensureConnectorRows,
  getIngestionStatus,
  upsertExternalRecord,
} from "../lib/ingestion-store";
import type { RuntimeEnvironment } from "../lib/ingestion-types";

class PreparedStatementAdapter {
  private values: SQLInputValue[] = [];

  constructor(private readonly statement: StatementSync) {}

  bind(...values: unknown[]) {
    this.values = values as SQLInputValue[];
    return this;
  }

  async first<T>() {
    return (this.statement.get(...this.values) as T | undefined) ?? null;
  }

  async all<T>() {
    return {
      success: true,
      results: this.statement.all(...this.values) as T[],
    };
  }

  async run<T>() {
    this.statement.run(...this.values);
    return { success: true, results: [] as T[] };
  }
}

class DatabaseAdapter {
  constructor(private readonly database: DatabaseSync) {}

  prepare(query: string) {
    return new PreparedStatementAdapter(this.database.prepare(query));
  }

  async batch(statements: PreparedStatementAdapter[]) {
    const results = [];
    for (const statement of statements) results.push(await statement.run());
    return results;
  }
}

const sqlite = new DatabaseSync(":memory:");
const migration = readFileSync(
  new URL("../drizzle/0000_broken_jane_foster.sql", import.meta.url),
  "utf8",
).replaceAll("--> statement-breakpoint", "");
sqlite.exec(migration);

const runtime = {
  DB: new DatabaseAdapter(sqlite) as unknown as D1Database,
  YOUTH_CENTER_API_KEY: "local-test-key",
} satisfies RuntimeEnvironment;

await ensureConnectorRows(runtime);
const emptyStatus = await getIngestionStatus(runtime);
assert.equal(emptyStatus.storage, "d1");
assert.equal(emptyStatus.connectors.length, 3);
assert.equal(emptyStatus.recordCount, 0);

const sample = {
  sourceId: "youth-center" as const,
  sourceRecordId: "test-policy-1",
  recordType: "policy" as const,
  title: "테스트 청년정책",
  payload: { id: "test-policy-1", title: "테스트 청년정책", benefit: "100" },
};
assert.equal(await upsertExternalRecord(sample, runtime), "inserted");
assert.equal(await upsertExternalRecord(sample, runtime), "unchanged");
assert.equal(
  await upsertExternalRecord(
    { ...sample, payload: { ...sample.payload, benefit: "200" } },
    runtime,
  ),
  "updated",
);

const populatedStatus = await getIngestionStatus(runtime);
assert.equal(populatedStatus.recordCount, 1);
assert.equal(populatedStatus.pendingChangeCount, 1);
console.log("validate:ingestion 통과 · D1 5개 테이블 · 삽입/무변경/변경감지");
