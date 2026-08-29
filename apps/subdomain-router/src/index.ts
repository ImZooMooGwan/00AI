import publicSites from "../../portal/app/data/public-sites.json";

type Route = {
  target: string;
  mode: "proxy" | "drop";
};

type PublicSite = {
  id: string;
  public_url: string;
  origin_url?: string;
  aliases?: string[];
  status?: string;
};

type GitHubProject = {
  name: string;
  homepage?: string | null;
  public_url?: string | null;
};

type ProjectRegistry = {
  githubProjects?: GitHubProject[];
  siteProjects?: PublicSite[];
};

const DOMAIN_SUFFIX = ".00ai.kr";
const PROJECT_REGISTRY_URL =
  "https://zeroai-platform.hayahoyeho.chatgpt.site/api/projects";
const VALID_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const ALLOWED_UPSTREAM_SUFFIXES = [
  "chatgpt.site",
  "pages.dev",
  "workers.dev",
  "vercel.app",
  "netlify.app",
  "github.io",
];

type CachePolicy = {
  browser: string;
  edge: string;
  edgeTtl: number;
  label: "document" | "static" | "immutable";
};

const RSC_REQUEST_HEADERS = [
  "rsc",
  "next-router-state-tree",
  "next-router-prefetch",
  "next-router-segment-prefetch",
  "next-url",
  "x-vinext-interception-context",
  "x-vinext-mounted-slots",
  "x-vinext-rsc-render-mode",
];

const STATIC_FILE =
  /\.(?:avif|bmp|css|gif|ico|jpe?g|js|json|map|mjs|mp3|mp4|ogg|pdf|png|svg|txt|wasm|webmanifest|webp|woff2?)$/i;

function cachePolicyFor(request: Request, incoming: URL): CachePolicy | null {
  if (!["GET", "HEAD"].includes(request.method)) return null;
  if (request.headers.has("Authorization") || request.headers.has("Range")) return null;
  if (RSC_REQUEST_HEADERS.some((header) => request.headers.has(header))) return null;
  if (incoming.searchParams.has("_rsc")) return null;
  if (incoming.pathname === "/api" || incoming.pathname.startsWith("/api/")) return null;

  const requestCacheControl = request.headers.get("Cache-Control") || "";
  if (/\b(?:no-cache|no-store)\b/i.test(requestCacheControl)) return null;

  if (
    incoming.pathname.startsWith("/assets/") ||
    incoming.pathname.startsWith("/_next/static/")
  ) {
    return {
      browser: "public, max-age=31536000, immutable",
      edge: "public, max-age=31536000, stale-if-error=604800",
      edgeTtl: 31536000,
      label: "immutable",
    };
  }

  if (STATIC_FILE.test(incoming.pathname)) {
    return {
      browser: "public, max-age=3600, stale-while-revalidate=86400",
      edge: "public, max-age=86400, stale-while-revalidate=86400, stale-if-error=604800",
      edgeTtl: 86400,
      label: "static",
    };
  }

  return {
    browser: "public, max-age=60, stale-while-revalidate=300",
    edge: "public, max-age=300, stale-while-revalidate=86400, stale-if-error=604800",
    edgeTtl: 300,
    label: "document",
  };
}

function applyCacheHeaders(
  headers: Headers,
  policy: CachePolicy | null,
  upstreamDurationMs: number,
) {
  headers.set("Server-Timing", `00ai-upstream;dur=${upstreamDurationMs}`);
  if (!policy) {
    headers.set("X-00AI-Cache", "BYPASS");
    headers.set("X-00AI-Cache-Policy", "bypass");
    return;
  }
  headers.set("Cache-Control", policy.browser);
  headers.set("X-00AI-Cache", "MISS");
  headers.set("X-00AI-Cache-Policy", policy.label);
}

function cacheKeyFor(incoming: URL) {
  return new Request(incoming.toString(), { method: "GET" });
}

async function matchCache(
  request: Request,
  cacheKey: Request,
  policy: CachePolicy,
) {
  const cached = await caches.default.match(cacheKey);
  if (!cached) return null;

  const headers = new Headers(cached.headers);
  headers.set("Cache-Control", policy.browser);
  headers.set("X-00AI-Cache", "HIT");
  headers.set("X-00AI-Cache-Policy", policy.label);
  headers.set("Server-Timing", "00ai-cache;dur=0");
  return withSecurity(
    new Response(request.method === "HEAD" ? null : cached.body, {
      status: cached.status,
      statusText: cached.statusText,
      headers,
    }),
  );
}

