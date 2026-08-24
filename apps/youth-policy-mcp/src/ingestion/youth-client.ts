import { DomainError } from "../domain/types";
import type { RuntimeEnv } from "../env";
import { assertAllowedSourceUrl, fetchWithRetry, readLimitedText } from "./http";
import { parseYouthPolicyPayload, type ParsedYouthPayload } from "./youth-payload";

export interface YouthApiConfiguration {
  apiKey: string;
  baseUrl: string;
  path: string;
  format: "json" | "xml";
  legacyEnabled: boolean;
}

export class YouthPolicyApiClient {
  private readonly baseUrl: URL;
  private readonly legacy: boolean;

  constructor(private readonly configuration: YouthApiConfiguration) {
    this.baseUrl = assertAllowedSourceUrl(configuration.baseUrl);
    this.legacy = configuration.path.includes("/opi/");
    if (this.legacy && !configuration.legacyEnabled) {
      throw new DomainError(
        "LEGACY_SOURCE_DISABLED",
        "구형 온통청년 API는 YOUTH_POLICY_LEGACY_ENABLED=true일 때만 사용할 수 있습니다.",
      );
    }
    if (!configuration.path.startsWith("/") || configuration.path.includes("..")) {
      throw new DomainError("INVALID_SOURCE_PATH", "온통청년 API 경로 설정이 유효하지 않습니다.");
    }
  }

  async fetchPage(page: number, pageSize: number): Promise<ParsedYouthPayload> {
    const url = new URL(this.configuration.path, this.baseUrl);
    assertAllowedSourceUrl(url.toString());
    url.searchParams.set("apiKeyNm", this.configuration.apiKey);
    url.searchParams.set("pageNum", String(page));
    url.searchParams.set("pageSize", String(pageSize));
    url.searchParams.set("rtnType", this.configuration.format);

    const response = await fetchWithRetry(url, {
      method: "GET",
      headers: {
        Accept:
          this.configuration.format === "xml"
            ? "application/xml,text/xml;q=0.9"
            : "application/json",
        "User-Agent": "00AI-Youth-Policy-MCP/0.1",
      },
    });
    const text = await readLimitedText(response);
    return parseYouthPolicyPayload(
      text,
      response.headers.get("content-type") ?? `application/${this.configuration.format}`,
      this.legacy,
    );
  }
}

export function youthApiConfigurationFromEnv(env: RuntimeEnv): YouthApiConfiguration {
  const format = env.YOUTH_POLICY_API_FORMAT?.toLowerCase() === "xml" ? "xml" : "json";
  return {
    apiKey: env.YOUTH_POLICY_API_KEY ?? "",
    baseUrl: env.YOUTH_POLICY_API_BASE_URL,
    path: env.YOUTH_POLICY_API_PATH,
    format,
    legacyEnabled: env.YOUTH_POLICY_LEGACY_ENABLED === "true",
  };
}
