/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

type CachePolicy = {
  browser: string;
  edge: string;
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

const AUTH_PATHS = [
  "/signin-with-chatgpt",
  "/signout-with-chatgpt",
  "/callback",
];

const STATIC_FILE =
  /\.(?:avif|bmp|css|gif|ico|jpe?g|js|json|map|mjs|mp3|mp4|ogg|pdf|png|svg|txt|wasm|webmanifest|webp|woff2?)$/i;

function cachePolicyFor(request: Request, url: URL): CachePolicy | null {
  if (!["GET", "HEAD"].includes(request.method)) return null;
  if (
    request.headers.has("Authorization") ||
    request.headers.has("Cookie") ||
    request.headers.has("Range") ||
    request.headers.has("oai-authenticated-user-email")
  ) {
    return null;
  }
  if (RSC_REQUEST_HEADERS.some((header) => request.headers.has(header))) return null;
  if (url.searchParams.has("_rsc")) return null;
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return null;
  if (AUTH_PATHS.some((path) => url.pathname === path || url.pathname.startsWith(`${path}/`))) {
    return null;
  }

  const requestCacheControl = request.headers.get("Cache-Control") || "";
  if (/\b(?:no-cache|no-store)\b/i.test(requestCacheControl)) return null;

  if (
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/_next/static/")
  ) {
    return {
      browser: "public, max-age=31536000, immutable",
      edge: "public, max-age=31536000, stale-if-error=604800",
      label: "immutable",
    };
  }
  if (STATIC_FILE.test(url.pathname) || url.pathname === "/_vinext/image") {
    return {
      browser: "public, max-age=3600, stale-while-revalidate=86400",
      edge: "public, max-age=86400, stale-while-revalidate=86400, stale-if-error=604800",
      label: "static",
    };
  }
  return {
    browser: "public, max-age=60, stale-while-revalidate=300",
    edge: "public, max-age=300, stale-while-revalidate=86400, stale-if-error=604800",
    label: "document",
  };
}

function cacheKeyFor(url: URL) {
  return new Request(url.toString(), { method: "GET" });
}

function withPortalHeaders(response: Response, values: Record<string, string>) {
  const headers = new Headers(response.headers);
  headers.set("X-00AI-Portal", "fast-cache-v1");
  for (const [name, value] of Object.entries(values)) headers.set(name, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function matchCache(request: Request, key: Request, policy: CachePolicy) {
  const cached = await caches.default.match(key);
  if (!cached) return null;
  const headers = new Headers(cached.headers);
  headers.set("Cache-Control", policy.browser);
  headers.set("X-00AI-Cache", "HIT");
  headers.set("X-00AI-Cache-Policy", policy.label);
  headers.set("X-00AI-Portal", "fast-cache-v1");
  headers.set("Server-Timing", "00ai-cache;dur=0");
  return new Response(request.method === "HEAD" ? null : cached.body, {
    status: cached.status,
    statusText: cached.statusText,
    headers,
  });
}

function storeInCache(
  ctx: ExecutionContext,
  key: Request,
  response: Response,
  policy: CachePolicy,
) {
  const stored = response.clone();
  stored.headers.set("Cache-Control", policy.edge);
  stored.headers.set("X-00AI-Cache", "STORED");
  ctx.waitUntil(
    caches.default.put(key, stored).catch((error) => {
      console.error(
        JSON.stringify({
          event: "portal_cache_put_failed",
          error: error instanceof Error ? error.message : "unknown",
          url: key.url,
        }),
      );
    }),
  );
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

async function loadResponse(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  url: URL,
) {
  // Serve the static 00AI GOV policy command center from both the
  // policy subdomain and the /policy path on the portal domain.
  const isPolicyHost = url.hostname === "policy.00ai.kr";
  const isPolicyPath = url.pathname === "/policy" || url.pathname === "/policy/" || url.pathname.startsWith("/policy/");
  if (isPolicyHost || isPolicyPath) {
    const policyAssetPath = isPolicyHost
      ? (url.pathname === "/" ? "/policy/index.html" : `/policy${url.pathname}`)
      : (url.pathname === "/policy" || url.pathname === "/policy/" ? "/policy/index.html" : url.pathname);
    const assetUrl = new URL(request.url);
    assetUrl.pathname = policyAssetPath;
    const assetResponse = await env.ASSETS.fetch(new Request(assetUrl, request));
    if (assetResponse.status !== 404) return assetResponse;
  }

  if (url.pathname === "/_vinext/image") {
    const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
    return handleImageOptimization(request, {
      fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
      transformImage: async (body, { width, format, quality }) => {
        const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
        return result.response();
      },
    }, allowedWidths);
  }

  return handler.fetch(request, env, ctx);
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const policy = cachePolicyFor(request, url);
    const key = policy ? cacheKeyFor(url) : null;

    if (policy && key) {
      const cached = await matchCache(request, key, policy);
      if (cached) return cached;
    }

    const startedAt = Date.now();
    const source = await loadResponse(request, env, ctx, url);
    const sourceCacheControl = source.headers.get("Cache-Control") || "";
    const responseAllowsCaching =
      !source.headers.has("Set-Cookie") &&
      !/\b(?:private|no-store)\b/i.test(sourceCacheControl);

    if (!policy || !responseAllowsCaching) {
      return withPortalHeaders(source, {
        "X-00AI-Cache": "BYPASS",
        "X-00AI-Cache-Policy": "bypass",
        "Server-Timing": `00ai-render;dur=${Date.now() - startedAt}`,
      });
    }

    const response = withPortalHeaders(source, {
      "Cache-Control": policy.browser,
      "X-00AI-Cache": "MISS",
      "X-00AI-Cache-Policy": policy.label,
      "Server-Timing": `00ai-render;dur=${Date.now() - startedAt}`,
    });
    if (
      request.method === "GET" &&
      key &&
      response.status >= 200 &&
      response.status < 400
    ) {
      storeInCache(ctx, key, response, policy);
    }
    return response;
  },
};

export default worker;
