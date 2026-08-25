import { calculateApplicationStatus } from "../domain/date";
import { diffPolicies } from "../domain/changes";
import { regionMatches } from "../domain/regions";
import type {
  PolicyBundle,
  PolicyRepository,
  PolicyVersion,
  RepositoryHealth,
  SearchCriteria,
  SearchPage,
  SyncSummary,
  UpsertPolicyInput,
  UpsertPolicyResult,
} from "../domain/types";
import { normalizeSearchText, policySearchText } from "./serialization";

export class MemoryPolicyRepository implements PolicyRepository {
  readonly bundles = new Map<string, PolicyBundle>();
  readonly versions = new Map<string, PolicyVersion[]>();
  readonly syncRuns = new Map<string, SyncSummary>();

  constructor(initial: PolicyBundle[] = []) {
    for (const bundle of initial) this.bundles.set(bundle.policy.id, structuredClone(bundle));
  }

  async health(): Promise<RepositoryHealth> {
    const lastSync = [...this.syncRuns.values()].sort((left, right) =>
      right.startedAt.localeCompare(left.startedAt),
    )[0] ?? null;
    return { connected: true, policyCount: this.bundles.size, lastSync };
  }

  async search(criteria: SearchCriteria): Promise<SearchPage> {
    const queryTokens = (criteria.query ?? "")
      .split(/\s+/)
      .map(normalizeSearchText)
      .filter(Boolean)
      .slice(0, 8);
    const filtered = [...this.bundles.values()]
      .filter(({ policy }) => !policy.isMock && policy.currentStatus === "active")
      .filter(({ policy }) => {
        const searchText = policySearchText(policy);
        return queryTokens.every((token) => searchText.includes(token));
      })
      .filter(
        ({ policy }) =>
          !criteria.regionCodes || regionMatches(policy.regionCodes, criteria.regionCodes),
      )
      .filter(
        ({ policy }) =>
          !criteria.largeCategories?.length ||
          (policy.largeCategory !== null && criteria.largeCategories.includes(policy.largeCategory)),
      )
      .filter(
        ({ policy }) =>
          !criteria.mediumCategories?.length ||
          (policy.mediumCategory !== null && criteria.mediumCategories.includes(policy.mediumCategory)),
      )
      .filter(
        ({ policy }) =>
          criteria.age === undefined ||
          ((policy.ageMin === null || criteria.age >= policy.ageMin) &&
            (policy.ageMax === null || criteria.age <= policy.ageMax)),
      )
      .filter(
        ({ policy }) =>
          !criteria.employmentStatus ||
          policy.employmentStatuses.length === 0 ||
          policy.employmentStatuses.some((status) =>
            status.replace(/\s+/g, "").includes(criteria.employmentStatus?.replace(/\s+/g, "") ?? ""),
          ),
      )
      .filter(
        ({ policy }) =>
          !criteria.applicationStatus ||
          calculateApplicationStatus(policy, criteria.asOf) === criteria.applicationStatus,
      )
      .sort((left, right) => left.policy.title.localeCompare(right.policy.title, "ko"));

    const offset = (criteria.page - 1) * criteria.pageSize;
    const items = filtered.slice(offset, offset + criteria.pageSize).map(({ policy }) => ({
      policy: structuredClone(policy),
      matchingReasons: buildMatchingReasons(policy, criteria),
    }));
    return {
      items,
      total: filtered.length,
      page: criteria.page,
      pageSize: criteria.pageSize,
      totalPages: Math.ceil(filtered.length / criteria.pageSize),
    };
  }

  async getBundle(policyId: string, asOf?: string): Promise<PolicyBundle | null> {
    if (asOf) {
      const version = (this.versions.get(policyId) ?? []).find(
        (item) => item.validFrom.slice(0, 10) <= asOf && (!item.validTo || item.validTo.slice(0, 10) > asOf),
      );
      const current = this.bundles.get(policyId);
      if (version && current) return { ...structuredClone(current), policy: structuredClone(version.normalizedData) };
    }
    const bundle = this.bundles.get(policyId);
    return bundle ? structuredClone(bundle) : null;
  }

  async getBundles(policyIds: string[], asOf?: string): Promise<PolicyBundle[]> {
    const bundles = await Promise.all(policyIds.map((id) => this.getBundle(id, asOf)));
    return bundles.filter((bundle): bundle is PolicyBundle => bundle !== null);
  }

  async getVersions(policyId: string, from?: string, to?: string): Promise<PolicyVersion[]> {
    return structuredClone(
      (this.versions.get(policyId) ?? []).filter(
        (version) => (!from || version.validFrom.slice(0, 10) >= from) && (!to || version.validFrom.slice(0, 10) <= to),
      ),
    );
  }

