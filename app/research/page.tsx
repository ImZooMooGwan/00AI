import type { Metadata } from "next";
import Link from "next/link";
import { SubpageFrame } from "@/components/SubpageFrame";
import { policies, snapshot } from "@/lib/data";

export const metadata: Metadata = { title: "Research Lab" };

export default function ResearchPage() {
  return <SubpageFrame eyebrow="RESEARCH LAB · REPRODUCIBLE DATA" title="Research Lab" description="검색조건과 데이터 버전을 함께 저장해 같은 결과를 다시 만들고, CSV·JSON으로 내려받아 인용합니다." aside={<dl><div><dt>데이터 버전</dt><dd>{snapshot.datasetVersion}</dd></div><div><dt>정책 레코드</dt><dd>{policies.length}</dd></div><div><dt>지원 형식</dt><dd>CSV · JSON</dd></div><div><dt>라이선스</dt><dd>원천별 확인</dd></div></dl>}>
    <div className="research-workbench"><section><span className="eyebrow cyan">QUERY BUILDER</span><h2>재현 가능한 데이터 추출</h2><form className="research-form"><label>기준시점<input type="date" defaultValue="2026-08-24" /></label><label>지역<select defaultValue="all"><option value="all">전체</option><option>전국</option><option>대전</option></select></label><label>정책분야<select><option>전체</option><option>일자리</option><option>주거</option><option>창업</option></select></label><label>검증상태<select><option>전체</option><option>검증 완료</option><option>부분 검증</option></select></label></form><div className="query-preview"><span>REPRODUCIBLE URL</span><code>/research?as_of=2026-08-24&amp;region=all&amp;verification=all</code></div></section><aside><span className="eyebrow green">RESULT</span><strong>{policies.length}</strong><p>정책 패밀리 레코드</p><dl><div><dt>프로그램</dt><dd>{policies.length}</dd></div><div><dt>모집회차</dt><dd>{policies.length}</dd></div><div><dt>출처 포함</dt><dd>100%</dd></div></dl></aside></div>
    <div className="export-grid"><Link href="/api/download?format=csv"><span>CSV</span><h3>정책 데이터</h3><p>스프레드시트와 통계도구에서 바로 사용</p><b>내려받기 ↓</b></Link><Link href="/api/download?format=json"><span>JSON</span><h3>정책 데이터</h3><p>기계가 읽을 수 있는 메타데이터 포함</p><b>내려받기 ↓</b></Link><Link href="/api/v1/changes"><span>API</span><h3>변경 이벤트</h3><p>필드 Diff와 검증상태를 JSON으로 조회</p><b>API 열기 ↗</b></Link></div>
    <div className="citation-box"><span className="eyebrow amber">CITATION</span><blockquote>Y-HUB 청년정책데이터허브, 「대한민국 청년정책 데이터셋」, 버전 {snapshot.datasetVersion}, 조회일 {snapshot.basisDate}.</blockquote><button type="button">인용문 복사</button></div>
  </SubpageFrame>;
}
