import publicSites from "../../portal/app/data/public-sites.json";

const ORIGIN = "https://00ai-portal-origin.able001.workers.dev";
const DOMAIN_SUFFIX = ".00ai.kr";
const GITHUB_OWNER = "ImZooMooGwan";

type SiteProject = {
  id: string;
  name: string;
  description: string;
  public_url: string;
  origin_url?: string;
  aliases?: string[];
  category: string;
  maker: string;
  stack: string;
  status: string;
  updated_at: string;
};

type GitHubRepository = {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  topics?: string[];
  fork: boolean;
  archived: boolean;
  disabled: boolean;
  created_at: string;
  updated_at: string;
  pushed_at: string | null;
  owner: { login: string };
};

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

type CachePolicy = {
  browser: string;
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
      edgeTtl: 31536000,
      label: "immutable",
    };
  }

  if (STATIC_FILE.test(incoming.pathname)) {
    return {
      browser: "public, max-age=3600, stale-while-revalidate=86400",
      edgeTtl: 86400,
      label: "static",
    };
  }

  return {
    browser: "public, max-age=60, stale-while-revalidate=300",
    edgeTtl: 300,
    label: "document",
  };
}

function cacheKeyFor(incoming: URL) {
  return new Request(incoming.toString(), { method: "GET" });
}

function storeInCache(
  ctx: ExecutionContext,
  cacheKey: Request,
  response: Response,
  policy: CachePolicy,
) {
  const stored = response.clone();
  stored.headers.set("Cache-Control", `public, max-age=${policy.edgeTtl}`);
  stored.headers.set("X-00AI-Cache", "STORED");
  ctx.waitUntil(
    caches.default.put(cacheKey, stored).catch((error) => {
      console.error(
        JSON.stringify({
          event: "root_cache_put_failed",
          error: error instanceof Error ? error.message : "unknown",
          url: cacheKey.url,
        }),
      );
    }),
  );
}

function finish(response: Response) {
  const headers = new Headers(response.headers);
  headers.delete("set-cookie");
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(key)) headers.set(key, value);
  }
  headers.set("X-00AI-Root-Router", "v2-fast-cache");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function redirectTo(host: string, incoming: URL, prefix: string) {
  const tail = incoming.pathname.slice(prefix.length);
  const target = new URL(`https://${host}${tail || "/"}`);
  target.search = incoming.search;
  target.hash = incoming.hash;
  return Response.redirect(target.toString(), 302);
}

function customUrlForSite(project: { id?: string; aliases?: string[] }) {
  const id = String(project.id || "").toLowerCase();
  if (id === "public-ai-gov") return "https://policy.00ai.kr";
  if (id === "youth-policy-data-hub") return "https://yhub.00ai.kr";
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(id)) return null;
  return `https://${id}${DOMAIN_SUFFIX}`;
}

async function loadGitHubProjects() {
  const endpoint = new URL(
    `https://api.github.com/users/${encodeURIComponent(GITHUB_OWNER)}/repos`,
  );
  endpoint.searchParams.set("type", "owner");
  endpoint.searchParams.set("sort", "created");
  endpoint.searchParams.set("direction", "desc");
  endpoint.searchParams.set("per_page", "100");

  try {
    const response = await fetch(endpoint, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "00ai-root-router",
        "X-GitHub-Api-Version": "2026-03-10",
      },
      cf: { cacheEverything: true, cacheTtl: 300 },
    } as RequestInit & { cf?: { cacheEverything: boolean; cacheTtl: number } });
    if (!response.ok) return { projects: [], available: false };
    const repositories = (await response.json()) as GitHubRepository[];
    const projects = repositories
      .filter(
        (repo) =>
          !repo.fork &&
          !repo.archived &&
          !repo.disabled &&
          !["00ai", ".github"].includes(repo.name.toLowerCase()),
      )
      .map((repo) => {
        const homepage =
          typeof repo.homepage === "string" && /^https?:\/\//i.test(repo.homepage)
            ? repo.homepage
            : null;
        return {
          id: String(repo.id),
          name: repo.name,
          full_name: repo.full_name,
          description: repo.description || "GitHub에 공개된 00AI 프로젝트입니다.",
          repository_url: repo.html_url,
          homepage,
          public_url: homepage || repo.html_url,
          owner: repo.owner.login,
          language: repo.language,
          topics: repo.topics || [],
          status: homepage ? "LIVE" : "OPEN SOURCE",
          created_at: repo.created_at,
          updated_at: repo.pushed_at || repo.updated_at,
        };
      });
    return { projects, available: true };
  } catch {
    return { projects: [], available: false };
  }
}

async function loadDropProjects(env: Env) {
  try {
    const upstream = await env.PORTAL.fetch(`${ORIGIN}/api/projects`, {
      headers: { Accept: "application/json" },
    });
    if (!upstream.ok) return { projects: [], available: false };
    const data = (await upstream.json()) as {
      projects?: Array<Record<string, unknown>>;
      sources?: { drop?: { available?: boolean } };
    };
    const projects = (data.projects || []).map((project) => {
      const slug = String(project.slug || "");
      return slug
        ? { ...project, public_url: `https://drop.00ai.kr/${encodeURIComponent(slug)}/` }
        : project;
    });
    return {
      projects,
      available: data.sources?.drop?.available !== false,
    };
  } catch {
    return { projects: [], available: false };
  }
}

