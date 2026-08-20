import { NextResponse } from "next/server";

type DropEnv = { DB: D1Database; DROP_ADMIN_TOKEN?: string };

function authorized(request: Request, expected: string | undefined) {
  const supplied = request.headers.get("authorization");
  return Boolean(expected && supplied === `Bearer ${expected}`);
}

export async function POST(request: Request) {
  try {
    const { env } = await import("cloudflare:workers");
    const runtime = env as unknown as DropEnv;
    if (!runtime.DB || !authorized(request, runtime.DROP_ADMIN_TOKEN)) return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 401 });
    const body = await request.json() as { projectId?: string; deploymentId?: string };
    if (!body.projectId || !body.deploymentId) return NextResponse.json({ error: "프로젝트와 배포 버전이 필요합니다." }, { status: 400 });
    const target = await runtime.DB.prepare("SELECT id FROM deployments WHERE id = ? AND project_id = ? AND status = ?").bind(body.deploymentId, body.projectId, "stored").first<{ id: string }>();
    if (!target) return NextResponse.json({ error: "되돌릴 수 있는 배포 버전을 찾지 못했습니다." }, { status: 404 });
    await runtime.DB.prepare("UPDATE projects SET active_deployment_id = ?, updated_at = ? WHERE id = ?").bind(target.id, Date.now(), body.projectId).run();
    return NextResponse.json({ projectId: body.projectId, activeDeploymentId: target.id, status: "restored" });
  } catch {
    return NextResponse.json({ error: "버전 되돌리기를 완료하지 못했습니다." }, { status: 400 });
  }
}
