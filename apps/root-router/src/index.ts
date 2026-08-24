const ORIGIN = "https://zeroai-platform.hayahoyeho.chatgpt.site";
const DOMAIN_SUFFIX = ".00ai.kr";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

function finish(response: Response) {
  const headers = new Headers(response.headers);
  headers.delete("set-cookie");
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(key)) headers.set(key, value);
  }
  headers.set("X-00AI-Root-Router", "v1");
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
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(id)) return null;
  return `https://${id}${DOMAIN_SUFFIX}`;
}

async function projectRegistry(request: Request) {
  const upstream = await fetch(`${ORIGIN}/api/projects`, {
    headers: { Accept: "application/json" },
    cf: { cacheEverything: false },
  });
  if (!upstream.ok) return finish(upstream);

  const data = (await upstream.json()) as {
    projects?: Array<Record<string, unknown>>;
    githubProjects?: Array<Record<string, unknown>>;
    siteProjects?: Array<Record<string, unknown> & { id?: string; aliases?: string[] }>;
    sources?: Record<string, unknown>;
    refreshedAt?: string;
  };

  const siteProjects = (data.siteProjects || []).map((project) => {
    const publicUrl = customUrlForSite(project);
    return publicUrl ? { ...project, public_url: publicUrl } : project;
  });

  const githubProjects = (data.githubProjects || []).map((project) => {
    const name = String(project.name || "").toLowerCase();
    const hasService = typeof project.homepage === "string" && project.homepage.length > 0;
    return hasService && /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(name)
      ? { ...project, public_url: `https://${name}${DOMAIN_SUFFIX}` }
      : project;
  });

  const projects = (data.projects || []).map((project) => {
    const slug = String(project.slug || "");
    return slug ? { ...project, public_url: `https://drop.00ai.kr/${encodeURIComponent(slug)}/` } : project;
  });

  return finish(
    Response.json(
      {
        ...data,
        projects,
        githubProjects,
        siteProjects,
        refreshedAt: new Date().toISOString(),
        rootRouter: true,
      },
      { headers: { "Cache-Control": "no-store" } },
    ),
  );
}

async function proxy(request: Request, incoming: URL) {
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

  const upstream = await fetch(new Request(target, init));
  const outgoing = new Headers(upstream.headers);
  outgoing.delete("set-cookie");

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

  return finish(
    new Response(request.method === "HEAD" ? null : upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: outgoing,
    }),
  );
}

export default {
  async fetch(request: Request): Promise<Response> {
    const incoming = new URL(request.url);

    if (incoming.pathname === "/policy" || incoming.pathname.startsWith("/policy/")) {
      return redirectTo("policy.00ai.kr", incoming, "/policy");
    }
    if (incoming.pathname === "/harness" || incoming.pathname.startsWith("/harness/")) {
      return redirectTo("harness.00ai.kr", incoming, "/harness");
    }
    if (incoming.pathname === "/api/projects" && request.method === "GET") {
      return projectRegistry(request);
    }

    return proxy(request, incoming);
  },
} satisfies ExportedHandler;
