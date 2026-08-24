import type {
  ConnectorDefinition,
  ConnectorId,
  RuntimeEnvironment,
} from "./ingestion-types";

export const CONNECTORS: ConnectorDefinition[] = [
  {
    id: "youth-center",
    name: "온통청년 정책 Open API",
    organization: "국무조정실 청년정책조정실·한국고용정보원",
    endpoint: "https://www.youthcenter.go.kr/opi/youthPlcyList.do",
    docsUrl: "https://www.youthcenter.go.kr/cmnFooter/openapiIntro/oaiDoc",
    authEnvKey: "YOUTH_CENTER_API_KEY",
    cadence: "1시간",
  },
  {
    id: "kosis",
    name: "KOSIS 공유서비스",
    organization: "국가데이터처",
    endpoint: "https://kosis.kr/openapi/statisticsSearch.do",
    docsUrl: "https://kosis.kr/openapi/",
    authEnvKey: "KOSIS_API_KEY",
    cadence: "매일",
  },
  {
    id: "law",
    name: "국가법령정보 공동활용",
    organization: "법제처",
    endpoint: "https://www.law.go.kr/DRF/lawSearch.do",
    docsUrl: "https://open.law.go.kr/LSO/openApi/guideList.do",
    authEnvKey: "LAW_OPEN_API_KEY 또는 LAW_OC",
    cadence: "6시간",
  },
];

export function connectorById(id: ConnectorId) {
  return CONNECTORS.find((connector) => connector.id === id);
}

export function readEnvString(
  runtime: RuntimeEnvironment,
  key: string,
): string | undefined {
  const value = runtime[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function credentialFor(
  id: ConnectorId,
  runtime: RuntimeEnvironment,
): string | undefined {
  if (id === "youth-center") return readEnvString(runtime, "YOUTH_CENTER_API_KEY");
  if (id === "kosis") return readEnvString(runtime, "KOSIS_API_KEY");
  return (
    readEnvString(runtime, "LAW_OPEN_API_KEY") ??
    readEnvString(runtime, "LAW_OC")
  );
}

