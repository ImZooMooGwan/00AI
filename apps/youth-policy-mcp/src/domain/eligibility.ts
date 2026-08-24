import { normalizeRegionCode, regionMatches } from "./regions";
import type {
  EligibilityCheck,
  EligibilityProfile,
  EligibilityResult,
  PolicyBundle,
} from "./types";

function addCheck(
  checks: EligibilityCheck[],
  check: EligibilityCheck,
  missingInformation: string[],
  followUpQuestions: string[],
): void {
  checks.push(check);
  if (check.state === "unknown") {
    missingInformation.push(check.condition);
    followUpQuestions.push(`${check.condition} 정보를 알려주세요.`);
  }
}

export function evaluateEligibility(
  bundle: PolicyBundle,
  profile: EligibilityProfile,
): EligibilityResult {
  const { policy } = bundle;
  const checks: EligibilityCheck[] = [];
  const missingInformation: string[] = [];
  const followUpQuestions: string[] = [];
  const agencyConfirmations: string[] = [];

  if (policy.ageMin !== null || policy.ageMax !== null) {
    const requirement = `${policy.ageMin ?? "제한 없음"}세 이상, ${policy.ageMax ?? "제한 없음"}세 이하`;
    if (profile.age === undefined) {
      addCheck(
        checks,
        {
          condition: "연령",
          policyRequirement: requirement,
          userValue: null,
          state: "unknown",
          reason: "연령이 입력되지 않아 자동 판정할 수 없습니다.",
          evidence: policy.sourceUrl,
        },
        missingInformation,
        followUpQuestions,
      );
    } else {
      const passesMinimum = policy.ageMin === null || profile.age >= policy.ageMin;
      const passesMaximum = policy.ageMax === null || profile.age <= policy.ageMax;
      checks.push({
        condition: "연령",
        policyRequirement: requirement,
        userValue: profile.age,
        state: passesMinimum && passesMaximum ? "pass" : "fail",
        reason:
          passesMinimum && passesMaximum
            ? "입력한 연령이 정책의 명시된 범위에 포함됩니다."
            : "입력한 연령이 정책의 명시된 범위를 벗어납니다.",
        evidence: policy.sourceUrl,
      });
    }
  }

  if (!policy.regionCodes.includes("00")) {
    const requirement = policy.regionNames.join(", ") || policy.regionCodes.join(", ");
    if (!profile.region) {
      addCheck(
        checks,
        {
          condition: "거주지역",
          policyRequirement: requirement,
          userValue: null,
          state: "unknown",
          reason: "거주지역이 입력되지 않아 자동 판정할 수 없습니다.",
          evidence: policy.sourceUrl,
        },
        missingInformation,
        followUpQuestions,
      );
    } else {
      const code = normalizeRegionCode(profile.region);
      const passes = regionMatches(policy.regionCodes, [code]);
      checks.push({
        condition: "거주지역",
        policyRequirement: requirement,
        userValue: profile.region,
        state: passes ? "pass" : "fail",
        reason: passes
          ? "입력한 지역이 정책 적용지역에 포함됩니다."
          : "입력한 지역은 정책 적용지역에 포함되지 않습니다.",
        evidence: policy.sourceUrl,
      });
    }
  }

  if (policy.employmentStatuses.length > 0) {
    const requirement = policy.employmentStatuses.join(", ");
    if (!profile.employmentStatus) {
      addCheck(
        checks,
        {
          condition: "취업상태",
          policyRequirement: requirement,
          userValue: null,
          state: "unknown",
          reason: "취업상태가 입력되지 않아 자동 판정할 수 없습니다.",
          evidence: policy.sourceUrl,
        },
        missingInformation,
        followUpQuestions,
      );
    } else {
      const normalizedUserValue = profile.employmentStatus.replace(/\s+/g, "").toLowerCase();
      const passes = policy.employmentStatuses.some((status) => {
        const normalizedStatus = status.replace(/\s+/g, "").toLowerCase();
        return normalizedStatus.includes(normalizedUserValue) || normalizedUserValue.includes(normalizedStatus);
      });
      checks.push({
        condition: "취업상태",
        policyRequirement: requirement,
        userValue: profile.employmentStatus,
        state: passes ? "pass" : "fail",
        reason: passes
          ? "입력한 취업상태가 명시된 대상에 포함됩니다."
          : "입력한 취업상태가 명시된 대상과 일치하지 않습니다.",
        evidence: policy.sourceUrl,
      });
    }
  }

  const manualConditions: Array<{
    name: string;
    requirement: string | null;
    userValue: string | number | undefined;
  }> = [
    {
      name: "소득",
      requirement: policy.incomeCondition,
      userValue: profile.incomeBand ?? profile.income,
    },
    { name: "학력", requirement: policy.educationCondition, userValue: profile.education },
    { name: "전공", requirement: policy.majorCondition, userValue: profile.major },
    { name: "혼인상태", requirement: policy.maritalCondition, userValue: profile.maritalStatus },
  ];

  for (const item of manualConditions) {
    if (!item.requirement) continue;
    const hasUserValue = item.userValue !== undefined && item.userValue !== "";
    checks.push({
      condition: item.name,
      policyRequirement: item.requirement,
      userValue: hasUserValue ? item.userValue ?? null : null,
      state: hasUserValue ? "manual" : "unknown",
      reason: hasUserValue
        ? "원문 조건이 자유서술형이어서 담당기관의 수동 확인이 필요합니다."
        : "판정에 필요한 정보가 입력되지 않았습니다.",
      evidence: policy.sourceUrl,
    });
    if (hasUserValue) {
      agencyConfirmations.push(`${item.name}: ${item.requirement}`);
    } else {
      missingInformation.push(item.name);
      followUpQuestions.push(`${item.name} 정보를 알려주세요.`);
    }
  }

  for (const special of policy.specialConditions) {
    const provided = profile.specialConditions ?? [];
    checks.push({
      condition: "특화조건",
      policyRequirement: special,
      userValue: provided.length > 0 ? provided.join(", ") : null,
      state: "manual",
      reason: "특화조건은 원문 및 증빙서류를 담당기관과 확인해야 합니다.",
      evidence: policy.sourceUrl,
    });
    agencyConfirmations.push(`특화조건: ${special}`);
  }

  for (const condition of bundle.conditions.filter((item) => item.manualReview)) {
    if (checks.some((check) => check.policyRequirement === condition.rawCondition)) continue;
    checks.push({
      condition: condition.conditionType,
      policyRequirement: condition.rawCondition,
      userValue: null,
      state: "manual",
      reason: "구조화가 불확실한 원문 조건입니다.",
      evidence: condition.evidenceUrl,
    });
    agencyConfirmations.push(condition.rawCondition);
  }

  let status: EligibilityResult["status"] = "eligible";
  if (checks.some((check) => check.state === "fail")) status = "ineligible";
  else if (checks.some((check) => check.state === "manual")) status = "manual_review";
  else if (checks.some((check) => check.state === "unknown")) status = "needs_more_info";

  return {
    policyId: policy.id,
    status,
    checks,
    missingInformation: [...new Set(missingInformation)],
    followUpQuestions: [...new Set(followUpQuestions)],
    agencyConfirmations: [...new Set(agencyConfirmations)],
    disclaimer:
      "이 결과는 공개된 정책 조건에 따른 사전 점검이며 신청 자격, 선정 또는 지원을 보장하지 않습니다. 최종 판단은 공식 공고와 담당기관 확인을 따릅니다.",
  };
}
