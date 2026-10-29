"use client";

import { useEffect, useMemo, useState } from "react";
import "./admin-hub.css";

type Category = "문서·보고" | "정책·데이터" | "업무지원";
type ServiceHealth = { ok: boolean; detail: string };
type Service = {
  code: string;
  title: string;
  category: Category;
  maturity: "서비스" | "실험실";
  healthKey: string;
  description: string;
  tasks: string[];
  href: string;
  action: string;
};

const services: Service[] = [
  {
    code: "WORKSPACE",
    title: "00AI 업무실",
    category: "문서·보고",
    maturity: "실험실",
    healthKey: "WORKSPACE",
    description: "업무폴더를 바탕으로 의회 요구자료와 보고서 초안을 작성합니다.",
    tasks: ["업무폴더 분석", "요구자료 초안", "결과 다운로드"],
    href: "https://00ai.kr/workspace/",
    action: "업무실 열기",
  },
  {
    code: "HARNESS",
    title: "00AI Harness",
    category: "문서·보고",
    maturity: "실험실",
    healthKey: "HARNESS",
    description: "업무 문서의 근거를 찾아 요청사항과 확인 항목을 정리합니다.",
    tasks: ["문서 검토", "근거 추출", "의회 자료 초안"],
    href: "https://harness.00ai.kr/",
    action: "문서 검토 시작",
  },
  {
    code: "GOV AGENT",
    title: "00AI Gov Agent",
    category: "문서·보고",
    maturity: "실험실",
    healthKey: "GOV_AGENT",
    description: "업무자료는 PC 브라우저에서 처리하며 HASA는 선택해 연결합니다.",
    tasks: ["로컬 자료 탐색", "보고서 초안", "Word·PDF 저장"],
    href: "https://00ai.kr/gov-agent/",
    action: "로컬 에이전트 열기",
  },
  {
    code: "POLICY",
    title: "AI 정책상황실",
    category: "정책·데이터",
    maturity: "서비스",
    healthKey: "POLICY",
    description: "법령과 공공데이터를 바탕으로 정책 대안을 살피고 보고자료를 준비합니다.",
    tasks: ["법령·근거 탐색", "정책 대안 검토", "보고자료 초안"],
    href: "https://policy.00ai.kr/",
    action: "정책 검토 시작",
  },
  {
    code: "Y–HUB",
    title: "청년정책 데이터허브",
    category: "정책·데이터",
    maturity: "서비스",
    healthKey: "YHUB",
    description: "청년정책과 공공데이터를 검색·비교하고 정책 간 관계를 살펴봅니다.",
    tasks: ["정책 검색", "정책 비교", "데이터 탐색"],
    href: "https://yhub.00ai.kr/",
    action: "정책 데이터 탐색",
  },
  {
    code: "TIME",
    title: "초과근무 알람",
    category: "업무지원",
    maturity: "서비스",
    healthKey: "TIME",
    description: "시간 알림과 직급별 예상 수당 계산으로 초과근무 시간을 확인합니다.",
    tasks: ["시간 알림", "예상 수당 계산", "누적 시간 확인"],
    href: "https://otgeunmu-check-alarm.nextrunners-6559.chatgpt.site/",
    action: "초과근무 확인",
  },
];

const categories = ["전체", "문서·보고", "정책·데이터", "업무지원"] as const;

