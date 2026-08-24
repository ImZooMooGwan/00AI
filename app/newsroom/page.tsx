import type { Metadata } from "next";
import Link from "next/link";
import { SubpageFrame } from "@/components/SubpageFrame";
import { ImpactBadge, VerificationBadge } from "@/components/StatusBadge";
import { changes, getPolicy } from "@/lib/data";

export const metadata: Metadata = { title: "Newsroom" };

export default function NewsroomPage() {
  return <SubpageFrame eyebrow="NEWSROOM · VERIFIED SIGNALS" title="Newsroom" description="기사 아이템을 대신 확정하지 않습니다. 관찰된 변화, 근거 데이터, 비교 기준, 확인할 기관과 해석의 주의점을 제공합니다."><div className="newsroom-grid"><section><div className="section-heading"><span className="eyebrow cyan">MONITOR</span><h2>주요 정책 신호</h2></div>{changes.filter((c) => ["high","medium"].includes(c.impact)).map((change) => { const policy = getPolicy(change.policyId); return <article className="news-signal" key={change.id}><header><ImpactBadge impact={change.impact} /><VerificationBadge status={change.verificationStatus} /><time>{change.detectedAt.slice(0,10)}</time></header><h3>{change.summary}</h3><dl><div><dt>관찰된 변화</dt><dd>{change.previousValue} → {change.currentValue}</dd></div><div><dt>관련 정책</dt><dd>{policy?.officialName}</dd></div><div><dt>확인할 기관</dt><dd>{policy?.leadOrganization}</dd></div><div><dt>주의할 해석</dt><dd>변경 원인과 정책 효과는 데이터만으로 단정할 수 없음</dd></div></dl><Link href={`/policy/${policy?.slug}`}>근거 확인 →</Link></article>; })}</section><aside className="watchlist"><span className="eyebrow violet">WATCHLIST</span><h2>관심목록</h2>{["대전 주거정책", "지원금 변경", "청년 창업", "신청기간 연장"].map((item, index) => <label key={item}><input type="checkbox" defaultChecked={index < 2} /><span>{item}</span><i>{index < 2 ? "감시 중" : "추가"}</i></label>)}<div className="feed-links"><Link href="/feed/changes">RSS 변경 피드 ↗</Link><Link href="/api/v1/changes">JSON Feed ↗</Link></div></aside></div></SubpageFrame>;
}
