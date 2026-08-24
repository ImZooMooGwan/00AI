import { getPolicy, getSource, snapshot } from "@/lib/data";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const policy = getPolicy(id);
  if (!policy) return Response.json({ error: "POLICY_NOT_FOUND", id }, { status: 404 });
  return Response.json({ meta: { apiVersion: "v1", datasetVersion: snapshot.datasetVersion, generatedAt: new Date().toISOString(), recordCount: 1, sourceCount: 1, license: "source-specific", nextCursor: null }, data: { ...policy, source: getSource(policy.sourceId) } });
}

