import { DomainError } from "./types";

export const REGION_CODE_TO_NAME = {
  "00": "전국",
  "11": "서울",
  "26": "부산",
  "27": "대구",
  "28": "인천",
  "29": "광주",
  "30": "대전",
  "31": "울산",
  "36": "세종",
  "41": "경기",
  "42": "강원",
  "43": "충북",
  "44": "충남",
  "45": "전북",
  "46": "전남",
  "47": "경북",
  "48": "경남",
  "50": "제주",
} as const;

const aliases: Record<string, string> = {
  전국: "00",
  서울: "11",
  서울특별시: "11",
  부산: "26",
  부산광역시: "26",
  대구: "27",
  대구광역시: "27",
  인천: "28",
  인천광역시: "28",
  광주: "29",
  광주광역시: "29",
  대전: "30",
  대전광역시: "30",
  울산: "31",
  울산광역시: "31",
  세종: "36",
  세종특별자치시: "36",
  경기: "41",
  경기도: "41",
  강원: "42",
  강원도: "42",
  강원특별자치도: "42",
  충북: "43",
  충청북도: "43",
  충남: "44",
  충청남도: "44",
  전북: "45",
  전라북도: "45",
  전북특별자치도: "45",
  전남: "46",
  전라남도: "46",
  경북: "47",
  경상북도: "47",
  경남: "48",
  경상남도: "48",
  제주: "50",
  제주도: "50",
  제주특별자치도: "50",
};

export function normalizeRegionCode(value: string): string {
  const normalized = value.trim().replace(/\s+/g, "");
  const alias = aliases[normalized];
  if (alias) return alias;

  const digits = normalized.replace(/\D/g, "");
  if (digits.length >= 2) {
    const province = digits.slice(0, 2);
    if (province in REGION_CODE_TO_NAME) return province;
  }

  throw new DomainError(
    "INVALID_REGION",
    `지원하지 않는 지역 '${value}'입니다. 시·도명 또는 법정지역코드를 확인해 주세요.`,
  );
}

export function normalizeRegionCodes(values: string[] | undefined): string[] | undefined {
  if (!values) return undefined;
  return [...new Set(values.map(normalizeRegionCode))];
}

export function regionName(code: string): string {
  return REGION_CODE_TO_NAME[code as keyof typeof REGION_CODE_TO_NAME] ?? code;
}

export function regionMatches(policyRegionCodes: string[], requestedCodes: string[]): boolean {
  if (policyRegionCodes.includes("00")) return true;
  return requestedCodes.some((code) => policyRegionCodes.includes(code));
}

export function parseRegionValues(value: unknown): { codes: string[]; names: string[] } {
  if (typeof value !== "string" || !value.trim()) return { codes: [], names: [] };
  const parts = value.split(/[,|;\/]/).map((part) => part.trim()).filter(Boolean);
  const codes: string[] = [];
  for (const part of parts) {
    try {
      codes.push(normalizeRegionCode(part));
    } catch {
      // A city/county name without a province cannot be mapped safely.
    }
  }
  const uniqueCodes = [...new Set(codes)];
  if (uniqueCodes.length === 0) return { codes: [], names: parts };
  return { codes: uniqueCodes, names: uniqueCodes.map(regionName) };
}
