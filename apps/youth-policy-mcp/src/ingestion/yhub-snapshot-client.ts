import type { NormalizedPolicyRecord, PolicyEvidence } from "../domain/types";
import type { RuntimeEnv } from "../env";
import { assertAllowedSourceUrl, fetchWithRetry, readLimitedText } from "./http";
import { normalizeYouthPolicy } from "./normalize";

const DEFAULT_SNAPSHOT_API_URL = "https://yhub.00ai.kr/api/v1";
const MAX_SNAPSHOT_RECORDS = 500;

interface SnapshotEnvelope {
  meta?: {
    datasetVersion?: unknown;
    basisDate?: unknown;
  };
  data?: unknown;
}

interface SnapshotSource {
  id: string;
  name: string;
  url: string;
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Y-HUB 스냅샷의 ${key} 필드가 유효하지 않습니다.`);
  }
  return value.trim();
}

function optionalString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stringArray(record: Record<string, unknown>, key: string): string[] {
  const value = record[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()));
}

function safeSourceUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Y-HUB 스냅샷 출처 URL이 유효하지 않습니다.");
  }
  return url.toString();
}

function recordArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value) || value.length > MAX_SNAPSHOT_RECORDS) {
    throw new Error("Y-HUB 스냅샷 레코드 수가 허용 범위를 벗어났습니다.");
  }
  return value.filter(
    (item): item is Record<string, unknown> =>
      typeof item === "object" && item !== null && !Array.isArray(item),
  );
}

async function fetchEnvelope(url: URL, fetcher: typeof fetch): Promise<SnapshotEnvelope> {
  const response = await fetchWithRetry(url, {
    method: "GET",
    headers: { Accept: "application/json", "User-Agent": "00AI-Youth-Policy-MCP/0.1" },
  }, 3, 10_000, fetcher);
  return JSON.parse(await readLimitedText(response)) as SnapshotEnvelope;
}

function confidence(record: Record<string, unknown>): PolicyEvidence["confidence"] {
  const state = optionalString(record, "verificationStatus");
  if (state === "verified") return "high";
  if (state === "partially_verified") return "medium";
  return "low";
}

function snapshotRecord(
  record: Record<string, unknown>,
  sourceUrl: string,
): Record<string, unknown> {
  return {
    plcyNo: requiredString(record, "id"),
    plcyNm: requiredString(record, "officialName"),
    plcyExplnCn: optionalString(record, "summary") ?? "",
    plcySprtCn: optionalString(record, "benefit") ?? "",
    zipCd: optionalString(record, "regionCode") ?? optionalString(record, "region") ?? "00",
    sprtTrgtAgeCn: optionalString(record, "age") ?? "공식 공고 확인",
    rqutPrdCn: optionalString(record, "applicationPeriod") ?? "공식 공고 확인",
    aplyMthdCn: optionalString(record, "applicationChannel") ?? "공식 원문 확인",
    sbmsnDcmntCn: stringArray(record, "requiredDocuments").join("|"),
    plcyLclsfNm: optionalString(record, "category"),
    sprvsnInstCdNm: optionalString(record, "leadOrganization"),
    addAplyQlfcCndCn: stringArray(record, "eligibility").join("|"),
    rfrncLawCn: optionalString(record, "legalBasis"),
    refUrlAddr1: sourceUrl,
    lastMdfcnDt:
      optionalString(record, "lastReviewedAt") ?? optionalString(record, "lastObservedAt"),
    yhubSnapshot: record,
  };
}

async function normalizeSnapshotPolicy(
  record: Record<string, unknown>,
  sources: Map<string, SnapshotSource>,
  observedAt: string,
  apiBase: URL,
): Promise<NormalizedPolicyRecord> {
  const sourceId = requiredString(record, "sourceId");
  const source = sources.get(sourceId);
  const slug = requiredString(record, "slug");
  const sourceUrl = source?.url ?? new URL(`/policy/${encodeURIComponent(slug)}`, apiBase.origin).toString();
  const normalized = await normalizeYouthPolicy(snapshotRecord(record, sourceUrl), observedAt);
  const sourcePolicyId = requiredString(record, "id");
  const policyId = `yhub:${sourcePolicyId}`;
  const verificationConfidence = confidence(record);
  const conflictNote =
    verificationConfidence === "high"
      ? null
      : "Y-HUB 검증 스냅샷으로 수집된 값이며 변동 조건은 공식 원문을 다시 확인해야 합니다.";

  normalized.policy = {
    ...normalized.policy,
    id: policyId,
    source: "yhub_verified_snapshot",
    sourcePolicyId,
    sourceUrl,
    sourceUpdatedAt:
      optionalString(record, "lastReviewedAt") ?? optionalString(record, "lastObservedAt"),
  };
  normalized.conditions = normalized.conditions.map((item, index) => ({
    ...item,
    id: `${policyId}:condition:${index}`,
    policyId,
    evidenceSource: source?.name ?? "Y-HUB 검증 스냅샷",
    evidenceUrl: sourceUrl,
    manualReview: true,
  }));
  normalized.evidence = normalized.evidence.map((item, index) => ({
    ...item,
    id: `${policyId}:evidence:${index}`,
    policyId,
    sourceName: source?.name ?? "Y-HUB 검증 스냅샷",
    sourceId,
    sourceUrl,
    confidence: verificationConfidence,
    conflictNote,
  }));
  normalized.legalBases = normalized.legalBases.map((item, index) => ({
    ...item,
    id: `${policyId}:legal:${index}`,
    policyId,
    sourceUrl,
    confidence: verificationConfidence,
    manualReview: true,
  }));
  normalized.rawResponse = {
    source: "Y-HUB verified snapshot",
    sourceId,
    record,
  };
  return normalized;
}

export async function fetchYHubSnapshotPolicies(
  env: RuntimeEnv,
  observedAt: string,
  fetcher: typeof fetch = fetch,
): Promise<{ policies: NormalizedPolicyRecord[]; datasetVersion: string | null }> {
  const apiBase = assertAllowedSourceUrl(env.YHUB_SNAPSHOT_API_URL ?? DEFAULT_SNAPSHOT_API_URL);
  apiBase.pathname = apiBase.pathname.replace(/\/$/, "");
  const policiesUrl = new URL(`${apiBase.pathname}/policies`, apiBase.origin);
  policiesUrl.searchParams.set("limit", String(MAX_SNAPSHOT_RECORDS));
  const sourcesUrl = new URL(`${apiBase.pathname}/sources`, apiBase.origin);
  const [policiesEnvelope, sourcesEnvelope] = await Promise.all([
    fetchEnvelope(policiesUrl, fetcher),
    fetchEnvelope(sourcesUrl, fetcher),
  ]);
  const sourceRecords = recordArray(sourcesEnvelope.data);
  const sources = new Map<string, SnapshotSource>();
  for (const record of sourceRecords) {
    const id = requiredString(record, "id");
    const url = safeSourceUrl(requiredString(record, "url"));
    sources.set(id, { id, name: requiredString(record, "name"), url });
  }
  const records = recordArray(policiesEnvelope.data);
  if (records.length === 0) throw new Error("Y-HUB 검증 스냅샷에 정책이 없습니다.");
  const policies = await Promise.all(
    records.map((record) => normalizeSnapshotPolicy(record, sources, observedAt, apiBase)),
  );
  return {
    policies,
    datasetVersion:
      typeof policiesEnvelope.meta?.datasetVersion === "string"
        ? policiesEnvelope.meta.datasetVersion
        : null,
  };
}
