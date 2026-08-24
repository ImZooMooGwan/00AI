import { getIngestionStatus } from "@/lib/ingestion-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = await getIngestionStatus();
  return Response.json(status, {
    status: status.storage === "d1" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}

