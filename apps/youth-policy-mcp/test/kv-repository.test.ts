import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { KVPolicyRepository } from "../src/db/kv-repository";
import { sampleBundle } from "./fixtures";

function repositoryPair(): [KVPolicyRepository, () => KVPolicyRepository, string] {
  const prefix = `test-policy-store:${crypto.randomUUID()}`;
  return [
    new KVPolicyRepository(env.POLICY_STORE, prefix),
    () => new KVPolicyRepository(env.POLICY_STORE, prefix),
    prefix,
  ];
}

async function finishSuccessfulSync(repository: KVPolicyRepository, id: string): Promise<void> {
  await repository.finishSync(id, {
    finishedAt: "2026-08-24T00:01:00.000Z",
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
}

describe("KV policy repository", () => {
  it("publishes a snapshot that a new repository instance can search and read", async () => {
    const [writer, reader] = repositoryPair();
    const bundle = sampleBundle();
    const syncId = await writer.startSync("youth_center", bundle.policy.collectedAt);
    await writer.upsertPolicy(
      { ...bundle, rawResponse: { plcyNo: bundle.policy.sourcePolicyId } },
      bundle.policy.collectedAt,
    );
    await finishSuccessfulSync(writer, syncId);

    const fresh = reader();
    const health = await fresh.health();
    expect(health).toEqual(
      expect.objectContaining({ connected: true, policyCount: 1 }),
    );
    expect(health.lastSync?.status).toBe("succeeded");
    expect(
      await fresh.search({ query: "주거", asOf: "2026-08-24", page: 1, pageSize: 20 }),
    ).toEqual(expect.objectContaining({ total: 1 }));
    expect((await fresh.getBundle(bundle.policy.id))?.evidence).toHaveLength(1);
    expect(await fresh.getVersions(bundle.policy.id)).toHaveLength(1);
  });

  it("preserves version history across snapshot generations", async () => {
    const [firstWriter, reader] = repositoryPair();
    const first = sampleBundle();
    const firstSync = await firstWriter.startSync("youth_center", first.policy.collectedAt);
    await firstWriter.upsertPolicy(
      { ...first, rawResponse: { amount: 20 } },
      first.policy.collectedAt,
    );
    await finishSuccessfulSync(firstWriter, firstSync);

    const secondWriter = reader();
    const observedAt = "2026-08-25T00:00:00.000Z";
    const second = sampleBundle({
      supportDetails: "월 최대 30만원 지원",
      sourceHash: "b".repeat(64),
      collectedAt: observedAt,
      lastSeenAt: observedAt,
    });
    const secondSync = await secondWriter.startSync("youth_center", observedAt);
    const result = await secondWriter.upsertPolicy(
      { ...second, rawResponse: { amount: 30 } },
      observedAt,
    );
    await finishSuccessfulSync(secondWriter, secondSync);

    expect(result.state).toBe("updated");
    const versions = await reader().getVersions(first.policy.id);
    expect(versions).toHaveLength(2);
    expect(versions[0]?.validTo).toBe(observedAt);
  });

  it("treats an empty namespace as a healthy empty store", async () => {
    const [repository] = repositoryPair();
    await expect(repository.health()).resolves.toEqual({
      connected: true,
      policyCount: 0,
      lastSync: null,
    });
    await expect(
      repository.search({ asOf: "2026-08-24", page: 1, pageSize: 20 }),
    ).resolves.toEqual({ items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 });
  });

  it("falls back to the previous immutable snapshot during propagation", async () => {
    const [firstWriter, reader, prefix] = repositoryPair();
    const first = sampleBundle();
    const firstSync = await firstWriter.startSync("youth_center", first.policy.collectedAt);
    await firstWriter.upsertPolicy(
      { ...first, rawResponse: { amount: 20 } },
      first.policy.collectedAt,
    );
    await finishSuccessfulSync(firstWriter, firstSync);

    const observedAt = "2026-08-25T00:00:00.000Z";
    const secondWriter = reader();
    const secondSync = await secondWriter.startSync("youth_center", observedAt);
    await secondWriter.upsertPolicy(
      {
        ...sampleBundle({
          title: "변경된 청년 주거비 지원",
          sourceHash: "c".repeat(64),
          collectedAt: observedAt,
          lastSeenAt: observedAt,
        }),
        rawResponse: { amount: 30 },
      },
      observedAt,
    );
    await finishSuccessfulSync(secondWriter, secondSync);

    const root = await env.POLICY_STORE.get<{
      currentDescriptorKey: string;
      previousDescriptorKey: string;
    }>(`${prefix}:root`, "json");
    expect(root?.previousDescriptorKey).toBeTruthy();
    await env.POLICY_STORE.delete(root!.currentDescriptorKey);

    expect((await reader().getBundle(first.policy.id))?.policy.title).toBe(first.policy.title);
  });
});