async function projectRegistry(env: Env, ctx: ExecutionContext) {
  const cacheKey = new Request("https://00ai.kr/api/projects", { method: "GET" });
  const cached = await caches.default.match(cacheKey);
  if (cached) {
    const headers = new Headers(cached.headers);
    headers.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    headers.set("X-00AI-Cache", "HIT");
    headers.set("Server-Timing", "00ai-cache;dur=0");
    return finish(new Response(cached.body, { status: cached.status, headers }));
  }

  const siteProjects = (publicSites as SiteProject[]).map((project) => ({
    ...project,
    public_url: customUrlForSite(project) || project.public_url,
  }));
  const [github, drop] = await Promise.all([
    loadGitHubProjects(),
    loadDropProjects(env),
  ]);

  const response = finish(
    Response.json(
      {
        projects: drop.projects,
        githubProjects: github.projects,
        siteProjects,
        sources: {
          drop: {
            available: drop.available,
            count: drop.projects.length,
          },
          github: {
            available: github.available,
            owner: GITHUB_OWNER,
            count: github.projects.length,
          },
          sites: {
            available: true,
            count: siteProjects.length,
          },
        },
        refreshedAt: new Date().toISOString(),
        rootRouter: true,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
          "X-00AI-Cache": "MISS",
        },
      },
    ),
  );
  const stored = response.clone();
  stored.headers.set("Cache-Control", "public, max-age=60");
  stored.headers.set("X-00AI-Cache", "STORED");
  ctx.waitUntil(
    caches.default.put(cacheKey, stored).catch((error) => {
      console.error(
        JSON.stringify({
          event: "project_registry_cache_put_failed",
          error: error instanceof Error ? error.message : "unknown",
        }),
      );
    }),
  );
  return response;
}

async function proxy(
  request: Request,
  incoming: URL,
  env: Env,
  ctx: ExecutionContext,
) {
  const cachePolicy = cachePolicyFor(request, incoming);
  const cacheKey = cachePolicy ? cacheKeyFor(incoming) : null;
  if (cachePolicy && cacheKey) {
    const cached = await caches.default.match(cacheKey);
    if (cached) {
      const headers = new Headers(cached.headers);
      headers.set("Cache-Control", cachePolicy.browser);
      headers.set("X-00AI-Cache", "HIT");
      headers.set("X-00AI-Cache-Policy", cachePolicy.label);
      headers.set("Server-Timing", "00ai-cache;dur=0");
      return finish(
        new Response(request.method === "HEAD" ? null : cached.body, {
          status: cached.status,
          statusText: cached.statusText,
          headers,
        }),
      );
    }
  }

  const target = new URL(ORIGIN);
  target.pathname = incoming.pathname;
  target.search = incoming.search;

  const headers = new Headers(request.headers);
  headers.delete("authorization");
  headers.delete("cookie");
  headers.delete("proxy-authorization");
  headers.set("X-Forwarded-Host", incoming.hostname);
  headers.set("X-00AI-Original-Host", incoming.hostname);

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
  };
  if (!["GET", "HEAD"].includes(request.method)) init.body = request.body;

  const startedAt = Date.now();
  const upstream = await env.PORTAL.fetch(new Request(target, init));
  const outgoing = new Headers(upstream.headers);
  outgoing.delete("set-cookie");
  outgoing.set("X-00AI-Origin", "service-binding");
  outgoing.set("Server-Timing", `00ai-origin;dur=${Date.now() - startedAt}`);
  if (cachePolicy) {
    outgoing.set("Cache-Control", cachePolicy.browser);
    outgoing.set("X-00AI-Cache", "MISS");
    outgoing.set("X-00AI-Cache-Policy", cachePolicy.label);
  } else {
    outgoing.set("X-00AI-Cache", "BYPASS");
    outgoing.set("X-00AI-Cache-Policy", "bypass");
  }

  const location = outgoing.get("Location");
  if (location) {
    try {
      const next = new URL(location, target);
      if (next.origin === target.origin) {
        next.protocol = incoming.protocol;
        next.host = incoming.host;
        outgoing.set("Location", next.toString());
      }
    } catch {}
  }

  const response = finish(
    new Response(request.method === "HEAD" ? null : upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: outgoing,
    }),
  );
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
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const incoming = new URL(request.url);

    if (incoming.pathname === "/policy" || incoming.pathname.startsWith("/policy/")) {
      return redirectTo("policy.00ai.kr", incoming, "/policy");
    }
    if (incoming.pathname === "/harness" || incoming.pathname.startsWith("/harness/")) {
      return redirectTo("harness.00ai.kr", incoming, "/harness");
    }
    if (incoming.pathname === "/api/projects" && request.method === "GET") {
      return projectRegistry(env, ctx);
    }

    return proxy(request, incoming, env, ctx);
  },
} satisfies ExportedHandler<Env>;
