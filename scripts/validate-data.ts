import { changes, indicators, policies, snapshot, sources } from "../lib/data";

const errors: string[] = [];
const duplicate = <T>(items: T[]) => items.filter((item, index) => items.indexOf(item) !== index);
const policyIds = new Set(policies.map((policy) => policy.id));
const sourceIds = new Set(sources.map((source) => source.id));

if (policies.length < 30) errors.push(`정책 레코드가 30개 미만입니다: ${policies.length}`);
for (const id of duplicate(policies.map((policy) => policy.id))) errors.push(`중복 정책 ID: ${id}`);
for (const slug of duplicate(policies.map((policy) => policy.slug))) errors.push(`중복 정책 slug: ${slug}`);
for (const policy of policies) {
  if (!/^YH-POL-\d{4}$/.test(policy.id)) errors.push(`정책 ID 형식 오류: ${policy.id}`);
  if (!policy.programId || !policy.roundId) errors.push(`프로그램·회차 연결 누락: ${policy.id}`);
  if (!sourceIds.has(policy.sourceId)) errors.push(`출처 참조 누락: ${policy.id} → ${policy.sourceId}`);
  if (!policy.eligibility.length) errors.push(`자격조건 누락: ${policy.id}`);
  if (!policy.verificationStatus) errors.push(`검증상태 누락: ${policy.id}`);
}
for (const change of changes) {
  if (!policyIds.has(change.policyId)) errors.push(`변경 이벤트 고아 정책: ${change.id}`);
  if (!sourceIds.has(change.sourceId)) errors.push(`변경 이벤트 출처 누락: ${change.id}`);
  if (change.previousValue === change.currentValue) errors.push(`변경 전후 값 동일: ${change.id}`);
  if (Number.isNaN(Date.parse(change.detectedAt))) errors.push(`감지일 형식 오류: ${change.id}`);
}
if (indicators.length < 12) errors.push(`지표 메타데이터가 12개 미만입니다: ${indicators.length}`);
if (Number.isNaN(Date.parse(snapshot.generatedAt))) errors.push("데이터셋 생성시각 형식 오류");

if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log(`validate:data 통과 · 정책 ${policies.length} · 변경 ${changes.length} · 지표 ${indicators.length}`);

