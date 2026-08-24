"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import {
  changes,
  formatPolicyStatus,
  policies,
  pulse,
  regions,
  snapshot,
  sources,
  type PolicyCategory,
  type PolicyRecord,
} from "@/lib/data";

type ViewMode = "galaxy" | "registry";
type RegionMode = "all" | "national" | "daejeon";
type CategoryMode = "전체" | PolicyCategory;
type PlaybackSpeed = 0.5 | 1 | 2;

const GALAXY_CENTER = { x: 380, y: 260 };

const categoryMeta: Array<{
  name: PolicyCategory;
  color: string;
  x: number;
  y: number;
}> = [
  { name: "일자리", color: "#46b7ff", x: 220, y: 122 },
  { name: "주거", color: "#8d7dff", x: 390, y: 88 },
  { name: "교육", color: "#5ee0ac", x: 540, y: 164 },
  { name: "금융", color: "#f6c85f", x: 575, y: 316 },
  { name: "복지·문화", color: "#ff8aa8", x: 465, y: 424 },
  { name: "창업", color: "#ff9b62", x: 268, y: 425 },
  { name: "참여·기반", color: "#46d4d1", x: 150, y: 295 },
];

const regionLabels: Record<RegionMode, string> = {
  all: "전체",
  national: "중앙정부",
  daejeon: "대전",
};

const verificationLabels = {
  verified: "검증 완료",
  partially_verified: "부분 검증",
  review_required: "검증 필요",
  machine_detected: "자동 감지",
} as const;

function matchesRegion(policy: PolicyRecord, region: RegionMode) {
  if (region === "national") return policy.scope === "national";
  if (region === "daejeon") return policy.regionCode === "30";
  return true;
}

const galaxyStars = Array.from({ length: 72 }, (_, index) => ({
  x: (index * 137 + 29) % 760,
  y: (index * 83 + 47) % 520,
  r: 0.45 + (index % 4) * 0.25,
  delay: -((index * 0.19) % 4.8),
}));

function rotatePoint(x: number, y: number, degrees: number) {
  const radians = (degrees * Math.PI) / 180;
  const dx = x - GALAXY_CENTER.x;
  const dy = y - GALAXY_CENTER.y;
  return {
    x: GALAXY_CENTER.x + dx * Math.cos(radians) - dy * Math.sin(radians),
    y: GALAXY_CENTER.y + dx * Math.sin(radians) + dy * Math.cos(radians),
  };
}

function categoryPosition(categoryIndex: number, rotation: number) {
  const category = categoryMeta[categoryIndex];
  return rotatePoint(category.x, category.y, rotation * 0.42);
}

function nodePosition(policy: PolicyRecord, visible: PolicyRecord[], rotation: number) {
  const categoryIndex = categoryMeta.findIndex((item) => item.name === policy.category);
  const safeCategoryIndex = Math.max(categoryIndex, 0);
  const category = categoryPosition(safeCategoryIndex, rotation);
  const siblings = visible.filter((item) => item.category === policy.category);
  const index = Math.max(siblings.findIndex((item) => item.id === policy.id), 0);
  const angleDegrees = index * 137.5 + safeCategoryIndex * 21 + rotation * (1.08 + safeCategoryIndex * 0.045);
  const angle = (angleDegrees * Math.PI) / 180;
  const radius = 42 + (index % 3) * 15;
  const depth = (Math.sin(angle) + 1) / 2;
  return {
    x: category.x + Math.cos(angle) * radius,
    y: category.y + Math.sin(angle) * radius * 0.78,
    depth,
  };
}

