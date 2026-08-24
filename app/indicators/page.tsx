import type { Metadata } from "next";
import { SubpageFrame } from "@/components/SubpageFrame";
import { getSource, indicators } from "@/lib/data";

export const metadata: Metadata = { title: "청년지표 관측소" };

export default function IndicatorsPage() {
  return <SubpageFrame eyebrow="YOUTH OBSERVATORY · 12 INDICATORS" title="청년지표 관측소" description="인구·이동·고용·소득·주거·창업·건강 지표를 정책과 연결합니다. 원천값이 없을 때는 임의 숫자 대신 연결 상태를 보여줍니다." aside={<dl><div><dt>지표 메타데이터</dt><dd>{indicators.length}개</dd></div><div><dt>스냅샷 연결</dt><dd>{indicators.filter((i) => i.status === "snapshot").length}개</dd></div><div><dt>API 키 필요</dt><dd>{indicators.filter((i) => i.status === "key_required").length}개</dd></div><div><dt>주요 원천</dt><dd>KOSIS</dd></div></dl>}>
    <div className="notice-bar"><b>정직한 빈 상태</b><span>KOSIS 인증키가 연결되기 전에는 실제 통계값처럼 보이는 데모 숫자를 만들지 않습니다. 메타데이터와 연결 준비상태만 공개합니다.</span></div>
    <div className="indicator-catalog">{indicators.map((indicator, index) => { const source = getSource(indicator.sourceId); return <article id={indicator.id} key={indicator.id}><header><span>{String(index + 1).padStart(2,"0")}</span><em className={`data-state ${indicator.status}`}>{indicator.status === "key_required" ? "API KEY REQUIRED" : "METADATA CONNECTED"}</em></header><h2>{indicator.name}</h2><p>{indicator.category} · 단위 {indicator.unit}</p><div className="indicator-empty"><span>{indicator.status === "key_required" ? "원천값 연결 대기" : "검증 스냅샷 준비"}</span><i style={{ width: `${28 + index * 4}%` }} /></div><dl><div><dt>통계표</dt><dd>{indicator.tableName}</dd></div><div><dt>작성기관</dt><dd>{indicator.organization}</dd></div><div><dt>공표주기</dt><dd>{indicator.frequency}</dd></div><div><dt>기준일</dt><dd>{indicator.basisDate}</dd></div></dl><p className="limit-text">한계: {indicator.limitations}</p>{source && <a href={source.url} target="_blank" rel="noreferrer">공식 통계 원천 ↗</a>}</article>; })}</div>
  </SubpageFrame>;
}

