import Link from "next/link";
import { ChangePreview, IndicatorStatus, KoreaCartogram, PolicyConstellation, ProvenanceCard, PulseGrid, SourceMarquee } from "@/components/DashboardVisuals";
import { DataStamp } from "@/components/DataStamp";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { policies, snapshot } from "@/lib/data";

export default function Home() {
  return (
    <div className="site-root">
      <a className="skip-link" href="#main">본문 바로가기</a>
      <SiteHeader />
      <main id="main">
        <section className="hero shell">
          <div className="hero-copy">
            <div className="hero-topline"><span>대한민국 청년정책 데이터 인프라</span><DataStamp compact /></div>
            <h1><span>청년정책이</span><br />어떻게 변하고 있는지,<br /><em>데이터로 확인하세요.</em></h1>
            <p>중앙정부와 지방정부의 청년정책을 하나의 기준으로 연결하고,<br className="desktop-only" /> 생성·변경·집행·종료의 전 과정을 투명하게 기록합니다.</p>
            <form className="hero-search" action="/policies" method="get" role="search">
              <label className="sr-only" htmlFor="hero-query">정책 검색</label>
              <span aria-hidden="true">⌕</span>
              <input id="hero-query" name="q" placeholder="정책명 또는 ‘월세가 부담돼요’처럼 검색" />
              <button type="submit">탐색하기 <span>→</span></button>
            </form>
            <div className="hero-actions">
              <Link className="button" href="/changes">오늘 바뀐 정책 <span>↗</span></Link>
              <Link className="button button-ghost" href="/policies">정책 데이터 탐색</Link>
              <span className="hero-note">※ 신청 가능 여부는 공식 원문에서 최종 확인</span>
            </div>
          </div>
          <div className="hero-observatory" aria-label="Y-HUB 데이터 관측 상태">
            <div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit orbit-three" />
            <div className="signal-axis x" /><div className="signal-axis y" />
            <div className="observatory-core"><span>LIVE</span><b>Y</b><small>POLICY SIGNAL</small></div>
            <div className="signal-point p1"><i /><span>주거</span></div>
            <div className="signal-point p2"><i /><span>일자리</span></div>
            <div className="signal-point p3"><i /><span>금융</span></div>
            <div className="signal-point p4"><i /><span>대전</span></div>
            <div className="scan-label l1"><b>{policies.length}</b><span>정책 레코드</span></div>
            <div className="scan-label l2"><b>08</b><span>변경 이벤트</span></div>
            <div className="coordinates">36.3504° N · 127.3845° E<br />SNAPSHOT {snapshot.basisDate}</div>
          </div>
        </section>

        <div className="shell"><SourceMarquee /></div>

        <section className="pulse-section shell" aria-labelledby="pulse-heading">
          <div className="section-heading split-heading">
            <div><span className="eyebrow cyan">POLICY DATA PULSE</span><h2 id="pulse-heading">지금, 정책 데이터는</h2></div>
            <p>{snapshot.notice}</p>
          </div>
          <PulseGrid />
        </section>

        <section className="shell dashboard-grid">
          <ChangePreview />
          <ProvenanceCard />
          <KoreaCartogram />
          <PolicyConstellation />
          <IndicatorStatus />
        </section>

        <section className="shell audience-section">
          <div className="section-heading split-heading">
            <div><span className="eyebrow violet">ONE DATA, MANY QUESTIONS</span><h2>같은 데이터, 다른 질문</h2></div>
            <p>연구자는 재현하고, 기자는 추적하며, 시민은 이해하고, 공무원은 비교할 수 있습니다.</p>
          </div>
          <div className="audience-grid">
            <Link href="/research"><span>01 · RESEARCHER</span><h3>시점과 조건을<br />재현합니다.</h3><p>정책·변경·출처 데이터를 같은 조건으로 다시 추출하고 인용하세요.</p><b>Research Lab →</b></Link>
            <Link href="/newsroom"><span>02 · NEWSROOM</span><h3>변화를 먼저<br />발견합니다.</h3><p>자격·지원·기간의 변경을 전후 원문과 함께 추적하세요.</p><b>Newsroom →</b></Link>
            <Link href="/policies"><span>03 · CITIZEN</span><h3>내 상황의 정책을<br />쉽게 찾습니다.</h3><p>정책명을 몰라도 지금 필요한 도움에서 출발할 수 있습니다.</p><b>정책 찾기 →</b></Link>
            <Link href="/compare"><span>04 · PUBLIC OFFICER</span><h3>지역과 제도를<br />비교합니다.</h3><p>유사정책과 검증 공백을 찾아 더 나은 정책을 설계하세요.</p><b>비교 도구 →</b></Link>
          </div>
        </section>

        <section className="final-cta">
          <div className="shell final-cta-inner">
            <div><span className="eyebrow green">OPEN DATA INFRASTRUCTURE</span><h2>대한민국 청년정책의<br />변화를 함께 기록합니다.</h2></div>
            <div><p>데이터를 내려받고, 출처를 검증하고,<br />잘못된 정보를 정정할 수 있습니다.</p><div><Link className="button" href="/downloads">데이터셋 받기</Link><Link className="button button-ghost" href="/verification">검증 참여하기</Link></div></div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
