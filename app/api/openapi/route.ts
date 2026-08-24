import { snapshot } from "@/lib/data";

export function GET() {
  return Response.json({
    openapi: "3.1.0",
    info: { title: "Y-HUB Open API", version: "1.0.0", description: `청년정책데이터허브 API · 데이터셋 ${snapshot.datasetVersion}` },
    servers: [{ url: "/api/v1" }],
    paths: {
      "/policies": { get: { summary: "정책 목록", parameters: [{ name: "region", in: "query", schema: { type: "string" } }, { name: "category", in: "query", schema: { type: "string" } }, { name: "verification_status", in: "query", schema: { type: "string" } }], responses: { "200": { description: "정책 목록" } } } },
      "/policies/{id}": { get: { summary: "정책 상세", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "정책 상세" }, "404": { description: "정책 없음" } } } },
      "/changes": { get: { summary: "정책 변경 이벤트", responses: { "200": { description: "변경 목록" } } } },
      "/indicators": { get: { summary: "청년지표 메타데이터", responses: { "200": { description: "지표 목록" } } } },
      "/sources": { get: { summary: "공식 출처 레지스트리", responses: { "200": { description: "출처 목록" } } } },
    },
  });
}

