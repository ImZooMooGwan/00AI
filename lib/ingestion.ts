import {
  CONNECTORS,
  connectorById,
  credentialFor,
  readEnvString,
} from "./ingestion-config";
import {
  beginCollectionRun,
  finishCollectionRun,
  getRuntimeEnvironment,
  upsertExternalRecord,
} from "./ingestion-store";
import type {
  CollectionResult,
  ConnectorId,
  NormalizedExternalRecord,
  RuntimeEnvironment,
} from "./ingestion-types";

type ApiRecord = Record<string, unknown>;
type FetchResult = {
  records: NormalizedExternalRecord[];
  warnings: string[];
};

const KOSIS_SEARCH_TERMS = [
  "청년인구",
  "청년 고용률",
  "청년 실업률",
  "청년 순이동",
  "청년 주거",
  "청년 창업",
];

const LAW_SEARCH_TERMS = [
  "청년기본법",
  "청년고용촉진 특별법",
  "주거기본법",
  "고용정책 기본법",
];

export async function runCollection(
  sourceId: ConnectorId,
  runtime = getRuntimeEnvironment(),
): Promise<CollectionResult> {
  const credential = credentialFor(sourceId, runtime);
  const { runId, startedAt } = await beginCollectionRun(sourceId, runtime);
  const started = Date.now();

  if (!credential) {
    const result = buildResult(sourceId, startedAt, started, "skipped", {
      message: `${connectorById(sourceId)?.authEnvKey ?? "API 키"}가 필요합니다.`,
    });
    await finishCollectionRun(runId, result, runtime);
    return result;
  }

  try {
    const fetched = await fetchSource(sourceId, credential, runtime);
    const counts = { inserted: 0, updated: 0, unchanged: 0 };
    for (const record of dedupeRecords(fetched.records)) {
      const outcome = await upsertExternalRecord(record, runtime);
      counts[outcome] += 1;
    }
    const status = fetched.warnings.length ? "partial" : "succeeded";
    const result = buildResult(sourceId, startedAt, started, status, {
      fetchedCount: fetched.records.length,
      insertedCount: counts.inserted,
      updatedCount: counts.updated,
      unchangedCount: counts.unchanged,
      message: fetched.warnings.length ? fetched.warnings.join(" · ") : undefined,
    });
    await finishCollectionRun(runId, result, runtime);
    return result;
  } catch (error) {
    const result = buildResult(sourceId, startedAt, started, "failed", {
      message: safeErrorMessage(error),
    });
    await finishCollectionRun(runId, result, runtime);
    return result;
  }
}

export async function runAllCollections(
  runtime = getRuntimeEnvironment(),
  sources: ConnectorId[] = CONNECTORS.map((connector) => connector.id),
) {
  const results: CollectionResult[] = [];
  for (const source of sources) {
    results.push(await runCollection(source, runtime));
  }
  return results;
}

export async function runScheduledCollection(runtime: RuntimeEnvironment) {
  return runAllCollections(runtime);
}

async function fetchSource(
  sourceId: ConnectorId,
  credential: string,
  runtime: RuntimeEnvironment,
): Promise<FetchResult> {
  if (sourceId === "youth-center") {
    return fetchYouthCenter(credential, runtime);
  }
  if (sourceId === "kosis") return fetchKosis(credential);
  return fetchLaw(credential);
}

