import Link from "next/link";
import { snapshot } from "@/lib/data";

const nav = [
  ["정책 대장", "/policies"],
  ["변화 추적", "/changes"],
  ["지역 지도", "/map"],
  ["관계 지도", "/graph"],
  ["청년 지표", "/indicators"],
  ["Open API", "/api"],
] as const;

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link className="brand" href="/" aria-label="Y-HUB 홈">
          <span className="brand-signal" aria-hidden="true"><i /></span>
          <span><b>Y-HUB</b><small>청년정책 데이터 지도</small></span>
        </Link>
        <nav className="primary-nav" aria-label="주요 메뉴">
          {nav.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
        </nav>
        <div className="header-actions">
          <span className="header-stamp">기준일 {snapshot.basisDate.replaceAll("-", ".")}</span>
          <Link className="icon-link" href="/verification" title="검증대장" aria-label="검증대장">✓</Link>
          <Link className="button button-small button-ghost" href="/downloads">데이터 받기</Link>
        </div>
      </div>
    </header>
  );
}
