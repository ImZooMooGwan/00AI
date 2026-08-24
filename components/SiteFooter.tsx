import Link from "next/link";
import { snapshot } from "@/lib/data";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div>
          <Link className="brand footer-brand" href="/">
            <span className="brand-signal" aria-hidden="true"><i /></span>
            <span><b>Y-HUB</b><small>Youth Policy Data Hub</small></span>
          </Link>
          <p>정책의 발표가 아니라, 정책의 변화를 기록합니다.</p>
        </div>
        <div className="footer-links" aria-label="데이터 정보">
          <Link href="/methodology">방법론</Link>
          <Link href="/sources">출처</Link>
          <Link href="/verification">검증대장</Link>
          <Link href="/api">Open API</Link>
          <Link href="/admin">관리자 데모</Link>
        </div>
        <div className="footer-meta">
          <span>데이터 버전 {snapshot.datasetVersion}</span>
          <span>기준일 {snapshot.basisDate}</span>
          <span>오픈소스 MVP · 공식 서비스 아님</span>
        </div>
      </div>
    </footer>
  );
}

