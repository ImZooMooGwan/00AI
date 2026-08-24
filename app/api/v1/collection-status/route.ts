import { getIngestionStatus } from "@/lib/ingestion-store";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await getIngestionStatus(), {
    headers: { "Cache-Control": "no-store" },
  });
}

