import type { Metadata } from "next";
import Link from "next/link";
import { SubpageFrame } from "@/components/SubpageFrame";
import { policies, snapshot } from "@/lib/data";

export const metadata: Metadata = { title: "정책 아카이브" };

export default async function ArchivePage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const available = date === snapshot.basisDate;
  return <SubpageFrame eyebrow="TIME-SLICE ARCHIVE" title={`${date} 기준 정책`} description="선택한 시점에 관측된 정책 상태를 재현합니다. 아직 최초 MVP 스냅샷만 제공하며 이후 릴리스마다 시점이 추가됩니다."><div className="release-card"><div><span className="release-state"><i /> {available ? "SNAPSHOT AVAILABLE" : "SNAPSHOT NOT AVAILABLE"}</span><h2>{available ? `${policies.length}개 정책 레코드` : "해당 시점의 스냅샷이 없습니다."}</h2><p>{available ? `데이터 버전 ${snapshot.datasetVersion}` : "가장 가까운 공개 릴리스를 이용하세요."}</p></div><div>{available ? <><p>정책 패밀리·프로그램·모집회차·검증상태를 현재 스키마로 제공합니다.</p><Link className="button" href={`/api/download?format=json&as_of=${date}`}>스냅샷 받기</Link></> : <Link className="button" href={`/archive/${snapshot.basisDate}`}>최신 스냅샷 보기</Link>}</div></div></SubpageFrame>;
}

