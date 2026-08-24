import type { Metadata } from "next";
import { CompareTool } from "@/components/CompareTool";
import { SubpageFrame } from "@/components/SubpageFrame";

export const metadata: Metadata = { title: "정책 비교", description: "최대 3개 청년정책의 대상·혜택·기간·기관·근거를 나란히 비교합니다." };

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const params = await searchParams;
  return <SubpageFrame eyebrow="POLICY COMPARISON MATRIX" title="정책 비교" description="최대 3개 정책의 대상·혜택·기간·기관·지역·검증상태를 같은 기준으로 비교합니다."><CompareTool initialIds={params.ids?.split(",").filter(Boolean) ?? []} /></SubpageFrame>;
}

