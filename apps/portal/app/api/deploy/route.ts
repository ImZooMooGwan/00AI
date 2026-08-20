import { unzipSync } from "fflate";
import { NextResponse } from "next/server";

const MAX_PROJECT_BYTES = 50 * 1024 * 1024;
const MAX_FILES = 1000;
const MAX_SINGLE_FILE_BYTES = 20 * 1024 * 1024;
const BLOCKED_EXTENSIONS = new Set([".exe", ".dll", ".php", ".py", ".sh", ".bat", ".cmd", ".ps1", ".jar", ".wasm"]);
const SAFE_SEGMENT = /^[a-zA-Z0-9가-힣._ -]+$/;
type DropEnv = { DB: D1Database; BUCKET: R2Bucket };
type DeployFile = { name: string; bytes: Uint8Array; type: string };

function safeSlug(value: string) { const slug = value.trim().toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 42); return slug || "project"; }
function extension(name: string) { const index = name.lastIndexOf("."); return index < 0 ? "" : name.slice(index).toLowerCase(); }
function id() { return crypto.randomUUID(); }
function contentType(name: string) {
  const types: Record<string, string> = { ".html": "text/html;charset=UTF-8", ".htm": "text/html;charset=UTF-8", ".css": "text/css;charset=UTF-8", ".js": "text/javascript;charset=UTF-8", ".mjs": "text/javascript;charset=UTF-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".woff": "font/woff", ".woff2": "font/woff2" };
  return types[extension(name)] || "application/octet-stream";
}
function safePath(name: string) {
  const path = name.replace(/\\/g, "/").replace(/^\.\//, "");
  if (!path || path.startsWith("/") || path.includes("//") || path.split("/").some((part) => part === "." || part === ".." || !SAFE_SEGMENT.test(part))) return null;
  return path;
}
function validate(files: DeployFile): never { throw new Error(String(files)); }
function inspect(files: DeployFile[]) {
  if (!files.length) throw new Error("업로드할 파일을 선택해 주세요.");
  if (files.length > MAX_FILES) throw new Error(`파일은 최대 ${MAX_FILES.toLocaleString()}개까지 올릴 수 있습니다.`);
  let total = 0; const names = new Set<string>();
  for (const file of files) {
    if (!safePath(file.name)) throw new Error(`${file.name}: 허용되지 않는 파일 경로입니다.`);
    if (names.has(file.name)) throw new Error(`${file.name}: ZIP 안에 같은 경로의 파일이 중복되어 있습니다.`);
    if (!file.bytes.byteLength) throw new Error(`${file.name}: 빈 파일은 배포할 수 없습니다.`);
    if (file.bytes.byteLength > MAX_SINGLE_FILE_BYTES) throw new Error(`${file.name}: 단일 파일은 20MB를 넘을 수 없습니다.`);
    if (BLOCKED_EXTENSIONS.has(extension(file.name))) throw new Error(`${file.name}: 서버 실행 파일은 지원하지 않습니다.`);
    names.add(file.name); total += file.bytes.byteLength;
  }
  if (total > MAX_PROJECT_BYTES) throw new Error("프로젝트 전체 용량은 50MB를 넘을 수 없습니다.");
  if (!names.has("index.html")) throw new Error("정적 웹 서비스의 시작 파일인 루트 index.html이 필요합니다.");
  return total;
}
async function expandUpload(files: File[]): Promise<DeployFile[]> {
  const zipFiles = files.filter((file) => extension(file.name) === ".zip");
  if (zipFiles.length && files.length !== 1) throw new Error("ZIP 파일은 다른 파일과 함께 올릴 수 없습니다.");
  if (!zipFiles.length) return Promise.all(files.map(async (file) => ({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()), type: file.type || contentType(file.name) })));
  const archive = zipFiles[0];
  if (archive.size > MAX_PROJECT_BYTES) throw new Error("ZIP 파일은 50MB를 넘을 수 없습니다.");
  let entries: Record<string, Uint8Array>;
  try { entries = unzipSync(new Uint8Array(await archive.arrayBuffer())); } catch { throw new Error("열 수 없는 ZIP 파일입니다."); }
  return Object.entries(entries).filter(([name]) => !name.endsWith("/")).map(([name, bytes]) => ({ name, bytes, type: contentType(name) }));
}

export async function POST(request: Request) {
  try {
    const form = await request.formData(); const name = String(form.get("name") || "").trim(); const visibility = form.get("visibility") === "public" ? "public" : "unlisted";
    const uploaded = form.getAll("files").filter((item): item is File => item instanceof File);
    if (name.length < 2 || name.length > 80) return NextResponse.json({ error: "프로젝트 이름은 2~80자로 입력해 주세요." }, { status: 400 });
    const files = await expandUpload(uploaded); const totalSize = inspect(files);
    const { env } = await import("cloudflare:workers"); const runtime = env as unknown as DropEnv;
    if (!runtime.DB || !runtime.BUCKET) return NextResponse.json({ error: "배포 저장소가 아직 연결되지 않았습니다. 잠시 후 다시 시도해 주세요." }, { status: 503 });
    const now = Date.now(); const projectId = id(); const deploymentId = id(); const slug = `${safeSlug(name)}-${projectId.slice(0, 6)}`; const storagePath = `projects/${projectId}/v1`; const publicUrl = `https://${slug}.00ai.kr`;
    await runtime.DB.batch([
      runtime.DB.prepare("INSERT INTO projects (id, slug, name, visibility, status, public_url, active_deployment_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(projectId, slug, name, visibility, "ready_for_domain", publicUrl, deploymentId, now, now),
      runtime.DB.prepare("INSERT INTO deployments (id, project_id, version, storage_path, file_count, total_size, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(deploymentId, projectId, 1, storagePath, files.length, totalSize, "stored", now),
    ]);
    try { await Promise.all(files.map((file) => runtime.BUCKET.put(`${storagePath}/${file.name}`, file.bytes, { httpMetadata: { contentType: file.type }, customMetadata: { originalName: file.name } }))); }
    catch (error) { await runtime.DB.prepare("UPDATE deployments SET status = ? WHERE id = ?").bind("failed", deploymentId).run(); throw error; }
    return NextResponse.json({ projectId, name, slug, publicUrl, status: "ready_for_domain", fileCount: files.length, totalSize }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "파일 저장 중 문제가 발생했습니다. 다시 시도해 주세요." }, { status: 400 }); }
}
