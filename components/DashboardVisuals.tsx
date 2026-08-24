import Link from "next/link";
import { changes, getPolicy, getSource, indicators, policies, pulse, regions } from "@/lib/data";
import { ImpactBadge, VerificationBadge } from "./StatusBadge";

const pulseItems = [
  ["등록 정책", pulse.registered, "레지스트리"],
  ["운영·상시", pulse.active, "현재 상태"],
  ["신청접수중", pulse.open, "공식 페이지 기준"],
  ["오늘 감지", pulse.detectedToday, "변경 이벤트"],
  ["검증 완료", pulse.verified, "사람 검토"],
  ["공식 출처", pulse.sourceCount, "원천 연결"],
] as const;

export function PulseGrid() {
  return (
    <section className="pulse-grid" aria-label="정책 데이터 현황">
      {pulseItems.map(([label, value, note], index) => (
        <article className="pulse-item" key={label}>
          <span className="pulse-index">0{index + 1}</span>
          <strong>{value.toLocaleString("ko-KR")}</strong>
          <h3>{label}</h3>
          <p>{note}</p>
        </article>
      ))}
    </section>
  );
}

export function ChangePreview() {
  return (
    <section className="panel change-panel" aria-labelledby="change-heading">
      <div className="panel-heading">
        <div>
          <span className="eyebrow cyan">CHANGE STREAM</span>
          <h2 id="change-heading">오늘의 정책 변화</h2>
        </div>
        <Link className="text-link" href="/changes">전체 변화 보기 <span>↗</span></Link>
      </div>
      <div className="change-list">
        {changes.slice(0, 5).map((change) => {
          const policy = getPolicy(change.policyId);
          return (
            <Link className="change-row" href={`/policy/${policy?.slug ?? ""}`} key={change.id}>
              <time>{new Date(change.detectedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false })}</time>
              <span className={`change-symbol impact-${change.impact}`} aria-hidden="true" />
              <span className="change-copy">
                <b>{policy?.officialName}</b>
                <small>{change.summary}</small>
              </span>
              <span className="change-meta">
                <ImpactBadge impact={change.impact} />
                <VerificationBadge status={change.verificationStatus} />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

const cartogramPositions: Record<string, [number, number]> = {
  서울: [3, 3], 인천: [2, 3], 경기: [3, 4], 강원: [4, 4], 충남: [2, 5], 세종: [3, 5],
  충북: [4, 5], 대전: [3, 6], 경북: [5, 5], 전북: [2, 7], 대구: [5, 6], 울산: [6, 6],
  경남: [4, 7], 부산: [5, 7], 광주: [2, 8], 전남: [3, 8], 제주: [1, 9],
};

export function KoreaCartogram() {
  return (
    <section className="panel map-panel" aria-labelledby="map-heading">
      <div className="panel-heading compact-heading">
        <div><span className="eyebrow green">POLICY MAP</span><h2 id="map-heading">대한민국 정책지도</h2></div>
        <Link className="text-link" href="/map">확대 보기 <span>↗</span></Link>
      </div>
      <p className="panel-intro">지역을 선택하면 전국 공통정책과 지역정책을 함께 확인합니다.</p>
      <div className="map-layout">
        <div className="korea-grid" role="img" aria-label="17개 시도별 등록 정책 수 격자 지도">
          {regions.map((region) => {
            const [column, row] = cartogramPositions[region.name];
            return (
              <Link
                href={`/map?region=${region.code}`}
                className={`region-cell ${region.name === "대전" ? "featured" : ""}`}
                style={{ gridColumn: column, gridRow: row }}
                key={region.code}
                aria-label={`${region.name}, 전체 ${region.policyCount}개, 지역 정책 ${region.localCount}개`}
              >
                <b>{region.name}</b><span>{region.policyCount}</span>
              </Link>
            );
          })}
        </div>
        <div className="map-side">
          <span className="map-kicker">LOCAL SIGNAL</span>
          <strong>대전</strong>
          <p>전국 공통 {policies.filter((p) => p.regionCode === "00").length}개 + 지역 {policies.filter((p) => p.regionCode === "30").length}개</p>
          <ul>
            <li><i className="legend national" /> 전국 공통정책</li>
            <li><i className="legend local" /> 지역 고유정책</li>
            <li><i className="legend open" /> 신청접수중</li>
          </ul>
          <Link className="button button-small" href="/policies?region=30">대전 정책 탐색</Link>
        </div>
      </div>
      <p className="source-line">출처: Y-HUB 정책 레지스트리 · 기준일 2026.08.24 · 단위: 정책 패밀리</p>
    </section>
  );
}

const categories = [
  { name: "일자리", x: 160, y: 78, color: "#63ddff" },
  { name: "주거", x: 318, y: 92, color: "#9c87ff" },
  { name: "교육", x: 413, y: 202, color: "#72e8b1" },
  { name: "금융", x: 300, y: 305, color: "#ffd06a" },
  { name: "창업", x: 132, y: 282, color: "#ff79c6" },
  { name: "복지·문화", x: 72, y: 174, color: "#ff9b7b" },
] as const;

export function PolicyConstellation() {
  return (
    <section className="panel universe-panel" aria-labelledby="universe-heading">
      <div className="panel-heading compact-heading">
        <div><span className="eyebrow violet">POLICY GRAPH</span><h2 id="universe-heading">정책 관계지도</h2></div>
        <Link className="text-link" href="/graph">2D 관계 탐색 <span>↗</span></Link>
      </div>
      <p className="panel-intro">분야, 기관, 지역, 대상이 만나는 정책의 연결을 보여줍니다.</p>
      <div className="constellation-wrap">
        <svg className="constellation" viewBox="0 0 480 360" role="img" aria-labelledby="graph-title graph-desc">
          <title id="graph-title">청년정책 분야 관계도</title>
          <desc id="graph-desc">Y-HUB를 중심으로 일자리, 주거, 교육, 금융, 창업, 복지문화 분야가 연결된 관계도</desc>
          <g className="graph-lines">
            {categories.map((cat) => <line key={cat.name} x1="240" y1="180" x2={cat.x} y2={cat.y} />)}
            <line x1="160" y1="78" x2="413" y2="202" /><line x1="318" y1="92" x2="300" y2="305" />
            <line x1="132" y1="282" x2="300" y2="305" />
          </g>
          <g className="graph-center"><circle cx="240" cy="180" r="46" /><circle cx="240" cy="180" r="34" /><text x="240" y="176">Y-HUB</text><text className="sub" x="240" y="195">{policies.length} POLICIES</text></g>
          {categories.map((cat) => {
            const count = policies.filter((policy) => policy.category === cat.name).length;
            return (
              <g className="graph-node" key={cat.name} transform={`translate(${cat.x} ${cat.y})`}>
                <circle r={20 + count * 1.2} fill={cat.color} /><circle className="node-core" r="8" />
                <text y={42}>{cat.name}</text><text className="sub" y={56}>{count}개</text>
              </g>
            );
          })}
        </svg>
        <div className="graph-summary">
          <span>RELATION TYPES</span>
          <dl><div><dt>정책↔분야</dt><dd>{policies.length}</dd></div><div><dt>정책↔기관</dt><dd>{new Set(policies.map((p) => p.leadOrganization)).size}</dd></div><div><dt>정책↔지역</dt><dd>17</dd></div><div><dt>검토 필요</dt><dd>{policies.filter((p) => p.verificationStatus !== "verified").length}</dd></div></dl>
          <p>선 크기나 노드 크기는 레지스트리 연결 수만 반영합니다.</p>
        </div>
      </div>
      <p className="source-line">출처: Y-HUB 레지스트리 내부 관계 · AI 제안 관계는 검증 전 별도 표시</p>
    </section>
  );
}

export function IndicatorStatus() {
  const connected = indicators.filter((indicator) => indicator.status !== "key_required").length;
  return (
    <section className="panel indicator-panel" aria-labelledby="indicator-heading">
      <div className="panel-heading">
        <div><span className="eyebrow amber">YOUTH OBSERVATORY</span><h2 id="indicator-heading">청년지표 관측소</h2></div>
        <Link className="text-link" href="/indicators">지표 전체 보기 <span>↗</span></Link>
      </div>
      <div className="indicator-layout">
        <div className="radar-status" role="img" aria-label={`12개 지표 중 ${connected}개 스냅샷 연결, ${indicators.length - connected}개 API 키 연결 필요`}>
          <div className="radar-rings"><i /><i /><i /><i /></div>
          <span className="radar-sweep" />
          <div className="radar-value"><strong>{connected}</strong><span>/ {indicators.length}</span><small>스냅샷 연결</small></div>
        </div>
        <div className="indicator-list">
          {indicators.slice(0, 6).map((indicator) => (
            <Link href={`/indicators#${indicator.id}`} key={indicator.id}>
              <span>{indicator.category}</span><b>{indicator.name}</b><em className={`data-state ${indicator.status}`}>{indicator.status === "key_required" ? "키 필요" : "메타 연결"}</em>
            </Link>
          ))}
        </div>
      </div>
      <div className="data-caution"><b>숫자를 만들지 않습니다.</b><span>KOSIS 인증키가 없을 때는 값 대신 연결 상태와 마지막 정상 스냅샷을 표시합니다.</span></div>
      <p className="source-line">출처: KOSIS 공유서비스 지표 메타데이터 · 통계값은 API 연결 후 원천 단위로 제공</p>
    </section>
  );
}

export function SourceMarquee() {
  const names = ["온통청년", "KOSIS", "국가법령정보센터", "대전청년포털", "공공데이터포털", "지방재정365"];
  return <div className="source-marquee" aria-label="연결 대상 공식 출처"><span>CONNECTED SOURCES</span>{names.map((name) => <b key={name}>{name}<i /></b>)}</div>;
}

export function ProvenanceCard() {
  const source = getSource("src-daejeon-housing");
  return (
    <aside className="provenance-card">
      <span className="eyebrow green">TRACEABLE BY DESIGN</span>
      <h3>숫자 하나까지<br />출처로 돌아갑니다.</h3>
      <div className="provenance-flow">
        <span>공식 원문</span><i>→</i><span>수집 스냅샷</span><i>→</i><span>필드 검증</span><i>→</i><span>공개 데이터</span>
      </div>
      <dl>
        <div><dt>예시 원천</dt><dd>{source?.name}</dd></div>
        <div><dt>수집 시각</dt><dd>2026.08.24 15:30 KST</dd></div>
        <div><dt>검증 상태</dt><dd>사람 검토 완료</dd></div>
      </dl>
      <Link className="button button-ghost" href="/verification">공개 검증대장 보기</Link>
    </aside>
  );
}