function PolicyGalaxy({
  visiblePolicies,
  focusedId,
  onFocus,
}: {
  visiblePolicies: PolicyRecord[];
  focusedId: string;
  onFocus: (id: string) => void;
}) {
  const [rotation, setRotation] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startRotation: 0, resume: true });

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyPreference = () => setPlaying(!media.matches);
    const frame = requestAnimationFrame(applyPreference);
    media.addEventListener("change", applyPreference);
    return () => {
      cancelAnimationFrame(frame);
      media.removeEventListener("change", applyPreference);
    };
  }, []);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let previous = performance.now();
    const animate = (now: number) => {
      const elapsed = Math.min(now - previous, 40);
      previous = now;
      setRotation((current) => (current + elapsed * 0.009 * speed) % 360);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed]);

  const categoryPoints = categoryMeta.map((_, index) => categoryPosition(index, rotation));
  const policyPoints = visiblePolicies.map((policy) => ({ policy, ...nodePosition(policy, visiblePolicies, rotation) }));
  const focusedPoint = policyPoints.find((point) => point.policy.id === focusedId);
  const focusedPolicy = focusedPoint?.policy;
  const sweepAngle = ((rotation * 1.6 - 90) * Math.PI) / 180;
  const sweepPoint = {
    x: GALAXY_CENTER.x + Math.cos(sweepAngle) * 215,
    y: GALAXY_CENTER.y + Math.sin(sweepAngle) * 215,
  };

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startX: event.clientX, startRotation: rotation, resume: playing };
    setPlaying(false);
    setDragging(true);
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (!dragging) return;
    setRotation(dragRef.current.startRotation + (event.clientX - dragRef.current.startX) * 0.38);
  }

  function handlePointerEnd(event: ReactPointerEvent<SVGSVGElement>) {
    if (!dragging) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(false);
    if (dragRef.current.resume) setPlaying(true);
  }

  function handleWheel(event: ReactWheelEvent<SVGSVGElement>) {
    event.preventDefault();
    setZoom((current) => Math.min(1.65, Math.max(0.72, current - event.deltaY * 0.0012)));
  }

  function resetView() {
    setRotation(0);
    setZoom(1);
  }

  return (
    <div className={`policy-galaxy ${playing ? "is-playing" : "is-paused"}`}>
      <div className="galaxy-live-status"><i /><span>{playing ? `자동 공전 · ${speed}×` : "정지됨"}</span><small>드래그 회전 · 휠 확대/축소 · 점 선택</small></div>
      <svg
        className={dragging ? "is-dragging" : ""}
        viewBox="0 0 760 520"
        role="img"
        aria-labelledby="atlas-graph-title atlas-graph-desc"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onWheel={handleWheel}
        onDoubleClick={resetView}
      >
        <title id="atlas-graph-title">대한민국 청년정책 분야 관계지도</title>
        <desc id="atlas-graph-desc">자동으로 공전하며 드래그 회전과 확대 축소가 가능한 청년정책 관계지도. Y-HUB를 중심으로 일자리, 주거, 교육, 금융, 복지문화, 창업, 참여기반 정책이 연결됩니다.</desc>
        <defs>
          <radialGradient id="atlas-core" cx="50%" cy="42%" r="60%">
            <stop offset="0%" stopColor="#1fcab6" stopOpacity=".42" />
            <stop offset="100%" stopColor="#08151d" stopOpacity=".96" />
          </radialGradient>
          <radialGradient id="policy-depth" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity=".95" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity=".08" />
          </radialGradient>
        </defs>
        <g transform={`translate(${GALAXY_CENTER.x} ${GALAXY_CENTER.y}) scale(${zoom}) translate(${-GALAXY_CENTER.x} ${-GALAXY_CENTER.y})`}>
          <g className="galaxy-star-field" aria-hidden="true">
            {galaxyStars.map((star, index) => <circle key={index} cx={star.x} cy={star.y} r={star.r} style={{ animationDelay: `${star.delay}s` }} />)}
          </g>
          <g className="atlas-grid-lines" aria-hidden="true">
            {[80, 160, 240, 320, 400, 480, 560, 640, 720].map((x) => <line key={`x-${x}`} x1={x} x2={x} y1="0" y2="520" />)}
            {[40, 100, 160, 220, 280, 340, 400, 460].map((y) => <line key={`y-${y}`} x1="0" x2="760" y1={y} y2={y} />)}
          </g>
          <g className="atlas-orbits" aria-hidden="true">
            <ellipse cx="380" cy="260" rx="284" ry="205" />
            <ellipse cx="380" cy="260" rx="218" ry="155" />
            <circle cx="380" cy="260" r="102" />
          </g>
          <g className="galaxy-sweep" aria-hidden="true">
            <line x1={GALAXY_CENTER.x} y1={GALAXY_CENTER.y} x2={sweepPoint.x} y2={sweepPoint.y} />
          </g>
          <g className="atlas-category-links" aria-hidden="true">
            {categoryPoints.map((point, index) => (
              <line key={categoryMeta[index].name} x1={GALAXY_CENTER.x} y1={GALAXY_CENTER.y} x2={point.x} y2={point.y} />
            ))}
            {policyPoints.map((point) => {
              const categoryIndex = categoryMeta.findIndex((item) => item.name === point.policy.category);
              const category = categoryPoints[Math.max(categoryIndex, 0)];
              return <line key={point.policy.id} x1={category.x} y1={category.y} x2={point.x} y2={point.y} />;
            })}
          </g>
          <g className="atlas-core-node" aria-hidden="true">
            <circle cx="380" cy="260" r="63" fill="url(#atlas-core)" />
            <circle cx="380" cy="260" r="50" />
            <text x="380" y="251">Y-HUB</text>
            <text className="atlas-core-count" x="380" y="276">{visiblePolicies.length} POLICIES</text>
          </g>
          {categoryMeta.map((category, index) => {
          const count = visiblePolicies.filter((policy) => policy.category === category.name).length;
          const point = categoryPoints[index];
          return (
            <g className={`atlas-category-node ${count === 0 ? "is-muted" : ""}`} key={category.name} transform={`translate(${point.x} ${point.y})`}>
              <circle r={26 + Math.min(count, 5) * 2} fill={category.color} />
              <circle className="atlas-category-core" r="6" />
              <text y="47">{category.name}</text>
              <text className="atlas-category-count" y="61">{count}개</text>
            </g>
          );
        })}
          {policyPoints.map(({ policy, x, y, depth }) => {
          const category = categoryMeta.find((item) => item.name === policy.category)!;
          const isFocused = policy.id === focusedId;
          const baseRadius = policy.status === "open" ? 7 : policy.status === "rolling" ? 5.5 : 4.5;
          const radius = baseRadius * (0.8 + depth * 0.38);
          return (
            <g
              className={`atlas-policy-node ${isFocused ? "is-focused" : ""}`}
              key={policy.id}
              role="button"
              tabIndex={0}
              aria-label={`${policy.officialName}, ${formatPolicyStatus(policy.status)}`}
              transform={`translate(${x} ${y})`}
              style={{ opacity: 0.56 + depth * 0.44 }}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => onFocus(policy.id)}
              onMouseEnter={() => onFocus(policy.id)}
              onFocus={() => onFocus(policy.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") onFocus(policy.id);
              }}
            >
              <circle className="atlas-policy-halo" r={radius + 7} fill={category.color} />
              <circle r={radius} fill={category.color} />
              <circle className="atlas-policy-shine" r={Math.max(1.2, radius * 0.33)} cx={-radius * 0.25} cy={-radius * 0.25} fill="url(#policy-depth)" />
            </g>
          );
        })}
          {focusedPoint && focusedPolicy && (
            <g className="galaxy-tooltip" transform={`translate(${focusedPoint.x} ${focusedPoint.y - 24})`} pointerEvents="none">
              <rect x="-82" y="-25" width="164" height="34" rx="4" />
              <text className="galaxy-tooltip-title" y="-11">{focusedPolicy.officialName.length > 20 ? `${focusedPolicy.officialName.slice(0, 20)}…` : focusedPolicy.officialName}</text>
              <text className="galaxy-tooltip-meta" y="1">{focusedPolicy.category} · {formatPolicyStatus(focusedPolicy.status)}</text>
            </g>
          )}
        </g>
      </svg>
      <div className="galaxy-legend" aria-label="지도 범례">
        <span><i className="legend-dot open" />신청 가능</span>
        <span><i className="legend-dot rolling" />상시·수시</span>
        <span><i className="legend-dot closed" />모집 종료·확인 필요</span>
      </div>
      <div className="galaxy-controls" aria-label="은하 움직임 제어">
        <button className="galaxy-play" type="button" onClick={() => setPlaying((current) => !current)} aria-label={playing ? "자동 공전 일시 정지" : "자동 공전 재생"}>{playing ? "Ⅱ" : "▶"}</button>
        <div className="galaxy-speeds" role="group" aria-label="공전 속도">
          {([0.5, 1, 2] as PlaybackSpeed[]).map((value) => <button type="button" key={value} className={speed === value ? "active" : ""} aria-pressed={speed === value} onClick={() => setSpeed(value)}>{value}×</button>)}
        </div>
        <label className="galaxy-zoom"><span>ZOOM</span><input type="range" min="0.72" max="1.65" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /><b>{Math.round(zoom * 100)}%</b></label>
        <button className="galaxy-reset-view" type="button" onClick={resetView}>시점 초기화</button>
      </div>
    </div>
  );
}

