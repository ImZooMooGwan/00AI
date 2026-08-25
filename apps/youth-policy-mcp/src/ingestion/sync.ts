import { createPolicyRepository } from "../db/repository";
import {
  DomainError,
  type NormalizedPolicyRecord,
  type PolicyRepository,
  type SyncSummary,
} from "../domain/types";
import type { RuntimeEnv } from "../env";
import { normalizeYouthPolicy } from "./normalize";
import { YouthPolicyApiClient, youthApiConfigurationFromEnv } from "./youth-client";
import { fetchYHubSnapshotPolicies } from "./yhub-snapshot-client";

const OFFICIAL_SOURCE = "youth_center";
const SNAPSHOT_SOURCE = "yhub_verified_snapshot";
const PAGE_SIZE = 100;
const UPSERT_BATCH_SIZE = 500;
const MISSING_CONFIRMATION_RUNS = 3;

function boundedInteger(value: string | undefined, fallback: number, maximum: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

function safeErrorSummary(error: unknown): string {
  if (error instanceof DomainError) return `${error.code}: ${error.message}`.slice(0, 500);
  return "INTERNAL_SYNC_ERROR: 동기화 처리 중 내부 오류가 발생했습니다.";
}

async function upsertPolicies(
  repository: PolicyRepository,
  policies: NormalizedPolicyRecord[],
  observedAt: string,
): Promise<{ newCount: number; updatedCount: number; unchangedCount: number }> {
  let newCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  for (let offset = 0; offset < policies.length; offset += UPSERT_BATCH_SIZE) {
    const results = await repository.upsertPolicies(
      policies.slice(offset, offset + UPSERT_BATCH_SIZE),
      observedAt,
    );
    for (const result of results) {
      if (result.state === "new") newCount += 1;
      else if (result.state === "updated") updatedCount += 1;
      else unchangedCount += 1;
    }
  }
  return { newCount, updatedCount, unchangedCount };
}

export async function synchronizeYouthPolicies(env: RuntimeEnv): Promise<SyncSummary> {
  const repository = createPolicyRepository(env);
  const startedAt = new Date().toISOString();
  const source = env.YOUTH_POLICY_API_KEY ? OFFICIAL_SOURCE : SNAPSHOT_SOURCE;
  const id = await repository.startSync(source, startedAt);
  const base = {
    id,
    source,
    startedAt,
    finishedAt: null,
    success: null,
    status: "running" as const,
    fetchedCount: 0,
    newCount: 0,
    updatedCount: 0,
    unchangedCount: 0,
    inactiveCount: 0,
    errorCount: 0,
    errorSummary: null,
  };

  if (!env.YOUTH_POLICY_API_KEY) {
    try {
      const snapshot = await fetchYHubSnapshotPolicies(env, startedAt);
      const { newCount, updatedCount, unchangedCount } = await upsertPolicies(
        repository,
        snapshot.policies,
        startedAt,
      );
      const inactiveCount = await repository.markMissing(
        SNAPSHOT_SOURCE,
        startedAt,
        MISSING_CONFIRMATION_RUNS,
      );
      const finished: SyncSummary = {
        ...base,
        finishedAt: new Date().toISOString(),
        success: true,
        status: "succeeded",
        fetchedCount: snapshot.policies.length,
        newCount,
        updatedCount,
        unchangedCount,
        inactiveCount,
        errorCount: 0,
        errorSummary: null,
      };
      await repository.finishSync(id, omitIdentity(finished));
      return finished;
    } catch (error) {
      const finished: SyncSummary = {
        ...base,
        finishedAt: new Date().toISOString(),
        success: false,
        status: "failed",
        errorCount: 1,
        errorSummary: safeErrorSummary(error),
      };
      await repository.finishSync(id, omitIdentity(finished));
      return finished;
    }
  }

  let fetchedCount = 0;
  let newCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  let inactiveCount = 0;
  let errorCount = 0;
  const errors: string[] = [];
  let reachedEnd = false;

  try {
    const client = new YouthPolicyApiClient(youthApiConfigurationFromEnv(env));
    const maximumPages = boundedInteger(env.YOUTH_POLICY_MAX_PAGES, 100, 500);
    const deduplicated = new Map<string, Record<string, unknown>>();

    for (let page = 1; page <= maximumPages; page += 1) {
      const payload = await client.fetchPage(page, PAGE_SIZE);
      fetchedCount += payload.items.length;
      for (const item of payload.items) {
        const sourceId = String(item.plcyNo ?? item.bizId ?? item.policyId ?? item.id ?? "").trim();
        if (!sourceId) {
          errorCount += 1;
          errors.push("정책 ID가 없는 원천 레코드를 제외했습니다.");
          continue;
        }
        deduplicated.set(sourceId, item);
      }
      if (
        payload.items.length < PAGE_SIZE ||
        (payload.totalCount !== null && fetchedCount >= payload.totalCount)
      ) {
        reachedEnd = true;
        break;
      }
    }

    const normalizedPolicies: NormalizedPolicyRecord[] = [];
    for (const record of deduplicated.values()) {
      try {
        normalizedPolicies.push(await normalizeYouthPolicy(record, startedAt));
      } catch {
        errorCount += 1;
        errors.push("필수 필드가 없거나 유효하지 않은 정책 레코드를 제외했습니다.");
      }
    }
    const counts = await upsertPolicies(repository, normalizedPolicies, startedAt);
    newCount = counts.newCount;
    updatedCount = counts.updatedCount;
    unchangedCount = counts.unchangedCount;

    if (reachedEnd && errorCount === 0) {
      inactiveCount = await repository.markMissing(
        OFFICIAL_SOURCE,
        startedAt,
        MISSING_CONFIRMATION_RUNS,
      );
    }

    const finishedAt = new Date().toISOString();
    const status: SyncSummary["status"] = errorCount > 0 || !reachedEnd ? "partial" : "succeeded";
    const summary: SyncSummary = {
      id,
      source: OFFICIAL_SOURCE,
      startedAt,
      finishedAt,
      success: status === "succeeded",
      status,
      fetchedCount,
      newCount,
      updatedCount,
      unchangedCount,
      inactiveCount,
      errorCount: errorCount + (reachedEnd ? 0 : 1),
      errorSummary: [...new Set(errors.concat(reachedEnd ? [] : ["최대 페이지에 도달해 누락 정책 판정을 보류했습니다."]))]
        .slice(0, 5)
        .join(" ") || null,
    };
    await repository.finishSync(id, omitIdentity(summary));
    return summary;
  } catch (error) {
    const summary: SyncSummary = {
      ...base,
      finishedAt: new Date().toISOString(),
      success: false,
      status: "failed",
      fetchedCount,
      newCount,
      updatedCount,
      unchangedCount,
      inactiveCount,
      errorCount: errorCount + 1,
      errorSummary: safeErrorSummary(error),
    };
    await repository.finishSync(id, omitIdentity(summary));
    console.warn(
      JSON.stringify({
        event: "official_youth_policy_sync_failed",
        fallback: SNAPSHOT_SOURCE,
      }),
    );
    const { YOUTH_POLICY_API_KEY: _officialApiKey, ...snapshotEnv } = env;
    return synchronizeYouthPolicies(snapshotEnv);
  }
}

function omitIdentity(
  summary: SyncSummary,
): Omit<SyncSummary, "id" | "source" | "startedAt"> {
  const { id: _id, source: _source, startedAt: _startedAt, ...rest } = summary;
  return rest;
}
