import { readEnvString } from "./ingestion-config";
import { getRuntimeEnvironment } from "./ingestion-store";

export const YOUTH_POLICY_MCP_SOURCE_URL =
  "https://github.com/ImZooMooGwan/00AI/tree/main/apps/youth-policy-mcp";

export const YOUTH_POLICY_MCP_TOOLS = [
  "search_youth_policies",
  "get_youth_policy",
  "check_policy_eligibility",
  "compare_youth_policies",
  "get_policy_changes",
  "get_policy_evidence",
] as const;

const MCP_PROTOCOL_VERSION = "2025-06-18";
const DEFAULT_TIMEOUT_MS = 2_500;
const STATUS_CACHE_TTL_MS = 30_000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

type McpConnectionState =
  | "connected"
  | "degraded"
  | "unavailable"
  | "not_configured";

type JsonRecord = Record<string, unknown>;

interface McpToolDefinition {
  name?: unknown;
  title?: unknown;
  annotations?: unknown;
}

interface McpToolResult {
  structuredContent?: unknown;
  content?: unknown;
  isError?: unknown;
}

interface McpEnvelope<T = unknown> {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; retryable?: boolean };
  meta?: {
    as_of?: string;
    retrieved_at?: string;
    sources?: JsonRecord[];
    warnings?: string[];
    is_cached?: boolean;
  };
}

interface McpSearchData {
  items?: unknown[];
  pagination?: {
    total?: unknown;
    page?: unknown;
    pageSize?: unknown;
    totalPages?: unknown;
  };
}

export interface YouthPolicyMcpSearchInput {
  query?: string;
  regionCodes?: string[];
  age?: number;
  applicationStatus?:
    | "open"
    | "closing_soon"
    | "upcoming"
    | "closed"
    | "always_open"
    | "unknown";
  asOf?: string;
  page?: number;
  pageSize?: number;
}

export interface YouthPolicyMcpPolicyRecord {
  id: string;
  sourceId: "youth-policy-mcp";
  sourceRecordId: string;
  recordType: "policy";
  title: string;
  summary: string | null;
  category: null;
  region: string | null;
  organization: null;
  canonicalUrl: string | null;
  sourceUpdatedAt: null;
  firstSeenAt: string;
  lastSeenAt: string;
  applicationStatus: string | null;
  targetAge: JsonRecord | null;
  matchingReasons: string[];
}

export interface YouthPolicyMcpSearchResult {
  records: YouthPolicyMcpPolicyRecord[];
  total: number;
  generatedAt: string;
  asOf: string | null;
  warnings: string[];
  sources: JsonRecord[];
}

export interface YouthPolicyMcpStatus {
  state: McpConnectionState;
  configured: boolean;
  reachable: boolean;
  ready: boolean;
  endpoint: string | null;
  healthEndpoint: string | null;
  protocol: "Streamable HTTP";
  protocolVersion: typeof MCP_PROTOCOL_VERSION;
  service: string;
  version: string | null;
  toolCount: number;
  tools: string[];
  expectedTools: readonly string[];
  database: {
    connected: boolean | null;
    policyCount: number | null;
  };
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  checkedAt: string;
  fallback: "d1_then_verified_snapshot";
  message: string;
  sourceRepository: typeof YOUTH_POLICY_MCP_SOURCE_URL;
}

export class YouthPolicyMcpError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "YouthPolicyMcpError";
  }
}

type StatusCache = {
  key: string;
  expiresAt: number;
  value: YouthPolicyMcpStatus;
};

let statusCache: StatusCache | undefined;

export function getYouthPolicyMcpConfiguration(
  runtime = getRuntimeEnvironment(),
) {
  const rawEndpoint = readEnvString(runtime, "YOUTH_POLICY_MCP_URL");
  const timeoutOverride = Number(
    readEnvString(runtime, "YOUTH_POLICY_MCP_TIMEOUT_MS"),
  );
  const timeoutMs = Number.isFinite(timeoutOverride)
    ? Math.min(10_000, Math.max(500, timeoutOverride))
    : DEFAULT_TIMEOUT_MS;

  if (!rawEndpoint) {
    return { endpoint: null, healthEndpoint: null, timeoutMs };
  }

  const endpoint = validateEndpoint(rawEndpoint);
  return {
    endpoint,
    healthEndpoint: resolveHealthEndpoint(endpoint),
    timeoutMs,
  };
}

