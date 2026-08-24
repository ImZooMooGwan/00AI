import type { Metadata } from "next";
import { McpConnectionCard } from "@/components/McpConnectionCard";
import { SyncControl } from "@/components/SyncControl";
import { SubpageFrame } from "@/components/SubpageFrame";
import {
  getIngestionStatus,
  getRecentRuns,
} from "@/lib/ingestion-store";
import { changes, policies, sources } from "@/lib/data";

export const metadata: Metadata = { title: "수집·검증 운영실" };
export const dynamic = "force-dynamic";

const STATE_LABELS = {
  ready: "수집 준비",
  running: "수집 중",
  succeeded: "정상",
  partial: "부분 성공",
  key_required: "운영 키 필요",
  failed: "오류",
} as const;

export default async function AdminPage() {
  const status = await getIngestionStatus();
  const recentRuns = status.storage === "d1" ? await getRecentRuns(8) : [];
  const configured = status.connectors.filter((connector) => connector.keyConfigured).length;
  const healthy = status.connectors.filter((connector) =>
    ["ready", "succeeded", "partial"].includes(connector.state),
  ).length;

  return (
    <SubpageFrame
      eyebrow="INGESTION OPS · D1 PERSISTENCE"
      title="수집·검증 운영실"
      description="공식 API 응답을 영속 저장하고, 이전 스냅샷과 달라진 레코드를 검토 후보로 분리합니다. 운영 키는 화면과 소스에 노출하지 않습니다."
      aside={
        <dl>
          <div><dt>영속 저장소</dt><dd>{status.storage === "d1" ? "D1 연결" : "연결 대기"}</dd></div>
          <div><dt>운영 키</dt><dd>{configured}/3</dd></div>
          <div><dt>수집 레코드</dt><dd>{status.recordCount.toLocaleString("ko-KR")}건</dd></div>
          <div><dt>변경 후보</dt><dd>{status.pendingChangeCount.toLocaleString("ko-KR")}건</dd></div>
        </dl>
      }
    >
      <div className="admin-metrics">
        <article><span>영속 저장소</span><strong>{status.storage === "d1" ? "ON" : "—"}</strong><small>Cloudflare D1</small></article>
        <article><span>정상 Connector</span><strong>{healthy}</strong><small>총 3개 공식 원천</small></article>
        <article><span>수집 실행</span><strong>{status.runCount}</strong><small>감사 가능한 실행이력</small></article>
        <article><span>검토 대기</span><strong>{status.pendingChangeCount}</strong><small>자동 감지 Diff</small></article>
      </div>

      {configured < 3 ? (
        <div className="notice-bar ingestion-notice">
          <b>운영 키 연결 대기</b>
          <span>온통청년·KOSIS·국가법령정보에서 발급한 키를 배포 환경에 등록하면 코드 변경 없이 수집이 시작됩니다. D1 저장과 변경감지 구조는 활성화되어 있습니다.</span>
        </div>
      ) : null}

      <McpConnectionCard variant="ops" />

      <section className="ingestion-panel" aria-labelledby="connector-title">
        <header>
          <div><span>OFFICIAL SOURCE CONNECTORS</span><h2 id="connector-title">공식 원천 연결 상태</h2></div>
          <SyncControl disabled={status.storage !== "d1"} />
        </header>
        <div className="connector-grid">
          {status.connectors.map((connector) => (
            <article className={`connector-card state-${connector.state}`} key={connector.id}>
              <div className="connector-heading">
                <span className="connector-signal" aria-hidden="true" />
                <b>{connector.name}</b>
                <em>{STATE_LABELS[connector.state]}</em>
              </div>
              <p>{connector.organization}</p>
              <dl>
                <div><dt>수집주기</dt><dd>{connector.cadence}</dd></div>
                <div><dt>최근 성공</dt><dd>{formatDate(connector.lastSuccessAt)}</dd></div>
                <div><dt>최근 건수</dt><dd>{connector.lastRecordCount.toLocaleString("ko-KR")}건</dd></div>
                <div><dt>인증</dt><dd>{connector.keyConfigured ? "비밀 키 연결" : connector.authEnvKey}</dd></div>
              </dl>
              {connector.lastError ? <small>{connector.lastError}</small> : null}
              <a href={connector.docsUrl} target="_blank" rel="noreferrer">공식 API 명세 ↗</a>
            </article>
          ))}
        </div>
      </section>

      <section className="run-ledger" aria-labelledby="run-ledger-title">
        <header><span>COLLECTION RUN LEDGER</span><h2 id="run-ledger-title">최근 수집 실행</h2></header>
        {recentRuns.length ? (
          <div className="run-list">
            {recentRuns.map((run) => (
              <div key={String(run.id)}>
                <b>{String(run.source_id)}</b>
                <span>{String(run.status)}</span>
                <time>{formatDate(String(run.started_at))}</time>
                <em>수집 {Number(run.fetched_count).toLocaleString("ko-KR")} · 신규 {Number(run.inserted_count).toLocaleString("ko-KR")} · 변경 {Number(run.updated_count).toLocaleString("ko-KR")}</em>
              </div>
            ))}
          </div>
        ) : <p className="empty-ledger">아직 실행 이력이 없습니다. 운영 키 연결 후 첫 동기화를 실행하세요.</p>}
      </section>

      <div className="review-workspace">
        <header><span>CHANGE REVIEW · {changes[0].id}</span><b>{policies.find((policy) => policy.id === changes[0].policyId)?.officialName}</b><em>읽기 전용</em></header>
        <div>
          <section><span>변경 전 데이터</span><pre>{JSON.stringify({ field: changes[0].field, value: changes[0].previousValue }, null, 2)}</pre></section>
          <section><span>공식 원문</span><div className="source-document"><b>{sources.find((source) => source.id === changes[0].sourceId)?.name}</b><p>공식 문서 원문은 서버에서 수집하고, 이 화면에는 검토에 필요한 인용 범위와 해시만 표시합니다.</p><i>수집 이력·원문 해시 영속 보존</i></div></section>
          <section><span>변경 후 데이터</span><pre>{JSON.stringify({ field: changes[0].field, value: changes[0].currentValue }, null, 2)}</pre></section>
        </div>
        <footer><button disabled>기각</button><button disabled>수정 후 승인</button><button disabled>승인</button><span>검토 승인 워크플로는 다음 운영 단계에서 활성화</span></footer>
      </div>
    </SubpageFrame>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "아직 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}
