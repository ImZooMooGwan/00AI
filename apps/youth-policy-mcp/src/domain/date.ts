import { DomainError, type ApplicationStatus, type Policy } from "./types";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function currentKoreanDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function assertIsoDate(value: string, fieldName: string): string {
  if (!ISO_DATE.test(value)) {
    throw new DomainError("INVALID_DATE", `${fieldName}은 YYYY-MM-DD 형식이어야 합니다.`);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new DomainError("INVALID_DATE", `${fieldName}에 유효한 날짜를 입력해 주세요.`);
  }
  return value;
}

function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return Math.floor((end - start) / 86_400_000);
}

export function calculateApplicationStatus(
  policy: Pick<Policy, "applicationStartDate" | "applicationEndDate" | "currentStatus">,
  asOf: string,
): ApplicationStatus {
  assertIsoDate(asOf, "as_of");

  if (policy.currentStatus !== "active") return "closed";
  const start = policy.applicationStartDate;
  const end = policy.applicationEndDate;

  if (!start && !end) return "always_open";
  if (start && asOf < start) return "upcoming";
  if (end && asOf > end) return "closed";
  if (end && daysBetween(asOf, end) <= 7) return "closing_soon";
  return "open";
}

export function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || /상시|연중|수시/.test(trimmed)) return null;

  const match = trimmed.match(/(20\d{2})\D*(\d{1,2})\D*(\d{1,2})/);
  if (!match) return null;
  const year = match[1];
  const monthValue = match[2];
  const dayValue = match[3];
  if (!year || !monthValue || !dayValue) return null;
  const normalized = `${year}-${monthValue.padStart(2, "0")}-${dayValue.padStart(2, "0")}`;
  try {
    return assertIsoDate(normalized, "date");
  } catch {
    return null;
  }
}