async function fetchYouthCenter(
  apiKey: string,
  runtime: RuntimeEnvironment,
): Promise<FetchResult> {
  const endpoint =
    readEnvString(runtime, "YOUTH_CENTER_API_URL") ??
    "https://www.youthcenter.go.kr/opi/youthPlcyList.do";
  const pageSize = 100;
  const maxPages = clampNumber(
    readEnvString(runtime, "YOUTH_CENTER_MAX_PAGES"),
    5,
    1,
    30,
  );
  const records: NormalizedExternalRecord[] = [];
  const modernEndpoint = endpoint.includes("/go/ythip/getPlcy");

  for (let page = 1; page <= maxPages; page += 1) {
    const url = new URL(endpoint);
    if (modernEndpoint) {
      url.searchParams.set("apiKeyNm", apiKey);
      url.searchParams.set("pageNum", String(page));
      url.searchParams.set("pageSize", String(pageSize));
      url.searchParams.set("pageType", "1");
      url.searchParams.set("rtnType", "json");
    } else {
      url.searchParams.set("openApiVlak", apiKey);
      url.searchParams.set("pageIndex", String(page));
      url.searchParams.set("display", String(pageSize));
    }
    const payload = await requestPayload(url);
    const pageRecords = findObjectRecords(payload)
      .map((record, index) => normalizeYouthPolicy(record, page, index))
      .filter((record): record is NormalizedExternalRecord => Boolean(record));
    records.push(...pageRecords);
    if (pageRecords.length < pageSize) break;
  }

  return {
    records,
    warnings:
      records.length === 0
        ? ["응답은 성공했지만 정규화 가능한 정책 레코드가 없습니다."]
        : [],
  };
}

async function fetchKosis(apiKey: string): Promise<FetchResult> {
  const records: NormalizedExternalRecord[] = [];
  const warnings: string[] = [];

  for (const term of KOSIS_SEARCH_TERMS) {
    try {
      const url = new URL("https://kosis.kr/openapi/statisticsSearch.do");
      url.searchParams.set("method", "getList");
      url.searchParams.set("apiKey", apiKey);
      url.searchParams.set("searchNm", term);
      url.searchParams.set("sort", "DATE");
      url.searchParams.set("startCount", "1");
      url.searchParams.set("resultCount", "20");
      url.searchParams.set("format", "json");
      url.searchParams.set("content", "json");
      const payload = await requestPayload(url);
      records.push(
        ...findObjectRecords(payload)
          .map((record, index) => normalizeKosisRecord(record, term, index))
          .filter((record): record is NormalizedExternalRecord => Boolean(record)),
      );
    } catch (error) {
      warnings.push(`${term}: ${safeErrorMessage(error)}`);
    }
  }
  if (!records.length && warnings.length) throw new Error(warnings.join(" · "));
  return { records, warnings };
}

async function fetchLaw(apiKey: string): Promise<FetchResult> {
  const records: NormalizedExternalRecord[] = [];
  const warnings: string[] = [];

  for (const term of LAW_SEARCH_TERMS) {
    try {
      const url = new URL("https://www.law.go.kr/DRF/lawSearch.do");
      url.searchParams.set("OC", apiKey);
      url.searchParams.set("target", "eflaw");
      url.searchParams.set("type", "JSON");
      url.searchParams.set("query", term);
      url.searchParams.set("nw", "3");
      url.searchParams.set("display", "20");
      url.searchParams.set("sort", "ddes");
      const payload = await requestPayload(url);
      records.push(
        ...findObjectRecords(payload)
          .map((record, index) => normalizeLawRecord(record, term, index))
          .filter((record): record is NormalizedExternalRecord => Boolean(record)),
      );
    } catch (error) {
      warnings.push(`${term}: ${safeErrorMessage(error)}`);
    }
  }
  if (!records.length && warnings.length) throw new Error(warnings.join(" · "));
  return { records, warnings };
}

async function requestPayload(url: URL): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json, application/xml;q=0.9, text/xml;q=0.8",
      "User-Agent": "Y-HUB/1.0 (+https://youth-policy-data-hub.hayahoyeho.chatgpt.site)",
    },
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  if (!text.trim()) throw new Error("빈 응답");
  try {
    return JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    const xmlRecords = parseXmlRecords(text);
    if (!xmlRecords.length) {
      throw new Error("지원하지 않는 응답 형식");
    }
    return xmlRecords;
  }
}

