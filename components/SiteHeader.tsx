import Link from "next/link";

const nav = [
  ["변화", "/changes"],
  ["정책", "/policies"],
  ["지표", "/indicators"],
  ["지도", "/map"],
  ["관계", "/graph"],
  ["데이터랩", "/research"],
] as const;

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link className="brand" href="/" aria-label="Y-HUB 홈">
          <span className="brand-signal" aria-hidden="true"><i /></span>
          <span><b>Y-HUB</b><small>Youth Policy Data Hub</small></span>
        </Link>
        <nav className="primary-nav" aria-label="주요 메뉴">
          {nav.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
        </nav>
        <div className="header-actions">
          <Link className="icon-link" href="/verification" title="검증대장" aria-label="검증대장">✓</Link>
          <Link className="button button-small button-ghost" href="/downloads">데이터 받기</Link>
        </div>
      </div>
    </header>
  );
}

