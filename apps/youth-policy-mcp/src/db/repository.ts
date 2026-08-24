import { D1PolicyRepository } from "./d1-repository";
import { DurableObjectPolicyRepository } from "./durable-object-repository";
import { DomainError, type PolicyRepository } from "../domain/types";
import type { RuntimeEnv } from "../env";

export type PolicyStorageBackend = "d1" | "durable_object";

export function policyStorageBackend(env: RuntimeEnv): PolicyStorageBackend {
  return env.POLICY_STORAGE_BACKEND === "durable_object" ? "durable_object" : "d1";
}

export function createPolicyRepository(env: RuntimeEnv): PolicyRepository {
  if (policyStorageBackend(env) === "durable_object") {
    if (!env.POLICY_STORE_DO) {
      throw new DomainError(
        "POLICY_STORE_NOT_CONFIGURED",
        "청년정책 Durable Object 저장소가 연결되지 않았습니다.",
      );
    }
    return new DurableObjectPolicyRepository(env.POLICY_STORE_DO);
  }
  if (!env.DB) {
    throw new DomainError("POLICY_DATABASE_NOT_CONFIGURED", "청년정책 D1 저장소가 연결되지 않았습니다.");
  }
  return new D1PolicyRepository(env.DB);
}
