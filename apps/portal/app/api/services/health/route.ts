import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Probe = {
  key: string;
  url: string;
  kind?: "yhub";
};

const probes: Probe[] = [
  { key: "WORKSPACE", url: "https://00ai.kr/workspace/" },
  { key: "HARNESS", url: "https://harness.00ai.kr/" },
  { key: "GOV_AGENT", url: "https://00ai.kr/gov-agent/" },
  { key: "POLICY", url: "https://policy.00ai.kr/" },
  { key: "YHUB", url: "https://yhub.00ai.kr/api/v1/mcp/status", kind: "yhub" },
  { key: "TIME", url: "https://otgeunmu-check-alarm.nextrunners-6559.chatgpt.site/" },
];

async function check(probe: Probe): Promise<{ ok: boolean; detail: string }> {
  try {
    const response = await fetch(probe.url, {
      method: "GET",
      headers: probe.kind === "yhub" ? { Accept: "application/json" } : { Accept: "text/html" },
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) {
      return { ok: false, detail: `응답 오류 · HTTP ${response.status}` };
    }
    if (response.url.toLowerCase().includes("signin-with-chatgpt")) {
      return { ok: false, detail: "로그인 또는 공개 권한 확인 필요" };
    }
    if (probe.kind === "yhub") {
      const data = await response.json() as {
        state?: string;
        ready?: boolean;
        toolCount?: number;
        database?: { policyCount?: number };
        lastSyncAt?: string | null;
      };
      const ok = data.state === "connected" && data.ready === true;
      const sync = data.lastSyncAt
        ? new Date(data.lastSyncAt).toLocaleString("ko-KR", {
            timeZone: "Asia/Seoul",
            month: "numeric",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "확인 정보 없음";
      const policyCount = data.database?.policyCount ?? 0;
      const tools = data.toolCount ?? 0;
      return {
        ok,
        detail: ok
          ? `MCP 연결 · 정책 ${policyCount}건 · 도구 ${tools}개 · 동기화 ${sync}`
          : "MCP 연결 상태 확인 필요",
      };
    }
    return { ok: true, detail: "웹 화면 응답 정상" };
  } catch {
    return { ok: false, detail: "응답 시간 초과 또는 연결 실패" };
  }
}

export async function GET() {
  const results = await Promise.all(probes.map(async (probe) => [probe.key, await check(probe)] as const));
  return NextResponse.json(
    { checkedAt: new Date().toISOString(), services: Object.fromEntries(results) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