export async function getYouthPolicyMcpStatus(
  runtime = getRuntimeEnvironment(),
  options: { force?: boolean } = {},
): Promise<YouthPolicyMcpStatus> {
  const checkedAt = new Date().toISOString();
  let configuration: ReturnType<typeof getYouthPolicyMcpConfiguration>;

  try {
    configuration = getYouthPolicyMcpConfiguration(runtime);
  } catch {
    return statusBase({
      state: "not_configured",
      configured: true,
      checkedAt,
      message: "MCP 주소 설정이 올바르지 않습니다.",
    });
  }

  if (!configuration.endpoint || !configuration.healthEndpoint) {
    return statusBase({
      state: "not_configured",
      configured: false,
      checkedAt,
      message: "배포 환경에 YOUTH_POLICY_MCP_URL을 등록하면 연결됩니다.",
    });
  }

  const cacheKey = configuration.endpoint;
  if (
    !options.force &&
    statusCache?.key === cacheKey &&
    statusCache.expiresAt > Date.now()
  ) {
    return statusCache.value;
  }

  try {
    const healthResponse = await fetchWithTimeout(
      configuration.healthEndpoint,
      {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      },
      configuration.timeoutMs,
    );

    if (!healthResponse.ok) {
      throw new YouthPolicyMcpError(
        "MCP_HEALTH_UNAVAILABLE",
        `MCP 헬스체크가 HTTP ${healthResponse.status}로 응답했습니다.`,
      );
    }

    const health = await readJsonRecord(healthResponse);
    const database = asRecord(health.database);
    const healthReady = health.ok === true && database?.connected === true;

    let tools: string[] = [];
    let toolsReachable = false;
    try {
      const result = await rpcRequest<{ tools?: McpToolDefinition[] }>(
        configuration,
        "tools/list",
        {},
      );
      tools = Array.isArray(result.tools)
        ? result.tools
            .map((tool) => stringValue(tool.name))
            .filter((name): name is string => Boolean(name))
        : [];
      toolsReachable = tools.length > 0;
    } catch {
      toolsReachable = false;
    }

    const missingTools = YOUTH_POLICY_MCP_TOOLS.filter(
      (tool) => !tools.includes(tool),
    );
    const ready = healthReady && toolsReachable && missingTools.length === 0;
    const value: YouthPolicyMcpStatus = {
      ...statusBase({
        state: ready ? "connected" : "degraded",
        configured: true,
        checkedAt,
        message: ready
          ? "GitHub 청년정책 MCP의 6개 읽기 전용 도구가 연결되었습니다."
          : "MCP 서버에는 도달했지만 DB 또는 도구 상태를 확인해야 합니다.",
      }),
      reachable: true,
      ready,
      endpoint: configuration.endpoint,
      healthEndpoint: configuration.healthEndpoint,
      service: stringValue(health.service) ?? "00AI Youth Policy MCP",
      version: stringValue(health.version),
      toolCount: tools.length || numberValue(health.tools) || 0,
      tools,
      database: {
        connected:
          typeof database?.connected === "boolean"
            ? database.connected
            : null,
        policyCount: numberValue(database?.policy_count),
      },
      lastSyncAt: stringValue(health.last_sync_at),
      lastSyncStatus: stringValue(health.last_sync_status),
    };
    statusCache = {
      key: cacheKey,
      expiresAt: Date.now() + STATUS_CACHE_TTL_MS,
      value,
    };
    return value;
  } catch (error) {
    const value: YouthPolicyMcpStatus = {
      ...statusBase({
        state: "unavailable",
        configured: true,
        checkedAt,
        message:
          error instanceof YouthPolicyMcpError && error.code === "MCP_TIMEOUT"
            ? "MCP 응답 시간이 초과되어 D1·검증 스냅샷으로 전환했습니다."
            : "MCP 서버에 연결할 수 없어 D1·검증 스냅샷으로 전환했습니다.",
      }),
      endpoint: configuration.endpoint,
      healthEndpoint: configuration.healthEndpoint,
    };
    statusCache = {
      key: cacheKey,
      expiresAt: Date.now() + STATUS_CACHE_TTL_MS,
      value,
    };
    return value;
  }
}

