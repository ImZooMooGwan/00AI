import type { Metadata } from "next";
import Link from "next/link";
import { KoreaCartogram } from "@/components/DashboardVisuals";
import { SubpageFrame } from "@/components/SubpageFrame";
import { policies, regions } from "@/lib/data";

export const metadata: Metadata = { title: "대한민국 정책지도" };

export default function MapPage() {
  return <SubpageFrame eyebrow="POLICY MAP · 17 REGIONS" title="대한민국 정책지도" description="시·도별로 중앙정부 공통정책과 지역 고유정책을 함께 보여줍니다. 지금은 정책 레지스트리 수를 비교하며, 통계 API 연결 후 청년지표 레이어가 추가됩니다."><KoreaCartogram /><div className="region-table-wrap"><table className="data-table"><caption>17개 시도 정책 연결 현황</caption><thead><tr><th>지역</th><th>전국 공통</th><th>지역 고유</th><th>합계</th><th>탐색</th></tr></thead><tbody>{regions.map((region) => <tr key={region.code}><th scope="row">{region.name}</th><td>{policies.filter((p) => p.regionCode === "00").length}</td><td>{region.localCount}</td><td>{region.policyCount}</td><td><Link href={`/policies?region=${region.code}`}>정책 보기 →</Link></td></tr>)}</tbody></table></div></SubpageFrame>;
}

