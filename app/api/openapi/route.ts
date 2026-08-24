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
      "/live-policies": { get: { summary: "청년정책 MCP 우선 검색과 D1·검증 스냅샷 폴백", parameters: [{ name: "q", in: "query", schema: { type: "string" } }, { name: "region", in: "query", schema: { type: "string" } }, { name: "age", in: "query", schema: { type: "integer", minimum: 0, maximum: 120 } }, { name: "application_status", in: "query", schema: { type: "string", enum: ["open", "closing_soon", "upcoming", "closed", "always_open", "unknown"] } }, { name: "as_of", in: "query", schema: { type: "string", format: "date" } }, { name: "limit", in: "query", schema: { type: "integer", maximum: 500 } }, { name: "refresh", in: "query", description: "폴백 원천을 즉시 다시 확인", schema: { type: "string", enum: ["1"] } }], responses: { "200": { description: "데이터 공급자와 폴백 여부를 포함한 정책 목록" } } } },
      "/mcp/status": { get: { summary: "GitHub 청년정책 MCP 연결·도구·DB 상태", responses: { "200": { description: "비밀값을 제외한 MCP 연결 진단" } } } },
      "/collection-status": { get: { summary: "공식 원천 수집 및 영속 저장 상태", responses: { "200": { description: "원천별 연결 상태" } } } },
      "/sources": { get: { summary: "공식 출처 레지스트리", responses: { "200": { description: "출처 목록" } } } },
    },
  });
}
