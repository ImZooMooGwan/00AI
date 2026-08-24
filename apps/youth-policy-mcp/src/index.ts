import { createMcpHandler } from "@modelcontextprotocol/server";

import { createPolicyRepository, policyStorageBackend } from "./db/repository";
import { TOOL_NAMES } from "./domain/types";
import type { RuntimeEnv } from "./env";
import { synchronizeYouthPolicies } from "./ingestion/sync";
import { createYouthPolicyMcpServer, youthPolicyMcpVersion } from "./mcp/server";

const MCP_PATHS = new Set(["/youth", "/youth/", "/mcp", "/mcp/", "/youth/mcp", "/youth/mcp/"]);
const HEALTH_PATHS = new Set(["/health", "/youth/health"]);
const MAX_MCP_REQUEST_BYTES = 1024 * 1024;

function json(value: unknown, status = 200, additionalHeaders: HeadersInit = {}): Response {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      ...additionalHeaders,
    },
  });
}

function splitConfiguration(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function validateRequestSource(request: Request, env: RuntimeEnv): Response | null {
  const url = new URL(request.url);
  const allowedHosts = new Set(splitConfiguration(env.MCP_ALLOWED_HOSTS));
  const hostAllowed =
    allowedHosts.has(url.hostname) ||
    url.hostname.endsWith(".workers.dev") ||
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1";
  if (!hostAllowed) return json({ error: "invalid_host" }, 403);

  const origin = request.headers.get("Origin");
  if (!origin) return null;
  const allowedOrigins = new Set(splitConfiguration(env.MCP_ALLOWED_ORIGINS));
  if (origin === url.origin || allowedOrigins.has(origin)) return null;
  return json({ error: "invalid_origin" }, 403);
}

function corsHeaders(request: Request, env: RuntimeEnv): HeadersInit {
  const origin = request.headers.get("Origin");
  const allowedOrigins = new Set(splitConfiguration(env.MCP_ALLOWED_ORIGINS));
  const allowOrigin = origin && (origin === new URL(request.url).origin || allowedOrigins.has(origin))
    ? origin
    : "https://mcp.00ai.kr";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, Accept, MCP-Protocol-Version, MCP-Session-Id, Last-Event-ID",
    "Access-Control-Expose-Headers": "MCP-Protocol-Version, MCP-Session-Id",
    Vary: "Origin",
  };
}

function withCors(response: Response, request: Request, env: RuntimeEnv): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(corsHeaders(request, env))) {
    if (typeof value === "string") headers.set(name, value);
  }
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function boundedRequest(request: Request): Promise<Request | Response> {
  if (request.method !== "POST" || !request.body) return request;
  const declared = Number.parseInt(request.headers.get("content-length") ?? "", 10);
  if (Number.isFinite(declared) && declared > MAX_MCP_REQUEST_BYTES) {
    return json({ error: "request_too_large" }, 413);
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > MAX_MCP_REQUEST_BYTES) {
        await reader.cancel("request too large");
        return json({ error: "request_too_large" }, 413);
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body,
  });
}

async function digestKey(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function rateLimit(request: Request, env: RuntimeEnv): Promise<Response | null> {
  const actor =
    request.headers.get("Authorization") ??
    request.headers.get("CF-Connecting-IP") ??
    request.headers.get("User-Agent") ??
    "anonymous";
  const key = await digestKey(`${new URL(request.url).pathname}:${actor}`);
  const result = await env.MCP_RATE_LIMITER.limit({ key });
  return result.success
    ? null
    : json({ error: "rate_limit_exceeded", retry_after_seconds: 60 }, 429, {
        "Retry-After": "60",
      });
}

async function secureEquals(left: string, right: string): Promise<boolean> {
  const [leftDigest, rightDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(left)),
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(right)),
  ]);
  const leftBytes = new Uint8Array(leftDigest);
  const rightBytes = new Uint8Array(rightDigest);
  let difference = leftBytes.byteLength ^ rightBytes.byteLength;
  for (let index = 0; index < leftBytes.byteLength; index += 1) {
    difference |= leftBytes[index]! ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}

async function health(env: RuntimeEnv): Promise<Response> {
  const state = await createPolicyRepository(env).health();
  const backend = policyStorageBackend(env);
  return json(
    {
      ok: state.connected,
      service: "00AI Youth Policy MCP",
      version: youthPolicyMcpVersion,
      protocol: "Streamable HTTP",
      tools: TOOL_NAMES.length,
      database: { connected: state.connected, policy_count: state.policyCount, backend },
      storage_backend: backend,
      last_sync_at: state.lastSync?.finishedAt ?? state.lastSync?.startedAt ?? null,
      last_sync_status: state.lastSync?.status ?? null,
      timestamp: new Date().toISOString(),
    },
    state.connected ? 200 : 503,
  );
}

async function handleMcp(request: Request, env: RuntimeEnv): Promise<Response> {
  const rejected = validateRequestSource(request, env);
  if (rejected) return withCors(rejected, request, env);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  const limited = await rateLimit(request, env);
  if (limited) return withCors(limited, request, env);
  const safeRequest = await boundedRequest(request);
  if (safeRequest instanceof Response) return withCors(safeRequest, request, env);

  const handler = createMcpHandler(() => createYouthPolicyMcpServer(env), {
    legacy: "stateless",
    responseMode: "auto",
    maxSubscriptions: 0,
    onerror(error) {
      console.error(JSON.stringify({ event: "mcp_error", name: error.name, message: "MCP request failed" }));
    },
  });
  const response = await handler.fetch(safeRequest);
  return withCors(response, request, env);
}

async function handleAdminSync(request: Request, env: RuntimeEnv): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, { Allow: "POST" });
  if (!env.SYNC_SECRET) return json({ error: "sync_not_configured" }, 503);
  const authorization = request.headers.get("Authorization") ?? "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!(await secureEquals(supplied, env.SYNC_SECRET))) return json({ error: "unauthorized" }, 401);
  return json(await synchronizeYouthPolicies(env));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const runtimeEnv: RuntimeEnv = env;
    const url = new URL(request.url);
    try {
      if (HEALTH_PATHS.has(url.pathname)) return health(runtimeEnv);
      if (url.pathname === "/admin/sync") return handleAdminSync(request, runtimeEnv);
      if (MCP_PATHS.has(url.pathname)) return handleMcp(request, runtimeEnv);
      if (url.pathname === "/" && request.method === "GET") {
        return json({
          service: "00AI Youth Policy MCP",
          mcp_endpoint: "/youth",
          health_endpoint: "/youth/health",
          documentation: "https://github.com/ImZooMooGwan/00AI/tree/main/apps/youth-policy-mcp",
        });
      }
      return json({ error: "not_found" }, 404);
    } catch {
      return json({ error: "internal_error", message: "요청 처리 중 내부 오류가 발생했습니다." }, 500);
    }
  },

  scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): void {
    const runtimeEnv: RuntimeEnv = env;
    ctx.waitUntil(
      synchronizeYouthPolicies(runtimeEnv).then((summary) => {
        console.log(
          JSON.stringify({
            event: "youth_policy_sync",
            status: summary.status,
            fetched: summary.fetchedCount,
            inserted: summary.newCount,
            updated: summary.updatedCount,
            errors: summary.errorCount,
          }),
        );
      }),
    );
  },
} satisfies ExportedHandler<Env>;
