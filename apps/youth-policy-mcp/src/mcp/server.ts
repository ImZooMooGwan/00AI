import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import { createPolicyRepository } from "../db/repository";
import { currentKoreanDate } from "../domain/date";
import { YouthPolicyService } from "../domain/service";
import { DomainError } from "../domain/types";
import type { RuntimeEnv } from "../env";
import { policyResources } from "./resources";
import {
  changesInputSchema,
  commonOutputSchema,
  compareInputSchema,
  eligibilityInputSchema,
  evidenceInputSchema,
  getPolicyInputSchema,
  searchInputSchema,
} from "./schemas";

const SERVER_VERSION = "0.1.0";
const annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

interface Envelope extends Record<string, unknown> {
  ok: boolean;
  data?: unknown;
  error?: { code: string; message: string; retryable: boolean };
  meta: Record<string, unknown>;
}

function success(data: unknown, asOf?: string, warnings: string[] = []): Envelope {
  return {
    ok: true,
    data,
    meta: {
      ...(asOf ? { as_of: asOf } : {}),
      retrieved_at: new Date().toISOString(),
      sources: collectSources(data),
      warnings,
      is_cached: false,
    },
  };
}

function collectSources(data: unknown): Array<Record<string, unknown>> {
  const sources = new Map<string, Record<string, unknown>>();
  const visit = (value: unknown, depth: number): void => {
    if (depth > 6 || value === null || value === undefined || sources.size >= 100) return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }
    if (typeof value !== "object") return;
    const item = value as Record<string, unknown>;
    const url =
      typeof item.sourceUrl === "string"
        ? item.sourceUrl
        : typeof item.originalUrl === "string"
          ? item.originalUrl
          : null;
    if (url) {
      const source = {
        source_name:
          typeof item.sourceName === "string" ? item.sourceName : "온통청년 청년정책 API",
        source_id:
          typeof item.sourceId === "string"
            ? item.sourceId
            : typeof item.sourcePolicyId === "string"
              ? item.sourcePolicyId
              : null,
        source_url: url,
        verified_at:
          typeof item.verifiedAt === "string"
            ? item.verifiedAt
            : typeof item.collectedAt === "string"
              ? item.collectedAt
              : null,
      };
      sources.set(`${source.source_id ?? ""}:${url}`, source);
    }
    for (const nested of Object.values(item)) visit(nested, depth + 1);
  };
  visit(data, 0);
  return [...sources.values()];
}

function failure(error: unknown): Envelope {
  const domainError =
    error instanceof DomainError
      ? error
      : new DomainError("INTERNAL_ERROR", "요청 처리 중 내부 오류가 발생했습니다.");
  return {
    ok: false,
    error: {
      code: domainError.code,
      message: domainError.message,
      retryable: domainError.retryable,
    },
    meta: { retrieved_at: new Date().toISOString() },
  };
}

function toolResult(envelope: Envelope, isError = false) {
  return {
    ...(isError ? { isError: true } : {}),
    content: [{ type: "text" as const, text: JSON.stringify(envelope) }],
    structuredContent: envelope,
  };
}

async function execute(
  operation: () => Promise<unknown>,
  asOf?: string,
): Promise<ReturnType<typeof toolResult>> {
  try {
    return toolResult(success(await operation(), asOf));
  } catch (error) {
    return toolResult(failure(error), true);
  }
}

