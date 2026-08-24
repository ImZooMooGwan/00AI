"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { changes, getPolicy, getSource, type VerificationStatus } from "@/lib/data";
import { ImpactBadge, VerificationBadge } from "./StatusBadge";

export function ChangeExplorer() {
  const [type, setType] = useState("all");
  const [verification, setVerification] = useState<"all" | VerificationStatus>("all");
  const [impact, setImpact] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(changes[0]?.id ?? null);

  const results = useMemo(() => changes.filter((change) =>
    (type === "all" || change.type === type)
    && (verification === "all" || change.verificationStatus === verification)
    && (impact === "all" || change.impact === impact)
  ), [type, verification, impact]);

  return (
    <div className="change-explorer">
      <div className="change-filter-grid">
        <fieldset><legend>기간</legend><div><button className="active" type="button">이번 주</button><button type="button">오늘</button><button type="button">이번 달</button></div></fieldset>
        <label>변경유형<select value={type} onChange={(e) => setType(e.target.value)}><option value="all">전체 유형</option>{Array.from(new Set(changes.map((c) => c.type))).map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>검증상태<select value={verification} onChange={(e) => setVerification(e.target.value as typeof verification)}><option value="all">전체 상태</option><option value="verified">검증 완료</option><option value="partially_verified">부분 검증</option><option value="review_required">검증 필요</option></select></label>
        <label>영향도<select value={impact} onChange={(e) => setImpact(e.target.value)}><option value="all">전체 영향도</option><option value="high">높음</option><option value="medium">보통</option><option value="low">낮음</option><option value="informational">정보</option></select></label>
      </div>
      <div className="stream-summary"><span><i /> 최근 수집 정상</span><b>{results.length}개 변화</b><small>자동 감지 {changes.filter((c) => c.verificationStatus !== "verified").length} · 검증 완료 {changes.filter((c) => c.verificationStatus === "verified").length}</small></div>
      <div className="timeline-stream">
        {results.map((change) => {
          const policy = getPolicy(change.policyId);
          const source = getSource(change.sourceId);
          const open = expanded === change.id;
          return (
            <article className={`timeline-event ${open ? "open" : ""}`} key={change.id}>
              <div className="timeline-time"><time>{new Date(change.detectedAt).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" })}</time><span>{new Date(change.detectedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false })}</span></div>
              <span className={`timeline-node impact-${change.impact}`} aria-hidden="true" />
              <div className="event-body">
                <button className="event-toggle" type="button" onClick={() => setExpanded(open ? null : change.id)} aria-expanded={open}>
                  <span className="event-kicker"><b>{change.type}</b><i>{policy?.region}</i><ImpactBadge impact={change.impact} /></span>
                  <strong>{policy?.officialName}</strong><small>{change.summary}</small><em>{open ? "접기 −" : "변경 전후 보기 +"}</em>
                </button>
                {open && <div className="event-detail">
                  <div className="diff-view"><section><span>이전</span><p>{change.previousValue}</p></section><div aria-hidden="true">→</div><section><span>변경</span><p>{change.currentValue}</p></section></div>
                  <div className="evidence-row"><VerificationBadge status={change.verificationStatus} /><span>감지 {change.detectedAt.slice(0, 16).replace("T", " ")}</span><span>필드 {change.field}</span>{source && <a href={source.url} target="_blank" rel="noreferrer">공식 원문 ↗</a>}<Link href={`/policy/${policy?.slug}`}>정책 상세 →</Link></div>
                </div>}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

