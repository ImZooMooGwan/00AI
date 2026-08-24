import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SITE_FILE = path.join(ROOT, "app/data/public-sites.json");
const MAP_FILE = path.join(ROOT, "app/data/domain-map.json");
const WRANGLER_FILE = path.join(ROOT, "wrangler.jsonc");
const OWNER = process.env.GITHUB_OWNER?.trim() || "ImZooMooGwan";
const BASE_DOMAIN = "00ai.kr";
const RESERVED = new Set([
  "00ai",
  "www",
  "api",
  "harness",
  "mail",
  "smtp",
  "imap",
]);

function subdomain(value) {
  let slug = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 55);
  if (slug.length < 3) slug = `app-${slug || "site"}`;
  return slug;
}

function add(map, host, target, mode = "proxy") {
  const name = host.toLowerCase();
  const label = name.split(".")[0];
  if (!name.endsWith(`.${BASE_DOMAIN}`) || RESERVED.has(label)) return;
  if (!map[name]) map[name] = { target, mode };
}

const sites = JSON.parse(await fs.readFile(SITE_FILE, "utf8"));
const map = {};

for (const site of sites) {
  if (!site?.id || !site?.public_url) continue;
  add(map, `${subdomain(site.id)}.${BASE_DOMAIN}`, site.public_url, "proxy");
}

const byId = new Map(sites.map((site) => [site.id, site]));
if (byId.get("public-ai-gov")) {
  add(map, `policy.${BASE_DOMAIN}`, byId.get("public-ai-gov").public_url, "proxy");
}
if (byId.get("youth-policy-data-hub")) {
  add(map, `yhub.${BASE_DOMAIN}`, byId.get("youth-policy-data-hub").public_url, "proxy");
}

// DROP은 프로젝트마다 DNS를 만들지 않고 drop.00ai.kr/<slug>/ 형태로 제공합니다.
map[`drop.${BASE_DOMAIN}`] = { target: "drop", mode: "drop" };

try {
  const endpoint = new URL(`https://api.github.com/users/${encodeURIComponent(OWNER)}/repos`);
  endpoint.searchParams.set("type", "owner");
  endpoint.searchParams.set("sort", "updated");
  endpoint.searchParams.set("per_page", "100");
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "00ai-domain-builder",
    "X-GitHub-Api-Version": "2026-03-10",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const response = await fetch(endpoint, { headers });
  if (!response.ok) throw new Error(`GitHub API ${response.status}`);
  const repositories = await response.json();

  for (const repo of repositories) {
    if (
      !repo?.name ||
      repo.fork ||
      repo.archived ||
      repo.disabled ||
      repo.name.toLowerCase() === "00ai" ||
      repo.name.toLowerCase() === ".github"
    ) {
      continue;
    }
    const host = `${subdomain(repo.name)}.${BASE_DOMAIN}`;
    const homepage = typeof repo.homepage === "string" && /^https?:\/\//i.test(repo.homepage)
      ? repo.homepage
      : null;
    add(map, host, homepage || repo.html_url, homepage ? "proxy" : "redirect");
  }
} catch (error) {
  console.warn(`GitHub domain sync skipped: ${error instanceof Error ? error.message : error}`);
}

const sortedMap = Object.fromEntries(
  Object.entries(map).sort(([a], [b]) => a.localeCompare(b)),
);
await fs.writeFile(MAP_FILE, `${JSON.stringify(sortedMap, null, 2)}\n`);

const wrangler = JSON.parse(await fs.readFile(WRANGLER_FILE, "utf8"));
wrangler.routes = [
  // 기존 포털 도메인을 Wrangler의 source of truth에 반드시 포함해 유지합니다.
  { pattern: BASE_DOMAIN, custom_domain: true },
  ...Object.keys(sortedMap)
    .filter((host) => host !== `harness.${BASE_DOMAIN}`)
    .sort()
    .map((host) => ({ pattern: host, custom_domain: true })),
];
await fs.writeFile(WRANGLER_FILE, `${JSON.stringify(wrangler, null, 2)}\n`);

console.log(`00AI domains prepared: ${wrangler.routes.length}`);
