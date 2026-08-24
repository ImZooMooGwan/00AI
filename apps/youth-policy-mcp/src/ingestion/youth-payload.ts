import { XMLParser } from "fast-xml-parser";

import { DomainError } from "../domain/types";

export interface ParsedYouthPayload {
  items: Record<string, unknown>[];
  totalCount: number | null;
  format: "json" | "xml";
  version: "v2" | "legacy";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getPath(root: unknown, path: string[]): unknown {
  let current = root;
  for (const segment of path) {
    const record = asRecord(current);
    if (!record) return undefined;
    current = record[segment];
  }
  return current;
}

function arrayFromCandidate(value: unknown): Record<string, unknown>[] | null {
  if (Array.isArray(value)) {
    return value.map(asRecord).filter((item): item is Record<string, unknown> => item !== null);
  }
  const record = asRecord(value);
  if (!record) return null;
  const item = record.item ?? record.items ?? record.policy ?? record.plcy;
  if (Array.isArray(item)) {
    return item.map(asRecord).filter((entry): entry is Record<string, unknown> => entry !== null);
  }
  const single = asRecord(item);
  return single ? [single] : null;
}

function findItems(payload: unknown): Record<string, unknown>[] | null {
  const candidates = [
    ["result", "youthPolicyList"],
    ["result", "youthPlcyList"],
    ["result", "data"],
    ["response", "body", "items"],
    ["response", "body", "data"],
    ["body", "items"],
    ["body", "data"],
    ["data", "items"],
    ["data"],
    ["items"],
    ["youthPolicyList"],
    ["youthPlcyList"],
  ];
  for (const path of candidates) {
    const result = arrayFromCandidate(getPath(payload, path));
    if (result !== null) return result;
  }
  return null;
}

function findNumber(payload: unknown, paths: string[][]): number | null {
  for (const path of paths) {
    const value = getPath(payload, path);
    const number = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function detectApiError(payload: unknown): string | null {
  const candidates = [
    getPath(payload, ["response", "header", "resultCode"]),
    getPath(payload, ["resultCode"]),
    getPath(payload, ["result", "code"]),
    getPath(payload, ["error", "code"]),
  ];
  const code = candidates.find((value) => value !== undefined && value !== null);
  if (
    code === undefined ||
    code === null ||
    ["00", "0", "SUCCESS", "success"].includes(String(code))
  ) {
    return null;
  }
  return String(code).slice(0, 40);
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new DomainError("UPSTREAM_INVALID_JSON", "온통청년 API가 유효하지 않은 JSON을 반환했습니다.", true);
  }
}

function parseXml(text: string): unknown {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      parseTagValue: false,
      trimValues: true,
      isArray: (_name, path) => /(?:item|policy|plcy)$/.test(String(path)),
    });
    return parser.parse(text) as unknown;
  } catch {
    throw new DomainError("UPSTREAM_INVALID_XML", "온통청년 API가 유효하지 않은 XML을 반환했습니다.", true);
  }
}

export function parseYouthPolicyPayload(
  text: string,
  contentType = "application/json",
  legacy = false,
): ParsedYouthPayload {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new DomainError("UPSTREAM_EMPTY_BODY", "온통청년 API가 빈 응답을 반환했습니다.", true);
  }
  const format: ParsedYouthPayload["format"] =
    contentType.toLowerCase().includes("xml") || trimmed.startsWith("<") ? "xml" : "json";
  const payload = format === "xml" ? parseXml(trimmed) : parseJson(trimmed);
  const unwrapped = payload;
  const errorCode = detectApiError(unwrapped);
  if (errorCode) {
    throw new DomainError(
      "UPSTREAM_API_ERROR",
      `온통청년 API 요청이 거부되었습니다(오류 코드 ${errorCode}).`,
      true,
    );
  }

  const totalCount = findNumber(unwrapped, [
    ["response", "body", "totalCount"],
    ["result", "totalCount"],
    ["result", "pageInfo", "totalCount"],
    ["pageInfo", "totalCount"],
    ["totalCount"],
    ["totalCnt"],
  ]);
  const items = findItems(unwrapped);
  if (items === null) {
    if (totalCount === 0) return { items: [], totalCount, format, version: legacy ? "legacy" : "v2" };
    throw new DomainError(
      "UPSTREAM_SCHEMA_MISMATCH",
      "온통청년 API 응답 구조가 예상한 정책 목록 형식과 다릅니다.",
      true,
    );
  }
  return { items, totalCount, format, version: legacy ? "legacy" : "v2" };
}
