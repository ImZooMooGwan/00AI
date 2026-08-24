import type { YouthPolicyStore } from "./policy-store-do";
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

const STORE_NAME = "youth_center";

export class DurableObjectPolicyRepository implements PolicyRepository {
  private readonly stub: DurableObjectStub<YouthPolicyStore>;

  constructor(namespace: DurableObjectNamespace<YouthPolicyStore>) {
    this.stub = namespace.getByName(STORE_NAME);
  }

  health(): Promise<RepositoryHealth> {
    return this.stub.health();
  }

  search(criteria: SearchCriteria): Promise<SearchPage> {
    return this.stub.search(criteria);
  }

  getBundle(policyId: string, asOf?: string): Promise<PolicyBundle | null> {
    return this.stub.getBundle(policyId, asOf);
  }

  getBundles(policyIds: string[], asOf?: string): Promise<PolicyBundle[]> {
    return this.stub.getBundles(policyIds, asOf);
  }

  getVersions(policyId: string, from?: string, to?: string): Promise<PolicyVersion[]> {
    return this.stub.getVersions(policyId, from, to);
  }

  upsertPolicy(input: UpsertPolicyInput, observedAt: string): Promise<UpsertPolicyResult> {
    return this.stub.upsertPolicy(input, observedAt);
  }

  markMissing(source: string, observedBefore: string, threshold: number): Promise<number> {
    return this.stub.markMissing(source, observedBefore, threshold);
  }

  startSync(source: string, startedAt: string): Promise<string> {
    return this.stub.startSync(source, startedAt);
  }

  finishSync(
    id: string,
    summary: Omit<SyncSummary, "id" | "source" | "startedAt">,
  ): Promise<void> {
    return this.stub.finishSync(id, summary);
  }
}
