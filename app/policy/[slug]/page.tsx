import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { PolicyStatusBadge, VerificationBadge } from "@/components/StatusBadge";
import { changes, getPolicy, getSource, policies, snapshot } from "@/lib/data";

export function generateStaticParams() { return policies.map((policy) => ({ slug: policy.slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const policy = getPolicy(slug);
  if (!policy) return { title: "정책을 찾을 수 없음", openGraph: { images: [] }, twitter: { images: [] } };
  return {
    title: policy.officialName,
    description: `${policy.summary} 대상·지원·신청·변경이력과 공식 출처를 확인하세요.`,
    openGraph: { title: `${policy.officialName} | Y-HUB`, description: policy.summary, images: [] },
    twitter: { title: `${policy.officialName} | Y-HUB`, description: policy.summary, images: [] },
  };
}

const steps = [
  ["청년 신청자", "정책 발견", "Y-HUB·공식 포털에서 정책 확인"],
  ["정보시스템", "자격 확인", "구조화 조건과 공식 공고 대조"],
  ["청년 신청자", "신청", "온라인·방문 등 공식 채널 접수"],
  ["사업 수행기관", "접수·심사", "서류 검토와 필요 시 보완 요청"],
  ["지방자치단체", "선정", "선정결과 통보 또는 대상 확정"],
  ["사업 수행기관", "지원·관리", "지원 제공과 사후관리"],
] as const;

export default async function PolicyDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const policy = getPolicy(slug);
  if (!policy) notFound();
  const source = getSource(policy.sourceId);
  const policyChanges = changes.filter((change) => change.policyId === policy.id);
  const related = (policy.relatedPolicyIds.length ? policy.relatedPolicyIds.map(getPolicy).filter(Boolean) : policies.filter((item) => item.id !== policy.id && (item.category === policy.category || item.regionCode === policy.regionCode)).slice(0, 3));

  return (
    <div className="site-root policy-detail-page">
      <a className="skip-link" href="#main">본문 바로가기</a><SiteHeader />
      <main id="main">
        <header className="policy-identity shell">
          <div className="breadcrumb"><Link href="/policies">정책 레지스트리</Link><span>/</span><span>{policy.category}</span><span>/</span><b>{policy.id}</b></div>
          <div className="policy-title-row">
            <div><div className="policy-badges"><span>{policy.scope === "national" ? "중앙정부" : policy.region}</span><span>{policy.category}</span><PolicyStatusBadge status={policy.status} /></div><h1>{policy.officialName}</h1><p>{policy.summary}</p></div>
            <aside><VerificationBadge status={policy.verificationStatus} /><dl><div><dt>데이터 기준일</dt><dd>{snapshot.basisDate}</dd></div><div><dt>최종 검토</dt><dd>{policy.lastReviewedAt ?? "검토 대기"}</dd></div><div><dt>정책 ID</dt><dd>{policy.id}</dd></div></dl>{source && <a className="button button-small" href={source.url} target="_blank" rel="noreferrer">공식 원문 확인 ↗</a>}</aside>
          </div>
        </header>

        <nav className="policy-anchor-nav" aria-label="정책 상세 목차"><div className="shell">{["개요", "대상", "지원", "신청", "절차", "기관·근거", "관련 정책", "변경·검증"].map((label, index) => <a href={`#section-${index + 1}`} key={label}><span>{String(index + 1).padStart(2,"0")}</span>{label}</a>)}</div></nav>

        <div className="shell policy-detail-grid">
          <div className="policy-main">
            <section className="detail-section" id="section-1"><header><span>01</span><div><h2>정책 정체성과 목적</h2><p>이 정책이 무엇이며 어떤 문제를 해결하려는지 설명합니다.</p></div></header><div className="detail-copy lead-copy"><p>{policy.purpose}</p><dl className="fact-grid"><div><dt>공식 정책명</dt><dd>{policy.officialName}</dd></div><div><dt>정책 범위</dt><dd>{policy.scope === "national" ? "전국 공통" : `${policy.region} 지역`}</dd></div><div><dt>최초 관측일</dt><dd>{policy.firstObservedAt}</dd></div><div><dt>현재 상태</dt><dd><PolicyStatusBadge status={policy.status} /></dd></div></dl></div></section>

            <section className="detail-section" id="section-2"><header><span>02</span><div><h2>대상</h2><p>자격을 자연어 한 문장으로 뭉치지 않고 조건별로 나눕니다.</p></div></header><div className="eligibility-grid"><article><span>AGE</span><h3>연령</h3><p>{policy.age}</p></article><article><span>REGION</span><h3>지역</h3><p>{policy.region}</p></article>{policy.eligibility.map((item, index) => <article key={item}><span>RULE {String(index + 1).padStart(2,"0")}</span><h3>{index === 0 ? "핵심 조건" : "추가 확인"}</h3><p>{item}</p></article>)}</div><div className="rule-warning"><b>조건상 관련성이 높음 ≠ 신청 가능 확정</b><span>소득·재산·중복수혜·회차별 예외는 공식 공고와 담당기관에서 최종 확인해야 합니다.</span></div></section>

            <section className="detail-section" id="section-3"><header><span>03</span><div><h2>지원내용</h2><p>지원 형태·규모와 확인이 필요한 한계를 함께 표시합니다.</p></div></header><div className="benefit-focus"><span>BENEFIT</span><strong>{policy.benefit}</strong><p>지원금·지원기간·지원횟수는 모집회차에 따라 달라질 수 있습니다.</p></div></section>

            <section className="detail-section" id="section-4"><header><span>04</span><div><h2>신청정보</h2><p>정책 패밀리와 현재 연결된 모집회차를 구분합니다.</p></div></header><div className="application-sheet"><div><span>APPLICATION ROUND</span><b>{policy.roundId}</b></div><dl><div><dt>신청 상태</dt><dd><PolicyStatusBadge status={policy.status} /></dd></div><div><dt>신청기간</dt><dd>{policy.applicationPeriod}</dd></div><div><dt>신청채널</dt><dd>{policy.applicationChannel}</dd></div><div><dt>제출서류</dt><dd>{policy.requiredDocuments.join(" · ")}</dd></div></dl>{source && <a className="button" href={source.url} target="_blank" rel="noreferrer">공식 신청정보 확인 ↗</a>}</div></section>

            <section className="detail-section" id="section-5"><header><span>05</span><div><h2>정책 신청 스윔레인</h2><p>신청자와 기관이 실제로 수행하는 흐름을 나눠 표시합니다.</p></div></header><div className="swimlane" role="table" aria-label="정책 신청 절차"><div className="swimlane-header" role="row"><span role="columnheader">주체</span><span role="columnheader">단계</span><span role="columnheader">수행 내용</span></div>{steps.map(([actor, stage, description], index) => <div className="swimlane-row" role="row" key={stage}><span role="cell"><i className={`actor-${index % 3}`} />{actor}</span><b role="cell"><em>{String(index + 1).padStart(2,"0")}</em>{stage}</b><p role="cell">{description}</p></div>)}</div><div className="unknown-step"><b>기관별 운영 차이 가능</b><span>공식 자료에서 확인되지 않은 내부 심사·보완 절차는 확정적으로 표시하지 않습니다.</span></div></section>

            <section className="detail-section" id="section-6"><header><span>06</span><div><h2>기관·예산·법적 근거</h2><p>누가 운영하고 무엇이 정책을 증명하는지 연결합니다.</p></div></header><dl className="evidence-table"><div><dt>소관·운영기관</dt><dd>{policy.leadOrganization}</dd><span className="verified-mark">공식출처 확인</span></div><div><dt>예산</dt><dd>{policy.budget}</dd><span className="pending-mark">연결 준비</span></div><div><dt>법적 근거</dt><dd>{policy.legalBasis}</dd><span className="pending-mark">조문 연결 준비</span></div><div><dt>원천 문서</dt><dd>{source?.name ?? "원천 확인 중"}</dd>{source && <a href={source.url} target="_blank" rel="noreferrer">열기 ↗</a>}</div></dl></section>

            <section className="detail-section" id="section-7"><header><span>07</span><div><h2>관련 데이터와 정책</h2><p>같은 분야·지역의 정책을 관계 후보로 제안합니다.</p></div></header><div className="related-grid">{related.map((item) => item && <Link href={`/policy/${item.slug}`} key={item.id}><span>{item.category} · {item.region}</span><h3>{item.officialName}</h3><p>{item.summary}</p><b>관계 후보 · 검토 필요</b></Link>)}</div></section>

            <section className="detail-section" id="section-8"><header><span>08</span><div><h2>변경·검증</h2><p>최신값만 남기지 않고 버전과 정정 근거를 보존합니다.</p></div></header>{policyChanges.length ? <div className="policy-change-list">{policyChanges.map((change) => <article key={change.id}><div><span>{change.type}</span><time>{change.detectedAt.slice(0,10)}</time><VerificationBadge status={change.verificationStatus} /></div><h3>{change.summary}</h3><div className="mini-diff"><p><span>이전</span>{change.previousValue}</p><i>→</i><p><span>변경</span>{change.currentValue}</p></div></article>)}</div> : <div className="empty-state compact-empty"><strong>공개된 변경 이벤트가 없습니다.</strong><p>변경이 없다는 뜻이 아니라, 비교 가능한 이전 스냅샷이 아직 연결되지 않았다는 뜻입니다.</p></div>}<div className="version-strip"><div><span>VERSION 01</span><b>2026.08.24</b><small>최초 레지스트리 스냅샷</small></div><i /><div className="future"><span>NEXT VERSION</span><b>원천 변경 감지 시</b><small>필드 Diff 생성</small></div></div></section>
          </div>

          <aside className="policy-side-rail">
            <div><span className="eyebrow green">DATA QUALITY</span><h3>데이터 품질</h3><dl><div><dt>출처 신뢰도</dt><dd>{source?.kind === "official_notice" ? "공식 원문" : "공식 포털"}</dd></div><div><dt>필수필드</dt><dd>82%</dd></div><div><dt>최신성</dt><dd>기준일 공개</dd></div><div><dt>검증상태</dt><dd>{policy.verificationStatus === "verified" ? "완료" : "추가 검토"}</dd></div></dl></div>
            <div><span className="eyebrow violet">ENTITY MODEL</span><h3>정책 단위</h3><ol><li><b>Policy Family</b><span>{policy.id}</span></li><li><b>Program</b><span>{policy.programId}</span></li><li><b>Application Round</b><span>{policy.roundId}</span></li></ol></div>
            <Link className="button button-ghost" href={`/compare?ids=${policy.id}`}>다른 정책과 비교</Link>
          </aside>
        </div>
      </main><SiteFooter />
    </div>
  );
}

