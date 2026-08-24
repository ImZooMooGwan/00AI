import { unzipSync } from "fflate";
import { NextResponse } from "next/server";

const MAX_PROJECT_BYTES = 50 * 1024 * 1024;
const MAX_FILES = 1000;
const MAX_SINGLE_FILE_BYTES = 20 * 1024 * 1024;
const BLOCKED_EXTENSIONS = new Set([
  ".exe",
  ".dll",
  ".php",
  ".py",
  ".sh",
  ".bat",
  ".cmd",
  ".ps1",
  ".jar",
  ".wasm",
]);
const SAFE_SEGMENT = /^[a-zA-Z0-9가-힣._ -]+$/;

type DropEnv = { DB?: D1Database; BUCKET?: R2Bucket };
type DeployFile = { name: string; bytes: Uint8Array; type: string };

function safeSlug(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);
  return slug || "project";
}

function extension(name: string) {
  const index = name.lastIndexOf(".");
  return index < 0 ? "" : name.slice(index).toLowerCase();
}

function id() {
  return crypto.randomUUID();
}

function contentType(name: string) {
  const types: Record<string, string> = {
    ".html": "text/html;charset=UTF-8",
    ".htm": "text/html;charset=UTF-8",
    ".css": "text/css;charset=UTF-8",
    ".js": "text/javascript;charset=UTF-8",
    ".mjs": "text/javascript;charset=UTF-8",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
  };
  return types[extension(name)] || "application/octet-stream";
}

function safePath(name: string) {
  const path = name.replace(/\\/g, "/").replace(/^\.\//, "");
  if (
    !path ||
    path.startsWith("/") ||
    path.includes("//") ||
    path
      .split("/")
      .some(
        (part) =>
          part === "." || part === ".." || !SAFE_SEGMENT.test(part),
      )
  ) {
    return null;
  }
  return path;
}

function isMacMetadata(name: string) {
  return (
    name === ".DS_Store" ||
    name.endsWith("/.DS_Store") ||
    name === "__MACOSX" ||
    name.startsWith("__MACOSX/")
  );
}

function normalizeUpload(files: DeployFile[]) {
  let normalized = files
    .map((file) => {
      const name = safePath(file.name);
      if (!name) {
        throw new Error(`${file.name}: 허용되지 않는 파일 경로입니다.`);
      }
      return { ...file, name };
    })
    .filter((file) => !isMacMetadata(file.name));

  if (!normalized.length) return normalized;

  const parts = normalized.map((file) => file.name.split("/"));
  const commonRoot = parts[0][0];
  if (
    parts.every(
      (segments) => segments.length > 1 && segments[0] === commonRoot,
    )
  ) {
    normalized = normalized.map((file) => ({
      ...file,
      name: file.name.split("/").slice(1).join("/"),
    }));
  }

  const indexCandidates = normalized.filter(
    (file) => file.name.toLowerCase() === "index.html",
  );
  if (indexCandidates.length === 1 && indexCandidates[0].name !== "index.html") {
    const target = indexCandidates[0];
    normalized = normalized.map((file) =>
      file === target
        ? { ...file, name: "index.html", type: contentType("index.html") }
        : file,
    );
  }

  if (normalized.some((file) => file.name === "index.html")) {
    return normalized;
  }

  const topLevelHtml = normalized.filter(
    (file) =>
      !file.name.includes("/") &&
      (extension(file.name) === ".html" || extension(file.name) === ".htm"),
  );
  if (topLevelHtml.length === 1) {
    const target = topLevelHtml[0];
    normalized = normalized.map((file) =>
      file === target
        ? { ...file, name: "index.html", type: contentType("index.html") }
        : file,
    );
  }

  return normalized;
}

function inspect(files: DeployFile[]) {
  if (!files.length) throw new Error("업로드할 파일을 선택해 주세요.");
  if (files.length > MAX_FILES) {
    throw new Error(
      `파일은 최대 ${MAX_FILES.toLocaleString()}개까지 올릴 수 있습니다.`,
    );
  }

  let total = 0;
  const names = new Set<string>();
  for (const file of files) {
    if (!safePath(file.name)) {
      throw new Error(`${file.name}: 허용되지 않는 파일 경로입니다.`);
    }
    if (names.has(file.name)) {
      throw new Error(`${file.name}: ZIP 안에 같은 경로의 파일이 중복되어 있습니다.`);
    }
    if (!file.bytes.byteLength) {
      throw new Error(`${file.name}: 빈 파일은 배포할 수 없습니다.`);
    }
    if (file.bytes.byteLength > MAX_SINGLE_FILE_BYTES) {
      throw new Error(`${file.name}: 단일 파일은 20MB를 넘을 수 없습니다.`);
    }
    if (BLOCKED_EXTENSIONS.has(extension(file.name))) {
      throw new Error(`${file.name}: 서버 실행 파일은 지원하지 않습니다.`);
    }
    names.add(file.name);
    total += file.bytes.byteLength;
  }

  if (total > MAX_PROJECT_BYTES) {
    throw new Error("프로젝트 전체 용량은 50MB를 넘을 수 없습니다.");
  }
  if (!names.has("index.html")) {
    throw new Error(
      "시작할 HTML을 찾지 못했습니다. index.html을 포함하거나 루트에 HTML 파일 하나만 두면 자동으로 시작 파일로 사용합니다.",
    );
  }
  return total;
}

async function expandUpload(files: File[]): Promise<DeployFile[]> {
  const zipFiles = files.filter((file) => extension(file.name) === ".zip");
  if (zipFiles.length && files.length !== 1) {
    throw new Error("ZIP 파일은 다른 파일과 함께 올릴 수 없습니다.");
  }

  if (!zipFiles.length) {
    const expanded = await Promise.all(
      files.map(async (file) => ({
        name: file.name,
        bytes: new Uint8Array(await file.arrayBuffer()),
        type: file.type || contentType(file.name),
      })),
    );
    return normalizeUpload(expanded);
  }

  const archive = zipFiles[0];
  if (archive.size > MAX_PROJECT_BYTES) {
    throw new Error("ZIP 파일은 50MB를 넘을 수 없습니다.");
  }

  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(new Uint8Array(await archive.arrayBuffer()));
  } catch {
    throw new Error("열 수 없는 ZIP 파일입니다.");
  }

  const expanded = Object.entries(entries)
    .filter(([name]) => !name.endsWith("/"))
    .map(([name, bytes]) => ({ name, bytes, type: contentType(name) }));
  return normalizeUpload(expanded);
}