function storeInCache(
  ctx: ExecutionContext,
  cacheKey: Request,
  response: Response,
  policy: CachePolicy,
) {
  const stored = response.clone();
  stored.headers.set("Cache-Control", policy.edge);
  stored.headers.set("X-00AI-Cache", "STORED");
  ctx.waitUntil(
    caches.default.put(cacheKey, stored).catch((error) => {
      console.error(
        JSON.stringify({
          event: "subdomain_cache_put_failed",
          error: error instanceof Error ? error.message : "unknown",
          url: cacheKey.url,
        }),
      );
    }),
  );
}

const SITE_BY_SLUG = new Map<string, PublicSite>();

function registerSlug(slug: string, site: PublicSite) {
  const normalized = slug.trim().toLowerCase();
  if (VALID_SLUG.test(normalized) && !SITE_BY_SLUG.has(normalized)) {
    SITE_BY_SLUG.set(normalized, site);
  }
}

for (const site of publicSites as PublicSite[]) {
  registerSlug(site.id, site);
  for (const alias of site.aliases ?? []) registerSlug(alias, site);
}

const DROP_SERVE_URL =
  "https://jbxmjsezaaqarheyjjte.supabase.co/functions/v1/zeroai-drop-serve";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpieG1qc2V6YWFxYXJoZXlqanRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3Nzc2MzUsImV4cCI6MjEwMTM1MzYzNX0.ZEoudIFSGGFSVhXpNc4Vf_Obv884mQQLS_9qhaWzxHI";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
};

function withSecurity(response: Response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(key)) headers.set(key, value);
  }
  headers.set("X-00AI-Router", "subdomain-router-v2");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function buildTarget(base: string, incoming: URL) {
  const target = new URL(base);
  const prefix = target.pathname === "/" ? "" : target.pathname.replace(/\/$/, "");
  target.pathname = `${prefix}${incoming.pathname}` || "/";
  target.search = incoming.search;
  return target;
}

function isAllowedUpstream(target: URL) {
  if (target.protocol !== "https:") return false;
  const hostname = target.hostname.toLowerCase();
  if (hostname === "00ai.kr" || hostname.endsWith(DOMAIN_SUFFIX)) return false;
  return ALLOWED_UPSTREAM_SUFFIXES.some(
    (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
  );
}

function routeFromSite(site: PublicSite): Route | null {
  try {
    const target = new URL(site.origin_url || site.public_url);
    if (!isAllowedUpstream(target)) return null;
    return { target: target.toString(), mode: "proxy" };
  } catch {
    return null;
  }
}

async function resolveRemoteRoute(slug: string): Promise<Route | null> {
  try {
    const requestInit: RequestInit & {
      cf?: { cacheEverything: boolean; cacheTtl: number };
    } = {
      headers: { Accept: "application/json" },
      cf: { cacheEverything: true, cacheTtl: 300 },
    };
    const response = await fetch(PROJECT_REGISTRY_URL, requestInit);
    if (!response.ok) return null;

    const contentLength = Number(response.headers.get("Content-Length") || 0);
    if (contentLength > 1_000_000) return null;
    const registry = (await response.json()) as ProjectRegistry;

    const site = (registry.siteProjects ?? []).find((candidate) => {
      if (candidate.id.toLowerCase() === slug) return true;
      return (candidate.aliases ?? []).some(
        (alias) => alias.toLowerCase() === slug,
      );
    });
    if (site) return routeFromSite(site);

    const repository = (registry.githubProjects ?? []).find(
      (candidate) => candidate.name.toLowerCase() === slug,
    );
    if (!repository?.homepage) return null;
    return routeFromSite({
      id: slug,
      public_url: repository.homepage || repository.public_url || "",
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "project_registry_fetch_failed",
        slug,
        error: error instanceof Error ? error.message : "unknown",
      }),
    );
    return null;
  }
}

async function resolveRoute(hostname: string): Promise<Route | null> {
  if (hostname === `drop${DOMAIN_SUFFIX}`) return { target: "drop", mode: "drop" };
  if (!hostname.endsWith(DOMAIN_SUFFIX)) return null;

  const slug = hostname.slice(0, -DOMAIN_SUFFIX.length);
  if (!VALID_SLUG.test(slug)) return null;

  const site = SITE_BY_SLUG.get(slug);
  if (site) return routeFromSite(site);
  return resolveRemoteRoute(slug);
}

