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

const MAX_FILES = 1000;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([
  ".zip", ".html", ".htm", ".css", ".js", ".mjs", ".json",
  ".svg", ".png", ".jpg", ".jpeg", ".webp", ".woff", ".woff2",
]);

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_FILE_BYTES + 5 * 1024 * 1024) {
    return jsonError("요청 크기가 너무 큽니다. 전체 파일은 50MB 이하로 올려주세요.", 413);
  }

  let source: FormData;
  try {
    source = await request.formData();
  } catch {
    return jsonError("업로드 요청을 읽지 못했습니다. 파일 형식을 확인해 주세요.", 400);
  }

  const organization = source.get("organization");
  const uploaderName = source.get("uploaderName");
  const name = source.get("name");
  const description = source.get("description");
  if (typeof organization !== "string" || !organization.trim() || organization.length > 80) {
    return jsonError("소속을 1~80자 이내로 입력해 주세요.", 400);
  }
  if (typeof uploaderName !== "string" || !uploaderName.trim() || uploaderName.length > 40) {
    return jsonError("성명을 1~40자 이내로 입력해 주세요.", 400);
  }
  if (typeof name !== "string" || !name.trim() || name.length > 80) {
    return jsonError("서비스 이름을 1~80자 이내로 입력해 주세요.", 400);
  }
  if (typeof description !== "string" || description.trim().length < 5 || description.length > 600) {
    return jsonError("서비스 설명을 5~600자 이내로 입력해 주세요.", 400);
  }

  const files = source.getAll("files").filter((item): item is File => item instanceof File);
  if (!files.length) return jsonError("업로드할 파일을 선택해 주세요.", 400);
  if (files.length > MAX_FILES) return jsonError(`파일은 최대 ${MAX_FILES.toLocaleString()}개까지 올릴 수 있습니다.`, 413);
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > MAX_FILE_BYTES) return jsonError("전체 파일 크기는 50MB 이하여야 합니다.", 413);

  const unsupported = files.find((file) => {
    const fileName = file.name.toLowerCase();
    const dot = fileName.lastIndexOf(".");
    return dot < 0 || !ALLOWED_EXTENSIONS.has(fileName.slice(dot));
  });
  if (unsupported) return jsonError(`지원하지 않는 파일 형식입니다: ${unsupported.name}`, 415);

  const forwarded = new FormData();
  forwarded.append("organization", organization.trim());
  forwarded.append("uploaderName", uploaderName.trim());
  forwarded.append("name", name.trim());
  forwarded.append("description", description.trim());
  forwarded.append("visibility", "public");
  for (const file of files) forwarded.append("files", file, file.name);

  try {
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

    if (response.ok) {
      if (typeof payload.slug !== "string") {
        return jsonError("배포 저장소가 공개 주소를 반환하지 않았습니다. 파일을 중복 등록하기 전에 운영자에게 문의해 주세요.", 502);
      }
      const slug = payload.slug.toLowerCase();
      if (!/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/.test(slug)) {
        return jsonError("배포 저장소가 올바르지 않은 서비스 주소를 반환했습니다. 운영자에게 문의해 주세요.", 502);
      }
      payload.publicUrl = `https://${slug}.00ai.kr/`;
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
