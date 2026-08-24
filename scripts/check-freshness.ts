import { policies, snapshot, sources } from "../lib/data";

const basis = Date.parse(`${snapshot.basisDate}T23:59:59+09:00`);
const errors: string[] = [];
for (const policy of policies) if (Date.parse(`${policy.lastObservedAt}T00:00:00+09:00`) > basis) errors.push(`기준일 이후 정책 관측일: ${policy.id}`);
for (const source of sources) if (Date.parse(source.fetchedAt) > basis + 24 * 60 * 60 * 1000) errors.push(`기준일과 맞지 않는 수집일: ${source.id}`);
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log(`check:freshness 통과 · 데이터 기준일 ${snapshot.basisDate}`);

