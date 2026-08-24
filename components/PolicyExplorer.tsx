"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { policies, type PolicyCategory, type PolicyStatus } from "@/lib/data";
import { PolicyStatusBadge, VerificationBadge } from "./StatusBadge";

const categories: Array<"전체" | PolicyCategory> = ["전체", "일자리", "주거", "교육", "금융", "복지·문화", "창업", "참여·기반"];

export function PolicyExplorer({ initialQuery = "", initialRegion = "all" }: { initialQuery?: string; initialRegion?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState<(typeof categories)[number]>("전체");
  const [region, setRegion] = useState(initialRegion);
  const [status, setStatus] = useState<"all" | PolicyStatus>("all");
  const [selected, setSelected] = useState<string[]>([]);

  const results = useMemo(() => {
    const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return policies.filter((policy) => {
      const haystack = [policy.officialName, policy.summary, policy.region, policy.leadOrganization, ...policy.eligibility, ...policy.lifeSituations].join(" ").toLowerCase();
      return (!tokens.length || tokens.every((token) => haystack.includes(token)))
        && (category === "전체" || policy.category === category)
        && (region === "all" || (region === "00" ? policy.scope === "national" : policy.regionCode === region))
        && (status === "all" || policy.status === status);
    });
  }, [query, category, region, status]);

  function toggleCompare(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 3 ? [...current, id] : current);
  }

  return (
    <>
      <div className="citizen-search">
        <span className="eyebrow cyan">SITUATION SEARCH</span>
        <label htmlFor="policy-query">지금 어떤 도움이 필요하신가요?</label>
        <div><span aria-hidden="true">⌕</span><input id="policy-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="예: 월세가 부담돼요, 대전에서 창업하고 싶어요" /><button type="button" onClick={() => setQuery("")}>초기화</button></div>
        <ul aria-label="검색 예시">
          {["월세가 부담돼요", "취업을 준비하고 있어요", "창업하고 싶어요", "마음이 너무 힘들어요"].map((example) => <li key={example}><button type="button" onClick={() => setQuery(example)}>{example}</button></li>)}
        </ul>
      </div>

      <div className="policy-toolbar">
        <div className="category-tabs" role="group" aria-label="정책 분야">
          {categories.map((item) => <button type="button" key={item} className={category === item ? "active" : ""} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}
        </div>
        <div className="policy-selects">
          <label>지역<select value={region} onChange={(event) => setRegion(event.target.value)}><option value="all">전체</option><option value="00">중앙정부</option><option value="30">대전</option></select></label>
          <label>상태<select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="all">전체</option><option value="open">신청 가능</option><option value="rolling">상시·수시</option><option value="closed">모집 종료</option><option value="unknown">최신 확인</option></select></label>
        </div>
      </div>

      <div className="result-count"><span>검색조건에 해당하는 정책</span><b>{results.length}</b></div>
      <div className="policy-card-grid">
        {results.map((policy) => (
          <article className="policy-card" key={policy.id}>
            <div className="policy-card-top"><span className="policy-id">{policy.id}</span><button type="button" className={selected.includes(policy.id) ? "compare-check active" : "compare-check"} onClick={() => toggleCompare(policy.id)} aria-pressed={selected.includes(policy.id)}><i /> 비교</button></div>
            <div className="policy-tags"><span>{policy.category}</span><span>{policy.region}</span></div>
            <h2><Link href={`/policy/${policy.slug}`}>{policy.officialName}</Link></h2>
            <p>{policy.summary}</p>
            <dl><div><dt>대상</dt><dd>{policy.age}</dd></div><div><dt>지원</dt><dd>{policy.benefit}</dd></div><div><dt>기관</dt><dd>{policy.leadOrganization}</dd></div></dl>
            <div className="policy-card-bottom"><div><PolicyStatusBadge status={policy.status} /><VerificationBadge status={policy.verificationStatus} /></div><Link href={`/policy/${policy.slug}`} aria-label={`${policy.officialName} 상세 보기`}>상세 <span>↗</span></Link></div>
          </article>
        ))}
      </div>
      {!results.length && <div className="empty-state"><strong>일치하는 정책이 없습니다.</strong><p>검색어를 줄이거나 지역·상태 필터를 바꿔보세요.</p></div>}
      {selected.length > 0 && <div className="compare-dock"><span><b>{selected.length}</b> / 3개 정책 선택</span><div>{selected.map((id) => <button key={id} type="button" onClick={() => toggleCompare(id)}>{policies.find((policy) => policy.id === id)?.officialName} ×</button>)}</div><Link className="button button-small" href={`/compare?ids=${selected.join(",")}`}>비교하기 →</Link></div>}
    </>
  );
}
