import { changes, getPolicy, snapshot } from "@/lib/data";

function xml(value: string) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;"); }

export function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const items = changes.map((change) => { const policy = getPolicy(change.policyId); const link = `${origin}/policy/${policy?.slug ?? ""}`; return `<item><title>${xml(`${change.type}: ${policy?.officialName ?? change.policyId}`)}</title><link>${xml(link)}</link><guid>${xml(change.id)}</guid><pubDate>${new Date(change.detectedAt).toUTCString()}</pubDate><description>${xml(change.summary)}</description></item>`; }).join("");
  const body = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Y-HUB 정책 변경 피드</title><link>${xml(origin)}</link><description>대한민국 청년정책 변경 이벤트</description><lastBuildDate>${new Date(snapshot.generatedAt).toUTCString()}</lastBuildDate>${items}</channel></rss>`;
  return new Response(body, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=300" } });
}

