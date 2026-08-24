import { changes, indicators, policies, snapshot, sources } from "@/lib/data";

function quote(value: unknown) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }

export function GET(request: Request) {
  const format = new URL(request.url).searchParams.get("format") ?? "json";
  if (format === "csv") {
    const columns = ["id", "officialName", "category", "scope", "region", "leadOrganization", "status", "verificationStatus", "age", "benefit", "applicationPeriod", "sourceId"] as const;
    const csv = [columns.join(","), ...policies.map((policy) => columns.map((column) => quote(policy[column])).join(","))].join("\n");
    return new Response(`\uFEFF${csv}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="yhub-policies-${snapshot.basisDate}.csv"` } });
  }
  const body = { meta: { datasetVersion: snapshot.datasetVersion, generatedAt: snapshot.generatedAt, recordCount: policies.length, sourceCount: sources.length, license: "source-specific" }, policies, changes, indicators, sources };
  return new Response(JSON.stringify(body, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="yhub-dataset-${snapshot.basisDate}.json"` } });
}

