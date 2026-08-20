export interface Env { DB: D1Database; BUCKET: R2Bucket; }

const MIME_FALLBACK = "application/octet-stream";
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Cross-Origin-Opener-Policy": "same-origin",
};

function response(body: BodyInit | null, init: ResponseInit = {}) {
  const headers = new Headers(init.headers); Object.entries(SECURITY_HEADERS).forEach(([key, value]) => headers.set(key, value));
  return new Response(body, { ...init, headers });
}
function validPath(path: string) {
  return path && !path.startsWith("/") && !path.includes("..") && !path.includes("\\") && !path.split("/").some((part) => !part || part === ".");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") return response("Method Not Allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
    const url = new URL(request.url); const [slug] = url.hostname.split(".");
    if (!/^[a-z0-9-]{3,63}$/.test(slug)) return response("Not Found", { status: 404 });
    const project = await env.DB.prepare("SELECT id, visibility, status, active_deployment_id FROM projects WHERE slug = ?").bind(slug).first<{ id: string; visibility: string; status: string; active_deployment_id: string | null }>();
    if (!project || project.visibility === "private" || project.status === "disabled") return response("Not Found", { status: 404 });
    const deployment = project.active_deployment_id
      ? await env.DB.prepare("SELECT storage_path FROM deployments WHERE id = ? AND project_id = ? AND status = ?").bind(project.active_deployment_id, project.id, "stored").first<{ storage_path: string }>()
      : await env.DB.prepare("SELECT storage_path FROM deployments WHERE project_id = ? AND status = ? ORDER BY version DESC LIMIT 1").bind(project.id, "stored").first<{ storage_path: string }>();
    if (!deployment) return response("Deployment not ready", { status: 503 });
    const requested = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
    if (!validPath(requested)) return response("Bad Request", { status: 400 });
    let object = await env.BUCKET.get(`${deployment.storage_path}/${requested}`);
    if (!object && !requested.includes(".")) object = await env.BUCKET.get(`${deployment.storage_path}/index.html`);
    if (!object) return response("Not Found", { status: 404 });
    const headers = new Headers(); object.writeHttpMetadata(headers); headers.set("ETag", object.httpEtag); headers.set("Cache-Control", requested === "index.html" ? "no-cache" : "public, max-age=31536000, immutable");
    headers.set("Content-Type", headers.get("Content-Type") || MIME_FALLBACK);
    return response(request.method === "HEAD" ? null : object.body, { headers });
  },
} satisfies ExportedHandler<Env>;
