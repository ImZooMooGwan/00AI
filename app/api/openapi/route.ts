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
      "/live-policies": { get: { summary: "D1에 수집된 온통청년 정책", parameters: [{ name: "q", in: "query", schema: { type: "string" } }, { name: "limit", in: "query", schema: { type: "integer", maximum: 500 } }, { name: "refresh", in: "query", description: "1이면 원천을 즉시 다시 확인", schema: { type: "string", enum: ["1"] } }], responses: { "200": { description: "실시간 수집 정책 목록" } } } },
      "/collection-status": { get: { summary: "공식 원천 수집 및 영속 저장 상태", responses: { "200": { description: "원천별 연결 상태" } } } },
      "/sources": { get: { summary: "공식 출처 레지스트리", responses: { "200": { description: "출처 목록" } } } },
    },
  });
}
