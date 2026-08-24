import { NextRequest } from "next/server";

const DROP_SERVE_URL =
  "https://jbxmjsezaaqarheyjjte.supabase.co/functions/v1/zeroai-drop-serve";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpieG1qc2V6YWFxYXJoZXlqanRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3Nzc2MzUsImV4cCI6MjEwMTM1MzYzNX0.ZEoudIFSGGFSVhXpNc4Vf_Obv884mQQLS_9qhaWzxHI";

function authHeaders() {
  return {
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    apikey: SUPABASE_ANON_KEY,
  };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  if (!path?.length) return new Response("Not Found", { status: 404 });

  const encodedPath = path.map(encodeURIComponent).join("/");
  const upstream = new URL(`${DROP_SERVE_URL}/${encodedPath}`);
  upstream.search = request.nextUrl.search;

  const response = await fetch(upstream, {
    headers: authHeaders(),
    cache: "no-store",
  });

  const headers = new Headers(response.headers);
  headers.delete("set-cookie");
  headers.set("Cache-Control", "public, max-age=60, s-maxage=300");
  headers.set("X-00AI-Origin", "DROP");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function HEAD(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const response = await GET(request, context);
  return new Response(null, { status: response.status, headers: response.headers });
}