async function readRuntime(): Promise<DropEnv> {
  try {
    const { env } = await import("cloudflare:workers");
    return env as unknown as DropEnv;
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

export async function GET() {
  const runtime = await readRuntime();
  return NextResponse.json(
    {
      available: Boolean(runtime.DB && runtime.BUCKET),
      d1: Boolean(runtime.DB),
      r2: Boolean(runtime.BUCKET),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const name = String(form.get("name") || "").trim();
    const organization = String(form.get("organization") || "").trim();
    const uploaderName = String(form.get("uploaderName") || "").trim();
    const description = String(form.get("description") || "").trim();
    const visibility = form.get("visibility") === "public" ? "public" : "unlisted";
    const uploaded = form
      .getAll("files")
      .filter((item): item is File => item instanceof File);

    if (name.length < 2 || name.length > 80) {
      return NextResponse.json(
        { error: "제목은 2~80자로 입력해 주세요." },
        { status: 400 },
      );
    }
    if (organization.length < 1 || organization.length > 80) {
      return NextResponse.json(
        { error: "소속은 1~80자로 입력해 주세요." },
        { status: 400 },
      );
    }
    if (uploaderName.length < 2 || uploaderName.length > 40) {
      return NextResponse.json(
        { error: "성명은 2~40자로 입력해 주세요." },
        { status: 400 },
      );
    }
    if (description.length < 5 || description.length > 600) {
      return NextResponse.json(
        { error: "내용은 5~600자로 입력해 주세요." },
        { status: 400 },
      );
    }

    const files = await expandUpload(uploaded);
    const totalSize = inspect(files);
    const runtime = await readRuntime();
    if (!runtime.DB || !runtime.BUCKET) {
      return NextResponse.json(
        {
          error:
            "00AI DROP 운영 저장소가 아직 연결되지 않았습니다. Sites 프로젝트에 D1(DB)과 R2(BUCKET) 바인딩을 프로비저닝한 뒤 다시 배포해야 합니다.",
          storage: { d1: Boolean(runtime.DB), r2: Boolean(runtime.BUCKET) },
        },
        { status: 503 },
      );
    }

    await ensureProfileTable(runtime.DB);

    const now = Date.now();
    const projectId = id();
    const deploymentId = id();
    const slug = `${safeSlug(name)}-${projectId.slice(0, 6)}`;
    const storagePath = `projects/${projectId}/v1`;
    const publicUrl = `https://${slug}.00ai.kr`;

    await runtime.DB.batch([
      runtime.DB.prepare(
        "INSERT INTO projects (id, slug, name, visibility, status, public_url, active_deployment_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).bind(
        projectId,
        slug,
        name,
        visibility,
        "ready_for_domain",
        publicUrl,
        deploymentId,
        now,
        now,
      ),
      runtime.DB.prepare(
        "INSERT INTO deployments (id, project_id, version, storage_path, file_count, total_size, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ).bind(
        deploymentId,
        projectId,
        1,
        storagePath,
        files.length,
        totalSize,
        "stored",
        now,
      ),
      runtime.DB.prepare(
        "INSERT INTO project_profiles (project_id, organization, uploader_name, description, created_at) VALUES (?, ?, ?, ?, ?)",
      ).bind(projectId, organization, uploaderName, description, now),
    ]);

    try {
      await Promise.all(
        files.map((file) =>
          runtime.BUCKET!.put(`${storagePath}/${file.name}`, file.bytes, {
            httpMetadata: { contentType: file.type },
            customMetadata: {
              originalName: file.name,
              projectTitle: name.slice(0, 80),
              organization: organization.slice(0, 80),
              uploaderName: uploaderName.slice(0, 40),
            },
          }),
        ),
      );
    } catch (error) {
      await runtime.DB.prepare(
        "UPDATE deployments SET status = ? WHERE id = ?",
      )
        .bind("failed", deploymentId)
        .run();
      throw error;
    }

    return NextResponse.json(
      {
        projectId,
        name,
        organization,
        uploaderName,
        description,
        slug,
        publicUrl,
        status: "ready_for_domain",
        fileCount: files.length,
        totalSize,
        entryFile: "index.html",
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "파일 저장 중 문제가 발생했습니다. 다시 시도해 주세요.",
      },
      { status: 400 },
    );
  }
}
