import { D1PolicyRepository } from "./d1-repository";
import { KVPolicyRepository } from "./kv-repository";
import { DomainError, type PolicyRepository } from "../domain/types";
import type { RuntimeEnv } from "../env";

export type PolicyStorageBackend = "d1" | "kv";

export function policyStorageBackend(env: RuntimeEnv): PolicyStorageBackend {
  return env.POLICY_STORAGE_BACKEND === "kv" ? "kv" : "d1";
}

export function createPolicyRepository(env: RuntimeEnv): PolicyRepository {
  if (policyStorageBackend(env) === "kv") {
    if (!env.POLICY_STORE) {
      throw new DomainError("POLICY_STORE_NOT_CONFIGURED", "청년정책 KV 저장소가 연결되지 않았습니다.");
    }
    return new KVPolicyRepository(env.POLICY_STORE);
  }
  if (!env.DB) {
    throw new DomainError("POLICY_DATABASE_NOT_CONFIGURED", "청년정책 D1 저장소가 연결되지 않았습니다.");
  }
  return new D1PolicyRepository(env.DB);
}