function PolicyRegistry({ visiblePolicies, onFocus }: { visiblePolicies: PolicyRecord[]; onFocus: (id: string) => void }) {
  return (
    <div className="atlas-registry-wrap">
      <table className="atlas-registry">
        <caption className="sr-only">검색 조건에 해당하는 청년정책 대장</caption>
        <thead>
          <tr><th>NO</th><th>정책</th><th>분야</th><th>지역</th><th>상태</th><th>검증</th><th>최종 관측</th></tr>
        </thead>
        <tbody>
          {visiblePolicies.map((policy, index) => (
            <tr key={policy.id} onMouseEnter={() => onFocus(policy.id)}>
              <td>{String(index + 1).padStart(2, "0")}</td>
              <th scope="row"><Link href={`/policy/${policy.slug}`}>{policy.officialName}<small>{policy.summary}</small></Link></th>
              <td><span className={`registry-category category-${categoryMeta.findIndex((item) => item.name === policy.category)}`}>{policy.category}</span></td>
              <td>{policy.region}</td>
              <td><span className={`registry-state state-${policy.status}`}><i />{formatPolicyStatus(policy.status)}</span></td>
              <td>{verificationLabels[policy.verificationStatus]}</td>
              <td>{policy.lastObservedAt.replaceAll("-", ".")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {visiblePolicies.length === 0 && <div className="atlas-empty"><b>조건에 맞는 정책이 없습니다.</b><span>검색어나 분야·지역 조건을 바꿔보세요.</span></div>}
    </div>
  );
}

export function YouthPolicyAtlas() {
  const [view, setView] = useState<ViewMode>("galaxy");
  const [category, setCategory] = useState<CategoryMode>("전체");
  const [region, setRegion] = useState<RegionMode>("all");
  const [query, setQuery] = useState("");
  const [openOnly, setOpenOnly] = useState(false);
  const [focusedId, setFocusedId] = useState(policies.find((policy) => policy.status === "open")?.id ?? policies[0].id);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (event.key === "/" && document.activeElement?.tagName !== "INPUT") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const visiblePolicies = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return policies.filter((policy) => {
      const haystack = [policy.officialName, policy.summary, policy.region, policy.leadOrganization, ...policy.eligibility, ...policy.lifeSituations].join(" ").toLowerCase();
      return (category === "전체" || policy.category === category)
        && matchesRegion(policy, region)
        && (!openOnly || policy.status === "open")
        && (!terms.length || terms.every((term) => haystack.includes(term)));
    });
  }, [category, openOnly, query, region]);

  const focusedPolicy = visiblePolicies.find((policy) => policy.id === focusedId)
    ?? visiblePolicies[0]
    ?? policies.find((policy) => policy.id === focusedId)
    ?? policies[0];
  const verifiedRate = Math.round((pulse.verified / Math.max(policies.length, 1)) * 100);
  const officialSources = sources.filter((source) => ["src-youth-api", "src-kosis", "src-law"].includes(source.id));

  function resetFilters() {
    setCategory("전체");
    setRegion("all");
    setOpenOnly(false);
    setQuery("");
  }

  return (
    <div className="atlas-shell">
      <section className="atlas-summary" aria-labelledby="atlas-title">
        <div className="atlas-title-block">
          <span>YOUTH POLICY ATLAS · 대한민국 청년정책 데이터 지도</span>
          <h1 id="atlas-title">대한민국 청년정책 지도</h1>
          <p>정책·지역·기관·변화를 한 화면에서 탐색합니다.</p>
        </div>
        <form className="atlas-search" role="search" onSubmit={(event) => event.preventDefault()}>
          <label className="sr-only" htmlFor="atlas-query">정책·기관·지역 검색</label>
          <span aria-hidden="true">⌕</span>
          <input ref={searchRef} id="atlas-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="정책명 · 기관 · 지역 · 생활상황 검색" />
          {query && <button type="button" onClick={() => setQuery("")} aria-label="검색어 지우기">×</button>}
          <kbd>/</kbd>
        </form>
        <div className="atlas-metrics" aria-label="Y-HUB 핵심 현황">
          <Link href="/policies"><strong>{policies.length}</strong><span>등록 정책</span></Link>
          <Link href="/changes"><strong>{pulse.detectedToday}</strong><span>오늘 변화</span></Link>
          <Link href="/map"><strong>{regions.length}</strong><span>시·도</span></Link>
          <Link href="/sources"><strong>{pulse.sourceCount}</strong><span>공식 출처</span></Link>
          <Link href="/verification"><strong>{verifiedRate}<em>%</em></strong><span>검증 완료율</span></Link>
        </div>
      </section>

      <section className="atlas-workspace" aria-label="청년정책 통합 탐색 화면">
        <aside className="atlas-sidebar" aria-label="정책 분야와 지역 필터">
          <header><span>분야</span><b>{visiblePolicies.length} / {policies.length}</b></header>
          <div className="atlas-category-list">
            <button type="button" className={category === "전체" ? "active" : ""} onClick={() => setCategory("전체")}>
              <i className="category-all" /><span>전체 정책</span><b>{policies.length}</b>
            </button>
            {categoryMeta.map((item) => (
              <button type="button" className={category === item.name ? "active" : ""} key={item.name} onClick={() => setCategory(item.name)}>
                <i style={{ backgroundColor: item.color }} /><span>{item.name}</span><b>{policies.filter((policy) => policy.category === item.name).length}</b>
              </button>
            ))}
          </div>
          <div className="atlas-filter-block">
            <span>지역 범위</span>
            {Object.entries(regionLabels).map(([value, label]) => (
              <button type="button" key={value} className={region === value ? "active" : ""} onClick={() => setRegion(value as RegionMode)}>{label}<i /></button>
            ))}
          </div>
          <label className="atlas-open-switch">
            <span><b>신청 가능만</b><small>현재 접수 중</small></span>
            <input type="checkbox" checked={openOnly} onChange={(event) => setOpenOnly(event.target.checked)} />
            <i />
          </label>
          <button className="atlas-reset" type="button" onClick={resetFilters}>필터 초기화 ↺</button>
        </aside>

        <section className="atlas-stage" aria-labelledby="stage-heading">
          <header className="atlas-stage-header">
            <div>
              <span>{view === "galaxy" ? "POLICY GALAXY" : "POLICY REGISTRY"}</span>
              <h2 id="stage-heading">{view === "galaxy" ? "정책 은하" : "정책 대장"}<small>{visiblePolicies.length}개 결과</small></h2>
            </div>
            <div className="atlas-view-toggle" role="group" aria-label="보기 방식">
              <button type="button" className={view === "galaxy" ? "active" : ""} aria-pressed={view === "galaxy"} onClick={() => setView("galaxy")}><i className="galaxy-icon" />은하</button>
              <button type="button" className={view === "registry" ? "active" : ""} aria-pressed={view === "registry"} onClick={() => setView("registry")}><i className="registry-icon" />대장</button>
            </div>
          </header>
          <div className={`atlas-stage-body view-${view}`}>
            {view === "galaxy"
              ? <PolicyGalaxy visiblePolicies={visiblePolicies} focusedId={focusedPolicy.id} onFocus={setFocusedId} />
              : <PolicyRegistry visiblePolicies={visiblePolicies} onFocus={setFocusedId} />}
          </div>
          <footer className="atlas-stage-footer">
            <span><i /> 기준일 {snapshot.basisDate.replaceAll("-", ".")}</span>
            <span>중앙·지방 정책을 정책 패밀리 단위로 집계</span>
            <Link href="/methodology">집계 기준 ↗</Link>
          </footer>
        </section>

        <aside className="atlas-live-rail" aria-label="선택 정책과 실시간 변화">
          <section className="atlas-focus-card">
            <header><span>FOCUS</span><b>{focusedPolicy.id}</b></header>
            <div className="atlas-focus-tags"><span>{focusedPolicy.category}</span><span>{focusedPolicy.region}</span><em className={`state-${focusedPolicy.status}`}><i />{formatPolicyStatus(focusedPolicy.status)}</em></div>
            <h2>{focusedPolicy.officialName}</h2>
            <p>{focusedPolicy.summary}</p>
            <dl>
              <div><dt>지원</dt><dd>{focusedPolicy.benefit}</dd></div>
              <div><dt>기관</dt><dd>{focusedPolicy.leadOrganization}</dd></div>
              <div><dt>기간</dt><dd>{focusedPolicy.applicationPeriod}</dd></div>
            </dl>
            <Link href={`/policy/${focusedPolicy.slug}`}>정책 상세 열기 <span>↗</span></Link>
          </section>
          <section className="atlas-change-stream">
            <header><div><span className="live-pulse" />LIVE CHANGE</div><Link href="/changes">전체 ↗</Link></header>
            <h2>오늘의 정책 변화</h2>
            <div>
              {changes.slice(0, 5).map((change) => {
                const policy = policies.find((item) => item.id === change.policyId);
                return (
                  <Link href={`/policy/${policy?.slug ?? ""}`} key={change.id}>
                    <time>{new Date(change.detectedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" })}</time>
                    <span><b>{change.type}</b>{policy?.officialName}</span>
                    <i>↗</i>
                  </Link>
                );
              })}
            </div>
          </section>
        </aside>
      </section>

      <section className="atlas-source-dock" aria-label="공식 데이터 연결 상태">
        <div><span>OFFICIAL DATA PIPELINE</span><b>공식 원천 연결</b></div>
        {officialSources.map((source) => (
          <Link href="/admin" key={source.id}>
            <i /><span><b>{source.name.replace(" Open API 제공목록", "")}</b><small>운영 키 연결 대기</small></span><em>KEY WAIT</em>
          </Link>
        ))}
        <Link className="atlas-admin-link" href="/admin">수집 관제실 <span>↗</span></Link>
      </section>

      <section className="atlas-quick-links" aria-label="주요 분석 도구">
        <Link href="/changes"><span>01 · CHANGE LOG</span><strong>변화 추적</strong><p>자격·지원·기간의 전후 차이를 원문과 함께 봅니다.</p><b>{pulse.detectedToday}건 오늘 감지 ↗</b></Link>
        <Link href="/map"><span>02 · REGIONAL MAP</span><strong>지역 지도</strong><p>전국 공통정책과 17개 시·도의 지역정책을 비교합니다.</p><b>{regions.length}개 시·도 ↗</b></Link>
        <Link href="/compare"><span>03 · COMPARE</span><strong>정책 비교</strong><p>유사 정책의 대상·지원·신청조건을 나란히 검토합니다.</p><b>최대 3개 비교 ↗</b></Link>
        <Link href="/indicators"><span>04 · OBSERVATORY</span><strong>청년지표</strong><p>정책 변화와 인구·고용·주거 지표의 흐름을 연결합니다.</p><b>12개 핵심지표 ↗</b></Link>
      </section>
    </div>
  );
}