  async upsertPolicy(input: UpsertPolicyInput, observedAt: string): Promise<UpsertPolicyResult> {
    const existing =
      this.bundles.get(input.policy.id) ??
      [...this.bundles.values()].find(
        ({ policy }) =>
          policy.source === input.policy.source &&
          policy.sourcePolicyId === input.policy.sourcePolicyId,
      );
    if (existing?.policy.sourceHash === input.policy.sourceHash) {
      existing.policy.collectedAt = observedAt;
      existing.policy.lastSeenAt = observedAt;
      existing.policy.missingCount = 0;
      existing.policy.currentStatus = "active";
      return { state: "unchanged", changes: [] };
    }

    const policy = existing
      ? {
          ...input.policy,
          id: existing.policy.id,
          firstSeenAt: existing.policy.firstSeenAt,
        }
      : input.policy;
    const changes = existing ? diffPolicies(existing.policy, policy) : [];
    const currentVersions = this.versions.get(policy.id) ?? [];
    if (currentVersions.length > 0) currentVersions[currentVersions.length - 1]!.validTo = observedAt;
    currentVersions.push({
      id: `${policy.id}:v${currentVersions.length + 1}`,
      policyId: policy.id,
      version: currentVersions.length + 1,
      validFrom: observedAt,
      validTo: null,
      normalizedData: structuredClone(policy),
      rawResponse: structuredClone(input.rawResponse),
      diff: structuredClone(changes),
      sourceHash: policy.sourceHash,
      createdAt: observedAt,
    });
    this.versions.set(policy.id, currentVersions);
    this.bundles.set(policy.id, {
      policy: structuredClone(policy),
      conditions: structuredClone(
        input.conditions.map((condition) => ({ ...condition, policyId: policy.id })),
      ),
      evidence: structuredClone(
        input.evidence.map((item) => ({ ...item, policyId: policy.id })),
      ),
      legalBases: structuredClone(
        input.legalBases.map((basis) => ({ ...basis, policyId: policy.id })),
      ),
    });
    return { state: existing ? "updated" : "new", changes };
  }

  async upsertPolicies(
    inputs: UpsertPolicyInput[],
    observedAt: string,
  ): Promise<UpsertPolicyResult[]> {
    const results: UpsertPolicyResult[] = [];
    for (const input of inputs) results.push(await this.upsertPolicy(input, observedAt));
    return results;
  }

  async markMissing(source: string, observedBefore: string, threshold: number): Promise<number> {
    let count = 0;
    for (const bundle of this.bundles.values()) {
      if (bundle.policy.source !== source || bundle.policy.lastSeenAt >= observedBefore) continue;
      bundle.policy.missingCount += 1;
      if (bundle.policy.missingCount >= threshold && bundle.policy.currentStatus === "active") {
        bundle.policy.currentStatus = "source_missing";
        count += 1;
      }
    }
    return count;
  }

  async startSync(source: string, startedAt: string): Promise<string> {
    const id = crypto.randomUUID();
    this.syncRuns.set(id, {
      id,
      source,
      startedAt,
      finishedAt: null,
      success: null,
      status: "running",
      fetchedCount: 0,
      newCount: 0,
      updatedCount: 0,
      unchangedCount: 0,
      inactiveCount: 0,
      errorCount: 0,
      errorSummary: null,
    });
    return id;
  }

  async finishSync(
    id: string,
    summary: Omit<SyncSummary, "id" | "source" | "startedAt">,
  ): Promise<void> {
    const run = this.syncRuns.get(id);
    if (!run) return;
    this.syncRuns.set(id, { ...run, ...summary });
  }
}

function buildMatchingReasons(policy: PolicyBundle["policy"], criteria: SearchCriteria): string[] {
  const reasons: string[] = [];
  if (criteria.query) reasons.push(`검색어 '${criteria.query}'와 정책명·설명·지원내용이 일치`);
  if (criteria.regionCodes) reasons.push("요청한 지역과 적용지역이 일치");
  if (criteria.age !== undefined) reasons.push("입력 연령이 명시된 연령 범위에 포함");
  if (criteria.largeCategories?.length || criteria.mediumCategories?.length) reasons.push("정책 분류가 일치");
  if (criteria.applicationStatus) reasons.push(`신청상태가 ${calculateApplicationStatus(policy, criteria.asOf)}`);
  return reasons.length > 0 ? reasons : ["활성 청년정책"];
}
