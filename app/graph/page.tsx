import type { Metadata } from "next";
import { PolicyConstellation } from "@/components/DashboardVisuals";
import { SubpageFrame } from "@/components/SubpageFrame";

export const metadata: Metadata = { title: "정책 관계지도" };

const relations = [["COMPLEMENTARY", "함께 이용 가능한 정책", "검토 필요"], ["SEQUENTIAL", "선행·후행 관계", "검토 필요"], ["REGIONAL_VARIANT", "중앙정책의 지역형 사업", "부분 검증"], ["SAME_TARGET", "대상집단 유사", "자동 후보"], ["SAME_AGENCY", "동일 기관 운영", "구조화 완료"], ["PARENT_CHILD", "상위정책과 세부사업", "구조화 완료"]];

export default function GraphPage() {
  return <SubpageFrame eyebrow="POLICY GRAPH · EXPLAINABLE RELATIONS" title="정책 관계지도" description="정책·기관·지역·분야의 연결을 2D 관계망으로 탐색합니다. AI가 제안한 관계는 검증된 관계와 분리합니다."><PolicyConstellation /><div className="relation-ledger"><div className="section-heading"><span className="eyebrow violet">RELATION LEDGER</span><h2>관계 의미체계</h2></div>{relations.map(([code, label, status]) => <article key={code}><code>{code}</code><h3>{label}</h3><span>{status}</span></article>)}</div></SubpageFrame>;
}

