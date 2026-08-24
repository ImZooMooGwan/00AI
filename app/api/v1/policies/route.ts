import { policies, snapshot, sources } from "@/lib/data";

export function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.toLowerCase();
  const region = url.searchParams.get("region");
  const category = url.searchParams.get("category");
  const status = url.searchParams.get("status");
  const verification = url.searchParams.get("verification_status");
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("page_size") ?? 50)));
  const filtered = policies.filter((policy) => (!q || [policy.officialName, policy.summary, ...policy.lifeSituations].join(" ").toLowerCase().includes(q)) && (!region || policy.regionCode === region) && (!category || policy.category === category) && (!status || policy.status === status) && (!verification || policy.verificationStatus === verification));
  const start = (page - 1) * pageSize;
  return Response.json({ meta: { apiVersion: "v1", datasetVersion: snapshot.datasetVersion, generatedAt: new Date().toISOString(), recordCount: filtered.length, sourceCount: sources.length, license: "source-specific", nextCursor: start + pageSize < filtered.length ? String(page + 1) : null }, data: filtered.slice(start, start + pageSize) }, { headers: { "Cache-Control": "public, max-age=300" } });
}

