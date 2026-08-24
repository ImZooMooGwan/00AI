import { sources } from "../lib/data";

const errors: string[] = [];
const ids = new Set<string>();
for (const source of sources) {
  if (ids.has(source.id)) errors.push(`중복 출처 ID: ${source.id}`);
  ids.add(source.id);
  try { const url = new URL(source.url); if (url.protocol !== "https:") errors.push(`HTTPS가 아닌 출처: ${source.id}`); }
  catch { errors.push(`출처 URL 오류: ${source.id}`); }
  if (!source.organization || !source.fetchedAt || !source.license) errors.push(`출처 필수 메타데이터 누락: ${source.id}`);
}
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log(`validate:sources 통과 · 공식 출처 ${sources.length}`);

