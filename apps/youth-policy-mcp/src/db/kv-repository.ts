import { MemoryPolicyRepository } from "./memory-repository";
import { DomainError } from "../domain/types";
import type {
  Policy,
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

const SCHEMA_VERSION = 1;
const DEFAULT_PREFIX = "policy-store:v1";
const MAX_CHUNK_BYTES = 8 * 1024 * 1024;
const MAX_ITEMS_PER_CHUNK = 100;
const WRITE_CONCURRENCY = 20;

interface SnapshotRoot {
  schemaVersion: typeof SCHEMA_VERSION;
  currentDescriptorKey: string;
  previousDescriptorKey: string | null;
}

interface SnapshotDescriptor {
  schemaVersion: typeof SCHEMA_VERSION;
  generation: string;
  policyCount: number;
  lastSync: SyncSummary | null;
  indexChunkKeys: string[];
  recordChunkKeys: string[];
  recordKeyByPolicyId: Record<string, string>;
}

interface SnapshotRecord {
  bundle: PolicyBundle;
  versions: PolicyVersion[];
}

interface EncodedChunk<T> {
  items: T[];
  value: string;
}

class SnapshotUnavailableError extends Error {
  constructor() {
    super("KV snapshot is not available yet");
    this.name = "SnapshotUnavailableError";
  }
}

/**
 * KV-backed repository optimized for a read-heavy MCP service.
 *
 * Synchronization builds immutable, size-bounded snapshot chunks and updates a
 * small root pointer only after every chunk is written. The previous descriptor
 * remains available as an eventual-consistency fallback during propagation.
 */
export class KVPolicyRepository implements PolicyRepository {
  private readonly rootKey: string;
  private memory: MemoryPolicyRepository | null = null;

  constructor(
    private readonly namespace: KVNamespace,
    prefix = DEFAULT_PREFIX,
  ) {
    this.rootKey = `${prefix}:root`;
  }

  async health(): Promise<RepositoryHealth> {
    if (this.memory) return this.memory.health();
    try {
      const descriptor = await this.loadFirstDescriptor();
      return {
        connected: true,
        policyCount: descriptor?.policyCount ?? 0,
        lastSync: descriptor?.lastSync ?? null,
      };
    } catch {
      return { connected: false, policyCount: 0, lastSync: null };
    }
  }

  async search(criteria: SearchCriteria): Promise<SearchPage> {
    if (this.memory) return this.memory.search(criteria);
    return this.withSnapshot(
      async (descriptor) => {
        const policies = await this.readChunks<Policy>(descriptor.indexChunkKeys);
        const repository = new MemoryPolicyRepository(
          policies.map((policy) => ({ policy, conditions: [], evidence: [], legalBases: [] })),
        );
        return repository.search(criteria);
      },
      { items: [], total: 0, page: criteria.page, pageSize: criteria.pageSize, totalPages: 0 },
    );
  }

  async getBundle(policyId: string, asOf?: string): Promise<PolicyBundle | null> {
    if (this.memory) return this.memory.getBundle(policyId, asOf);
    return this.withSnapshot(async (descriptor) => {
      const record = await this.readRecord(descriptor, policyId);
      if (!record) return null;
      const repository = repositoryForRecords([record]);
      return repository.getBundle(policyId, asOf);
    }, null);
  }

  async getBundles(policyIds: string[], asOf?: string): Promise<PolicyBundle[]> {
    if (this.memory) return this.memory.getBundles(policyIds, asOf);
    return this.withSnapshot(async (descriptor) => {
      const chunkKeys = [
        ...new Set(
          policyIds
            .map((policyId) => descriptor.recordKeyByPolicyId[policyId])
            .filter((key): key is string => Boolean(key)),
        ),
      ];
      const records = await this.readChunks<SnapshotRecord>(chunkKeys);
      return repositoryForRecords(records).getBundles(policyIds, asOf);
    }, []);
  }

  async getVersions(policyId: string, from?: string, to?: string): Promise<PolicyVersion[]> {
    if (this.memory) return this.memory.getVersions(policyId, from, to);
    return this.withSnapshot(async (descriptor) => {
      const record = await this.readRecord(descriptor, policyId);
      if (!record) return [];
      return repositoryForRecords([record]).getVersions(policyId, from, to);
    }, []);
  }

  async upsertPolicy(input: UpsertPolicyInput, observedAt: string): Promise<UpsertPolicyResult> {
    return (await this.mutableRepository()).upsertPolicy(input, observedAt);
  }

  async markMissing(source: string, observedBefore: string, threshold: number): Promise<number> {
    return (await this.mutableRepository()).markMissing(source, observedBefore, threshold);
  }

  async startSync(source: string, startedAt: string): Promise<string> {
    return (await this.mutableRepository()).startSync(source, startedAt);
  }

  async finishSync(
    id: string,
    summary: Omit<SyncSummary, "id" | "source" | "startedAt">,
  ): Promise<void> {
    const repository = await this.mutableRepository();
    await repository.finishSync(id, summary);
    await this.persistSnapshot(repository);
  }

  private async mutableRepository(): Promise<MemoryPolicyRepository> {
    if (this.memory) return this.memory;
    const records = await this.withSnapshot(
      (descriptor) => this.readChunks<SnapshotRecord>(descriptor.recordChunkKeys),
      [],
    );
    this.memory = repositoryForRecords(records);
    const descriptor = await this.loadFirstDescriptor();
    if (descriptor?.lastSync) {
      this.memory.syncRuns.set(descriptor.lastSync.id, structuredClone(descriptor.lastSync));
    }
    return this.memory;
  }

  private async readRecord(
    descriptor: SnapshotDescriptor,
    policyId: string,
  ): Promise<SnapshotRecord | null> {
    const key = descriptor.recordKeyByPolicyId[policyId];
    if (!key) return null;
    const records = await this.readChunks<SnapshotRecord>([key]);
    return records.find((record) => record.bundle.policy.id === policyId) ?? null;
  }

  private async withSnapshot<T>(
    operation: (descriptor: SnapshotDescriptor) => Promise<T>,
    emptyValue: T,
  ): Promise<T> {
    const root = await this.readJson<SnapshotRoot>(this.rootKey);
    if (!root) return structuredClone(emptyValue);
    const descriptorKeys = [root.currentDescriptorKey, root.previousDescriptorKey].filter(
      (key): key is string => Boolean(key),
    );
    for (const key of descriptorKeys) {
      const descriptor = await this.readJson<SnapshotDescriptor>(key);
      if (!descriptor || descriptor.schemaVersion !== SCHEMA_VERSION) continue;
      try {
        return await operation(descriptor);
      } catch (error) {
        if (!(error instanceof SnapshotUnavailableError)) throw error;
      }
    }
    throw new DomainError(
      "POLICY_STORE_UNAVAILABLE",
      "청년정책 저장소 스냅샷을 아직 읽을 수 없습니다.",
      true,
    );
  }

  private async loadFirstDescriptor(): Promise<SnapshotDescriptor | null> {
    const root = await this.readJson<SnapshotRoot>(this.rootKey);
    if (!root) return null;
    for (const key of [root.currentDescriptorKey, root.previousDescriptorKey]) {
      if (!key) continue;
      const descriptor = await this.readJson<SnapshotDescriptor>(key);
      if (descriptor?.schemaVersion === SCHEMA_VERSION) return descriptor;
    }
    throw new SnapshotUnavailableError();
  }

  private async readChunks<T>(keys: string[]): Promise<T[]> {
    if (keys.length === 0) return [];
    const values = await Promise.all(keys.map((key) => this.namespace.get(key, "text")));
    if (values.some((value) => value === null)) throw new SnapshotUnavailableError();
    const items: T[] = [];
    for (const value of values) {
      try {
        const parsed = JSON.parse(value ?? "[]") as unknown;
        if (!Array.isArray(parsed)) throw new Error("snapshot chunk is not an array");
        items.push(...(parsed as T[]));
      } catch {
        throw new SnapshotUnavailableError();
      }
    }
    return items;
  }

  private async readJson<T>(key: string): Promise<T | null> {
    const value = await this.namespace.get(key, "text");
    if (value === null) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  private async persistSnapshot(repository: MemoryPolicyRepository): Promise<void> {
    const oldRoot = await this.readJson<SnapshotRoot>(this.rootKey);
    const generation = `${Date.now().toString(36)}-${crypto.randomUUID()}`;
    const keyPrefix = this.rootKey.slice(0, -":root".length);
    const policies = [...repository.bundles.values()].map(({ policy }) => structuredClone(policy));
    const records: SnapshotRecord[] = [...repository.bundles.values()].map((bundle) => ({
      bundle: structuredClone(bundle),
      versions: structuredClone(repository.versions.get(bundle.policy.id) ?? []),
    }));
    const indexChunks = encodeChunks(policies);
    const recordChunks = encodeChunks(records);
    const indexWrites = indexChunks.map((chunk, index) => ({
      key: `${keyPrefix}:snapshot:${generation}:index:${index}`,
      value: chunk.value,
    }));
    const recordWrites = recordChunks.map((chunk, index) => ({
      key: `${keyPrefix}:snapshot:${generation}:records:${index}`,
      value: chunk.value,
      policyIds: chunk.items.map((record) => record.bundle.policy.id),
    }));
    const descriptorKey = `${keyPrefix}:snapshot:${generation}:descriptor`;
    const lastSync = [...repository.syncRuns.values()].sort((left, right) =>
      right.startedAt.localeCompare(left.startedAt),
    )[0] ?? null;
    const descriptor: SnapshotDescriptor = {
      schemaVersion: SCHEMA_VERSION,
      generation,
      policyCount: policies.filter((policy) => !policy.isMock).length,
      lastSync: lastSync ? structuredClone(lastSync) : null,
      indexChunkKeys: indexWrites.map(({ key }) => key),
      recordChunkKeys: recordWrites.map(({ key }) => key),
      recordKeyByPolicyId: Object.fromEntries(
        recordWrites.flatMap(({ key, policyIds }) => policyIds.map((policyId) => [policyId, key])),
      ),
    };

    const descriptorValue = JSON.stringify(descriptor);
    assertWithinKvLimit(descriptorValue, "snapshot descriptor");
    await writeInBatches(
      this.namespace,
      [...indexWrites, ...recordWrites].map(({ key, value }) => ({ key, value })),
    );
    await this.namespace.put(descriptorKey, descriptorValue);
    await this.namespace.put(
      this.rootKey,
      JSON.stringify({
        schemaVersion: SCHEMA_VERSION,
        currentDescriptorKey: descriptorKey,
        previousDescriptorKey: oldRoot?.currentDescriptorKey ?? null,
      } satisfies SnapshotRoot),
    );

    if (oldRoot?.previousDescriptorKey) {
      await this.deleteSnapshot(oldRoot.previousDescriptorKey);
    }
  }

  private async deleteSnapshot(descriptorKey: string): Promise<void> {
    const descriptor = await this.readJson<SnapshotDescriptor>(descriptorKey);
    if (!descriptor) return;
    const keys = [...descriptor.indexChunkKeys, ...descriptor.recordChunkKeys, descriptorKey];
    for (let offset = 0; offset < keys.length; offset += WRITE_CONCURRENCY) {
      await Promise.all(
        keys
          .slice(offset, offset + WRITE_CONCURRENCY)
          .map((key) => this.namespace.delete(key)),
      );
    }
  }
}

function repositoryForRecords(records: SnapshotRecord[]): MemoryPolicyRepository {
  const repository = new MemoryPolicyRepository(records.map(({ bundle }) => bundle));
  for (const record of records) {
    repository.versions.set(record.bundle.policy.id, structuredClone(record.versions));
  }
  return repository;
}

function encodeChunks<T>(items: T[]): EncodedChunk<T>[] {
  const chunks: EncodedChunk<T>[] = [];
  let currentItems: T[] = [];
  let currentValues: string[] = [];
  let currentBytes = 2;

  const flush = (): void => {
    if (currentItems.length === 0) return;
    chunks.push({ items: currentItems, value: `[${currentValues.join(",")}]` });
    currentItems = [];
    currentValues = [];
    currentBytes = 2;
  };

  for (const item of items) {
    const encoded = JSON.stringify(item);
    const encodedBytes = new TextEncoder().encode(encoded).byteLength;
    assertWithinKvLimit(encoded, "policy record");
    const separatorBytes = currentItems.length > 0 ? 1 : 0;
    if (
      currentItems.length >= MAX_ITEMS_PER_CHUNK ||
      currentBytes + separatorBytes + encodedBytes > MAX_CHUNK_BYTES
    ) {
      flush();
    }
    currentItems.push(item);
    currentValues.push(encoded);
    currentBytes += (currentItems.length > 1 ? 1 : 0) + encodedBytes;
  }
  flush();
  return chunks;
}

function assertWithinKvLimit(value: string, label: string): void {
  if (new TextEncoder().encode(value).byteLength > MAX_CHUNK_BYTES) {
    throw new DomainError(
      "POLICY_STORE_RECORD_TOO_LARGE",
      `${label}이 KV 안전 크기를 초과했습니다.`,
    );
  }
}

async function writeInBatches(
  namespace: KVNamespace,
  writes: Array<{ key: string; value: string }>,
): Promise<void> {
  for (let offset = 0; offset < writes.length; offset += WRITE_CONCURRENCY) {
    await Promise.all(
      writes
        .slice(offset, offset + WRITE_CONCURRENCY)
        .map(({ key, value }) => namespace.put(key, value)),
    );
  }
}
