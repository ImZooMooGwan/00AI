import publicSites from "../data/public-sites.json";

type PublicSite = {
  id: string;
  public_url: string;
  aliases?: string[];
};

type GitHubProject = {
  name: string;
  homepage?: string | null;
};

type ProjectRegistry = {
  githubProjects?: GitHubProject[];
};

type RouteContext = {
  params: Promise<{ segments: string[] }>;
};

const PROJECT_REGISTRY_URL =
  "https://zeroai-platform.hayahoyeho.chatgpt.site/api/projects";
const ALLOWED_GITHUB_HOME_SUFFIXES = [
  "chatgpt.site",
  "pages.dev",
  "workers.dev",
  "vercel.app",
  "netlify.app",
  "github.io",
];

const sitesBySlug = new Map<string, PublicSite>();
for (const site of publicSites as PublicSite[]) {
  sitesBySlug.set(site.id.toLowerCase(), site);
  for (const alias of site.aliases ?? []) {
    sitesBySlug.set(alias.toLowerCase(), site);
  }
}

async function resolveGitHubHomepage(slug: string) {
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
    const project = (registry.githubProjects ?? []).find(
      (candidate) => candidate.name.toLowerCase() === slug,
    );
    if (!project?.homepage) return null;

    const homepage = new URL(project.homepage);
    const hostname = homepage.hostname.toLowerCase();
    if (homepage.protocol !== "https:" || hostname.endsWith(".00ai.kr")) {
      return null;
    }
    return ALLOWED_GITHUB_HOME_SUFFIXES.some(
      (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
    )
      ? homepage.toString()
      : null;
  } catch {
    return null;
  }
}

async function redirectProject(request: Request, context: RouteContext) {
  const { segments } = await context.params;
  const [rawSlug, ...rest] = segments;
  const slug = rawSlug?.toLowerCase();
  const site = slug ? sitesBySlug.get(slug) : undefined;
  const publicUrl = site?.public_url || (slug ? await resolveGitHubHomepage(slug) : null);

  if (!publicUrl) {
    const section = slug === "harness" ? "harness" : slug === "drop" ? "deploy" : "projects";
    return Response.redirect(new URL(`/#${section}`, request.url), 302);
  }

  const incoming = new URL(request.url);
  const destination = new URL(publicUrl);
  if (rest.length) {
    const base = destination.pathname === "/" ? "" : destination.pathname.replace(/\/$/, "");
    destination.pathname = `${base}/${rest.map(encodeURIComponent).join("/")}`;
  }
  destination.search = incoming.search;
  return Response.redirect(destination, 307);
}

export const GET = redirectProject;
export const HEAD = redirectProject;
