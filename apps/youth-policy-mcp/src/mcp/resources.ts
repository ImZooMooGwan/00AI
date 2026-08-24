import { REGION_CODE_TO_NAME } from "../domain/regions";
import type { RuntimeEnv } from "../env";

export interface McpResourceDefinition {
  name: string;
  uri: string;
  title: string;
  mimeType: string;
  text: string;
}

export function policyResources(env: RuntimeEnv): McpResourceDefinition[] {
  return [
    {
      name: "taxonomy",
      uri: "youth-policy://taxonomy",
      title: "Y-HUB 청년정책 분류체계",
      mimeType: "application/json",
      text: JSON.stringify(
        {
          categories: ["일자리", "주거", "교육", "복지·문화", "참여·권리", "창업"],
          note: "실제 검색 필터는 온통청년 원천 분류값을 보존합니다.",
        },
        null,
        2,
      ),
    },
    {
      name: "code-reference",
      uri: "youth-policy://code-reference",
      title: "Y-HUB 지역 코드표",
      mimeType: "application/json",
      text: JSON.stringify({ regionCodes: REGION_CODE_TO_NAME }, null, 2),
    },
    {
      name: "methodology",
      uri: "youth-policy://methodology",
      title: "Y-HUB 수집·정규화 방법론",
      mimeType: "text/markdown",
      text: [
        "# 방법론",
        "",
        "- 공식 API 응답을 검증한 뒤 공통 정책 모델로 정규화합니다.",
        "- 원문 해시가 바뀐 경우에만 새 정책 버전을 생성합니다.",
        "- 신청상태와 구조화된 자격조건은 결정론적 규칙으로 계산합니다.",
        "- 자유서술 조건과 불확실한 법적 근거는 manual_review로 남깁니다.",
        "- 정상 질의 과정에는 LLM API를 호출하지 않습니다.",
      ].join("\n"),
    },
    {
      name: "data-sources",
      uri: "youth-policy://data-sources",
      title: "Y-HUB 데이터 원천",
      mimeType: "application/json",
      text: JSON.stringify(
        {
          youthPolicies: {
            organization: "온통청년",
            documentation: "https://www.youthcenter.go.kr/cmnFooter/openapiIntro/oaiDoc",
          },
          laws: {
            organization: "국가법령정보센터",
            documentation: "https://open.law.go.kr/LSO/openApi/guideList.do",
          },
          statistics: {
            service: "Korean Stats MCP",
            endpoint: env.KOSIS_MCP_URL,
            note: "통계 도구는 이 서버에 복제하지 않습니다.",
          },
        },
        null,
        2,
      ),
    },
    {
      name: "eligibility-rules",
      uri: "youth-policy://eligibility-rules",
      title: "Y-HUB 자격 판정 규칙",
      mimeType: "text/markdown",
      text: [
        "# 자격 판정 규칙",
        "",
        "연령·지역·명시된 취업상태만 자동 판정합니다. 소득, 학력, 전공, 혼인, 특화조건이 자유서술형이면 수동 확인 대상으로 반환합니다. 결과는 사전 점검이며 최종 자격이나 선정을 보장하지 않습니다.",
      ].join("\n"),
    },
    {
      name: "citation-guide",
      uri: "youth-policy://citation-guide",
      title: "Y-HUB 정책 인용 가이드",
      mimeType: "text/markdown",
      text: [
        "# 인용 가이드",
        "",
        "정책명, 원천기관, 원천 정책 ID, 기준일, 수집일, 공식 원문 URL을 함께 표기하세요. 법령 연결이 manual_review인 경우 확정적 법적 근거로 인용하지 마세요.",
      ].join("\n"),
    },
  ];
}