function normalizeYouthPolicy(
  input: ApiRecord,
  page: number,
  index: number,
): NormalizedExternalRecord | null {
  const record = flattenRecord(input);
  const title = pick(record, [
    "plcyNm",
    "polyBizSjnm",
    "policyName",
    "bizNm",
    "정책명",
    "title",
  ]);
  if (!title) return null;
  const sourceRecordId =
    pick(record, [
      "plcyNo",
      "bizId",
      "polyBizId",
      "policyId",
      "srchPolicyId",
      "id",
    ]) ?? fallbackId(title, record, `${page}-${index}`);
  const canonicalUrl = normalizeUrl(
    pick(record, [
      "aplyUrlAddr",
      "rqutUrla",
      "refUrlAddr",
      "plcyUrl",
      "url",
    ]),
    "https://www.youthcenter.go.kr",
  );
  return {
    sourceId: "youth-center",
    sourceRecordId,
    recordType: "policy",
    title,
    summary: pick(record, ["plcyExplnCn", "polyItcnCn", "plcySprtCn", "summary"]),
    category: pick(record, ["lclsfNm", "mclsfNm", "bizTycdSel", "plcyMajorCdNm"]),
    region: pick(record, ["zipCd", "polyBizSecd", "rgtrInstCdNm", "region"]),
    organization: pick(record, [
      "sprvsnInstCdNm",
      "operInstCdNm",
      "cnsgNmor",
      "organization",
    ]),
    canonicalUrl:
      canonicalUrl ??
      "https://www.youthcenter.go.kr/youthPolicy/ythPlcyTotalSearch",
    sourceUpdatedAt: pick(record, [
      "mdfcnDt",
      "lastCnttPrcsDe",
      "frstRegDt",
      "bizEdDt",
    ]),
    payload: input,
  };
}

function normalizeKosisRecord(
  input: ApiRecord,
  term: string,
  index: number,
): NormalizedExternalRecord | null {
  const record = flattenRecord(input);
  const title = pick(record, ["TBL_NM", "STAT_NM", "tblNm", "title"]);
  if (!title) return null;
  const tableId = pick(record, ["TBL_ID", "STAT_ID", "tblId"]);
  return {
    sourceId: "kosis",
    sourceRecordId: tableId ?? fallbackId(title, record, `${term}-${index}`),
    recordType: "statistics_catalog",
    title,
    summary: pick(record, ["CONTENTS", "ITEM03", "contents"]),
    category: term,
    organization: pick(record, ["ORG_NM", "orgNm"]),
    canonicalUrl: normalizeUrl(
      pick(record, ["TBL_VIEW_URL", "LINK_URL", "linkUrl"]),
      "https://kosis.kr",
    ),
    sourceUpdatedAt: pick(record, ["END_PRD_DE", "STRT_PRD_DE"]),
    payload: input,
  };
}

function normalizeLawRecord(
  input: ApiRecord,
  term: string,
  index: number,
): NormalizedExternalRecord | null {
  const record = flattenRecord(input);
  const title = pick(record, ["법령명한글", "법령약칭명", "lawName", "title"]);
  if (!title) return null;
  const lawId = pick(record, ["법령ID", "법령일련번호", "lawId", "id"]);
  const amendment = pick(record, ["제개정구분명", "법령구분명"]);
  const promulgation = pick(record, ["공포일자"]);
  const enforcement = pick(record, ["시행일자"]);
  return {
    sourceId: "law",
    sourceRecordId: lawId ?? fallbackId(title, record, `${term}-${index}`),
    recordType: "law",
    title,
    summary: [amendment, promulgation && `공포 ${promulgation}`, enforcement && `시행 ${enforcement}`]
      .filter(Boolean)
      .join(" · "),
    category: term,
    organization: pick(record, ["소관부처명"]),
    canonicalUrl: normalizeUrl(
      pick(record, ["법령상세링크", "상세링크", "url"]),
      "https://www.law.go.kr",
    ),
    sourceUpdatedAt: promulgation ?? enforcement,
    payload: input,
  };
}