async function proxyExternal(request: Request, route: Route, incoming: URL) {
  const target = buildTarget(route.target, incoming);
  const cachePolicy = cachePolicyFor(request, incoming);
  const upstreamHeaders = new Headers(request.headers);
  upstreamHeaders.delete("authorization");
  upstreamHeaders.delete("cookie");
  upstreamHeaders.delete("proxy-authorization");
  upstreamHeaders.set("X-Forwarded-Host", incoming.hostname);
  upstreamHeaders.set("X-00AI-Original-Host", incoming.hostname);

  try {
    const init: RequestInit = {
      method: request.method,
      headers: upstreamHeaders,
      redirect: "manual",
    };
    if (request.method !== "GET" && request.method !== "HEAD") {
      init.body = request.body;
    }
    if (cachePolicy) {
      init.cf = {
        cacheEverything: true,
        cacheControl: cachePolicy.edge,
        cacheTtlByStatus: {
          "200-399": cachePolicy.edgeTtl,
          "404": 30,
          "500-599": 0,
        },
        cacheDeceptionArmor: true,
      };
    }

    const startedAt = Date.now();
    const response = await fetch(target.toString(), init);

    const headers = new Headers(response.headers);
    headers.delete("set-cookie");
    applyCacheHeaders(headers, cachePolicy, Date.now() - startedAt);

    const location = headers.get("Location");
    if (location) {
      try {
        const redirected = new URL(location, target);
        if (redirected.origin === target.origin) {
          redirected.protocol = incoming.protocol;
          redirected.host = incoming.host;
          headers.set("Location", redirected.toString());
        }
      } catch {
        // Preserve malformed or non-URL Location values from the upstream.
      }
    }

    headers.set("X-00AI-Upstream", target.hostname);
    return withSecurity(
      new Response(request.method === "HEAD" ? null : response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      }),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "upstream_fetch_failed",
        hostname: incoming.hostname,
        upstream: target.hostname,
        error: error instanceof Error ? error.message : "unknown",
      }),
    );
    return withSecurity(new Response("Upstream unavailable", { status: 502 }));
  }
}

async function serveDrop(request: Request, incoming: URL) {
  const parts = incoming.pathname.split("/").filter(Boolean);
  if (!parts.length) {
    return withSecurity(Response.redirect("https://00ai.kr/#deploy", 302));
  }

  const encodedPath = parts
    .map((part) => encodeURIComponent(decodeURIComponent(part)))
    .join("/");
  const target = new URL(`${DROP_SERVE_URL}/${encodedPath}`);
  target.search = incoming.search;

  const headers = new Headers();
  headers.set("Authorization", `Bearer ${SUPABASE_ANON_KEY}`);
  headers.set("apikey", SUPABASE_ANON_KEY);
  const range = request.headers.get("Range");
  if (range) headers.set("Range", range);

  const cachePolicy = cachePolicyFor(request, incoming);
  const init: RequestInit = {
    method: request.method === "HEAD" ? "HEAD" : "GET",
    headers,
    redirect: "manual",
  };
  if (cachePolicy) {
    init.cf = {
      cacheEverything: true,
      cacheControl: cachePolicy.edge,
      cacheTtlByStatus: {
        "200-399": cachePolicy.edgeTtl,
        "404": 30,
        "500-599": 0,
      },
      cacheDeceptionArmor: true,
    };
  }

  const startedAt = Date.now();
  const response = await fetch(target.toString(), init);

  const outgoing = new Headers(response.headers);
  outgoing.delete("set-cookie");
  outgoing.set("X-00AI-Upstream", "DROP");
  applyCacheHeaders(outgoing, cachePolicy, Date.now() - startedAt);
  return withSecurity(
    new Response(request.method === "HEAD" ? null : response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: outgoing,
    }),
  );
}

export default {
  async fetch(
    request: Request,
    _env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const incoming = new URL(request.url);
    const route = await resolveRoute(incoming.hostname.toLowerCase());

    if (!route) {
      return withSecurity(
        new Response("등록되지 않은 00AI 프로젝트입니다.", { status: 404 }),
      );
    }
    if (!["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"].includes(request.method)) {
      return withSecurity(new Response("Method Not Allowed", { status: 405 }));
    }
    const cachePolicy = cachePolicyFor(request, incoming);
    const cacheKey = cachePolicy ? cacheKeyFor(incoming) : null;
    if (cachePolicy && cacheKey) {
      const cached = await matchCache(request, cacheKey, cachePolicy);
      if (cached) return cached;
    }

    const response = route.mode === "drop"
      ? await serveDrop(request, incoming)
      : await proxyExternal(request, route, incoming);
    if (
      request.method === "GET" &&
      cachePolicy &&
      cacheKey &&
      response.status >= 200 &&
      response.status < 400
    ) {
      storeInCache(ctx, cacheKey, response, cachePolicy);
    }
    return response;
  },
} satisfies ExportedHandler<Env>;
