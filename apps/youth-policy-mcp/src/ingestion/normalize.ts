import { normalizeDate } from "../domain/date";
import { parseRegionValues } from "../domain/regions";
import type {
  NormalizedPolicyRecord,
  Policy,
  PolicyCondition,
  PolicyEvidence,
  PolicyLegalBasis,
} from "../domain/types";

const OFFICIAL_API_DOCUMENTATION = "https://www.youthcenter.go.kr/cmnFooter/openapiIntro/oaiDoc";

function getString(record: Record<string, unknown>, names: string[]): string | null {
  for (const name of names) {
    const value = record[name];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function getRequiredString(record: Record<string, unknown>, names: string[], label: string): string {
  const value = getString(record, names);
  if (!value) throw new Error(`정책 ${label} 누락`);
  return value;
}

function parseInteger(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/\d{1,3}/);
  if (!match) return null;
  const number = Number.parseInt(match[0], 10);
  return Number.isFinite(number) ? number : null;
}

function splitList(value: string | null): string[] {
  if (!value) return [];
  return [...new Set(value.split(/[,|;·\n]/).map((item) => item.trim()).filter(Boolean))];
}

function safeHttpUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function parseDateRange(value: string | null): { start: string | null; end: string | null } {
  if (!value) return { start: null, end: null };
  const pieces = value.split(/~|∼|–|—|부터|\s+-\s+/);
  if (pieces.length >= 2) return { start: normalizeDate(pieces[0]), end: normalizeDate(pieces[1]) };
  const date = normalizeDate(value);
  return { start: date, end: date };
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function condition(
  policyId: string,
  type: PolicyCondition["conditionType"],
  operator: string,
  comparisonValue: string | null,
  rawCondition: string,
  sourceUrl: string,
  manualReview: boolean,
): PolicyCondition {
  return {
    id: `${policyId}:condition:${type}:${operator}`,
    policyId,
    conditionType: type,
    operator,
    comparisonValue,
    unit: type.startsWith("age") ? "세" : null,
    rawCondition,
    structuredStatus: manualReview ? "unstructured" : "structured",
    evidenceSource: "온통청년",
    evidenceUrl: sourceUrl,
    manualReview,
  };
}

export async function normalizeYouthPolicy(
  record: Record<string, unknown>,
  observedAt: string,
): Promise<NormalizedPolicyRecord> {
  const sourcePolicyId = getRequiredString(
    record,
    ["plcyNo", "bizId", "policyId", "polyBizSecd", "id"],
    "ID",
  );
  const title = getRequiredString(record, ["plcyNm", "polyBizSjnm", "title", "policyName"], "명");
  const id = `youth-center:${sourcePolicyId}`;
  const description = getString(record, ["plcyExplnCn", "polyItcnCn", "description", "policyDescription"]) ?? "";
  const supportDetails = getString(record, ["plcySprtCn", "sporCn", "supportDetails", "supportContent"]) ?? "";
  const regionValue = getString(record, ["zipCd", "regionCode", "region", "rgtrInstCdNm", "sprtTrgtRgnCn"]);
  const regions = parseRegionValues(regionValue);
  const ageText = getString(record, ["sprtTrgtAgeCn", "ageInfo", "ageCondition"]);
  const ageMin = parseInteger(getString(record, ["sprtTrgtMinAge", "minAge", "ageMin"])) ??
    parseInteger(ageText);
  const ageNumbers = ageText?.match(/\d{1,3}/g) ?? [];
  const ageMax = parseInteger(getString(record, ["sprtTrgtMaxAge", "maxAge", "ageMax"])) ??
    (ageNumbers.length > 1 ? Number.parseInt(ageNumbers[1] ?? "", 10) : null);
  const applicationRange = parseDateRange(
    getString(record, ["aplyYmd", "rqutPrdCn", "applicationPeriod", "bizPrd"]),
  );
  const businessRange = parseDateRange(getString(record, ["bizPrd", "businessPeriod", "plcyPrd"]));
  const applicationUrl = safeHttpUrl(
    getString(record, ["aplyUrlAddr", "rqutUrla", "applicationUrl", "applyUrl"]),
  );
  const referenceUrls = [
    safeHttpUrl(getString(record, ["refUrlAddr1", "refUrl1", "referenceUrl"])),
    safeHttpUrl(getString(record, ["refUrlAddr2", "refUrl2"])),
    applicationUrl,
  ].filter((url): url is string => url !== null);
  const sourceUrl = referenceUrls[0] ?? OFFICIAL_API_DOCUMENTATION;
  const incomeCondition = getString(record, ["earnCndSeCd", "incomeCondition", "accrRqisCn"]);
  const employmentStatuses = splitList(
    getString(record, ["jobCd", "empmSttsCn", "employmentStatus", "empmSttsCndCn"]),
  );
  const educationCondition = getString(record, ["schoolCd", "educationCondition", "acdmcrCn"]);
  const majorCondition = getString(record, ["plcyMajorCd", "majorCondition", "majrRqisCn"]);
  const maritalCondition = getString(record, ["marriageCd", "maritalCondition", "mrgSttsCn"]);
  const specialConditions = splitList(
    getString(record, ["sBizCd", "specialCondition", "addAplyQlfcCndCn"]),
  );
  const rawForHash = {
    sourcePolicyId,
    title,
    description,
    supportDetails,
    regionValue,
    ageMin,
    ageMax,
    applicationRange,
    businessRange,
    applicationUrl,
    referenceUrls,
    incomeCondition,
    employmentStatuses,
    educationCondition,
    majorCondition,
    maritalCondition,
    specialConditions,
    raw: record,
  };
  const sourceHash = await sha256Hex(stableJson(rawForHash));
  const policy: Policy = {
    id,
    source: "youth_center",
    sourcePolicyId,
    title,
    description,
    supportDetails,
    largeCategory: getString(record, ["lclsfNm", "polyRlmCd", "largeCategory", "plcyLclsfNm"]),
    mediumCategory: getString(record, ["mclsfNm", "mediumCategory", "plcyMclsfNm"]),
    managingOrganization: getString(record, ["sprvsnInstCdNm", "cnsgNmor", "managingOrganization"]),
    operatingOrganization: getString(record, ["operInstCdNm", "operInstNm", "operatingOrganization"]),
    regionCodes: regions.codes,
    regionNames: regions.names,
    ageMin,
    ageMax: Number.isFinite(ageMax) ? ageMax : null,
    incomeCondition,
    employmentStatuses,
    educationCondition,
    majorCondition,
    maritalCondition,
    specialConditions,
    applicationStartDate:
      normalizeDate(getString(record, ["aplyBgngYmd", "applicationStartDate"])) ?? applicationRange.start,
    applicationEndDate:
      normalizeDate(getString(record, ["aplyEndYmd", "applicationEndDate"])) ?? applicationRange.end,
    businessStartDate:
      normalizeDate(getString(record, ["bizBgngYmd", "businessStartDate"])) ?? businessRange.start,
    businessEndDate:
      normalizeDate(getString(record, ["bizEndYmd", "businessEndDate"])) ?? businessRange.end,
    applicationMethod: getString(record, ["aplyMthdCn", "rqutProcCn", "applicationMethod"]),
    applicationUrl,
    requiredDocuments: splitList(getString(record, ["sbmsnDcmntCn", "pstnPaprCn", "requiredDocuments"])),
    referenceUrls: [...new Set(referenceUrls)],
    currentStatus: "active",
    sourceUpdatedAt: getString(record, ["lastMdfcnDt", "mdfcnDt", "sourceUpdatedAt"]),
    collectedAt: observedAt,
    firstSeenAt: observedAt,
    lastSeenAt: observedAt,
    missingCount: 0,
    sourceHash,
    sourceUrl,
    isMock: false,
  };

  const conditions: PolicyCondition[] = [];
  if (ageMin !== null) conditions.push(condition(id, "age_min", ">=", String(ageMin), ageText ?? `${ageMin}세 이상`, sourceUrl, false));
  if (policy.ageMax !== null) conditions.push(condition(id, "age_max", "<=", String(policy.ageMax), ageText ?? `${policy.ageMax}세 이하`, sourceUrl, false));
  if (regions.codes.length > 0 && !regions.codes.includes("00")) {
    conditions.push(condition(id, "region", "in", JSON.stringify(regions.codes), regionValue ?? regions.names.join(", "), sourceUrl, false));
  }
  if (incomeCondition) conditions.push(condition(id, "income", "manual", null, incomeCondition, sourceUrl, true));
  if (employmentStatuses.length > 0) conditions.push(condition(id, "employment", "in", JSON.stringify(employmentStatuses), employmentStatuses.join(", "), sourceUrl, false));
  if (educationCondition) conditions.push(condition(id, "education", "manual", null, educationCondition, sourceUrl, true));
  if (majorCondition) conditions.push(condition(id, "major", "manual", null, majorCondition, sourceUrl, true));
  if (maritalCondition) conditions.push(condition(id, "marital", "manual", null, maritalCondition, sourceUrl, true));
  for (const special of specialConditions) conditions.push(condition(id, "special", "manual", null, special, sourceUrl, true));

  const evidenceFields: Array<[string, string]> = [
    ["title", title],
    ["description", description],
    ["supportDetails", supportDetails],
    ["applicationPeriod", [policy.applicationStartDate, policy.applicationEndDate].filter(Boolean).join(" ~ ")],
    ["eligibility", [ageText, incomeCondition, employmentStatuses.join(", ")].filter(Boolean).join(" / ")],
  ];
  const evidence: PolicyEvidence[] = evidenceFields
    .filter(([, text]) => text.length > 0)
    .map(([fieldPath, text]) => ({
      id: `${id}:evidence:${fieldPath}`,
      policyId: id,
      fieldPath,
      sourceName: "온통청년 청년정책 API",
      sourceId: sourcePolicyId,
      sourceUrl,
      evidenceText: text,
      effectiveDate: policy.sourceUpdatedAt,
      verifiedAt: observedAt,
      confidence: "high",
      sourceHash,
      conflictNote: null,
    }));

  const legalName = getString(record, ["lawNm", "legalBasisName", "rfrncLawCn"]);
  const legalUrl = safeHttpUrl(getString(record, ["lawUrl", "legalBasisUrl"]));
  const legalBases: PolicyLegalBasis[] = legalName
    ? [
        {
          id: `${id}:legal:0`,
          policyId: id,
          legalId: getString(record, ["lawId", "legalBasisId"]),
          legalName,
          article: getString(record, ["lawArticle", "article"]),
          effectiveDate: normalizeDate(getString(record, ["lawEffectiveDate"])),
          promulgationDate: normalizeDate(getString(record, ["lawPromulgationDate"])),
          responsibleAgency: policy.managingOrganization,
          sourceUrl: legalUrl ?? sourceUrl,
          linkMethod: "source",
          confidence: legalUrl ? "high" : "low",
          verifiedAt: observedAt,
          manualReview: !legalUrl,
        },
      ]
    : [];

  return { policy, conditions, evidence, legalBases, rawResponse: record };
}
