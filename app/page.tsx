import Link from "next/link";
import {
  ChangePreview,
  IndicatorStatus,
  KoreaCartogram,
  PolicyConstellation,
  ProvenanceCard,
  PulseGrid,
  SourceMarquee,
} from "@/components/DashboardVisuals";
import { DataStamp } from "@/components/DataStamp";
import { McpConnectionCard } from "@/components/McpConnectionCard";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { YouthPolicyAtlas } from "@/components/YouthPolicyAtlas";
import { changes, indicators, policies, pulse, snapshot, sources } from "@/lib/data";

const modules = [
  { index: "01", code: "POLICY REGISTRY", title: "정책 대장", copy: "정책·프로그램·모집회차와 버전을 분리해 기록합니다.", href: "/policies", meta: `${policies.length}개 정책` },
  { index: "02", code: "CHANGE STREAM", title: "변화 관측소", copy: "신규·자격·지원·기간 변화를 전후 값과 근거로 추적합니다.", href: "/changes", meta: `${changes.length}개 이벤트` },
  { index: "03", code: "YOUTH OBSERVATORY", title: "청년지표", copy: "인구·고용·주거·소득·이동 지표와 정책을 연결합니다.", href: "/indicators", meta: `${indicators.length}개 지표` },
  { index: "04", code: "POLICY MAP", title: "정책 지도", copy: "중앙정부 공통정책과 지역 고유정책을 한 좌표에서 비교합니다.", href: "/map", meta: "17개 시도" },
  { index: "05", code: "RESEARCH LAB", title: "연구 데이터랩", copy: "조건과 시점을 재현하고 CSV·JSON으로 인용 가능한 데이터를 받습니다.", href: "/research", meta: snapshot.datasetVersion },
  { index: "06", code: "NEWSROOM", title: "변화 뉴스룸", copy: "보도 가치가 있는 정책 신호를 공식 근거와 함께 먼저 확인합니다.", href: "/newsroom", meta: `오늘 ${pulse.detectedToday}건` },
  { index: "07", code: "VERIFICATION", title: "공개 검증대장", copy: "출처·완전성·최신성·검증 상태와 정정 이력을 공개합니다.", href: "/verification", meta: `${sources.length}개 출처` },
] as const;

export default function Home() {
  return (
    <div className="site-root hub-root">
      <a className="skip-link" href="#main">본문 바로가기</a>
      <SiteHeader />
      <main id="main">
        <section className="hub-hero shell" aria-labelledby="hub-title">
          <div className="hub-hero-copy">
            <div className="hero-topline">
              <span>YOUTH POLICY DATA INFRASTRUCTURE</span>
              <DataStamp compact />
            </div>
            <h1 id="hub-title"><span>AI로 시각화한</span><br /><em>대한민국 청년정책</em></h1>
            <p className="hub-hero-lead">대한민국 청년정책의 <b>현재와 변화</b>를 한곳에서.</p>
            <p className="hub-hero-description">중앙정부와 지방정부의 정책을 수집·표준화하고 대상, 혜택, 절차, 기관, 법적 근거와 변경 이력을 공식 출처까지 연결합니다.</p>
            <form className="hero-search" action="/policies" method="get" role="search">
              <label className="sr-only" htmlFor="hero-query">정책 또는 필요한 도움 검색</label>
              <span aria-hidden="true">⌕</span>
              <input id="hero-query" name="q" placeholder="‘월세가 부담돼요’처럼 필요한 도움을 입력하세요" />
              <button type="submit">정책 찾기 <span>→</span></button>
            </form>
            <div className="hero-actions">
              <Link className="button" href="/changes">오늘 바뀐 정책 <span>↗</span></Link>
              <Link className="button button-ghost" href="/policies">정책 데이터 탐색</Link>
            </div>
            <div className="hub-trust-row" aria-label="데이터 공개 상태">
              <span><i className="live-dot" />지속 수집</span>
              <span><b>{policies.length}</b> 등록 정책</span>
              <span><b>{sources.length}</b> 공식 출처</span>
              <span>기준일 <b>{snapshot.basisDate.replaceAll("-", ".")}</b></span>
            </div>
            <p className="hero-note">신청 가능 여부와 자격조건은 연결된 공식 원문에서 최종 확인하세요.</p>
          </div>

          <div className="hub-hero-galaxy" aria-label="첫 화면 청년정책 시각화">
            <YouthPolicyAtlas embedded />
          </div>
        </section>

        <div className="shell"><SourceMarquee /></div>
        <div className="shell"><McpConnectionCard /></div>

        <section className="pulse-section shell" aria-labelledby="pulse-heading">
          <div className="section-heading split-heading">
            <div><span className="eyebrow cyan">POLICY DATA PULSE</span><h2 id="pulse-heading">지금, 정책 데이터는</h2></div>
            <p>{snapshot.notice}</p>
          </div>
          <PulseGrid />
        </section>

        <section className="hub-modules shell" aria-labelledby="module-heading">
          <div className="section-heading split-heading">
            <div><span className="eyebrow violet">Y-HUB DATA INFRASTRUCTURE</span><h2 id="module-heading">정책을 찾는 데서 끝나지 않습니다</h2></div>
            <p>정책의 생성·변경·집행·종료를 같은 데이터 계보에서 탐색하고 비교합니다.</p>
          </div>
          <div className="hub-module-grid">
            {modules.map((module) => (
              <Link href={module.href} key={module.code}>
                <span>{module.index} · {module.code}</span>
                <h3>{module.title}</h3>
                <p>{module.copy}</p>
                <footer><b>{module.meta}</b><i>↗</i></footer>
              </Link>
            ))}
          </div>
        </section>

        <section className="shell dashboard-grid" aria-label="청년정책 핵심 데이터 화면">
          <ChangePreview />
          <ProvenanceCard />
          <KoreaCartogram />
          <PolicyConstellation />
          <IndicatorStatus />
        </section>

        <section className="hub-data-story shell" aria-labelledby="story-heading">
          <div className="hub-story-copy">
            <span className="eyebrow green">FROM SOURCE TO PUBLIC DATA</span>
            <h2 id="story-heading">정책 한 문장이<br />공개 데이터가 되기까지</h2>
            <p>Y-HUB는 최신 정보만 덮어쓰지 않습니다. 원문을 보존하고 이전 값과 달라진 이유, 감지 시각과 검증 상태를 함께 남깁니다.</p>
            <Link className="text-link" href="/methodology">수집·검증 방법론 보기 <span>↗</span></Link>
          </div>
          <ol className="hub-story-flow">
            <li><span>01</span><div><b>공식 원천 수집</b><p>온통청년·KOSIS·국가법령정보 등 원천별 갱신주기로 확인</p></div></li>
            <li><span>02</span><div><b>표준화·버전 관리</b><p>정책·프로그램·모집회차를 분리하고 이전 스냅샷을 보존</p></div></li>
            <li><span>03</span><div><b>변경 감지</b><p>자격·혜택·기간·기관·법적 근거의 필드 단위 차이를 생성</p></div></li>
            <li><span>04</span><div><b>검증·공개</b><p>자동 감지와 사람 검증을 구분하고 원문·기준일과 함께 공개</p></div></li>
          </ol>
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
            <div><p>데이터를 내려받고, 출처를 검증하고,<br />잘못된 정보를 정정할 수 있습니다.</p><div><Link className="button" href="/downloads">데이터셋 받기</Link><Link className="button button-ghost" href="/verification">검증 참여하기</Link><Link className="button button-ghost" href="/api">Open API</Link></div></div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
