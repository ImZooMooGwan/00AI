import publicSites from "../data/public-sites.json";

type PublicSite = {
  id: string;
  public_url: string;
  aliases?: string[];
};

type RouteContext = {
  params: Promise<{ segments: string[] }>;
};

const sitesBySlug = new Map<string, PublicSite>();
for (const site of publicSites as PublicSite[]) {
  sitesBySlug.set(site.id.toLowerCase(), site);
  for (const alias of site.aliases ?? []) {
    sitesBySlug.set(alias.toLowerCase(), site);
  }
}

async function redirectProject(request: Request, context: RouteContext) {
  const { segments } = await context.params;
  const [rawSlug, ...rest] = segments;
  const slug = rawSlug?.toLowerCase();
  const site = slug ? sitesBySlug.get(slug) : undefined;

  if (!site) {
    const section = slug === "harness" ? "harness" : slug === "drop" ? "deploy" : "projects";
    return Response.redirect(new URL(`/#${section}`, request.url), 302);
  }

  const incoming = new URL(request.url);
  const destination = new URL(site.public_url);
  if (rest.length) {
    const base = destination.pathname === "/" ? "" : destination.pathname.replace(/\/$/, "");
    destination.pathname = `${base}/${rest.map(encodeURIComponent).join("/")}`;
  }
  destination.search = incoming.search;
  return Response.redirect(destination, 307);
}

export const GET = redirectProject;
export const HEAD = redirectProject;
