import { runAllCollections, runCollection } from "@/lib/ingestion";
import {
  getIngestionStatus,
  getRuntimeEnvironment,
} from "@/lib/ingestion-store";
import type { ConnectorId } from "@/lib/ingestion-types";

export const dynamic = "force-dynamic";

const SOURCES = new Set<ConnectorId>(["youth-center", "kosis", "law"]);

export async function POST(request: Request) {
  const runtime = getRuntimeEnvironment();
  if (!isAuthorized(request, runtime.SYNC_SECRET)) {
    return Response.json(
      { error: "동기화 권한이 없습니다." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const source = new URL(request.url).searchParams.get("source") ?? "all";
  if (source !== "all" && !SOURCES.has(source as ConnectorId)) {
    return Response.json(
      { error: "지원하지 않는 원천입니다." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const results =
    source === "all"
      ? await runAllCollections(runtime)
      : [await runCollection(source as ConnectorId, runtime)];
  const status = await getIngestionStatus(runtime);
  return Response.json(
    { syncedAt: new Date().toISOString(), results, status },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function isAuthorized(request: Request, configuredSecret: unknown) {
  if (request.headers.get("oai-authenticated-user-email")) return true;
  if (typeof configuredSecret !== "string" || !configuredSecret) return false;
  const authorization = request.headers.get("authorization");
  return authorization === `Bearer ${configuredSecret}`;
}

