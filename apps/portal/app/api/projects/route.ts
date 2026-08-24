import { NextResponse } from "next/server";

type ProjectEnv = {
  DB?: D1Database;
  BUCKET?: R2Bucket;
  GITHUB_OWNER?: string;
  GITHUB_TOKEN?: string;
  GITHUB_EXCLUDE_REPOS?: string;
  GITHUB_PROJECT_TOPIC?: string;
};

type DropProject = {
  slug: string;
  name: string;
  public_url: string;
  status: string;
  created_at: number;
  organization?: string | null;
  uploader_name?: string | null;
  description?: string | null;
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

const DEFAULT_GITHUB_OWNER = "ImZooMooGwan";
const DEFAULT_EXCLUDED_REPOSITORIES = ["00ai", ".github"];
const GITHUB_CACHE_SECONDS = 300;

async function readRuntimeEnv(): Promise<ProjectEnv> {
  try {
    const { env } = await import("cloudflare:workers");
    return env as unknown as ProjectEnv;
  } catch {
    return {};
  }
}

async function ensureProfileTable(db: D1Database) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS project_profiles (
        project_id TEXT PRIMARY KEY,
        organization TEXT NOT NULL,
        uploader_name TEXT NOT NULL,
        description TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )`,
    )
    .run();
}

async function loadDropProjects(runtime: ProjectEnv): Promise<DropProject[]> {
  if (!runtime.DB) return [];

  try {
    await ensureProfileTable(runtime.DB);
    const result = await runtime.DB.prepare(
      `SELECT
        p.slug,
        p.name,
        p.public_url,
        p.status,
        p.created_at,
        pp.organization,
        pp.uploader_name,
        pp.description
      FROM projects p
      LEFT JOIN project_profiles pp ON pp.project_id = p.id
      WHERE p.visibility = ?
      ORDER BY p.created_at DESC
      LIMIT 30`,
    )
      .bind("public")
      .all<DropProject>();
    return result.results ?? [];
  } catch {
    try {
      const fallback = await runtime.DB.prepare(
        "SELECT slug, name, public_url, status, created_at FROM projects WHERE visibility = ? ORDER BY created_at DESC LIMIT 30",
      )
        .bind("public")
        .all<DropProject>();
      return fallback.results ?? [];
    } catch {
      return [];
    }
  }
}

function validHomepage(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

async function loadGitHubProjects(runtime: ProjectEnv) {
  const owner = runtime.GITHUB_OWNER?.trim() || DEFAULT_GITHUB_OWNER;
  const excluded = new Set(
    [
      ...DEFAULT_EXCLUDED_REPOSITORIES,
      ...(runtime.GITHUB_EXCLUDE_REPOS ?? "").split(","),
    ]
      .map((name) => name.trim().toLowerCase())
      .filter(Boolean),
  );
  const requiredTopic =
    runtime.GITHUB_PROJECT_TOPIC?.trim().toLowerCase() || null;
  const endpoint = new URL(
    `https://api.github.com/users/${encodeURIComponent(owner)}/repos`,
  );
  endpoint.searchParams.set("type", "owner");
  endpoint.searchParams.set("sort", "created");
  endpoint.searchParams.set("direction", "desc");
  endpoint.searchParams.set("per_page", "100");

  const headers = new Headers({
    Accept: "application/vnd.github+json",
    "User-Agent": "00ai-project-registry",
    "X-GitHub-Api-Version": "2026-03-10",
  });
  if (runtime.GITHUB_TOKEN) {
    headers.set("Authorization", `Bearer ${runtime.GITHUB_TOKEN}`);
  }

  try {
    const requestInit: RequestInit & {
      cf?: { cacheEverything: boolean; cacheTtl: number };
    } = {
      headers,
      cf: { cacheEverything: true, cacheTtl: GITHUB_CACHE_SECONDS },
    };
    const response = await fetch(endpoint, requestInit);
    if (!response.ok) throw new Error(`GitHub API ${response.status}`);

    const repositories = (await response.json()) as GitHubRepository[];
    const projects = repositories
      .filter((repository) => {
        const topics = (repository.topics ?? []).map((topic) =>
          topic.toLowerCase(),
        );
        return (
          !repository.fork &&
          !repository.archived &&
          !repository.disabled &&
          !excluded.has(repository.name.toLowerCase()) &&
          (!requiredTopic || topics.includes(requiredTopic))
        );
      })
      .map((repository) => {
        const homepage = validHomepage(repository.homepage);
        return {
          id: String(repository.id),
          name: repository.name,
          full_name: repository.full_name,
          description:
            repository.description || "GitHub에 공개된 00AI 프로젝트입니다.",
          repository_url: repository.html_url,
          homepage,
          public_url: homepage || repository.html_url,
          owner: repository.owner.login,
          language: repository.language,
          topics: repository.topics ?? [],
          status: homepage ? "LIVE" : "OPEN SOURCE",
          created_at: repository.created_at,
          updated_at: repository.pushed_at || repository.updated_at,
        };
      });

    return { owner, projects, available: true };
  } catch {
    return { owner, projects: [], available: false };
  }
}

export async function GET() {
  const runtime = await readRuntimeEnv();
  const [projects, github] = await Promise.all([
    loadDropProjects(runtime),
    loadGitHubProjects(runtime),
  ]);

  return NextResponse.json(
    {
      projects,
      githubProjects: github.projects,
      sources: {
        drop: {
          available: Boolean(runtime.DB && runtime.BUCKET),
          d1: Boolean(runtime.DB),
          r2: Boolean(runtime.BUCKET),
          count: projects.length,
        },
        github: {
          available: github.available,
          owner: github.owner,
          count: github.projects.length,
        },
      },
      refreshedAt: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control":
          "public, max-age=60, s-maxage=300, stale-while-revalidate=86400",
      },
    },
  );
}
