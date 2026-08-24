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

const DOMAIN_SUFFIX = ".00ai.kr";
const VALID_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const ALLOWED_UPSTREAM_SUFFIXES = [
  "chatgpt.site",
  "pages.dev",
  "workers.dev",
  "vercel.app",
  "netlify.app",
  "github.io",
];

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

function resolveRoute(hostname: string): Route | null {
  if (hostname === `drop${DOMAIN_SUFFIX}`) return { target: "drop", mode: "drop" };
  if (!hostname.endsWith(DOMAIN_SUFFIX)) return null;

  const slug = hostname.slice(0, -DOMAIN_SUFFIX.length);
  if (!VALID_SLUG.test(slug)) return null;

  const site = SITE_BY_SLUG.get(slug);
  if (!site) return null;

  try {
    const target = new URL(site.origin_url || site.public_url);
    if (!isAllowedUpstream(target)) return null;
    return { target: target.toString(), mode: "proxy" };
  } catch {
    return null;
  }
}

async function proxyExternal(request: Request, route: Route, incoming: URL) {
  const target = buildTarget(route.target, incoming);
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
    const response = await fetch(new Request(target, init));

    const headers = new Headers(response.headers);
    headers.delete("set-cookie");

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

  const response = await fetch(target, {
    method: request.method === "HEAD" ? "HEAD" : "GET",
    headers,
    redirect: "manual",
  });

  const outgoing = new Headers(response.headers);
  outgoing.delete("set-cookie");
  outgoing.set("X-00AI-Upstream", "DROP");
  return withSecurity(
    new Response(request.method === "HEAD" ? null : response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: outgoing,
    }),
  );
}

export default {
  async fetch(request: Request): Promise<Response> {
    const incoming = new URL(request.url);
    const route = resolveRoute(incoming.hostname.toLowerCase());

    if (!route) {
      return withSecurity(
        new Response("등록되지 않은 00AI 프로젝트입니다.", { status: 404 }),
      );
    }
    if (!["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"].includes(request.method)) {
      return withSecurity(new Response("Method Not Allowed", { status: 405 }));
    }
    if (route.mode === "drop") return serveDrop(request, incoming);
    return proxyExternal(request, route, incoming);
  },
} satisfies ExportedHandler;
