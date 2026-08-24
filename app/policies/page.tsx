import type { Metadata } from "next";
import { PolicyExplorer } from "@/components/PolicyExplorer";
import { SubpageFrame } from "@/components/SubpageFrame";
import { policies } from "@/lib/data";

export const metadata: Metadata = { title: "청년정책 레지스트리", description: "중앙정부와 지역 청년정책을 같은 기준으로 검색하고 비교합니다." };

export default async function PoliciesPage({ searchParams }: { searchParams: Promise<{ q?: string; region?: string }> }) {
  const params = await searchParams;
  return (
    <SubpageFrame eyebrow="POLICY REGISTRY · 30 RECORDS" title="청년정책 레지스트리" description="정책명뿐 아니라 지금 처한 상황, 지역, 자격조건, 지원방식으로 정책을 찾습니다. 정책 패밀리와 연도별 모집회차는 분리해 기록합니다." aside={<dl><div><dt>등록 정책</dt><dd>{policies.length}개</dd></div><div><dt>중앙정부</dt><dd>{policies.filter((p) => p.scope === "national").length}개</dd></div><div><dt>대전</dt><dd>{policies.filter((p) => p.regionCode === "30").length}개</dd></div><div><dt>비교 한도</dt><dd>최대 3개</dd></div></dl>}>
      <div className="notice-bar"><b>개발 스냅샷</b><span>정책 존재와 공식 출처 연결을 우선 검증했습니다. 변동 가능한 신청기간·소득·자격은 원문을 최종 확인하세요.</span></div>
      <PolicyExplorer initialQuery={params.q ?? ""} initialRegion={params.region ?? "all"} />
    </SubpageFrame>
  );
}

