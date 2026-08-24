import { policies } from "../lib/data";

const ids = new Set(policies.map((policy) => policy.id));
const errors: string[] = [];
for (const policy of policies) {
  for (const relatedId of policy.relatedPolicyIds) if (!ids.has(relatedId)) errors.push(`관계 대상 없음: ${policy.id} → ${relatedId}`);
  if (policy.relatedPolicyIds.includes(policy.id)) errors.push(`자기참조 관계: ${policy.id}`);
}
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log(`validate:graph 통과 · 노드 ${policies.length}`);

