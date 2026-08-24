import { changes, indicators, policies, regions, snapshot, sources } from "@/lib/data";

const resources: Record<string, unknown[]> = {
  programs: policies.map((policy) => ({ id: policy.programId, policyFamilyId: policy.id, title: policy.officialName, organization: policy.leadOrganization, regionCodes: [policy.regionCode], verificationStatus: policy.verificationStatus })),
  rounds: policies.map((policy) => ({ id: policy.roundId, programId: policy.programId, applicationPeriod: policy.applicationPeriod, status: policy.status, sourceIds: [policy.sourceId] })),
  regions,
  organizations: Array.from(new Set(policies.map((policy) => policy.leadOrganization))).map((name, index) => ({ id: `YH-ORG-${String(index + 1).padStart(3, "0")}`, name })),
  "legal-bases": Array.from(new Set(policies.map((policy) => policy.legalBasis))).map((title, index) => ({ id: `YH-LAW-${String(index + 1).padStart(3, "0")}`, title, verificationStatus: title.includes("공식") ? "partially_verified" : "review_required" })),
  sources,
  "verification-issues": policies.filter((policy) => policy.verificationStatus !== "verified").map((policy) => ({ id: `YH-ISS-${policy.id.slice(-4)}`, policyId: policy.id, type: policy.verificationStatus === "review_required" ? "LATEST_ROUND_REQUIRED" : "FIELD_VERIFICATION_PENDING", status: "OPEN" })),
  graph: [{ nodes: policies.map((policy) => ({ id: policy.id, label: policy.officialName, category: policy.category, region: policy.region })), edges: policies.slice(1).map((policy, index) => ({ id: `YH-EDGE-${index + 1}`, source: policies[index % policies.length].id, target: policy.id, type: policies[index % policies.length].category === policy.category ? "SAME_CATEGORY" : "RELATED_CANDIDATE", verificationStatus: "machine_detected" })) }],
  datasets: [{ id: snapshot.datasetVersion, title: `Y-HUB Dataset ${snapshot.basisDate.replaceAll("-", ".")}`, generatedAt: snapshot.generatedAt, policyCount: policies.length, changeCount: changes.length, indicatorCount: indicators.length, sourceCount: sources.length }],
};

export async function GET(_request: Request, { params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params;
  const data = resources[resource];
  if (!data) return Response.json({ error: "RESOURCE_NOT_FOUND", resource }, { status: 404 });
  return Response.json({ meta: { apiVersion: "v1", datasetVersion: snapshot.datasetVersion, generatedAt: new Date().toISOString(), recordCount: data.length, sourceCount: sources.length, license: "source-specific", nextCursor: null }, data });
}

