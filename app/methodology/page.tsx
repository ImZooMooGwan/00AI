import type { Metadata } from "next";
import { SubpageFrame } from "@/components/SubpageFrame";

export const metadata: Metadata = { title: "방법론" };

const methods = [
  ["01", "정책 단위 식별", "정책 패밀리 → 프로그램 → 모집회차 → 버전 → 원천문서로 분리합니다."],
  ["02", "원천 우선순위", "법령·고시, 최신 모집공고, 공식 API·페이지, 보도자료, 통계 순으로 충돌을 판단합니다."],
  ["03", "변경 감지", "원문 스냅샷의 해시와 정규화 필드를 비교해 이벤트 후보를 만듭니다."],
  ["04", "영향도 계산", "자격·지원금·기한·종료·지역·절차 변화에 공개된 규칙을 적용합니다."],
  ["05", "사람 검증", "AI 구조화 결과는 후보이며, 시민 의사결정에 큰 영향을 주는 필드는 원문 대조 후 반영합니다."],
  ["06", "재현성", "데이터 버전·생성시점·검색조건·원천 버전·건수·체크섬을 함께 제공합니다."],
];

export default function MethodologyPage() { return <SubpageFrame eyebrow="METHODOLOGY · OPEN RULES" title="방법론" description="Y-HUB가 어떤 정보를 수집하고, 어떻게 구조화하며, 무엇을 검증 완료라고 부르는지 공개합니다."><div className="method-flow"><span>BRONZE<small>원천 보존</small></span><i>→</i><span>SILVER<small>정제·표준화</small></span><i>→</i><span>GOLD<small>서비스 데이터</small></span><i>→</i><span>EVENT<small>변경 생성</small></span></div><div className="method-list">{methods.map(([n,title,copy]) => <article key={n}><span>{n}</span><h2>{title}</h2><p>{copy}</p></article>)}</div><div className="ai-boundary"><div><span className="eyebrow green">AI CAN</span><h3>구조화·비교·설명</h3><p>공식 문서에서 정책명·대상·혜택·기간을 추출하고 변경 전후를 쉬운 말로 설명합니다.</p></div><div><span className="eyebrow amber">AI CANNOT</span><h3>상상·확정·유권해석</h3><p>공식 원천에 없는 정책이나 수치를 만들고 신청 가능 여부 또는 법적 해석을 확정하지 않습니다.</p></div></div></SubpageFrame>; }