function findObjectRecords(value: unknown): ApiRecord[] {
  const candidates: ApiRecord[][] = [];
  const visit = (node: unknown, depth: number) => {
    if (depth > 8 || node === null || node === undefined) return;
    if (Array.isArray(node)) {
      const objects = node.filter(isRecord);
      if (objects.length) candidates.push(objects);
      for (const item of node) visit(item, depth + 1);
      return;
    }
    if (isRecord(node)) {
      for (const child of Object.values(node)) visit(child, depth + 1);
    }
  };
  visit(value, 0);
  if (!candidates.length) return isRecord(value) ? [value] : [];
  return candidates.sort((a, b) => scoreRecords(b) - scoreRecords(a))[0];
}

function scoreRecords(records: ApiRecord[]) {
  const sample = records.slice(0, 5).map(flattenRecord);
  const meaningful = sample.reduce(
    (count, record) =>
      count +
      Number(
        Boolean(
          pick(record, [
            "plcyNm",
            "polyBizSjnm",
            "TBL_NM",
            "법령명한글",
            "title",
          ]),
        ),
      ),
    0,
  );
  return records.length + meaningful * 1_000;
}

function parseXmlRecords(xml: string): ApiRecord[] {
  const results: ApiRecord[][] = [];
  for (const tag of ["youthPolicy", "policy", "item", "emp", "law", "row"]) {
    const matches = [...xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "gi"))];
    if (!matches.length) continue;
    results.push(matches.map((match) => parseXmlObject(match[1])));
  }
  return results.sort((a, b) => b.length - a.length)[0] ?? [];
}

function parseXmlObject(fragment: string): ApiRecord {
  const record: ApiRecord = {};
  const expression = /<([A-Za-z0-9_가-힣:-]+)(?:\s[^>]*)?>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/\1>/g;
  for (const match of fragment.matchAll(expression)) {
    const value = decodeXml((match[2] ?? match[3] ?? "").replace(/<[^>]+>/g, "").trim());
    if (value) record[match[1]] = value;
  }
  return record;
}

function flattenRecord(input: ApiRecord) {
  const output: Record<string, string> = {};
  const visit = (node: unknown, depth: number) => {
    if (depth > 5 || !isRecord(node)) return;
    for (const [key, value] of Object.entries(node)) {
      if (value === null || value === undefined) continue;
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        if (!(key in output)) output[key] = String(value).trim();
      } else if (isRecord(value)) visit(value, depth + 1);
    }
  };
  visit(input, 0);
  return output;
}

function pick(record: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value) return value;
  }
  return undefined;
}

function normalizeUrl(value: string | undefined, base: string) {
  if (!value) return undefined;
  try {
    return new URL(value, base).toString();
  } catch {
    return undefined;
  }
}

function fallbackId(
  title: string,
  record: Record<string, string>,
  salt: string,
) {
  const source = `${title}|${record.organization ?? ""}|${salt}`;
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fallback-${(hash >>> 0).toString(16)}`;
}

function dedupeRecords(records: NormalizedExternalRecord[]) {
  const unique = new Map<string, NormalizedExternalRecord>();
  for (const record of records) {
    unique.set(`${record.sourceId}:${record.sourceRecordId}`, record);
  }
  return [...unique.values()];
}

function clampNumber(
  raw: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const value = Number(raw ?? fallback);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(value)));
}

function buildResult(
  sourceId: ConnectorId,
  startedAt: string,
  started: number,
  status: CollectionResult["status"],
  values: Partial<CollectionResult>,
): CollectionResult {
  const finishedAt = new Date().toISOString();
  return {
    sourceId,
    status,
    fetchedCount: values.fetchedCount ?? 0,
    insertedCount: values.insertedCount ?? 0,
    updatedCount: values.updatedCount ?? 0,
    unchangedCount: values.unchangedCount ?? 0,
    startedAt,
    finishedAt,
    durationMs: Date.now() - started,
    message: values.message,
  };
}

function safeErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return "알 수 없는 수집 오류";
  return error.message.replace(/[A-Za-z0-9_-]{24,}/g, "[redacted]").slice(0, 500);
}

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function isRecord(value: unknown): value is ApiRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
