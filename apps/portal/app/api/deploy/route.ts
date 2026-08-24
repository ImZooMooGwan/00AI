import { NextResponse } from "next/server";

const DROP_FUNCTION_URL =
  "https://jbxmjsezaaqarheyjjte.supabase.co/functions/v1/zeroai-drop";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpieG1qc2V6YWFxYXJoZXlqanRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3Nzc2MzUsImV4cCI6MjEwMTM1MzYzNX0.ZEoudIFSGGFSVhXpNc4Vf_Obv884mQQLS_9qhaWzxHI";

function authHeaders() {
  return {
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    apikey: SUPABASE_ANON_KEY,
    Accept: "application/json",
  };
}

export async function GET() {
  try {
    const response = await fetch(DROP_FUNCTION_URL, {
      method: "GET",
      headers: authHeaders(),
      cache: "no-store",
    });
    const result = await response.json();
    return NextResponse.json(
      {
        available: response.ok && result?.available !== false,
        storage: "supabase",
        count: result?.count ?? 0,
      },
      {
        status: response.ok ? 200 : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch {
    return NextResponse.json(
      { available: false, storage: "supabase" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function POST(request: Request) {
  try {
    const source = await request.formData();
    const forwarded = new FormData();

    for (const key of [
      "organization",
      "uploaderName",
      "name",
      "description",
      "visibility",
    ]) {
      const value = source.get(key);
      if (typeof value === "string") forwarded.append(key, value);
    }

    for (const item of source.getAll("files")) {
      if (item instanceof File) forwarded.append("files", item, item.name);
    }

    const response = await fetch(DROP_FUNCTION_URL, {
      method: "POST",
      headers: authHeaders(),
      body: forwarded,
      cache: "no-store",
    });

    const text = await response.text();
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(text) as Record<string, unknown>;
    } catch {
      payload = {
        error: response.ok
          ? "배포 응답을 읽지 못했습니다."
          : `배포 저장소 오류 (${response.status})`,
      };
    }

    if (response.ok && typeof payload.slug === "string") {
      payload.publicUrl = `https://drop.00ai.kr/${encodeURIComponent(payload.slug)}/`;
    }

    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `배포 저장소 연결 실패: ${error.message}`
            : "배포 저장소에 연결하지 못했습니다.",
      },
      { status: 502 },
    );
  }
}
