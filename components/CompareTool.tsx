"use client";

import { useMemo, useState } from "react";
import { policies } from "@/lib/data";
import { PolicyStatusBadge, VerificationBadge } from "./StatusBadge";

export function CompareTool({ initialIds }: { initialIds: string[] }) {
  const defaults = initialIds.length ? initialIds.slice(0, 3) : [policies[3].id, policies[20].id, policies[23].id];
  const [ids, setIds] = useState(defaults);
  const selected = useMemo(() => ids.map((id) => policies.find((p) => p.id === id)).filter(Boolean), [ids]);

  function setPolicy(index: number, id: string) {
    setIds((current) => current.map((item, currentIndex) => currentIndex === index ? id : item));
  }

  const rows = [
    ["정책 범위", (p: (typeof policies)[number]) => p.region],
    ["분야", (p: (typeof policies)[number]) => p.category],
    ["상태", (p: (typeof policies)[number]) => <PolicyStatusBadge status={p.status} />],
    ["연령", (p: (typeof policies)[number]) => p.age],
    ["핵심 자격", (p: (typeof policies)[number]) => p.eligibility.join(" · ")],
    ["지원 내용", (p: (typeof policies)[number]) => p.benefit],
    ["신청 기간", (p: (typeof policies)[number]) => p.applicationPeriod],
    ["운영 기관", (p: (typeof policies)[number]) => p.leadOrganization],
    ["법적 근거", (p: (typeof policies)[number]) => p.legalBasis],
    ["검증", (p: (typeof policies)[number]) => <VerificationBadge status={p.verificationStatus} />],
  ] as const;

  return (
    <div className="compare-tool">
      <div className="compare-selectors">
        {[0,1,2].map((index) => <label key={index}><span>정책 {index + 1}</span><select value={ids[index] ?? ""} onChange={(event) => setPolicy(index, event.target.value)}>{policies.map((policy) => <option key={policy.id} value={policy.id}>{policy.officialName}</option>)}</select></label>)}
      </div>
      <div className="compare-table-wrap"><table className="compare-table"><caption className="sr-only">선택한 청년정책 비교표</caption><thead><tr><th>비교항목</th>{selected.map((policy) => <th key={policy!.id}><span>{policy!.id}</span>{policy!.officialName}</th>)}</tr></thead><tbody>{rows.map(([label, getter]) => <tr key={label}><th scope="row">{label}</th>{selected.map((policy) => <td key={policy!.id}>{getter(policy!)}</td>)}</tr>)}</tbody></table></div>
      <div className="analysis-note"><b>비교 해석 원칙</b><p>조건이 유사하다고 중복수혜 가능·불가능을 단정하지 않습니다. 정책별 공식 공고의 중복수혜 제한과 집행기관 확인이 필요합니다.</p></div>
    </div>
  );
}

