import { NextResponse } from "next/server";

type ProjectEnv = { DB: D1Database };

export async function GET() {
  try {
    const { env } = await import("cloudflare:workers");
    const runtime = env as unknown as ProjectEnv;
    if (!runtime.DB) return NextResponse.json({ projects: [], available: false });
    const result = await runtime.DB.prepare(
      "SELECT slug, name, public_url, status, created_at FROM projects WHERE visibility = ? ORDER BY created_at DESC LIMIT 30"
    ).bind("public").all<{ slug: string; name: string; public_url: string; status: string; created_at: number }>();
    return NextResponse.json({ projects: result.results ?? [], available: true });
  } catch {
    return NextResponse.json({ projects: [], available: false });
  }
}
