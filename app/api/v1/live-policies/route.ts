import {
  getExternalRecords,
  getIngestionStatus,
  getRuntimeEnvironment,
} from "@/lib/ingestion-store";
import { runCollection } from "@/lib/ingestion";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim().toLowerCase();
  const limit = Number(url.searchParams.get("limit") ?? 100);
  const runtime = getRuntimeEnvironment();
  const before = await getIngestionStatus(runtime);
  const youthConnector = before.connectors.find(
    (connector) => connector.id === "youth-center",
  );
  const intervalMinutes = Math.max(
    15,
    Number(runtime.COLLECTION_INTERVAL_MINUTES ?? 60),
  );
  const stale =
    !youthConnector?.lastSuccessAt ||
    Date.now() - new Date(youthConnector.lastSuccessAt).getTime() >
      intervalMinutes * 60_000;
  if (
    youthConnector?.keyConfigured &&
    youthConnector.state !== "running" &&
    (stale || url.searchParams.get("refresh") === "1")
  ) {
    await runCollection("youth-center", runtime);
  }
  const [records, status] = await Promise.all([
    getExternalRecords("policy", limit, runtime),
    getIngestionStatus(runtime),
  ]);
  const filtered = query
    ? records.filter((record) =>
        [record.title, record.summary, record.organization, record.region]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query),
      )
    : records;
  return Response.json(
    {
      meta: {
        apiVersion: "v1",
        generatedAt: status.checkedAt,
        recordCount: filtered.length,
        persistence: status.storage,
        connectorStates: Object.fromEntries(
          status.connectors.map((connector) => [connector.id, connector.state]),
        ),
      },
      data: filtered,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
