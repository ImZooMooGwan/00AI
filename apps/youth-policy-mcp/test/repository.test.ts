import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";

import { D1PolicyRepository } from "../src/db/d1-repository";
import { sampleBundle, samplePolicy } from "./fixtures";

async function clearPolicyTables(): Promise<void> {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM policy_legal_bases"),
    env.DB.prepare("DELETE FROM policy_evidence"),
    env.DB.prepare("DELETE FROM policy_conditions"),
    env.DB.prepare("DELETE FROM policy_versions"),
    env.DB.prepare("DELETE FROM policies"),
    env.DB.prepare("DELETE FROM sync_runs"),
  ]);
}

describe("D1 policy repository", () => {
  beforeEach(clearPolicyTables);

  it("stores a current policy with evidence and a first version", async () => {
    const repository = new D1PolicyRepository(env.DB);
    const bundle = sampleBundle();
    const result = await repository.upsertPolicy(
      { ...bundle, rawResponse: { plcyNo: bundle.policy.sourcePolicyId } },
      bundle.policy.collectedAt,
    );
    expect(result.state).toBe("new");

    const stored = await repository.getBundle(bundle.policy.id);
    expect(stored?.policy.title).toBe(bundle.policy.title);
    expect(stored?.evidence).toHaveLength(1);
    expect(await repository.getVersions(bundle.policy.id)).toHaveLength(1);
  });

  it("does not create a duplicate version for the same source hash", async () => {
    const repository = new D1PolicyRepository(env.DB);
    const bundle = sampleBundle();
    const input = { ...bundle, rawResponse: { plcyNo: bundle.policy.sourcePolicyId } };
    await repository.upsertPolicy(input, bundle.policy.collectedAt);
    const result = await repository.upsertPolicy(input, "2026-08-25T00:00:00.000Z");
    expect(result.state).toBe("unchanged");
    expect(await repository.getVersions(bundle.policy.id)).toHaveLength(1);
  });

  it("creates a new version with field changes", async () => {
    const repository = new D1PolicyRepository(env.DB);
    const first = sampleBundle();
    await repository.upsertPolicy(
      { ...first, rawResponse: { amount: 20 } },
      first.policy.collectedAt,
    );
    const second = sampleBundle({
      supportDetails: "월 최대 30만원 지원",
      sourceHash: "b".repeat(64),
      collectedAt: "2026-08-25T00:00:00.000Z",
      lastSeenAt: "2026-08-25T00:00:00.000Z",
    });
    const result = await repository.upsertPolicy(
      { ...second, rawResponse: { amount: 30 } },
      second.policy.collectedAt,
    );
    expect(result.state).toBe("updated");
    expect(result.changes).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "supportDetails", impact: "major" })]),
    );
    expect(await repository.getVersions(first.policy.id)).toHaveLength(2);
  });

  it("filters by region without nationwide fallback for an unknown code", async () => {
    const repository = new D1PolicyRepository(env.DB);
    const bundle = sampleBundle();
    await repository.upsertPolicy(
      { ...bundle, rawResponse: { plcyNo: bundle.policy.sourcePolicyId } },
      bundle.policy.collectedAt,
    );
    const result = await repository.search({
      regionCodes: ["36"],
      asOf: "2026-08-24",
      page: 1,
      pageSize: 20,
    });
    expect(result.total).toBe(0);
  });

  it("reports database health and last sync", async () => {
    const repository = new D1PolicyRepository(env.DB);
    const id = await repository.startSync("youth_center", "2026-08-24T00:00:00Z");
    await repository.finishSync(id, {
      finishedAt: "2026-08-24T00:01:00Z",
      success: true,
      status: "succeeded",
      fetchedCount: 1,
      newCount: 1,
      updatedCount: 0,
      unchangedCount: 0,
      inactiveCount: 0,
      errorCount: 0,
      errorSummary: null,
    });
    const health = await repository.health();
    expect(health.connected).toBe(true);
    expect(health.lastSync?.status).toBe("succeeded");
  });

  it("never returns rows marked as mock data", async () => {
    const repository = new D1PolicyRepository(env.DB);
    const policy = samplePolicy({
      id: "mock:1",
      sourcePolicyId: "mock-1",
      isMock: true,
    });
    const bundle = sampleBundle(policy);
    await repository.upsertPolicy(
      { ...bundle, rawResponse: { id: "mock-1" } },
      policy.collectedAt,
    );
    const result = await repository.search({ asOf: "2026-08-24", page: 1, pageSize: 20 });
    expect(result.total).toBe(0);
  });
});
