import type { Metadata } from "next";
import { SubpageFrame } from "@/components/SubpageFrame";
import { VerificationBadge } from "@/components/StatusBadge";
import { policies, sources } from "@/lib/data";

export const metadata: Metadata = { title: "공개 검증대장" };

const issues = [
  ["YH-ISS-001", "LATEST_ROUND_REQUIRED", "청년문화예술패스", "최신 모집회차 확인 필요", "review_required"],
  ["YH-ISS-002", "BUDGET_UNCONFIRMED", "청년월세 특별지원", "연도별 세부예산 연결 전", "review_required"],
  ["YH-ISS-003", "LEGAL_BASIS_UNCONFIRMED", "대전 청년월세지원사업", "조례·사업지침 조문 연결 필요", "partially_verified"],
  ["YH-ISS-004", "PROCESS_NOT_PUBLIC", "청년마음건강지원사업", "지역별 세부 심사절차 차이", "partially_verified"],
] as const;

export default function VerificationPage() {
  const verified = policies.filter((p) => p.verificationStatus === "verified").length;
  const partial = policies.filter((p) => p.verificationStatus === "partially_verified").length;
  const review = policies.filter((p) => p.verificationStatus === "review_required").length;
  return <SubpageFrame eyebrow="VERIFICATION LEDGER · PUBLIC BY DEFAULT" title="공개 검증대장" description="확인되지 않은 정보를 감추지 않습니다. 무엇이 확인됐고, 무엇이 비어 있으며, 왜 검토가 필요한지 공개합니다." aside={<dl><div><dt>검증 완료</dt><dd>{verified}개</dd></div><div><dt>부분 검증</dt><dd>{partial}개</dd></div><div><dt>검증 필요</dt><dd>{review}개</dd></div><div><dt>공식 출처</dt><dd>{sources.length}개</dd></div></dl>}>
    <div className="verification-pulse"><article><span>전체 정책</span><strong>{policies.length}</strong><i style={{width:"100%"}} /></article><article><span>검증 완료</span><strong>{verified}</strong><i className="green" style={{width:`${verified / policies.length * 100}%`}} /></article><article><span>부분 검증</span><strong>{partial}</strong><i className="amber" style={{width:`${partial / policies.length * 100}%`}} /></article><article><span>검증 필요</span><strong>{review}</strong><i className="violet" style={{width:`${review / policies.length * 100}%`}} /></article></div>
    <div className="quality-dimensions"><div><span>01</span><h3>출처 신뢰도</h3><p>공식 원문·공식 포털·통계·법령의 우선순위를 분리합니다.</p></div><div><span>02</span><h3>데이터 완전성</h3><p>대상·혜택·기간·예산·절차의 필드 충족도를 따로 봅니다.</p></div><div><span>03</span><h3>최신성</h3><p>원천 갱신일·수집일·검토일을 각각 기록합니다.</p></div><div><span>04</span><h3>검증 상태</h3><p>자동 감지와 사람 검토를 모양과 문구로 구분합니다.</p></div></div>
    <div className="issue-table-wrap"><table className="data-table issue-table"><caption>현재 공개 검증 이슈</caption><thead><tr><th>ID</th><th>이슈 유형</th><th>대상 정책</th><th>공개 사유</th><th>상태</th></tr></thead><tbody>{issues.map(([id,type,policy,reason,status]) => <tr key={id}><td><code>{id}</code></td><td><code>{type}</code></td><td>{policy}</td><td>{reason}</td><td><VerificationBadge status={status} /></td></tr>)}</tbody></table></div>
  </SubpageFrame>;
}

