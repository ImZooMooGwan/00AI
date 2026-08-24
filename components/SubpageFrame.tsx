import type { ReactNode } from "react";
import { DataStamp } from "./DataStamp";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

export function SubpageFrame({ eyebrow, title, description, children, aside }: { eyebrow: string; title: string; description: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="site-root">
      <a className="skip-link" href="#main">본문 바로가기</a>
      <SiteHeader />
      <main className="subpage shell" id="main">
        <header className="page-hero">
          <div><span className="eyebrow cyan">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
          <aside className="page-hero-aside">{aside ?? <><DataStamp /><dl><div><dt>공개 원칙</dt><dd>원천·기준일·검증상태 표시</dd></div><div><dt>데이터 형태</dt><dd>정책 패밀리 기준</dd></div></dl></>}</aside>
        </header>
        <div className="page-content">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}

