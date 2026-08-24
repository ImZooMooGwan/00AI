import { DomainError } from "../domain/types";
import { assertAllowedSourceUrl, fetchWithRetry, readLimitedText } from "./http";

export interface LawSearchRecord {
  legalId: string | null;
  legalName: string;
  promulgationDate: string | null;
  effectiveDate: string | null;
  sourceUrl: string | null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Read-only adapter for explicit law searches. It never invents a policy-law
 * link; callers must retain `manual_review` unless the source itself names it.
 */
export class LawApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly oc: string,
  ) {}

  async search(query: string): Promise<LawSearchRecord[]> {
    if (!this.oc) throw new DomainError("LAW_API_NOT_CONFIGURED", "국가법령정보 API 인증값이 설정되지 않았습니다.");
    const url = new URL("/DRF/lawSearch.do", assertAllowedSourceUrl(this.baseUrl));
    url.searchParams.set("OC", this.oc);
    url.searchParams.set("target", "law");
    url.searchParams.set("type", "JSON");
    url.searchParams.set("query", query.slice(0, 100));
    url.searchParams.set("display", "20");
    assertAllowedSourceUrl(url.toString());
    const response = await fetchWithRetry(url, { headers: { Accept: "application/json" } });
    const body = await readLimitedText(response);
    let payload: unknown;
    try {
      payload = JSON.parse(body) as unknown;
    } catch {
      throw new DomainError("LAW_API_INVALID_RESPONSE", "국가법령정보 API 응답을 해석할 수 없습니다.", true);
    }
    const root = record(payload);
    const lawSearch = record(root?.LawSearch ?? root?.lawSearch ?? root);
    const candidates = lawSearch?.law;
    const items = Array.isArray(candidates) ? candidates : candidates ? [candidates] : [];
    return items
      .map(record)
      .filter((item): item is Record<string, unknown> => item !== null)
      .map((item) => ({
        legalId: text(item.법령ID ?? item.lawId),
        legalName: text(item.법령명한글 ?? item.법령명 ?? item.lawName) ?? "",
        promulgationDate: text(item.공포일자 ?? item.promulgationDate),
        effectiveDate: text(item.시행일자 ?? item.effectiveDate),
        sourceUrl: text(item.법령상세링크 ?? item.sourceUrl),
      }))
      .filter((item) => item.legalName.length > 0);
  }
}
