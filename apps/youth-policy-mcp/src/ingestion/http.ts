import { DomainError } from "../domain/types";

const MAX_UPSTREAM_BYTES = 2 * 1024 * 1024;
const ALLOWED_SOURCE_HOSTS = new Set([
  "www.youthcenter.go.kr",
  "youthcenter.go.kr",
  "www.law.go.kr",
  "law.go.kr",
  "yhub.00ai.kr",
  "youth-policy-data-hub.hayahoyeho.chatgpt.site",
]);

export function assertAllowedSourceUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new DomainError("INVALID_SOURCE_URL", "외부 데이터 원천 URL 설정이 유효하지 않습니다.");
  }
  if (url.protocol !== "https:" || !ALLOWED_SOURCE_HOSTS.has(url.hostname)) {
    throw new DomainError(
      "SOURCE_HOST_NOT_ALLOWED",
      "허용목록에 없는 외부 데이터 원천은 호출할 수 없습니다.",
    );
  }
  return url;
}

export async function readLimitedText(
  response: Response,
  maximumBytes = MAX_UPSTREAM_BYTES,
): Promise<string> {
  const declaredLength = Number.parseInt(response.headers.get("content-length") ?? "", 10);
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new DomainError("UPSTREAM_RESPONSE_TOO_LARGE", "외부 API 응답이 허용 크기를 초과했습니다.", true);
  }
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      size += result.value.byteLength;
      if (size > maximumBytes) {
        await reader.cancel("response too large");
        throw new DomainError("UPSTREAM_RESPONSE_TOO_LARGE", "외부 API 응답이 허용 크기를 초과했습니다.", true);
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }
  const combined = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(combined);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function fetchWithRetry(
  url: URL,
  init: RequestInit,
  attempts = 3,
  timeoutMilliseconds = 10_000,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMilliseconds);
    try {
      const response = await fetcher(url, { ...init, signal: controller.signal });
      if (response.ok) return response;
      if (response.status < 500 && response.status !== 429) {
        throw new DomainError(
          "UPSTREAM_REQUEST_REJECTED",
          `외부 API 요청이 HTTP ${response.status}로 거부되었습니다.`,
          false,
        );
      }
      lastError = new DomainError(
        "UPSTREAM_TEMPORARY_ERROR",
        `외부 API가 일시적으로 응답하지 않습니다(HTTP ${response.status}).`,
        true,
      );
    } catch (error) {
      if (error instanceof DomainError && !error.retryable) throw error;
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
    if (attempt + 1 < attempts) await delay(250 * 2 ** attempt);
  }
  if (lastError instanceof DomainError) throw lastError;
  throw new DomainError("UPSTREAM_UNAVAILABLE", "외부 API에 연결할 수 없습니다.", true);
}
