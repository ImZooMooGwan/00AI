import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const response = await fetch("https://mcp.00ai.kr/youth/health", {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      return NextResponse.json(
        { service: { ok: false, detail: `MCP 응답 오류 · HTTP ${response.status}` } },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const data = await response.json() as {
      ok?: boolean;
      tools?: number;
      database?: { connected?: boolean; policy_count?: number; backend?: string };
      hasa?: { configured?: boolean; state?: string };
      last_sync_at?: string | null;
      last_sync_status?: string | null;
    };
    const ok = data.ok === true && data.database?.connected === true;
    const synced = data.last_sync_at
      ? new Date(data.last_sync_at).toLocaleString("ko-KR", {
          timeZone: "Asia/Seoul",
          month: "numeric",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "확인 정보 없음";
    const readTools = Math.max(0, (data.tools ?? 0) - 1);
    const detail = ok
      ? `MCP 연결 · 정책 ${data.database?.policy_count ?? 0}건 · 조회 도구 ${readTools}개 · HASA ${data.hasa?.configured ? "연결됨" : "키 미설정"} · 동기화 ${synced}`
      : "정책 MCP 연결 상태 확인 필요";
    return NextResponse.json(
      { service: { ok, detail, lastSyncStatus: data.last_sync_status ?? null } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { service: { ok: false, detail: "정책 MCP 상태 확인 시간 초과" } },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
