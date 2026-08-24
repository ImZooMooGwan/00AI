import type { Metadata } from "next";
import { SubpageFrame } from "@/components/SubpageFrame";
import { changes, policies, sources } from "@/lib/data";

export const metadata: Metadata = { title: "관리자 검토화면 데모" };

export default function AdminPage() {
  return <SubpageFrame eyebrow="ADMIN REVIEW · READ-ONLY DEMO" title="관리자 검토화면" description="공개 MVP에서는 읽기 전용 데모만 제공합니다. 승인·수정·기각과 정정 이력은 인증·권한·감사로그가 연결된 뒤 활성화합니다." aside={<dl><div><dt>권한</dt><dd>읽기 전용 데모</dd></div><div><dt>검토 대기</dt><dd>{policies.filter((p) => p.verificationStatus !== "verified").length}개</dd></div><div><dt>변경 후보</dt><dd>{changes.length}개</dd></div><div><dt>출처 오류</dt><dd>0개</dd></div></dl>}>
    <div className="admin-metrics"><article><span>정상 Connector</span><strong>3</strong><small>스냅샷 모드</small></article><article><span>API 키 대기</span><strong>3</strong><small>온통청년·KOSIS·법령</small></article><article><span>변경 후보</span><strong>{changes.length}</strong><small>필드 Diff</small></article><article><span>검토 대기</span><strong>{policies.filter((p) => p.verificationStatus !== "verified").length}</strong><small>부분·필요</small></article></div>
    <div className="review-workspace"><header><span>CHANGE REVIEW · {changes[0].id}</span><b>{policies.find((p) => p.id === changes[0].policyId)?.officialName}</b><em>읽기 전용</em></header><div><section><span>변경 전 데이터</span><pre>{JSON.stringify({ field: changes[0].field, value: changes[0].previousValue }, null, 2)}</pre></section><section><span>공식 원문</span><div className="source-document"><b>{sources.find((s) => s.id === changes[0].sourceId)?.name}</b><p>공식 문서 원문은 보안상 서버에서 수집하고, 이 화면에는 검토에 필요한 인용 범위만 표시합니다.</p><i>원천 수집 2026.08.24</i></div></section><section><span>변경 후 데이터</span><pre>{JSON.stringify({ field: changes[0].field, value: changes[0].currentValue }, null, 2)}</pre></section></div><footer><button disabled>기각</button><button disabled>수정 후 승인</button><button disabled>승인</button><span>인증·감사로그 연결 후 활성화</span></footer></div>
  </SubpageFrame>;
}