export default function Home() {
  const [category, setCategory] = useState<(typeof categories)[number]>("전체");
  const [query, setQuery] = useState("");
  const [health, setHealth] = useState<Record<string, ServiceHealth>>({});
  const [healthLoading, setHealthLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const checks: Array<[string, ServiceHealth]> = await Promise.all(
        services.map(async (service) => {
          try {
            const response = await fetch(service.href, {
              mode: "no-cors",
              cache: "no-store",
              redirect: "follow",
              signal: AbortSignal.timeout(4000),
            });
            return [service.healthKey, {
              ok: response.type === "opaque" || response.ok,
              detail: response.type === "opaque" ? "서비스 주소 응답 확인" : "웹 화면 응답 정상",
            }] as [string, ServiceHealth];
          } catch {
            return [service.healthKey, { ok: false, detail: "접속 시간 초과 또는 연결 실패" }] as [string, ServiceHealth];
          }
        }),
      );
      try {
        const response = await fetch("/api/services/health", { cache: "no-store" });
        if (response.ok) {
          const data = await response.json() as { service?: ServiceHealth };
          if (data.service) {
            const existing = checks.findIndex(([key]) => key === "YHUB");
            if (existing >= 0) checks[existing] = ["YHUB", data.service];
          }
        }
      } catch {
        // Keep the browser-level Y-HUB address check when the deep health API is unavailable.
      }
      if (active) {
        setHealth(Object.fromEntries(checks));
        setHealthLoading(false);
      }
    };
    void refresh();
    return () => { active = false; };
  }, []);
  const visibleServices = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("ko-KR");
    return services.filter((service) => {
      const matchesCategory = category === "전체" || service.category === category;
      const haystack = [service.title, service.category, service.description, ...service.tasks].join(" ").toLocaleLowerCase("ko-KR");
      return matchesCategory && (!q || haystack.includes(q));
    });
  }, [category, query]);

  return (
    <main className="admin-hub" id="top">
      <a className="hub-skip" href="#service-list">서비스 목록으로 바로가기</a>
      <header className="hub-header">
        <a className="hub-brand" href="#top" aria-label="00AI 행정 도구 첫 화면"><span className="hub-brand-mark">00</span><span>AI<small>PUBLIC WORK TOOLS</small></span></a>
        <nav className="hub-nav" aria-label="주요 메뉴"><a href="#service-list">서비스</a><a href="#use-guide">이용 안내</a></nav>
        <a className="hub-header-link" href="/drop">서비스 배포 <span aria-hidden="true">↗</span></a>
      </header>

      <section className="hub-hero" aria-labelledby="hub-title">
        <div className="hub-hero-inner">
          <div className="hub-hero-copy">
            <p className="hub-eyebrow"><span /> 00AI · 공공업무 도구</p>
            <h1 id="hub-title">행정에 필요한 도구,<br /><em>한곳에서 바로 시작하세요.</em></h1>
            <p className="hub-intro">정책 검토와 문서 작성부터 데이터 탐색과 업무 관리까지.<br className="desktop-only" /> 지금 필요한 업무를 고르면 알맞은 서비스로 연결합니다.</p>
            <a className="hub-primary" href="#service-list">업무 도구 찾기 <span aria-hidden="true">↓</span></a>
          </div>
          <div className="hub-hero-note" aria-label="도구 이용 기준">
            <span className="note-index">00AI / GUIDE</span>
            <strong>AI는 초안과 탐색을 돕습니다.</strong>
            <p>근거와 최신성은 확인하고, 최종 판단과 결재는 담당자가 합니다.</p>
            <a href="#use-guide">안전한 이용 기준 <span aria-hidden="true">→</span></a>
          </div>
        </div>
        <div className="hub-hero-footer"><span>업무 목적에 맞춰 골라 쓰는 공공 AI</span><span>POLICY · DOCUMENTS · DATA · WORK</span></div>
      </section>

      <section className="hub-services" id="service-list" aria-labelledby="service-title">
        <div className="hub-section-heading">
          <div><p className="hub-eyebrow">업무별 서비스</p><h2 id="service-title">무엇을 하시겠어요?</h2><p>서비스 이름보다 지금 하려는 업무를 기준으로 골라보세요.</p></div>
          <div className="hub-count"><strong>{visibleServices.length.toString().padStart(2, "0")}</strong><span>개 도구</span></div>
        </div>

        <div className="hub-controls">
          <div className="hub-filters" role="group" aria-label="업무 분야 선택">
            {categories.map((item) => <button key={item} type="button" className={category === item ? "is-active" : ""} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}
          </div>
          <label className="hub-search"><span aria-hidden="true">⌕</span><span className="sr-only">서비스 검색</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="업무나 서비스 검색" /></label>
        </div>

        {visibleServices.length ? <div className="hub-service-grid">
          {visibleServices.map((service, index) => <article className="hub-service-card" key={service.code}>
            <div className="hub-card-top"><span className="hub-card-code">{service.code}</span><span className={`hub-status ${service.maturity === "서비스" ? "is-live" : "is-lab"}`}><i />{service.maturity}</span></div>
            <div className="hub-card-title-row"><span className="hub-card-number">{String(index + 1).padStart(2, "0")}</span><span className="hub-category">{service.category}</span></div>
            <h3>{service.title}</h3>
            <p className="hub-card-description">{service.description}</p>
            <ul className="hub-task-list">{service.tasks.map((task) => <li key={task}>{task}</li>)}</ul>
            <div className={`hub-health ${healthLoading ? "is-checking" : health[service.healthKey]?.ok ? "is-ready" : "is-failed"}`} role="status" aria-live="polite"><i aria-hidden="true" /><span>{healthLoading ? "서비스 연결 확인 중" : health[service.healthKey]?.detail ?? "연결 상태를 확인할 수 없습니다."}</span></div>
            <a className="hub-card-action" href={service.href} target="_blank" rel="noreferrer"><span>{service.action}</span><span aria-hidden="true">↗</span></a>
          </article>)}
        </div> : <div className="hub-empty"><strong>검색 결과가 없습니다.</strong><p>다른 업무 표현으로 검색하거나 분야를 바꿔보세요.</p></div>}
      </section>

      <section className="hub-use-guide" id="use-guide" aria-labelledby="guide-title">
        <div className="guide-heading"><p className="hub-eyebrow">사용 전 확인</p><h2 id="guide-title">업무에 쓸 때<br /><em>세 가지만 확인하세요.</em></h2></div>
        <div className="guide-list">
          <article><span>01</span><div><h3>민감한 정보는 입력하지 않기</h3><p>개인정보와 비공개 행정자료는 기관의 보안 기준과 서비스 처리 범위를 확인한 뒤 다루세요.</p></div></article>
          <article><span>02</span><div><h3>출처와 수치를 원문에서 확인하기</h3><p>AI가 제시한 법령, 통계, 인용문은 공식 원문과 기준 시점을 다시 확인하세요.</p></div></article>
          <article><span>03</span><div><h3>결과는 검토 후 업무에 반영하기</h3><p>생성된 내용은 참고 초안입니다. 행정상 판단과 대외 발송 전 담당자가 검토하세요.</p></div></article>
        </div>
      </section>

      <footer className="hub-footer">
        <a className="hub-brand footer-brand" href="#top"><span className="hub-brand-mark">00</span><span>AI<small>PUBLIC WORK TOOLS</small></span></a>
        <p>00AI는 공공업무 활용 방식을 실험·개발하는 독립 프로젝트입니다.<br />공식 정부 서비스가 아니며, 각 도구의 운영 상태와 이용 조건을 확인해 주세요.</p>
        <a className="footer-github" href="https://github.com/ImZooMooGwan/00AI" target="_blank" rel="noreferrer">소스 코드 보기 ↗</a>
      </footer>
    </main>
  );
}
