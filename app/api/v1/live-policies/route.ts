import { policies, sources } from "@/lib/data";
import { runCollection } from "@/lib/ingestion";
import {
  getExternalRecords,
  getIngestionStatus,
  getRuntimeEnvironment,
} from "@/lib/ingestion-store";
import {
  getYouthPolicyMcpConfiguration,
  searchYouthPoliciesViaMcp,
  YouthPolicyMcpError,
} from "@/lib/youth-policy-mcp";

export const dynamic = "force-dynamic";

const APPLICATION_STATUSES = new Set([
  "open",
  "closing_soon",
  "upcoming",
  "closed",
  "always_open",
  "unknown",
]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim();
  const requestedLimit = Number(url.searchParams.get("limit") ?? 100);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(500, Math.max(1, Math.trunc(requestedLimit)))
    : 100;
  const regionCodes = url.searchParams
    .getAll("region")
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
  const requestedAge = Number(url.searchParams.get("age"));
  const age =
    Number.isInteger(requestedAge) && requestedAge >= 0 && requestedAge <= 120
      ? requestedAge
      : undefined;
  const applicationStatus = url.searchParams.get("application_status");
  const asOf = url.searchParams.get("as_of");
  const runtime = getRuntimeEnvironment();

  let mcpConfigured = false;
  let mcpFailureCode: string | null = null;
  try {
    mcpConfigured = Boolean(getYouthPolicyMcpConfiguration(runtime).endpoint);
    if (mcpConfigured) {
      const result = await searchYouthPoliciesViaMcp(
        {
          ...(query ? { query } : {}),
          ...(regionCodes.length ? { regionCodes } : {}),
          ...(age !== undefined ? { age } : {}),
          ...(applicationStatus && APPLICATION_STATUSES.has(applicationStatus)
            ? {
                applicationStatus:
                  applicationStatus as
                    | "open"
                    | "closing_soon"
                    | "upcoming"
                    | "closed"
                    | "always_open"
                    | "unknown",
              }
            : {}),
          ...(asOf ? { asOf } : {}),
          page: 1,
          pageSize: Math.min(limit, 50),
        },
        runtime,
      );
      return Response.json(
        {
          meta: {
            apiVersion: "v1",
            generatedAt: result.generatedAt,
            recordCount: result.records.length,
            totalAvailable: result.total,
            provider: "youth-policy-mcp",
            persistence: "mcp-d1",
            fallbackUsed: false,
            asOf: result.asOf,
            warnings: result.warnings,
            sourceCount: result.sources.length,
            sourcePriority: [
              "youth-policy-mcp",
              "d1-official-connectors",
              "verified-snapshot",
            ],
          },
          data: result.records,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
  } catch (error) {
    mcpFailureCode =
      error instanceof YouthPolicyMcpError
        ? error.code
        : "MCP_UNAVAILABLE";
  }

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
    before.storage === "d1" &&
    youthConnector?.keyConfigured &&
    youthConnector.state !== "running" &&
    (stale || url.searchParams.get("refresh") === "1")
  ) {
    await runCollection("youth-center", runtime);
  }

  const status = await getIngestionStatus(runtime);
  const d1Records =
    status.storage === "d1"
      ? await getExternalRecords("policy", query ? 500 : limit, runtime)
      : [];
  const fallbackRecords = d1Records.length
    ? d1Records
    : verifiedSnapshotRecords();
  const normalizedQuery = query?.toLowerCase();
  const matchingRecords = normalizedQuery
    ? fallbackRecords.filter((record) =>
        [
          record.title,
          record.summary,
          record.organization,
          record.region,
          record.category,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery),
      )
    : fallbackRecords;
  const filtered = matchingRecords.slice(0, limit);
  const provider = d1Records.length
    ? "d1-official-connectors"
    : "verified-snapshot";

  return Response.json(
    {
      meta: {
        apiVersion: "v1",
        generatedAt: status.checkedAt,
        recordCount: filtered.length,
        provider,
        persistence: status.storage,
        fallbackUsed: true,
        mcp: {
          configured: mcpConfigured,
          state: mcpConfigured ? "unavailable" : "not_configured",
          failureCode: mcpFailureCode,
        },
        connectorStates: Object.fromEntries(
          status.connectors.map((connector) => [connector.id, connector.state]),
        ),
        sourcePriority: [
          "youth-policy-mcp",
          "d1-official-connectors",
          "verified-snapshot",
        ],
      },
      data: filtered,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function verifiedSnapshotRecords() {
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  return policies.map((policy) => {
    const source = sourceById.get(policy.sourceId);
    return {
      id: policy.id,
      sourceId: "verified-snapshot",
      sourceRecordId: policy.id,
      recordType: "policy",
      title: policy.officialName,
      summary: policy.summary,
      category: policy.category,
      region: policy.region,
      organization: policy.leadOrganization,
      canonicalUrl: source?.url ?? null,
      sourceUpdatedAt: source?.sourceUpdatedAt ?? null,
      firstSeenAt: policy.firstObservedAt,
      lastSeenAt: policy.lastObservedAt,
      applicationStatus: policy.status,
    };
  });
}
