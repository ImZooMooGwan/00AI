import type { Metadata } from "next";
import { ChangeExplorer } from "@/components/ChangeExplorer";
import { SubpageFrame } from "@/components/SubpageFrame";
import { changes } from "@/lib/data";

export const metadata: Metadata = { title: "정책 변경 피드", description: "청년정책의 신규·변경·모집·종료 이벤트를 전후 값과 공식 근거로 추적합니다." };

export default function ChangesPage() {
  return (
    <SubpageFrame eyebrow="CHANGE STREAM · FIELD-LEVEL DIFF" title="정책 변경 피드" description="최신 정보로 덮어쓰지 않습니다. 무엇이, 언제, 어떻게 바뀌었는지 변경 전후 값과 공식 근거를 함께 보존합니다." aside={<dl><div><dt>변경 이벤트</dt><dd>{changes.length}개</dd></div><div><dt>오늘 감지</dt><dd>{changes.filter((c) => c.detectedAt.startsWith("2026-08-24")).length}개</dd></div><div><dt>검증 완료</dt><dd>{changes.filter((c) => c.verificationStatus === "verified").length}개</dd></div><div><dt>갱신 방식</dt><dd>원천 주기별 수집</dd></div></dl>}>
      <div className="notice-bar"><b>두 단계 공개</b><span>자동 감지는 빠르게 공개하되 시민의 자격판단에는 사용하지 않습니다. 검증 완료 이벤트만 기본 정책정보에 반영합니다.</span></div>
      <ChangeExplorer />
    </SubpageFrame>
  );
}

