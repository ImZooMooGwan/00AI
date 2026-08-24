import { getIngestionStatus } from "@/lib/ingestion-store";
import { getYouthPolicyMcpStatus } from "@/lib/youth-policy-mcp";

export const dynamic = "force-dynamic";

export async function GET() {
  const [ingestion, youthPolicyMcp] = await Promise.all([
    getIngestionStatus(),
    getYouthPolicyMcpStatus(),
  ]);
  return Response.json({ ...ingestion, youthPolicyMcp }, {
    status: ingestion.storage === "d1" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
