import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import type { PolicyRepository } from "../src/domain/types";
import { sampleBundle } from "./fixtures";

function store(): PolicyRepository {
  return env.POLICY_STORE_DO.getByName(
    `test:${crypto.randomUUID()}`,
  ) as unknown as PolicyRepository;
}

describe("Durable Object policy store", () => {
  it("starts as a healthy empty SQLite store", async () => {
    await expect(store().health()).resolves.toEqual({
      connected: true,
      policyCount: 0,
      lastSync: null,
    });
  });

  it("stores current policy data, evidence, and version history", async () => {
    const stub = store();
    const first = sampleBundle();
    const result = await stub.upsertPolicy(
      { ...first, rawResponse: { amount: 20 } },
      first.policy.collectedAt,
    );

    expect(result.state).toBe("new");
    expect((await stub.getBundle(first.policy.id))?.evidence).toHaveLength(1);
    expect(await stub.getVersions(first.policy.id)).toHaveLength(1);
    await expect(
      stub.search({ query: "청년 주거", asOf: "2026-08-24", page: 1, pageSize: 20 }),
    ).resolves.toEqual(expect.objectContaining({ total: 1 }));
  });

  it("preserves historical versions and first-seen identity", async () => {
    const stub = store();
    const first = sampleBundle();
    await stub.upsertPolicy(
      { ...first, rawResponse: { amount: 20 } },
      first.policy.collectedAt,
    );

    const observedAt = "2026-08-25T00:00:00.000Z";
    const second = sampleBundle({
      supportDetails: "월 최대 30만원 지원",
      sourceHash: "b".repeat(64),
      collectedAt: observedAt,
      firstSeenAt: observedAt,
      lastSeenAt: observedAt,
    });
    const result = await stub.upsertPolicy(
      { ...second, rawResponse: { amount: 30 } },
      observedAt,
    );

    expect(result.state).toBe("updated");
    const versions = await stub.getVersions(first.policy.id);
    expect(versions).toHaveLength(2);
    expect(versions[0]?.validTo).toBe(observedAt);
    expect((await stub.getBundle(first.policy.id))?.policy.firstSeenAt).toBe(
      first.policy.firstSeenAt,
    );
    expect(
      (await stub.getBundle(first.policy.id, "2026-08-24"))?.policy.supportDetails,
    ).toBe(first.policy.supportDetails);
  });

  it("records synchronization health without exposing secrets", async () => {
    const stub = store();
    const id = await stub.startSync("youth_center", "2026-08-24T00:00:00.000Z");
    await stub.finishSync(id, {
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

    const health = await stub.health();
    expect(health.lastSync?.status).toBe("succeeded");
    expect(health.lastSync?.id).toBe(id);
  });
});