export async function searchYouthPoliciesViaMcp(
  input: YouthPolicyMcpSearchInput,
  runtime = getRuntimeEnvironment(),
): Promise<YouthPolicyMcpSearchResult> {
  const configuration = getYouthPolicyMcpConfiguration(runtime);
  if (!configuration.endpoint) {
    throw new YouthPolicyMcpError(
      "MCP_NOT_CONFIGURED",
      "청년정책 MCP 주소가 설정되지 않았습니다.",
    );
  }

  const pageSize = Math.min(50, Math.max(1, input.pageSize ?? 50));
  const args: JsonRecord = {
    page: Math.max(1, input.page ?? 1),
    page_size: pageSize,
  };
  if (input.query) args.query = input.query;
  if (input.regionCodes?.length) args.region_codes = input.regionCodes;
  if (input.age !== undefined) args.age = input.age;
  if (input.applicationStatus) {
    args.application_status = input.applicationStatus;
  }
  if (input.asOf) args.as_of = input.asOf;

  const result = await rpcRequest<McpToolResult>(
    configuration,
    "tools/call",
    { name: "search_youth_policies", arguments: args },
  );
  const envelope = extractEnvelope<McpSearchData>(result);
  if (!envelope.ok) {
    throw new YouthPolicyMcpError(
      envelope.error?.code ?? "MCP_TOOL_ERROR",
      envelope.error?.message ?? "청년정책 MCP 검색이 실패했습니다.",
    );
  }

  const retrievedAt =
    envelope.meta?.retrieved_at ?? new Date().toISOString();
  const items = Array.isArray(envelope.data?.items)
    ? envelope.data.items
    : [];
  return {
    records: items
      .map((item) => normalizeSearchItem(item, retrievedAt))
      .filter(
        (item): item is YouthPolicyMcpPolicyRecord => item !== null,
      ),
    total: numberValue(envelope.data?.pagination?.total) ?? items.length,
    generatedAt: retrievedAt,
    asOf: envelope.meta?.as_of ?? null,
    warnings: Array.isArray(envelope.meta?.warnings)
      ? envelope.meta.warnings
      : [],
    sources: Array.isArray(envelope.meta?.sources)
      ? envelope.meta.sources
      : [],
  };
}

function statusBase({
  state,
  configured,
  checkedAt,
  message,
}: {
  state: McpConnectionState;
  configured: boolean;
  checkedAt: string;
  message: string;
}): YouthPolicyMcpStatus {
  return {
    state,
    configured,
    reachable: false,
    ready: false,
    endpoint: null,
    healthEndpoint: null,
    protocol: "Streamable HTTP",
    protocolVersion: MCP_PROTOCOL_VERSION,
    service: "00AI Youth Policy MCP",
    version: null,
    toolCount: 0,
    tools: [],
    expectedTools: YOUTH_POLICY_MCP_TOOLS,
    database: { connected: null, policyCount: null },
    lastSyncAt: null,
    lastSyncStatus: null,
    checkedAt,
    fallback: "d1_then_verified_snapshot",
    message,
    sourceRepository: YOUTH_POLICY_MCP_SOURCE_URL,
  };
}

async function rpcRequest<T>(
  configuration: ReturnType<typeof getYouthPolicyMcpConfiguration>,
  method: string,
  params: JsonRecord,
): Promise<T> {
  if (!configuration.endpoint) {
    throw new YouthPolicyMcpError(
      "MCP_NOT_CONFIGURED",
      "청년정책 MCP 주소가 설정되지 않았습니다.",
    );
  }
  const response = await fetchWithTimeout(
    configuration.endpoint,
    {
      method: "POST",
      headers: {
        Accept: "application/json, text/event-stream",
        "Content-Type": "application/json",
        "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: crypto.randomUUID(),
        method,
        params,
      }),
      cache: "no-store",
    },
    configuration.timeoutMs,
  );

  if (!response.ok) {
    throw new YouthPolicyMcpError(
      "MCP_HTTP_ERROR",
      `청년정책 MCP가 HTTP ${response.status}로 응답했습니다.`,
    );
  }

  const payload = await readRpcPayload(response);
  const error = asRecord(payload.error);
  if (error) {
    throw new YouthPolicyMcpError(
      stringValue(error.code) ?? "MCP_RPC_ERROR",
      stringValue(error.message) ?? "청년정책 MCP 요청이 실패했습니다.",
    );
  }
  if (!("result" in payload)) {
    throw new YouthPolicyMcpError(
      "MCP_INVALID_RESPONSE",
      "청년정책 MCP 응답 형식을 확인할 수 없습니다.",
    );
  }
  return payload.result as T;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new YouthPolicyMcpError(
        "MCP_TIMEOUT",
        "청년정책 MCP 응답 시간이 초과되었습니다.",
      );
    }
    throw new YouthPolicyMcpError(
      "MCP_UNREACHABLE",
      error instanceof Error
        ? "청년정책 MCP에 연결할 수 없습니다."
        : "청년정책 MCP 연결이 실패했습니다.",
    );
  } finally {
    clearTimeout(timer);
  }
}

