import { changes, getPolicy, snapshot, sources } from "@/lib/data";

export function GET(request: Request) {
  const url = new URL(request.url);
  const region = url.searchParams.get("region");
  const type = url.searchParams.get("type");
  const verification = url.searchParams.get("verification_status");
  const data = changes.filter((change) => (!type || change.type === type) && (!verification || change.verificationStatus === verification) && (!region || getPolicy(change.policyId)?.regionCode === region));
  return Response.json({ meta: { apiVersion: "v1", datasetVersion: snapshot.datasetVersion, generatedAt: new Date().toISOString(), recordCount: data.length, sourceCount: sources.length, license: "source-specific", nextCursor: null }, data });
}