export function createYouthPolicyMcpServer(env: RuntimeEnv): McpServer {
  const server = new McpServer(
    { name: "00ai-youth-policy-mcp", version: SERVER_VERSION },
    {
      capabilities: { tools: {}, resources: {}, prompts: {} },
      instructions:
        "대한민국 청년정책을 검색·비교하고 자격조건, 변경이력, 공식 근거를 확인합니다. 통계는 KOSIS MCP를 별도로 사용하세요.",
    },
  );
  const service = new YouthPolicyService(createPolicyRepository(env));

  server.registerTool(
    "search_youth_policies",
    {
      title: "청년정책 검색",
      description:
        "자연어와 지역·분류·연령·취업상태·신청상태 필터로 공식 청년정책을 검색합니다. 존재하지 않는 지역은 전국 정책으로 대체하지 않습니다.",
      inputSchema: searchInputSchema,
      outputSchema: commonOutputSchema,
      annotations,
    },
    async (input) =>
      execute(
        () =>
          service.search({
            ...(input.query ? { query: input.query } : {}),
            ...(input.region_codes ? { regionCodes: input.region_codes } : {}),
            ...(input.large_categories ? { largeCategories: input.large_categories } : {}),
            ...(input.medium_categories ? { mediumCategories: input.medium_categories } : {}),
            ...(input.age !== undefined ? { age: input.age } : {}),
            ...(input.employment_status ? { employmentStatus: input.employment_status } : {}),
            ...(input.application_status ? { applicationStatus: input.application_status } : {}),
            ...(input.as_of ? { asOf: input.as_of } : {}),
            page: input.page,
            pageSize: input.page_size,
          }),
        input.as_of ?? currentKoreanDate(),
      ),
  );

  server.registerTool(
    "get_youth_policy",
    {
      title: "청년정책 상세",
      description: "정책 ID와 선택적 기준일로 상세정보, 신청방법, 법적 근거, 출처와 최신성 경고를 조회합니다.",
      inputSchema: getPolicyInputSchema,
      outputSchema: commonOutputSchema,
      annotations,
    },
    async (input) =>
      execute(
        () => service.getPolicy(input.policy_id, input.as_of),
        input.as_of ?? currentKoreanDate(),
      ),
  );

  server.registerTool(
    "check_policy_eligibility",
    {
      title: "정책 자격조건 사전 점검",
      description:
        "사용자 프로필을 저장하지 않고 구조화된 조건만 규칙 기반으로 점검합니다. 정보부족과 수동확인을 명시하며 최종 자격을 보장하지 않습니다.",
      inputSchema: eligibilityInputSchema,
      outputSchema: commonOutputSchema,
      annotations,
    },
    async (input) =>
      execute(
        () =>
          service.checkEligibility(
            input.policy_id,
            {
              ...(input.profile.age !== undefined ? { age: input.profile.age } : {}),
              ...(input.profile.region ? { region: input.profile.region } : {}),
              ...(input.profile.income !== undefined ? { income: input.profile.income } : {}),
              ...(input.profile.income_band ? { incomeBand: input.profile.income_band } : {}),
              ...(input.profile.employment_status
                ? { employmentStatus: input.profile.employment_status }
                : {}),
              ...(input.profile.enrollment_status
                ? { enrollmentStatus: input.profile.enrollment_status }
                : {}),
              ...(input.profile.education ? { education: input.profile.education } : {}),
              ...(input.profile.major ? { major: input.profile.major } : {}),
              ...(input.profile.marital_status
                ? { maritalStatus: input.profile.marital_status }
                : {}),
              ...(input.profile.special_conditions
                ? { specialConditions: input.profile.special_conditions }
                : {}),
            },
            input.as_of,
          ),
        input.as_of ?? currentKoreanDate(),
      ),
  );

  server.registerTool(
    "compare_youth_policies",
    {
      title: "청년정책 비교",
      description:
        "최대 10개 정책 또는 지역·분류 정책을 비교하고, 확인된 사실과 규칙 기반 중복·공백 신호를 분리해 반환합니다.",
      inputSchema: compareInputSchema,
      outputSchema: commonOutputSchema,
      annotations,
    },
    async (input) => {
      const asOf = input.as_of ?? currentKoreanDate();
      return execute(
        () =>
          service.compare({
            ...(input.policy_ids ? { policyIds: input.policy_ids } : {}),
            ...(input.regions ? { regions: input.regions } : {}),
            ...(input.category ? { category: input.category } : {}),
            ...(input.fields ? { fields: input.fields } : {}),
            asOf,
          }),
        asOf,
      );
    },
  );

  server.registerTool(
    "get_policy_changes",
    {
      title: "청년정책 변경이력",
      description: "정책 버전 사이의 필드별 이전 값, 변경 값, 감지일, 영향 수준과 공식 원문 URL을 조회합니다.",
      inputSchema: changesInputSchema,
      outputSchema: commonOutputSchema,
      annotations,
    },
    async (input) =>
      execute(
        () => service.getChanges(input.policy_id, input.from, input.to),
        input.to ?? currentKoreanDate(),
      ),
  );

  server.registerTool(
    "get_policy_evidence",
    {
      title: "청년정책 근거·출처",
      description: "정책 필드별 원천 ID, 공식 URL, 기준일, 수집일, 원문 해시, 법령 연결과 불확실성을 조회합니다.",
      inputSchema: evidenceInputSchema,
      outputSchema: commonOutputSchema,
      annotations,
    },
    async (input) => execute(() => service.getEvidence(input.policy_id, input.fields)),
  );

  for (const resource of policyResources(env)) {
    server.registerResource(
      resource.name,
      resource.uri,
      { title: resource.title, mimeType: resource.mimeType },
      async (uri) => ({
        contents: [{ uri: uri.href, mimeType: resource.mimeType, text: resource.text }],
      }),
    );
  }

  server.registerPrompt(
    "analyze_youth_policy_region",
    {
      title: "지역 청년정책 분석",
      description: "국가통계 MCP와 Y-HUB MCP를 함께 사용해 지역 청년정책의 중복·공백 가능성을 분석합니다.",
      argsSchema: z.object({
        region: z.string().trim().min(1).max(50),
        category: z.string().trim().min(1).max(100).optional(),
      }),
    },
    ({ region, category }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              `${region}의 청년${category ? ` ${category}` : ""} 정책을 분석해 주세요.`,
              `1. 국가통계 MCP(${env.KOSIS_MCP_URL})에서 관련 청년 통계를 조회합니다.`,
              "2. Y-HUB MCP에서 해당 지역 정책을 검색합니다.",
              "3. 통계상 문제와 현재 정책을 연결하고 다른 지역과 비교합니다.",
              "4. 정책 중복과 공백은 가능성으로 표현합니다.",
              "5. 확인된 사실과 해석을 분리하고 모든 수치·정책에 출처를 붙입니다.",
            ].join("\n"),
          },
        },
      ],
    }),
  );

  return server;
}

export const youthPolicyMcpVersion = SERVER_VERSION;