async function readJsonRecord(response: Response): Promise<JsonRecord> {
  const payload = await readBoundedText(response);
  try {
    return asRecord(JSON.parse(payload)) ?? {};
  } catch {
    throw new YouthPolicyMcpError(
      "MCP_INVALID_JSON",
      "청년정책 MCP가 올바른 JSON을 반환하지 않았습니다.",
    );
  }
}

async function readRpcPayload(response: Response): Promise<JsonRecord> {
  const text = await readBoundedText(response);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream")) {
    try {
      return asRecord(JSON.parse(text)) ?? {};
    } catch {
      throw new YouthPolicyMcpError(
        "MCP_INVALID_JSON",
        "청년정책 MCP가 올바른 JSON-RPC 응답을 반환하지 않았습니다.",
      );
    }
  }

  const dataLines = text
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter((line) => line && line !== "[DONE]");
  for (let index = dataLines.length - 1; index >= 0; index -= 1) {
    try {
      const parsed = asRecord(JSON.parse(dataLines[index]));
      if (parsed) return parsed;
    } catch {
      // Continue to the previous SSE data frame.
    }
  }
  throw new YouthPolicyMcpError(
    "MCP_INVALID_SSE",
    "청년정책 MCP의 SSE 응답을 해석할 수 없습니다.",
  );
}

async function readBoundedText(response: Response): Promise<string> {
  const declaredSize = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredSize) && declaredSize > MAX_RESPONSE_BYTES) {
    throw new YouthPolicyMcpError(
      "MCP_RESPONSE_TOO_LARGE",
      "청년정책 MCP 응답 크기가 허용 범위를 넘었습니다.",
    );
  }
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) {
    throw new YouthPolicyMcpError(
      "MCP_RESPONSE_TOO_LARGE",
      "청년정책 MCP 응답 크기가 허용 범위를 넘었습니다.",
    );
  }
  return text;
}

function extractEnvelope<T>(result: McpToolResult): McpEnvelope<T> {
  const structured = asRecord(result.structuredContent);
  if (structured && typeof structured.ok === "boolean") {
    return structured as unknown as McpEnvelope<T>;
  }

  if (Array.isArray(result.content)) {
    for (const item of result.content) {
      const record = asRecord(item);
      const text = stringValue(record?.text);
      if (!text) continue;
      try {
        const parsed = asRecord(JSON.parse(text));
        if (parsed && typeof parsed.ok === "boolean") {
          return parsed as unknown as McpEnvelope<T>;
        }
      } catch {
        // The next content item may contain the structured envelope.
      }
    }
  }

  throw new YouthPolicyMcpError(
    "MCP_INVALID_TOOL_RESULT",
    "청년정책 MCP 도구 응답 형식을 확인할 수 없습니다.",
  );
}

function normalizeSearchItem(
  value: unknown,
  retrievedAt: string,
): YouthPolicyMcpPolicyRecord | null {
  const item = asRecord(value);
  const source = asRecord(item?.source);
  const policyId = stringValue(item?.policyId);
  const title = stringValue(item?.title);
  if (!item || !policyId || !title) return null;

  const collectedAt = stringValue(source?.collectedAt) ?? retrievedAt;
  return {
    id: policyId,
    sourceId: "youth-policy-mcp",
    sourceRecordId: stringValue(source?.sourcePolicyId) ?? policyId,
    recordType: "policy",
    title,
    summary: stringValue(item.summary),
    category: null,
    region: Array.isArray(item.regions)
      ? item.regions.map(stringValue).filter(Boolean).join(", ") || null
      : null,
    organization: null,
    canonicalUrl: stringValue(source?.originalUrl),
    sourceUpdatedAt: null,
    firstSeenAt: collectedAt,
    lastSeenAt: collectedAt,
    applicationStatus: stringValue(item.applicationStatus),
    targetAge: asRecord(item.targetAge),
    matchingReasons: Array.isArray(item.matchingReasons)
      ? item.matchingReasons
          .map(stringValue)
          .filter((reason): reason is string => Boolean(reason))
      : [],
  };
}

function validateEndpoint(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new YouthPolicyMcpError(
      "MCP_INVALID_URL",
      "청년정책 MCP 주소가 올바르지 않습니다.",
    );
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new YouthPolicyMcpError(
      "MCP_INSECURE_URL",
      "청년정책 MCP는 HTTPS 주소를 사용해야 합니다.",
    );
  }
  url.hash = "";
  url.search = "";
  return url.toString().replace(/\/$/, "");
}

function resolveHealthEndpoint(endpoint: string) {
  const url = new URL(endpoint);
  const path = url.pathname.replace(/\/$/, "");
  url.pathname = path.endsWith("/youth") ? `${path}/health` : "/health";
  return url.toString().replace(/\/$/, "");
}

function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
