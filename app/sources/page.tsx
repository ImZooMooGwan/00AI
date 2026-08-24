import type { Metadata } from "next";
import { SubpageFrame } from "@/components/SubpageFrame";
import { sources } from "@/lib/data";

export const metadata: Metadata = { title: "공식 데이터 출처" };

export default function SourcesPage() { return <SubpageFrame eyebrow="SOURCE REGISTRY · PROVENANCE" title="공식 데이터 출처" description="정책·통계·법령을 증명하는 공식 원천과 수집 상태를 관리합니다. 민간 자료만으로 정책 데이터를 확정하지 않습니다."><div className="source-registry">{sources.map((source, index) => <article key={source.id}><header><span>{String(index+1).padStart(2,"0")}</span><code>{source.id}</code><em>{source.kind.replace("_", " ")}</em></header><h2>{source.name}</h2><p>{source.organization}</p><dl><div><dt>수집 시각</dt><dd>{source.fetchedAt.replace("T"," ")}</dd></div><div><dt>원천 갱신</dt><dd>{source.sourceUpdatedAt ?? "원천 제공값 없음"}</dd></div><div><dt>이용 조건</dt><dd>{source.license}</dd></div></dl><a href={source.url} target="_blank" rel="noreferrer">공식 원천 열기 ↗</a></article>)}</div></SubpageFrame>; }

