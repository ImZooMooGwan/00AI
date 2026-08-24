import type { Metadata } from "next";
import { SubpageFrame } from "@/components/SubpageFrame";
import { policies, snapshot } from "@/lib/data";

export const metadata: Metadata = { title: "Open API v1" };

const endpoints = [
  ["GET", "/api/v1/policies", "정책 목록과 검색 필터"],
  ["GET", "/api/v1/policies/{id}", "정책 상세"],
  ["GET", "/api/v1/programs", "집행 프로그램"],
  ["GET", "/api/v1/rounds", "연도·회차별 모집"],
  ["GET", "/api/v1/changes", "필드 변경 이벤트"],
  ["GET", "/api/v1/indicators", "청년지표 메타데이터"],
  ["GET", "/api/v1/regions", "지역 코드와 정책 수"],
  ["GET", "/api/v1/sources", "공식 원천 레지스트리"],
  ["GET", "/api/v1/graph", "정책 관계 그래프"],
  ["GET", "/api/v1/live-policies", "청년정책 MCP 우선 검색·D1 폴백"],
  ["GET", "/api/v1/mcp/status", "GitHub 청년정책 MCP 연결 진단"],
  ["GET", "/api/v1/collection-status", "원천별 수집·DB 상태"],
  ["GET", "/api/v1/datasets", "공개 릴리스"],
] as const;

export default function ApiPage() {
  const example = { meta: { apiVersion: "v1", datasetVersion: snapshot.datasetVersion, generatedAt: snapshot.generatedAt, recordCount: policies.length, sourceCount: 9, license: "source-specific", nextCursor: null }, data: [] };
  return <SubpageFrame eyebrow="OPEN API · VERSION 1" title="Open API v1" description="정책·변경·지표·출처를 같은 ID와 데이터 버전으로 조회합니다. 실시간 정책 검색은 GitHub 청년정책 MCP를 우선 사용하고 장애 시 Y-HUB D1과 검증 스냅샷으로 자동 전환합니다." aside={<dl><div><dt>API 버전</dt><dd>v1</dd></div><div><dt>데이터셋</dt><dd>{snapshot.datasetVersion}</dd></div><div><dt>MCP 도구</dt><dd>6개 읽기 전용</dd></div><div><dt>OpenAPI</dt><dd>3.1.0</dd></div></dl>}><div className="api-console"><header><div><span className="api-light red" /><span className="api-light amber" /><span className="api-light green" /></div><code>https://y-hub.example/api/v1</code><a href="/api/openapi">OpenAPI JSON ↗</a></header><pre>{JSON.stringify(example, null, 2)}</pre></div><div className="endpoint-list">{endpoints.map(([method,path,description]) => <a href={path.replace("{id}","YH-POL-0001")} key={path}><b>{method}</b><code>{path}</code><span>{description}</span><i>↗</i></a>)}</div><div className="api-params"><h2>공통 쿼리</h2>{["as_of","from","to","region","age","application_status","category","status","verification_status","changed_since","page","page_size","format"].map((param) => <code key={param}>{param}</code>)}</div></SubpageFrame>;
}
