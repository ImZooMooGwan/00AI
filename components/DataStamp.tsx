import { snapshot } from "@/lib/data";

export function DataStamp({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "data-stamp compact" : "data-stamp"}>
      <span className="live-dot" aria-hidden="true" />
      <span><b>데이터 기준</b> {snapshot.basisDate}</span>
      {!compact && <span><b>버전</b> {snapshot.datasetVersion}</span>}
    </div>
  );
}

