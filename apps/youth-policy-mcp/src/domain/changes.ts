import type { FieldChange, Policy } from "./types";

const IGNORED_FIELDS = new Set([
  "collectedAt",
  "firstSeenAt",
  "lastSeenAt",
  "missingCount",
  "sourceHash",
]);

const MAJOR_FIELDS = new Set([
  "supportDetails",
  "ageMin",
  "ageMax",
  "incomeCondition",
  "employmentStatuses",
  "applicationStartDate",
  "applicationEndDate",
  "businessStartDate",
  "businessEndDate",
  "applicationMethod",
  "applicationUrl",
  "requiredDocuments",
  "managingOrganization",
  "operatingOrganization",
  "currentStatus",
]);

function stable(value: unknown): string {
  if (Array.isArray(value)) return JSON.stringify([...value].sort());
  if (value && typeof value === "object") {
    const sorted = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right),
    );
    return JSON.stringify(Object.fromEntries(sorted));
  }
  return JSON.stringify(value);
}

export function diffPolicies(previous: Policy, current: Policy): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const field of Object.keys(current) as (keyof Policy)[]) {
    if (IGNORED_FIELDS.has(field)) continue;
    const previousValue = previous[field];
    const currentValue = current[field];
    if (stable(previousValue) === stable(currentValue)) continue;
    changes.push({
      field,
      previousValue,
      currentValue,
      impact: MAJOR_FIELDS.has(field) ? "major" : "minor",
    });
  }
  return changes;
}
