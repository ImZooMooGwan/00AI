import { formatPolicyStatus, formatVerification, type PolicyStatus, type VerificationStatus } from "@/lib/data";

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  return <span className={`status-badge verify-${status}`}><i aria-hidden="true" />{formatVerification(status)}</span>;
}

export function PolicyStatusBadge({ status }: { status: PolicyStatus }) {
  return <span className={`status-badge policy-${status}`}><i aria-hidden="true" />{formatPolicyStatus(status)}</span>;
}

export function ImpactBadge({ impact }: { impact: string }) {
  const labels: Record<string, string> = {
    critical: "긴급",
    high: "높음",
    medium: "보통",
    low: "낮음",
    informational: "정보",
  };
  return <span className={`impact-badge impact-${impact}`}>{labels[impact] ?? impact}</span>;
}

