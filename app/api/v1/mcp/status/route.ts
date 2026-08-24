import { getYouthPolicyMcpStatus } from "@/lib/youth-policy-mcp";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await getYouthPolicyMcpStatus(), {
    headers: { "Cache-Control": "no-store" },
  });
}
