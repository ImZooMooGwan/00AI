import type { Metadata } from "next";
import { SubpageFrame } from "@/components/SubpageFrame";
import { changes, policies, snapshot, sources } from "@/lib/data";

export const metadata: Metadata = { title: "데이터 다운로드" };

export default function DownloadsPage() { return <SubpageFrame eyebrow="OPEN DATA RELEASE · 2026.08.24" title="데이터 다운로드" description="정책 레지스트리와 변경 이벤트를 버전·기준일·검색조건·출처와 함께 내려받습니다." aside={<dl><div><dt>릴리스</dt><dd>{snapshot.datasetVersion}</dd></div><div><dt>정책</dt><dd>{policies.length}</dd></div><div><dt>변경 이벤트</dt><dd>{changes.length}</dd></div><div><dt>출처</dt><dd>{sources.length}</dd></div></dl>}><div className="release-card"><div><span className="release-state"><i /> LATEST RELEASE</span><h2>Y-HUB Dataset 2026.08.24</h2><p>최초 공개 MVP 스냅샷 · 공식 출처 연결과 검증상태 포함</p></div><dl><div><dt>dataset_version</dt><dd>{snapshot.datasetVersion}</dd></div><div><dt>generated_at</dt><dd>{snapshot.generatedAt}</dd></div><div><dt>record_count</dt><dd>{policies.length}</dd></div><div><dt>source_count</dt><dd>{sources.length}</dd></div></dl></div><div className="download-grid"><a href="/api/download?format=csv"><span>.CSV</span><h3>정책 레지스트리</h3><p>UTF-8 BOM · 스프레드시트 호환</p><b>내려받기 ↓</b></a><a href="/api/download?format=json"><span>.JSON</span><h3>전체 데이터 패키지</h3><p>정책·변경·출처·지표 메타데이터</p><b>내려받기 ↓</b></a><a href="/feed/changes"><span>.XML</span><h3>변경 RSS 피드</h3><p>최신 변경 이벤트 구독</p><b>피드 열기 ↗</b></a><a href="/api"><span>3.1</span><h3>OpenAPI 문서</h3><p>API v1 엔드포인트와 메타데이터</p><b>문서 보기 ↗</b></a></div></SubpageFrame>; }

