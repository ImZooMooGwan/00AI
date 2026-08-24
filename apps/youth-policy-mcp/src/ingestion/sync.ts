import { D1PolicyRepository } from "../db/d1-repository";
import { DomainError, type SyncSummary } from "../domain/types";
import type { RuntimeEnv } from "../env";
import { normalizeYouthPolicy } from "./normalize";
import { YouthPolicyApiClient, youthApiConfigurationFromEnv } from "./youth-client";

const SOURCE = "youth_center";
const PAGE_SIZE = 100;
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

export async function synchronizeYouthPolicies(env: RuntimeEnv): Promise<SyncSummary> {
  const repository = new D1PolicyRepository(env.DB);
  const startedAt = new Date().toISOString();
  const id = await repository.startSync(SOURCE, startedAt);
  const base = {
    id,
    source: SOURCE,
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
    const finished: SyncSummary = {
      ...base,
      finishedAt: new Date().toISOString(),
      success: false,
      status: "skipped",
      errorCount: 1,
      errorSummary: "YOUTH_POLICY_API_KEY가 설정되지 않아 동기화를 건너뛰었습니다.",
    };
    await repository.finishSync(id, omitIdentity(finished));
    return finished;
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

    for (const record of deduplicated.values()) {
      try {
        const normalized = await normalizeYouthPolicy(record, startedAt);
        const result = await repository.upsertPolicy(normalized, startedAt);
        if (result.state === "new") newCount += 1;
        else if (result.state === "updated") updatedCount += 1;
        else unchangedCount += 1;
      } catch {
        errorCount += 1;
        errors.push("필수 필드가 없거나 유효하지 않은 정책 레코드를 제외했습니다.");
      }
    }

    if (reachedEnd && errorCount === 0) {
      inactiveCount = await repository.markMissing(SOURCE, startedAt, MISSING_CONFIRMATION_RUNS);
    }

    const finishedAt = new Date().toISOString();
    const status: SyncSummary["status"] = errorCount > 0 || !reachedEnd ? "partial" : "succeeded";
    const summary: SyncSummary = {
      id,
      source: SOURCE,
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
    return summary;
  }
}

function omitIdentity(
  summary: SyncSummary,
): Omit<SyncSummary, "id" | "source" | "startedAt"> {
  const { id: _id, source: _source, startedAt: _startedAt, ...rest } = summary;
  return rest;
}
